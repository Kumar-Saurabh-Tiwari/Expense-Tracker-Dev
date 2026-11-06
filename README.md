# Expense Tracker account pages

A small Node.js and Express app with Bootstrap signup and login pages. Users are stored in MySQL and passwords are hashed with bcrypt.

## Folders

- `src/auth/` - signup, login, and session API routes
- `src/auth/auth.middleware.js` - shared login checks for pages and API routes
- `src/expenses/` - authenticated expense API and app page
- `src/leaderboard/` - premium-only all-time expense leaderboard using Sequelize
- `src/gemini-setup/` - Gemini category suggestions and spending insights
- `src/payments/` - Cashfree order creation and payment verification
- `src/password/` - password-help email request
- `src/config/` - MySQL connection and setup
- `public/auth/` - signup and login page, styles, and browser JavaScript
- `public/app/` - assets for future signed-in screens
- `database/` - MySQL schema

## Requirements

- Node.js 18 or newer
- MySQL

## Run locally

1. Run `database/schema.sql` in MySQL to create the database, users, expenses, and payment-orders tables.
2. Copy `.env.example` to `.env` and set your MySQL details and a long random `SESSION_SECRET`.
3. Install packages and start the app:

   ```sh
   npm install
   npm start
   ```

4. Open <http://localhost:3000>.

Database changes are managed with Sequelize migrations. After the app has created the database tables, apply pending migrations with `npm run db:migrate`; use `npm run db:migrate:undo` to roll back the latest migration.

Cashfree runs in Sandbox by default. Configure `CASHFREE_API_KEY` and `CASHFREE_API_SECRET` in `.env`, and keep the secret server-side. Premium membership costs ₹199 INR by default; `PREMIUM_AMOUNT`, `PREMIUM_CURRENCY`, `CASHFREE_ENV`, `CASHFREE_API_VERSION`, and `APP_URL` can be set in `.env`. The checkout asks for the customer's 10-digit Indian mobile number because Cashfree requires it.

The login page is at `/auth/` and signup is at `/auth/signup.html`. After login, the app opens at `/app/`. The app creates or updates the expenses table when it starts. Existing expenses are kept during the update; older rows without an owner stay unassigned. New expenses are saved per user through `POST /api/expenses` and loaded from `GET /api/expenses` whenever the app page opens or refreshes. The API also supports deleting an expense with `DELETE /api/expenses/:id`. Expense APIs require a logged-in session, and users can only access their own expenses.

The login form sends `{ "email": "...", "password": "..." }` to `POST /api/auth/login`. A successful login returns `200` with `User login successful`; an unknown email returns `404 User not found`, and a wrong password returns `401 User not authorized`.

The login page's "Forgot password?" form posts an email to `/password/forgotpassword` using Axios. Configure `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and optionally `BREVO_SENDER_NAME` in `.env`. In Brevo (formerly Sendinblue), create an API key and verify the sender email before using this route. For privacy, it returns the same confirmation whether or not an account exists. A registered user receives a one-time reset link that expires after one hour; the token is stored hashed in the `password_reset_tokens` table, and resetting the password invalidates all outstanding reset links.

The Buy premium membership button creates a `PENDING` order on the server and opens Cashfree checkout. On return, the server verifies the order using Cashfree's payments-for-order API. Only a verified successful payment sets the order to `SUCCESSFUL` and upgrades the user's account; a verified failed payment sets the order to `FAILED`.

Database-changing API requests use MySQL transactions so related writes commit or roll back together. Reads use no transaction; payment status verification is a `POST` because it may update the order and membership, while `GET /api/payments/orders/:orderId` only reads current status.

Premium members see the message "You are a premium user now" after login and on page refresh. They can also view a top-10 leaderboard of user names and all-time expense totals at `GET /api/leaderboard`. Each user's running expense total is stored in `users.total_expenses` and updated in the same transaction as expense additions and deletions, so leaderboard reads do not aggregate the expenses table. Existing totals are backfilled once when the column is added. The leaderboard uses Sequelize; other app routes continue to use mysql2.

The expense page includes a premium-only client-side daily, weekly, and monthly report with a CSV download. It uses expenses already loaded in the browser; `Salary` category records are shown as income in this report. Actual income entry and backend report/export endpoints are not implemented yet.

Gemini suggests a category when you enter an expense description, and you can change the suggestion before saving. The "AI spending insight" button gives one short tip from category totals for the last 30 days. Set `GEMINI_API_KEY` in `.env`; keep the key on the server and do not commit it. If Gemini is unavailable, choose a category manually; adding expenses still works.

Sessions are kept in memory, so they reset when the server restarts; this keeps the starter app simple. Do not use the example secret or commit your `.env` file.
