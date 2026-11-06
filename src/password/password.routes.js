const express = require('express');
const crypto = require('crypto');
const { db } = require('../config/database');
const { hashPassword } = require('../auth/password');
const logger = require('../config/logger');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/forgotpassword', async (req, res, next) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!emailPattern.test(email) || email.length > 254) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  const apiKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) {
    logger.warn('Password-reset email service is not configured.');
    return res.status(503).json({ message: 'Email service is not configured yet.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [users] = await connection.execute(
      'SELECT id, email FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
      [email]
    );

    if (users.length > 0) {
      await connection.execute(
        'DELETE FROM password_reset_tokens WHERE user_id = ?',
        [users[0].id]
      );
      await connection.execute(
        `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
         VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR))`,
        [tokenHash, users[0].id]
      );
    }
    await connection.commit();
    connection.release();
    connection = null;

    if (users.length > 0) {
      const senderName = process.env.BREVO_SENDER_NAME;

      const resetUrl = new URL('/auth/reset-password.html', process.env.APP_URL);
      resetUrl.searchParams.set('token', token);
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: users[0].email }],
          subject: 'Reset your Expense Tracker password',
          textContent: `Use this one-time link to reset your password within one hour: ${resetUrl.toString()}\n\nIf you did not request a password reset, you can ignore this email.`
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        logger.error('Brevo email request failed', { statusCode: response.status });
        return res.status(502).json({ message: 'Could not send the email right now. Please try again later.' });
      }
    }

    return res.json({
      message: 'If an account exists for that email, a password reset link has been sent.'
    });
  } catch (error) {
    return next(error);
  } finally {
    if (connection) connection.release();
  }
});

router.post('/resetpassword', async (req, res, next) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ message: 'This password reset link is invalid or expired.' });
  }
  if (password.length < 8 || password.length > 72) {
    return res.status(400).json({ message: 'Password must be 8-72 characters.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  let connection;
  try {
    const passwordHash = await hashPassword(password);
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [tokens] = await connection.execute(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()
       LIMIT 1 FOR UPDATE`,
      [tokenHash]
    );
    if (tokens.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'This password reset link is invalid or expired.' });
    }

    await connection.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, tokens[0].user_id]
    );
    await connection.execute(
      'DELETE FROM password_reset_tokens WHERE user_id = ?',
      [tokens[0].user_id]
    );
    await connection.commit();
    return res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    if (connection) await connection.rollback();
    return next(error);
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
