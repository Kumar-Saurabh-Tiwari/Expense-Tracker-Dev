const express = require('express');
const { db } = require('../config/database');

const router = express.Router();
const categories = ['Food', 'Petrol', 'Salary', 'Transport', 'Shopping', 'Bills', 'Other'];

router.use((req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Please log in to manage expenses.' });
  }
  return next();
});

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

  try {
    const [result] = await db.execute(
      `INSERT INTO expenses (user_id, amount, description, category)
       VALUES (?, ?, ?, ?)`,
      [req.session.user.id, amount, description, category]
    );
    const [expenses] = await db.execute(
      `SELECT id, amount, description, category, created_at
       FROM expenses
       WHERE id = ? AND user_id = ?`,
      [result.insertId, req.session.user.id]
    );
    return res.status(201).json({ expense: expenses[0] });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Invalid expense.' });
  }

  try {
    const [result] = await db.execute(
      'DELETE FROM expenses WHERE id = ? AND user_id = ?',
      [id, req.session.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Expense not found.' });
    }
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
