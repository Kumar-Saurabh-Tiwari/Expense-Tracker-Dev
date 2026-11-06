const { DataTypes, Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    }
  }
);

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  isPremium: {
    type: DataTypes.BOOLEAN,
    field: 'is_premium'
  },
  totalExpenses: {
    type: DataTypes.DECIMAL(18, 2),
    field: 'total_expenses',
    allowNull: false
  }
}, {
  tableName: 'users',
  timestamps: false
});

const Expense = sequelize.define('Expense', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    field: 'user_id'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  note: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'expenses',
  timestamps: false
});

User.hasMany(Expense, { as: 'expenses', foreignKey: 'userId' });
Expense.belongsTo(User, { as: 'user', foreignKey: 'userId' });

module.exports = { sequelize, User, Expense };
