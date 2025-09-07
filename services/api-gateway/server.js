// services/api-gateway/server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

const AUTH_URL         = process.env.AUTH_URL || 'http://auth-service:3001';
const ACCOUNT_URL      = process.env.ACCOUNT_URL || 'http://account-service:3002';
const TRANSACTION_URL  = process.env.TRANSACTION_URL || 'http://transaction-service:3003';
const AUDIT_URL        = process.env.AUDIT_URL || 'http://audit-service:3005';

// --- light request log
app.use((req, _res, next) => {
  console.log(new Date().toISOString(), req.method, req.originalUrl);
  next();
});

// --- gateway health
app.get('/health', (_req, res) =>
  res.json({ status: 'healthy', service: 'api-gateway', timestamp: new Date().toISOString() })
);

// --- common proxy options
const baseProxy = {
  changeOrigin: true,
  logLevel: 'info',
  proxyTimeout: 15000,
  timeout: 15000,
  onError: (err, _req, res) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) res.status(502).json({ error: 'Bad gateway', detail: err.message });
  },
};

// ========= AUTH =========
// /api/auth/health -> /health (auth exposes /health at root)
app.use('/api/auth/health', createProxyMiddleware({
  target: AUTH_URL,
  ...baseProxy,
  pathRewrite: () => '/health',
}));

// All other /api/auth/* -> auth:/api/*
app.use('/api/auth', createProxyMiddleware({
  target: AUTH_URL,
  ...baseProxy,
  pathRewrite: (path) => path.replace(/^\/api\/auth/, '/api'),
}));

// ========= ACCOUNTS =========
// /api/accounts/health -> /health
app.use('/api/accounts/health', createProxyMiddleware({
  target: ACCOUNT_URL,
  ...baseProxy,
  pathRewrite: () => '/health',
}));

// pass /api/accounts (and subpaths) through unchanged
app.use('/api/accounts', createProxyMiddleware({
  target: ACCOUNT_URL,
  ...baseProxy,
}));

// ========= TRANSACTIONS =========
app.use('/api/transactions/health', createProxyMiddleware({
  target: TRANSACTION_URL,
  ...baseProxy,
  pathRewrite: () => '/health',
}));

app.use('/api/transactions', createProxyMiddleware({
  target: TRANSACTION_URL,
  ...baseProxy,
}));

// ========= AUDIT =========
app.use('/api/audit/health', createProxyMiddleware({
  target: AUDIT_URL,
  ...baseProxy,
  pathRewrite: () => '/health',
}));

app.use('/api/audit', createProxyMiddleware({
  target: AUDIT_URL,
  ...baseProxy,
}));

// No global express.json() here — avoid consuming the body before proxying

// Final 404 for any gateway-owned route
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => console.log(`API Gateway listening on :${PORT}`));

