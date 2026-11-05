require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./src/auth/auth.routes');
const expenseRoutes = require('./src/expenses/expense.routes');
const { initializeDatabase } = require('./src/config/database');

const required = ['SESSION_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Set these values in .env: ${missing.join(', ')}`);

const app = express();

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

function serveExpenseApp(req, res) {
  if (!req.session.user) return res.redirect('/auth/');
  res.set('Cache-Control', 'no-store');
  return res.sendFile(path.join(__dirname, 'src', 'expenses', 'expenses.html'));
}

app.get(['/app', '/app/'], serveExpenseApp);
app.get('/app/expenses.js', (req, res) => {
  if (!req.session.user) return res.sendStatus(404);
  return res.sendFile(path.join(__dirname, 'src', 'expenses', 'expenses.js'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/auth/'));
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

async function start() {
  await initializeDatabase();

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`Expense Tracker running at http://localhost:${port}`));
}

start().catch((error) => {
  console.error('Could not start the app:', error.message);
  process.exitCode = 1;
});
