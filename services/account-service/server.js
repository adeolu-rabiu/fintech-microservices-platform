const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const Decimal = require('decimal.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${process.env.PORT}] ${req.method} ${req.originalUrl}`);
  next();
});


// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/cloudbank_accounts';
mongoose.connect(MONGO_URI);

// Account Schema
const AccountSchema = new mongoose.Schema({
  accountNumber: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  accountType: { 
    type: String, 
    enum: ['checking', 'savings', 'business', 'investment'], 
    default: 'checking' 
  },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'GBP' },
  status: { 
    type: String, 
    enum: ['active', 'frozen', 'closed', 'pending'], 
    default: 'active' 
  },
  overdraftLimit: { type: Number, default: 0 },
  interestRate: { type: Number, default: 0 },
  metadata: {
    branch: String,
    openedBy: String,
    kycStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Account = mongoose.model('Account', AccountSchema);

// Transaction History Schema
const TransactionHistorySchema = new mongoose.Schema({
  accountNumber: { type: String, required: true },
  transactionId: { type: String, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  description: String,
  reference: String,
  timestamp: { type: Date, default: Date.now }
});

const TransactionHistory = mongoose.model('TransactionHistory', TransactionHistorySchema);

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

// Routes
app.post('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const { accountType, currency = 'GBP', overdraftLimit = 0 } = req.body;
    
    // Generate unique account number
    const accountNumber = 'CB' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    const account = new Account({
      accountNumber,
      userId: req.user.userId,
      accountType,
      currency,
      overdraftLimit,
      metadata: {
        openedBy: req.user.email,
        kycStatus: 'pending'
      }
    });
    
    await account.save();
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.get('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.user.userId });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.get('/api/accounts/:accountNumber', authMiddleware, async (req, res) => {
  try {
    const account = await Account.findOne({ 
      accountNumber: req.params.accountNumber,
      userId: req.user.userId 
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

app.put('/api/accounts/:accountNumber/balance', authMiddleware, async (req, res) => {
  try {
    const { amount, operation, description, reference } = req.body;
    
    const account = await Account.findOne({ 
      accountNumber: req.params.accountNumber,
      userId: req.user.userId 
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    if (account.status !== 'active') {
      return res.status(400).json({ error: 'Account is not active' });
    }
    
    const currentBalance = new Decimal(account.balance);
    let newBalance;
    
    if (operation === 'credit') {
      newBalance = currentBalance.plus(amount);
    } else if (operation === 'debit') {
      newBalance = currentBalance.minus(amount);
      
      // Check overdraft
      if (newBalance.lessThan(new Decimal(account.overdraftLimit).negated())) {
        return res.status(400).json({ error: 'Insufficient funds' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid operation' });
    }
    
    // Update account balance
    account.balance = newBalance.toNumber();
    account.updatedAt = new Date();
    await account.save();
    
    // Record transaction history
    const transactionHistory = new TransactionHistory({
      accountNumber: account.accountNumber,
      transactionId: uuidv4(),
      type: operation,
      amount,
      balanceAfter: account.balance,
      description,
      reference
    });
    await transactionHistory.save();
    
    res.json({
      account,
      transaction: transactionHistory
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

app.get('/api/accounts/:accountNumber/history', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;
    
    const account = await Account.findOne({ 
      accountNumber: req.params.accountNumber,
      userId: req.user.userId 
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const history = await TransactionHistory.find({ 
      accountNumber: req.params.accountNumber 
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));
    
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'account-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`CloudBank Account Service running on port ${PORT}`);
});
