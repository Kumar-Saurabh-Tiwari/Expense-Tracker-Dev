const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function initializeDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [premiumColumn] = await db.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'is_premium'`
  );
  if (premiumColumn.length === 0) {
    await db.execute(
      'ALTER TABLE users ADD COLUMN is_premium TINYINT(1) NOT NULL DEFAULT 0'
    );
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      order_id VARCHAR(45) NOT NULL PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(3) NOT NULL,
      status ENUM('PENDING', 'SUCCESSFUL', 'FAILED') NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX payment_orders_user_created (user_id, created_at),
      CONSTRAINT payment_orders_user_fk FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      description VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX expenses_user_created (user_id, created_at),
      CONSTRAINT expenses_user_fk FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  const [userIdColumn] = await db.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'expenses'
       AND COLUMN_NAME = 'user_id'`
  );
  if (userIdColumn.length === 0) {
    await db.execute('ALTER TABLE expenses ADD COLUMN user_id INT UNSIGNED NULL AFTER id');
  }

  await db.execute('ALTER TABLE expenses MODIFY description VARCHAR(255) NOT NULL');

  const [userIndex] = await db.execute(
    `SELECT INDEX_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'expenses'
       AND INDEX_NAME = 'expenses_user_created'`
  );
  if (userIndex.length === 0) {
    await db.execute('CREATE INDEX expenses_user_created ON expenses (user_id, created_at)');
  }

  const [userForeignKey] = await db.execute(
    `SELECT CONSTRAINT_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'expenses'
       AND CONSTRAINT_NAME = 'expenses_user_fk'
       AND REFERENCED_TABLE_NAME = 'users'`
  );
  if (userForeignKey.length === 0) {
    await db.execute(`
      ALTER TABLE expenses
      ADD CONSTRAINT expenses_user_fk FOREIGN KEY (user_id)
      REFERENCES users (id) ON DELETE CASCADE
    `);
  }

}

module.exports = { db, initializeDatabase };
