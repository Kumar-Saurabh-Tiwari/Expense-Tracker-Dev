const express = require('express');
const { db } = require('../config/database');
const { requireLogin } = require('../auth/auth.middleware');

const router = express.Router();

router.use(requireLogin);

router.get('/', async (req, res, next) => {
  try {
    const [users] = await db.execute(
      'SELECT is_premium FROM users WHERE id = ? LIMIT 1',
      [req.session.user.id]
    );
    if (!users[0]) return res.status(401).json({ message: 'Please log in again.' });
    if (!users[0].is_premium) {
      return res.status(403).json({ message: 'The leaderboard is available to premium members.' });
    }

    const [leaders] = await db.execute(`
      SELECT users.name, SUM(expenses.amount) AS total_spent
      FROM users
      INNER JOIN expenses ON expenses.user_id = users.id
      GROUP BY users.id, users.name
      ORDER BY total_spent DESC, users.name ASC
      LIMIT 10
    `);

    return res.json({
      leaderboard: leaders.map((user, index) => ({
        rank: index + 1,
        name: user.name,
        totalSpent: Number(user.total_spent)
      }))
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
