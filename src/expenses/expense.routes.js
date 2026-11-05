const express = require('express');
const { db } = require('../config/database');
const { requireLogin } = require('../auth/auth.middleware');

const router = express.Router();
const categories = ['Food', 'Petrol', 'Salary', 'Transport', 'Shopping', 'Bills', 'Other'];

router.use(requireLogin);

router.get('/', async (req, res, next) => {
  try {
    const [expenses] = await db.execute(
      `SELECT id, amount, description, category, created_at
       FROM expenses
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC`,
      [req.session.user.id]
    );
    return res.json({ expenses });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const body = req.body || {};
  const amount = typeof body.amount === 'number'
    ? String(body.amount)
    : typeof body.amount === 'string' ? body.amount.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = typeof body.category === 'string' ? body.category : '';

  if (!/^\d{1,8}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    return res.status(400).json({ message: 'Enter an amount greater than zero (up to two decimal places).' });
  }
  if (!description || description.length > 255) {
    return res.status(400).json({ message: 'Enter a description of up to 255 characters.' });
  }
  if (!categories.includes(category)) {
    return res.status(400).json({ message: 'Choose a valid expense category.' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [users] = await connection.execute(
      'SELECT id FROM users WHERE id = ? FOR UPDATE',
      [req.session.user.id]
    );
    if (users.length === 0) {
      await connection.rollback();
      return res.status(401).json({ message: 'Please log in again.' });
    }
    const [result] = await connection.execute(
      `INSERT INTO expenses (user_id, amount, description, category)
       VALUES (?, ?, ?, ?)`,
      [req.session.user.id, amount, description, category]
    );
    await connection.execute(
      'UPDATE users SET total_expenses = total_expenses + ? WHERE id = ?',
      [amount, req.session.user.id]
    );
    const [expenses] = await connection.execute(
      `SELECT id, amount, description, category, created_at
       FROM expenses
       WHERE id = ? AND user_id = ?`,
      [result.insertId, req.session.user.id]
    );
    await connection.commit();
    return res.status(201).json({ expense: expenses[0] });
  } catch (error) {
    if (connection) await connection.rollback();
    return next(error);
  } finally {
    if (connection) connection.release();
  }
});

router.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Invalid expense.' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [users] = await connection.execute(
      'SELECT id FROM users WHERE id = ? FOR UPDATE',
      [req.session.user.id]
    );
    if (users.length === 0) {
      await connection.rollback();
      return res.status(401).json({ message: 'Please log in again.' });
    }
    const [expenses] = await connection.execute(
      'SELECT amount FROM expenses WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, req.session.user.id]
    );
    if (expenses.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Expense not found.' });
    }
    await connection.execute(
      'DELETE FROM expenses WHERE id = ? AND user_id = ?',
      [id, req.session.user.id]
    );
    await connection.execute(
      'UPDATE users SET total_expenses = total_expenses - ? WHERE id = ?',
      [expenses[0].amount, req.session.user.id]
    );
    await connection.commit();
    return res.sendStatus(204);
  } catch (error) {
    if (connection) await connection.rollback();
    return next(error);
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
