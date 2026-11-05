# Expense Tracker account pages

A small Node.js and Express app with Bootstrap signup and login pages. Users are stored in MySQL and passwords are hashed with bcrypt.

## Folders

- `src/auth/` - signup, login, and session API routes
- `src/expenses/` - authenticated expense API and app page
- `src/config/` - MySQL connection and setup
- `public/auth/` - signup and login page, styles, and browser JavaScript
- `public/app/` - assets for future signed-in screens
- `database/` - MySQL schema

## Requirements

- Node.js 18 or newer
- MySQL

## Run locally

1. Run `database/schema.sql` in MySQL to create the database, users table, and expenses table.
2. Copy `.env.example` to `.env` and set your MySQL details and a long random `SESSION_SECRET`.
3. Install packages and start the app:

   ```sh
   npm install
   npm start
   ```

4. Open <http://localhost:3000>.

The login page is at `/auth/` and signup is at `/auth/signup.html`. After login, the app opens at `/app/`. The app creates or updates the expenses table when it starts. Existing expenses are kept during the update; older rows without an owner stay unassigned. New expenses are saved per user through `POST /api/expenses` and loaded from `GET /api/expenses` whenever the app page opens or refreshes. The API also supports deleting an expense with `DELETE /api/expenses/:id`. Expense APIs require a logged-in session, and users can only access their own expenses.

The login form sends `{ "email": "...", "password": "..." }` to `POST /api/auth/login`. A successful login returns `200` with `User login successful`; an unknown email returns `404 User not found`, and a wrong password returns `401 User not authorized`.

Sessions are kept in memory, so they reset when the server restarts; this keeps the starter app simple. Do not use the example secret or commit your `.env` file.
