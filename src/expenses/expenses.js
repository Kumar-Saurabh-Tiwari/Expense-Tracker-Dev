const form = document.querySelector('#expense-form');
const list = document.querySelector('#expense-list');
const message = document.querySelector('#message');
const emptyMessage = document.querySelector('#empty-message');
const addButton = document.querySelector('#add-button');

function showMessage(text, type = 'danger') {
  message.textContent = text;
  message.className = `alert alert-${type}`;
}

function clearMessage() {
  message.textContent = '';
  message.className = 'alert d-none';
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

fetch('/api/auth/me')
  .then(async (response) => {
    if (response.status === 401) {
      window.location.replace('/auth/');
      return null;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not load your account.');
    return result.user;
  })
  .then((user) => {
    if (!user) return;
    document.querySelector('#user-name').textContent = user.name;
    return loadExpenses();
  })
  .catch((error) => showMessage(error.message || 'Could not load expenses.'));
