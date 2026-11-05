const express = require('express');
const { db } = require('../config/database');
const { hashPassword, checkPassword } = require('./password');

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

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, await hashPassword(password)]
    );
    await connection.commit();
    req.session.user = { id: result.insertId, name, email };
    return res.status(201).json({ user: req.session.user });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'User already exists' });
    }
    return next(error);
  } finally {
    if (connection) connection.release();
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
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!(await checkPassword(password, user.password_hash))) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => error ? reject(error) : resolve());
    });
    req.session.user = { id: user.id, name: user.name, email: user.email };
    return res.json({
      message: 'User login successful',
      user: req.session.user
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in.' });
  return res.json({ user: req.session.user });
});

router.post('/logout', async (req, res, next) => {
  try {
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => error ? reject(error) : resolve());
    });
    res.clearCookie('connect.sid');
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
