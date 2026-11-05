# Expense Tracker account pages

A small Node.js and Express app with Bootstrap signup and login pages. Users are stored in MySQL and passwords are hashed with bcrypt.

## Folders

- `src/auth/` - signup, login, and session API routes
- `src/config/` - MySQL connection and setup
- `public/auth/` - signup and login page, styles, and browser JavaScript
- `public/app/` - future signed-in app screens, kept separate from authentication
- `database/` - MySQL schema

## Requirements

- Node.js 18 or newer
- MySQL

## Run locally

1. Run `database/schema.sql` in MySQL to create the database and users table.
2. Copy `.env.example` to `.env` and set your MySQL details and a long random `SESSION_SECRET`.
3. Install packages and start the app:

   ```sh
   npm install
   npm start
   ```

4. Open <http://localhost:3000>.

Sessions are kept in memory, so they reset when the server restarts; this keeps the starter app simple. Do not use the example secret or commit your `.env` file.
