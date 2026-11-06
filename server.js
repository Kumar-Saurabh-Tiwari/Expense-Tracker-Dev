require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./src/auth/auth.routes');
const { requireLoginPage } = require('./src/auth/auth.middleware');
const expenseRoutes = require('./src/expenses/expense.routes');
const leaderboardRoutes = require('./src/leaderboard/leaderboard.routes');
const paymentRoutes = require('./src/payments/payment.routes');
const passwordRoutes = require('./src/password/password.routes');
const { initializeDatabase } = require('./src/config/database');
const logger = require('./src/config/logger');

const required = [
  'SESSION_SECRET',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'APP_URL',
  'PREMIUM_AMOUNT',
  'PREMIUM_CURRENCY',
  'CASHFREE_ENV',
  'CASHFREE_API_VERSION'
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  const message = `Set these values in .env: ${missing.join(', ')}`;
  logger.error('Required configuration is missing', { missing });
  throw new Error(message);
}

if (process.env.SESSION_SECRET.length < 32) {
  logger.error('SESSION_SECRET must contain at least 32 characters.');
  throw new Error('SESSION_SECRET must contain at least 32 characters.');
}

let appUrl;
try {
  appUrl = new URL(process.env.APP_URL);
} catch {
  logger.error('APP_URL must be an absolute URL.');
  throw new Error('APP_URL must be an absolute URL.');
}
if (!['http:', 'https:'].includes(appUrl.protocol)) {
  logger.error('APP_URL must use HTTP or HTTPS.');
  throw new Error('APP_URL must use HTTP or HTTPS.');
}
if (process.env.NODE_ENV === 'production' && appUrl.protocol !== 'https:') {
  logger.error('APP_URL must use HTTPS in production.');
  throw new Error('APP_URL must use HTTPS in production.');
}

const sessionMaxAge = Number(process.env.SESSION_MAX_AGE_MS || 86400000);
if (!Number.isSafeInteger(sessionMaxAge) || sessionMaxAge <= 0) {
  logger.error('SESSION_MAX_AGE_MS must be a positive integer.');
  throw new Error('SESSION_MAX_AGE_MS must be a positive integer.');
}
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0) {
  logger.error('TRUST_PROXY_HOPS must be a non-negative integer.');
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
}

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  logger.error('PORT must be an integer between 1 and 65535.');
  throw new Error('PORT must be an integer between 1 and 65535.');
}
const databasePort = Number(process.env.DB_PORT);
if (!Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535) {
  logger.error('DB_PORT must be an integer between 1 and 65535.');
  throw new Error('DB_PORT must be an integer between 1 and 65535.');
}

const premiumAmount = Number(process.env.PREMIUM_AMOUNT);
if (!Number.isFinite(premiumAmount) || premiumAmount <= 0 || premiumAmount > 99999999.99) {
  logger.error('PREMIUM_AMOUNT is invalid.');
  throw new Error('PREMIUM_AMOUNT must be greater than zero and at most 99999999.99.');
}
if (!/^[A-Z]{3}$/.test(process.env.PREMIUM_CURRENCY)) {
  logger.error('PREMIUM_CURRENCY is invalid.');
  throw new Error('PREMIUM_CURRENCY must be a three-letter uppercase currency code.');
}
if (!['sandbox', 'production'].includes(process.env.CASHFREE_ENV)) {
  logger.error('CASHFREE_ENV is invalid.');
  throw new Error('CASHFREE_ENV must be either sandbox or production.');
}

const app = express();
app.set('trust proxy', trustProxyHops);

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('HTTP request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });
  next();
});

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionMaxAge
  }
}));

function serveExpenseApp(req, res) {
  res.set('Cache-Control', 'no-store');
  return res.sendFile(path.join(__dirname, 'src', 'expenses', 'expenses.html'));
}

app.get(['/app', '/app/'], requireLoginPage, serveExpenseApp);
app.get('/app/expenses.js', requireLoginPage, (req, res) => {
  return res.sendFile(path.join(__dirname, 'src', 'expenses', 'expenses.js'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/auth/'));
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/password', passwordRoutes);

app.use((error, req, res, next) => {
  logger.error('Unhandled request error', {
    method: req.method,
    path: req.path,
    message: error.message,
    stack: error.stack
  });
  if (res.headersSent) return next(error);
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

async function start() {
  await initializeDatabase();

  app.listen(port, () => logger.info('Expense Tracker started', {
    port,
    environment: process.env.NODE_ENV || 'development'
  }));
}

start().catch((error) => {
  logger.error('Could not start the app', { message: error.message, stack: error.stack });
  process.exitCode = 1;
});
