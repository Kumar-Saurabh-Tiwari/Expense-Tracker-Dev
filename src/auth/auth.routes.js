const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 || password.length < 8 || password.length > 72) {
    return res.status(400).json({ message: 'Enter your name, a valid email, and a password of 8-72 characters.' });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, await bcrypt.hash(password, 10)]
    );
    req.session.user = { id: result.insertId, name, email };
    return res.status(201).json({ user: req.session.user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'User already exists' });
    }
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) return res.status(400).json({ message: 'Enter your email and password.' });

  try {
    const [users] = await db.execute(
      'SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = users[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = { id: user.id, name: user.name, email: user.email };
      return res.json({ user: req.session.user });
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in.' });
  return res.json({ user: req.session.user });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    return res.sendStatus(204);
  });
});

module.exports = router;
