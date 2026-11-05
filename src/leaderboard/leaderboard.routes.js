const express = require('express');
const { requireLogin } = require('../auth/auth.middleware');
const { Sequelize } = require('sequelize');
const { User, Expense } = require('../config/sequelize');

const router = express.Router();

router.use(requireLogin);

router.get('/', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.session.user.id, {
      attributes: ['isPremium'],
      raw: true
    });
    if (!user) return res.status(401).json({ message: 'Please log in again.' });
    if (!user.isPremium) {
      return res.status(403).json({ message: 'The leaderboard is available to premium members.' });
    }

    const leaders = await User.findAll({
      attributes: [
        'name',
        [Sequelize.fn('SUM', Sequelize.col('expenses.amount')), 'totalSpent']
      ],
      include: [{
        model: Expense,
        as: 'expenses',
        attributes: [],
        required: true
      }],
      subQuery: false,
      group: ['User.id', 'User.name'],
      order: [[Sequelize.literal('totalSpent'), 'DESC'], ['name', 'ASC']],
      limit: 10,
      raw: true
    });

    return res.json({
      leaderboard: leaders.map((user, index) => ({
        rank: index + 1,
        name: user.name,
        totalSpent: Number(user.totalSpent)
      }))
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
