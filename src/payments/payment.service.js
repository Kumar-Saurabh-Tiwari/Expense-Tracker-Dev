const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION;

function getApiBaseUrl() {
  return process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
}

async function cashfreeRequest(path, options = {}) {
  const clientId = process.env.CASHFREE_API_KEY;
  const clientSecret = process.env.CASHFREE_API_SECRET;
  if (!clientId || !clientSecret) {
    const error = new Error('Cashfree API credentials are not configured.');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-version': CASHFREE_API_VERSION,
      'x-client-id': clientId,
      'x-client-secret': clientSecret
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(`Cashfree request failed with status ${response.status}.`);
    error.status = 502;
    throw error;
  }

  return result;
}

async function createCashfreeOrder({ orderId, amount, currency, user, phone, returnUrl }) {
  return cashfreeRequest('/orders', {
    method: 'POST',
    body: {
      order_id: orderId,
      order_amount: Number(amount),
      order_currency: currency,
      customer_details: {
        customer_id: String(user.id),
        customer_name: user.name,
        customer_email: user.email,
        customer_phone: phone
      },
      order_meta: { return_url: returnUrl },
      order_note: 'Expense Tracker Premium Membership'
    }
  });
}

async function PGOrderFetchPayments(orderId) {
  const payments = await cashfreeRequest(`/orders/${encodeURIComponent(orderId)}/payments`);
  if (!Array.isArray(payments)) {
    throw new Error('Cashfree returned an invalid payment status response.');
  }
  return payments;
}

module.exports = { createCashfreeOrder, PGOrderFetchPayments };
