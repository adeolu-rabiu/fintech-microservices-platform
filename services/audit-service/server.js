const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${process.env.PORT}] ${req.method} ${req.originalUrl}`);
  next();
});


// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/bankaudit');

// Audit Log Schema
const AuditLogSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: { 
    type: String, 
    required: true,
    enum: [
      'USER_REGISTRATION', 'USER_LOGIN', 'ACCOUNT_CREATED', 
      'TRANSACTION_COMPLETED', 'TRANSACTION_FAILED', 'HIGH_RISK_TRANSACTION',
      'TRANSACTION_APPROVED', 'ADMIN_ACTION', 'SECURITY_ALERT'
    ]
  },
  serviceSource: { type: String, required: true },
  userId: String,
  details: mongoose.Schema.Types.Mixed,
  riskLevel: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'], 
    default: 'low' 
  },
  timestamp: { type: Date, default: Date.now }
});

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

// Routes
app.post('/api/audit', async (req, res) => {
  try {
    const { eventType, serviceSource, userId, details } = req.body;
    
    const eventId = 'AUDIT_' + Date.now() + Math.random().toString(36).substr(2, 8).toUpperCase();
    
    const auditLog = new AuditLog({
      eventId,
      eventType,
      serviceSource,
      userId,
      details,
      timestamp: new Date()
    });
    
    await auditLog.save();
    res.status(201).json({ eventId });
    
  } catch (error) {
    console.error('Audit logging failed:', error);
    res.status(500).json({ error: 'Audit logging failed' });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'audit-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Audit Service running on port ${PORT}`);
});
