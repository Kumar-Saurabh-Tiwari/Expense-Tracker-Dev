'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('expenses');
    if (!columns.note) {
      await queryInterface.addColumn('expenses', 'note', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('expenses');
    if (columns.note) {
      await queryInterface.removeColumn('expenses', 'note');
    }
  }
};
