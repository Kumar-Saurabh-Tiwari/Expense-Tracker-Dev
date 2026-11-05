const form = document.querySelector('#expense-form');
const list = document.querySelector('#expense-list');
const message = document.querySelector('#message');
const emptyMessage = document.querySelector('#empty-message');
const addButton = document.querySelector('#add-button');
const premiumForm = document.querySelector('#premium-form');
const premiumButton = document.querySelector('#premium-button');
const premiumMessage = document.querySelector('#premium-message');
let paymentConfig;

function showMessage(text, type = 'danger') {
  message.textContent = text;
  message.className = `alert alert-${type}`;
}

function clearMessage() {
  message.textContent = '';
  message.className = 'alert d-none';
}

function showPremiumMessage(text, type = 'danger') {
  premiumMessage.textContent = text;
  premiumMessage.className = `alert alert-${type} mt-3 mb-0`;
}

function showAppMessage(text, type = 'danger') {
  message.textContent = text;
  message.className = `alert alert-${type}`;
}

function formatAmount(amount) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'INR'
  }).format(Number(amount));
}

function renderExpenses(expenses) {
  list.replaceChildren();
  emptyMessage.textContent = expenses.length ? '' : 'No expenses yet. Add your first one above.';
  emptyMessage.classList.toggle('d-none', expenses.length > 0);

  for (const expense of expenses) {
    const item = document.createElement('li');
    item.className = 'list-group-item d-flex justify-content-between align-items-center gap-3';

    const details = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'fw-semibold';
    title.textContent = expense.description;
    const subtitle = document.createElement('small');
    subtitle.className = 'text-secondary';
    subtitle.textContent = `${expense.category} · ${new Date(expense.created_at).toLocaleDateString()}`;
    details.append(title, subtitle);

    const actions = document.createElement('div');
    actions.className = 'd-flex align-items-center gap-2';
    const amount = document.createElement('span');
    amount.className = 'fw-semibold text-nowrap';
    amount.textContent = formatAmount(expense.amount);
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-outline-danger btn-sm';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteExpense(expense.id, deleteButton));
    actions.append(amount, deleteButton);

    item.append(details, actions);
    list.append(item);
  }
}

async function loadExpenses() {
  const response = await fetch('/api/expenses');
  if (response.status === 401) {
    window.location.replace('/auth/');
    return;
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Could not load expenses.');
  renderExpenses(result.expenses);
}

async function deleteExpense(id, button) {
  button.disabled = true;
  try {
    const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (response.status === 401) {
      window.location.replace('/auth/');
      return;
    }
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.message || 'Could not delete the expense.');
    }
    await loadExpenses();
    clearMessage();
  } catch (error) {
    showMessage(error.message);
    button.disabled = false;
  }
}

async function loadPremiumStatus() {
  const response = await fetch('/api/payments/status');
  if (response.status === 401) {
    window.location.replace('/auth/');
    return;
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Could not load membership status.');

  paymentConfig = result;
  document.querySelector('#premium-price').textContent =
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: result.currency
    }).format(result.amount);

  if (result.isPremium) {
    premiumButton.textContent = 'Premium membership active';
    premiumButton.disabled = true;
    premiumButton.removeAttribute('data-bs-toggle');
    premiumButton.removeAttribute('data-bs-target');
  } else {
    premiumButton.disabled = false;
  }
}

async function verifyPayment(orderId) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(`/api/payments/orders/${encodeURIComponent(orderId)}`);
    if (response.status === 401) {
      window.location.replace('/auth/');
      return;
    }

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not verify the transaction.');

    if (result.status === 'SUCCESSFUL') {
      showAppMessage('Transaction successful', 'success');
      await loadPremiumStatus();
      return;
    }
    if (result.status === 'FAILED') {
      showAppMessage('TRANSACTION FAILED.');
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  showAppMessage('Payment is still processing. Please refresh to check again.', 'info');
}

premiumForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payButton = document.querySelector('#pay-button');
  payButton.disabled = true;
  premiumMessage.className = 'alert d-none';

  try {
    if (typeof Cashfree !== 'function') {
      throw new Error('Cashfree checkout could not be loaded. Please try again.');
    }

    const response = await fetch('/api/payments/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: new FormData(premiumForm).get('phone') })
    });
    const result = await response.json();
    if (response.status === 401) {
      window.location.replace('/auth/');
      return;
    }
    if (!response.ok) throw new Error(result.message || 'Could not start the payment.');

    const cashfree = Cashfree({ mode: paymentConfig.cashfreeMode });
    await cashfree.checkout({
      paymentSessionId: result.paymentSessionId,
      redirectTarget: '_self'
    });
  } catch (error) {
    showPremiumMessage(error.message || 'Could not start the payment. Please try again.');
  } finally {
    payButton.disabled = false;
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();
  addButton.disabled = true;

  try {
    const expense = Object.fromEntries(new FormData(form));
    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense)
    });
    const result = await response.json();
    if (response.status === 401) {
      window.location.replace('/auth/');
      return;
    }
    if (!response.ok) throw new Error(result.message || 'Could not add the expense.');

    form.reset();
    await loadExpenses();
    showMessage('Expense added.', 'success');
  } catch (error) {
    showMessage(error.message || 'Could not reach the server. Please try again.');
  } finally {
    addButton.disabled = false;
  }
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Could not log out. Please try again.');
    window.location.replace('/auth/');
  } catch (error) {
    showMessage(error.message);
  }
});

async function initializeApp() {
  const response = await fetch('/api/auth/me');
  if (response.status === 401) {
    window.location.replace('/auth/');
    return;
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Could not load your account.');
  document.querySelector('#user-name').textContent = result.user.name;

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('payment_order_id');
  if (orderId) {
    window.history.replaceState({}, '', '/app/');
  }

  const results = await Promise.allSettled([loadExpenses(), loadPremiumStatus()]);
  for (const result of results) {
    if (result.status === 'rejected') showAppMessage(result.reason.message || 'Could not load the app.');
  }
  if (orderId) await verifyPayment(orderId);
}

initializeApp().catch((error) => showAppMessage(error.message || 'Could not load the app.'));
