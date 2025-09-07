const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const Decimal = require('decimal.js');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${process.env.PORT}] ${req.method} ${req.originalUrl}`);
  next();
});

// MongoDB connection with retry logic
const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/banktransactions');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    setTimeout(connectMongo, 5000);
  }
};
connectMongo();

// Redis connection with better error handling
let redisClient;
const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379
      }
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
    });
    
    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });
    
    await redisClient.connect();
  } catch (error) {
    console.error('Redis connection failed:', error);
  }
};
connectRedis();

// Transaction Schema
const TransactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  fromAccountNumber: { type: String, required: true },
  toAccountNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'GBP' },
  type: {
    type: String,
    enum: ['transfer', 'payment', 'deposit', 'withdrawal'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'flagged'],
    default: 'pending'
  },
  description: String,
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: String,
    fraudScore: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  processedAt: Date
});

const Transaction = mongoose.model('Transaction', TransactionSchema);

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Fraud detection function
const calculateFraudScore = async (transaction, userId) => {
  let fraudScore = 0;

  // Check transaction amount (high amounts = higher risk)
  if (transaction.amount > 10000) fraudScore += 30;
  else if (transaction.amount > 5000) fraudScore += 15;

  // Check transaction frequency (Redis cache) with error handling
  try {
    if (redisClient && redisClient.isReady) {
      const userTxnKey = `user_txn_count:${userId}`;
      const txnCount = await redisClient.get(userTxnKey) || 0;

      if (parseInt(txnCount) > 10) fraudScore += 25;
      else if (parseInt(txnCount) > 5) fraudScore += 10;

      // Increment transaction count (expire in 1 hour)
      await redisClient.setEx(userTxnKey, 3600, String((parseInt(txnCount, 10) || 0) + 1));
    }
  } catch (error) {
    console.error('Redis operation failed:', error);
    // Continue without Redis-based checks
  }

  // Check for suspicious patterns
  try {
    const recentTxns = await Transaction.find({
      fromAccountNumber: transaction.fromAccountNumber,
      createdAt: { $gte: new Date(Date.now() - 3600000) }
    }).limit(5);

    const sameAmountTxns = recentTxns.filter(txn => txn.amount === transaction.amount);
    if (sameAmountTxns.length >= 3) fraudScore += 40;
  } catch (error) {
    console.error('Database query failed:', error);
  }

  return Math.min(fraudScore, 100);
};

// Audit logging function with better error handling
const logAuditEvent = async (eventType, details, userId) => {
  try {
    await axios.post('http://audit-service:3005/api/audit', {
      eventType,
      serviceSource: 'transaction-service',
      userId,
      details,
      timestamp: new Date().toISOString()
    }, {
      timeout: 5000
    });
  } catch (error) {
    console.error('Audit logging failed:', error.message);
    // Don't fail the transaction if audit logging fails
  }
};

// Routes
app.post('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const { fromAccountNumber, toAccountNumber, amount, type, description } = req.body;

    // Validate input
    if (!fromAccountNumber || !toAccountNumber) {
      return res.status(400).json({ error: 'Account numbers required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!type || !['transfer', 'payment', 'deposit', 'withdrawal'].includes(type)) {
      return res.status(400).json({ error: 'Invalid transaction type' });
    }

    // Create transaction
    const transactionId = 'TXN' + Date.now() + Math.random().toString(36).substr(2, 8).toUpperCase();

    const transaction = new Transaction({
      transactionId,
      fromAccountNumber,
      toAccountNumber,
      amount: new Decimal(amount).toNumber(),
      type,
      description,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Calculate fraud score
    const fraudScore = await calculateFraudScore(transaction, req.user.userId);
    transaction.metadata.fraudScore = fraudScore;

    // Auto-flag high-risk transactions
    if (fraudScore > 70) {
      transaction.status = 'flagged';
      await logAuditEvent('HIGH_RISK_TRANSACTION', {
        transactionId,
        fraudScore,
        amount,
        fromAccountNumber,
        toAccountNumber
      }, req.user.userId);
    }

    await transaction.save();

    // Process low-risk transactions immediately
    if (fraudScore <= 70) {
      try {
        // Update account balances via Account Service
        const authHeader = req.header('Authorization');
        
        await axios.put(`http://account-service:3002/api/accounts/${fromAccountNumber}/balance`, {
          amount: amount,
          operation: 'debit',
          description: `Transfer to ${toAccountNumber}`,
          reference: transactionId
        }, {
          headers: { Authorization: authHeader },
          timeout: 10000
        });

        await axios.put(`http://account-service:3002/api/accounts/${toAccountNumber}/balance`, {
          amount: amount,
          operation: 'credit',
          description: `Transfer from ${fromAccountNumber}`,
          reference: transactionId
        }, {
          headers: { Authorization: authHeader },
          timeout: 10000
        });

        transaction.status = 'completed';
        transaction.processedAt = new Date();
        await transaction.save();

        // Log successful transaction
        await logAuditEvent('TRANSACTION_COMPLETED', {
          transactionId,
          amount,
          fromAccountNumber,
          toAccountNumber
        }, req.user.userId);

      } catch (error) {
        console.error('Transaction processing failed:', error.message);
        transaction.status = 'failed';
        await transaction.save();

        await logAuditEvent('TRANSACTION_FAILED', {
          transactionId,
          error: error.message
        }, req.user.userId);

        return res.status(400).json({ 
          error: 'Transaction failed', 
          details: error.response?.data || error.message,
          transactionId 
        });
      }
    }

    res.status(201).json(transaction);

  } catch (error) {
    console.error('Transaction creation failed:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const { accountNumber, limit = 10, status } = req.query;

    let query = {};
    if (accountNumber) {
      query.$or = [
        { fromAccountNumber: accountNumber },
        { toAccountNumber: accountNumber }
      ];
    }
    if (status) {
      query.status = status;
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(transactions);
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    service: 'transaction-service',
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis: redisClient?.isReady ? 'connected' : 'disconnected'
    }
  };
  res.json(health);
});

app.listen(PORT, () => {
  console.log(`Transaction Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (redisClient) await redisClient.quit();
  await mongoose.connection.close();
  process.exit(0);
});
