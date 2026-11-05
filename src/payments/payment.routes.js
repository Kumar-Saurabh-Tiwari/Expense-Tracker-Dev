const crypto = require('crypto');
const express = require('express');
const { db } = require('../config/database');
const { requireLogin } = require('../auth/auth.middleware');
const { createCashfreeOrder, PGOrderFetchPayments } = require('./payment.service');

const router = express.Router();
const premiumAmount = process.env.PREMIUM_AMOUNT || '199.00';
const currency = process.env.PREMIUM_CURRENCY || 'INR';
const terminalFailureStatuses = new Set(['FAILED', 'USER_DROPPED', 'CANCELLED']);

router.use(requireLogin);

router.get('/status', async (req, res, next) => {
  try {
    const [users] = await db.execute(
      'SELECT is_premium FROM users WHERE id = ? LIMIT 1',
      [req.session.user.id]
    );
    if (!users[0]) return res.status(401).json({ message: 'Please log in again.' });
    return res.json({
      isPremium: Boolean(users[0].is_premium),
      amount: Number(premiumAmount),
      currency,
      cashfreeMode: process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox'
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/orders', async (req, res, next) => {
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/\D/g, '') : '';
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number.' });
  }

  const amount = Number(premiumAmount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) {
    return res.status(500).json({ message: 'Premium membership price is not configured correctly.' });
  }

  const returnUrl = new URL('/app/', process.env.APP_URL || 'http://localhost:3000');

  try {
    const [users] = await db.execute(
      'SELECT id, name, email, is_premium FROM users WHERE id = ? LIMIT 1',
      [req.session.user.id]
    );
    const user = users[0];
    if (!user) return res.status(401).json({ message: 'Please log in again.' });
    if (user.is_premium) {
      return res.status(409).json({ message: 'This account already has premium membership.' });
    }

    const orderId = `premium_${crypto.randomUUID().replace(/-/g, '')}`;
    returnUrl.searchParams.set('payment_order_id', orderId);

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        'INSERT INTO payment_orders (order_id, user_id, amount, currency, status) VALUES (?, ?, ?, ?, ?)',
        [orderId, user.id, amount.toFixed(2), currency, 'PENDING']
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    try {
      const cashfreeOrder = await createCashfreeOrder({
        orderId,
        amount,
        currency,
        user,
        phone,
        returnUrl: returnUrl.toString()
      });
      if (!cashfreeOrder.payment_session_id) {
        throw new Error('Cashfree did not return a payment session.');
      }

      return res.status(201).json({
        orderId,
        paymentSessionId: cashfreeOrder.payment_session_id,
        amount,
        currency
      });
    } catch (error) {
      const failedOrderConnection = await db.getConnection();
      try {
        await failedOrderConnection.beginTransaction();
        await failedOrderConnection.execute(
          'UPDATE payment_orders SET status = ? WHERE order_id = ? AND user_id = ? AND status = ?',
          ['FAILED', orderId, user.id, 'PENDING']
        );
        await failedOrderConnection.commit();
      } catch (updateError) {
        await failedOrderConnection.rollback();
        throw updateError;
      } finally {
        failedOrderConnection.release();
      }
      throw error;
    }
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
});

router.get('/orders/:orderId', async (req, res, next) => {
  try {
    const [[order]] = await db.execute(
      'SELECT status FROM payment_orders WHERE order_id = ? AND user_id = ? LIMIT 1',
      [req.params.orderId, req.session.user.id]
    );
    if (!order) return res.status(404).json({ message: 'Payment order not found.' });

    const [[user]] = await db.execute(
      'SELECT is_premium FROM users WHERE id = ? LIMIT 1',
      [req.session.user.id]
    );
    return res.json({
      status: order.status,
      isPremium: Boolean(user?.is_premium)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/orders/:orderId/verify', async (req, res, next) => {
  const orderId = req.params.orderId;

  try {
    const [orders] = await db.execute(
      'SELECT order_id, amount, currency, status FROM payment_orders WHERE order_id = ? AND user_id = ? LIMIT 1',
      [orderId, req.session.user.id]
    );
    const order = orders[0];
    if (!order) return res.status(404).json({ message: 'Payment order not found.' });

    if (order.status === 'PENDING') {
      const payments = await PGOrderFetchPayments(order.order_id);
      const successfulPayment = payments.find((payment) =>
        payment.order_id === order.order_id &&
        payment.payment_status === 'SUCCESS' &&
        payment.payment_currency === order.currency &&
        Number(payment.payment_amount) === Number(order.amount)
      );
      const allPaymentsFailed = payments.length > 0 &&
        payments.every((payment) => terminalFailureStatuses.has(payment.payment_status));

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [lockedOrders] = await connection.execute(
          'SELECT status FROM payment_orders WHERE order_id = ? AND user_id = ? FOR UPDATE',
          [order.order_id, req.session.user.id]
        );
        if (lockedOrders[0]?.status === 'PENDING' && successfulPayment) {
          await connection.execute(
            'UPDATE payment_orders SET status = ? WHERE order_id = ?',
            ['SUCCESSFUL', order.order_id]
          );
          await connection.execute(
            'UPDATE users SET is_premium = 1 WHERE id = ?',
            [req.session.user.id]
          );
        } else if (lockedOrders[0]?.status === 'PENDING' && allPaymentsFailed) {
          await connection.execute(
            'UPDATE payment_orders SET status = ? WHERE order_id = ?',
            ['FAILED', order.order_id]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    const [[currentOrder]] = await db.execute(
      'SELECT status FROM payment_orders WHERE order_id = ? AND user_id = ?',
      [order.order_id, req.session.user.id]
    );
    const [[user]] = await db.execute(
      'SELECT is_premium FROM users WHERE id = ?',
      [req.session.user.id]
    );
    return res.json({
      status: currentOrder.status,
      isPremium: Boolean(user?.is_premium)
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
});

module.exports = router;
