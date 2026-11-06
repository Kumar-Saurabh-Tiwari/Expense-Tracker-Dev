const form = document.querySelector('#expense-form');
const list = document.querySelector('#expense-list');
const message = document.querySelector('#message');
const emptyMessage = document.querySelector('#empty-message');
const expensePageStatus = document.querySelector('#expense-page-status');
const expensePageSizeSelect = document.querySelector('#expense-page-size');
const expensePreviousButton = document.querySelector('#expense-previous');
const expenseNextButton = document.querySelector('#expense-next');
const addButton = document.querySelector('#add-button');
const premiumForm = document.querySelector('#premium-form');
const premiumButton = document.querySelector('#premium-button');
const premiumMessage = document.querySelector('#premium-message');
const premiumBanner = document.querySelector('#premium-banner');
const leaderboardSection = document.querySelector('#leaderboard-section');
const leaderboardMessage = document.querySelector('#leaderboard-message');
const leaderboardTable = document.querySelector('#leaderboard-table');
const leaderboardList = document.querySelector('#leaderboard-list');
const descriptionInput = document.querySelector('#description');
const categorySelect = document.querySelector('#category');
const categoryHint = document.querySelector('#category-hint');
const insightButton = document.querySelector('#insight-button');
const insightMessage = document.querySelector('#insight-message');
const reportPeriod = document.querySelector('#report-period');
const reportDate = document.querySelector('#report-date');
const reportContent = document.querySelector('#report-content');
const reportLocked = document.querySelector('#report-locked');
const downloadReportButton = document.querySelector('#download-report');
const reportRows = document.querySelector('#report-rows');
let paymentConfig;
let expensesData = [];
let expensePage = 1;
const expensePageSizeStorageKey = 'expense-tracker-expense-page-size';
const validExpensePageSizes = [...expensePageSizeSelect.options].map((option) => Number(option.value));
let isPremiumUser = false;
let suggestionTimer;
let suggestionController;
let suggestionPromise;
let suggestionVersion = 0;
let requestedSuggestionVersion = -1;
let categoryManuallySelected = false;

function showMessage(text, type = 'danger') {
  message.textContent = text;
  message.className = `alert alert-${type}`;
}

function clearMessage() {
  message.textContent = '';
  message.className = 'alert d-none';
}

function restoreExpensePageSize() {
  try {
    const savedPageSize = Number(window.localStorage.getItem(expensePageSizeStorageKey));
    if (validExpensePageSizes.includes(savedPageSize)) {
      expensePageSizeSelect.value = String(savedPageSize);
    }
  } catch (error) {
    showAppMessage('Could not load your expenses-per-page preference.');
  }
}

function saveExpensePageSize() {
  try {
    window.localStorage.setItem(expensePageSizeStorageKey, expensePageSizeSelect.value);
  } catch (error) {
    showAppMessage('Could not save your expenses-per-page preference.');
  }
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

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getReportRange() {
  const [year, month, day] = reportDate.value.split('-').map(Number);
  const selected = new Date(year, month - 1, day);
  let start;
  let end;

  if (reportPeriod.value === 'daily') {
    start = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else if (reportPeriod.value === 'weekly') {
    start = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else {
    start = new Date(selected.getFullYear(), selected.getMonth(), 1);
    end = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
  }

  return { start, end };
}

function getReportItems() {
  if (!reportDate.value) return [];
  const { start, end } = getReportRange();
  return expensesData
    .map((expense) => ({ ...expense, reportDate: new Date(expense.created_at) }))
    .filter((expense) =>
      Number.isFinite(expense.reportDate.getTime()) &&
      expense.reportDate >= start &&
      expense.reportDate < end
    )
    .sort((left, right) => right.reportDate - left.reportDate || right.id - left.id);
}

function isIncomeItem(expense) {
  return expense.type === 'income' ||
    expense.transaction_type === 'income' ||
    String(expense.category).toLowerCase() === 'salary';
}

function renderReport() {
  const unlocked = isPremiumUser;
  reportLocked.classList.toggle('d-none', unlocked);
  reportContent.classList.toggle('d-none', !unlocked);
  reportPeriod.disabled = !unlocked;
  reportDate.disabled = !unlocked;
  downloadReportButton.disabled = !unlocked;
  if (!unlocked) return;

  const items = getReportItems();
  let income = 0;
  let expenseTotal = 0;
  reportRows.replaceChildren();

  for (const item of items) {
    const itemIsIncome = isIncomeItem(item);
    const amount = Number(item.amount) || 0;
    if (itemIsIncome) income += amount;
    else expenseTotal += amount;

    const row = document.createElement('tr');
    const dateCell = document.createElement('td');
    dateCell.textContent = item.reportDate.toLocaleDateString();
    const descriptionCell = document.createElement('td');
    descriptionCell.textContent = item.description;
    const categoryCell = document.createElement('td');
    categoryCell.textContent = item.category;
    const incomeCell = document.createElement('td');
    incomeCell.className = 'text-end';
    incomeCell.textContent = itemIsIncome ? formatAmount(amount) : '—';
    const expenseCell = document.createElement('td');
    expenseCell.className = 'text-end';
    expenseCell.textContent = itemIsIncome ? '—' : formatAmount(amount);
    row.append(dateCell, descriptionCell, categoryCell, incomeCell, expenseCell);
    reportRows.append(row);
  }

  document.querySelector('#report-income').textContent = formatAmount(income);
  document.querySelector('#report-expenses').textContent = formatAmount(expenseTotal);
  document.querySelector('#report-savings').textContent = formatAmount(income - expenseTotal);
  document.querySelector('#report-income-total').textContent = formatAmount(income);
  document.querySelector('#report-expense-total').textContent = formatAmount(expenseTotal);

  const periodName = reportPeriod.value[0].toUpperCase() + reportPeriod.value.slice(1);
  document.querySelector('#report-period-title').textContent = `${periodName} report`;
  document.querySelector('#report-empty').classList.toggle('d-none', items.length > 0);
}

function downloadReport() {
  if (!isPremiumUser) return;
  const items = getReportItems();
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [
    ['Date', 'Description', 'Category', 'Income', 'Expense'],
    ...items.map((item) => {
      const amount = Number(item.amount) || 0;
      const itemIsIncome = isIncomeItem(item);
      return [
        item.reportDate.toLocaleDateString(),
        item.description,
        item.category,
        itemIsIncome ? amount.toFixed(2) : '',
        itemIsIncome ? '' : amount.toFixed(2)
      ];
    })
  ];
  const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `expense-report-${reportPeriod.value}-${reportDate.value}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

reportDate.value = dateInputValue(new Date());
reportPeriod.addEventListener('change', renderReport);
reportDate.addEventListener('change', renderReport);
downloadReportButton.addEventListener('click', downloadReport);

async function requestCategorySuggestion(version) {
  suggestionController = new AbortController();
  requestedSuggestionVersion = version;
  const response = await fetch('/api/expenses/suggest-category', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: descriptionInput.value.trim() }),
    signal: suggestionController.signal
  });
  const result = await response.json();
  if (response.status === 401) {
    window.location.replace('/auth/');
    return;
  }
  if (!response.ok) throw new Error(result.message || 'AI category suggestion is unavailable.');
  if (version === suggestionVersion && !categoryManuallySelected) {
    categorySelect.value = result.category;
    categoryHint.textContent = `AI suggested ${result.category}. You can change it.`;
  }
}

descriptionInput.addEventListener('input', () => {
  suggestionVersion += 1;
  categoryManuallySelected = false;
  clearTimeout(suggestionTimer);
  if (suggestionController) suggestionController.abort();
  suggestionPromise = null;
  requestedSuggestionVersion = -1;

  const description = descriptionInput.value.trim();
  if (!description) {
    categoryHint.textContent = 'AI will suggest a category from your description.';
    return;
  }

  categoryHint.textContent = 'AI is choosing a category...';
  const version = suggestionVersion;
  suggestionTimer = setTimeout(() => {
    suggestionPromise = requestCategorySuggestion(version).catch((error) => {
      if (error.name !== 'AbortError' && version === suggestionVersion) {
        categoryHint.textContent = 'AI suggestion unavailable. Choose a category manually.';
      }
    });
  }, 500);
});

categorySelect.addEventListener('change', () => {
  categoryManuallySelected = true;
  categoryHint.textContent = 'Using your selected category.';
});

insightButton.addEventListener('click', async () => {
  insightButton.disabled = true;
  insightMessage.className = 'mb-0 mt-3';
  insightMessage.textContent = 'Thinking...';
  try {
    const response = await fetch('/api/expenses/insight');
    const result = await response.json();
    if (response.status === 401) {
      window.location.replace('/auth/');
      return;
    }
    if (!response.ok) throw new Error(result.message || 'Could not get an AI insight.');
    insightMessage.textContent = result.insight;
  } catch (error) {
    insightMessage.textContent = error.message || 'Could not get an AI insight.';
  } finally {
    insightButton.disabled = false;
  }
});

function renderLeaderboard(leaders) {
  leaderboardList.replaceChildren();
  for (const leader of leaders) {
    const row = document.createElement('tr');
    const rank = document.createElement('th');
    rank.scope = 'row';
    rank.textContent = leader.rank;
    const name = document.createElement('td');
    name.textContent = leader.name;
    const total = document.createElement('td');
    total.className = 'text-end';
    total.textContent = formatAmount(leader.totalSpent);
    row.append(rank, name, total);
    leaderboardList.append(row);
  }
  leaderboardMessage.textContent = leaders.length ? '' : 'No expenses to rank yet.';
  leaderboardTable.classList.toggle('d-none', leaders.length === 0);
}

async function loadLeaderboard() {
  const response = await fetch('/api/leaderboard');
  if (response.status === 401) {
    window.location.replace('/auth/');
    return;
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Could not load the leaderboard.');
  renderLeaderboard(result.leaderboard);
}

async function refreshLeaderboardIfVisible() {
  if (!leaderboardSection.classList.contains('d-none')) {
    await loadLeaderboard();
  }
}

function renderExpenses(expenses) {
  expensesData = expenses;
  renderReport();
  list.replaceChildren();
  emptyMessage.textContent = expenses.length ? '' : 'No expenses yet. Add your first one above.';
  emptyMessage.classList.toggle('d-none', expenses.length > 0);

  const pageSize = Number(expensePageSizeSelect.value);
  const totalPages = Math.max(1, Math.ceil(expenses.length / pageSize));
  expensePage = Math.min(expensePage, totalPages);
  const start = (expensePage - 1) * pageSize;
  const pageExpenses = expenses.slice(start, start + pageSize);

  for (const expense of pageExpenses) {
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
    if (expense.note) {
      const note = document.createElement('div');
      note.className = 'small text-secondary mt-1';
      note.textContent = expense.note;
      details.append(note);
    }

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

  const firstItem = expenses.length ? start + 1 : 0;
  const lastItem = Math.min(start + pageSize, expenses.length);
  expensePageStatus.textContent =
    `Page ${expensePage} of ${totalPages} · ${firstItem}-${lastItem} of ${expenses.length} expenses`;
  expensePreviousButton.disabled = expensePage <= 1;
  expenseNextButton.disabled = expensePage >= totalPages;
}

expensePageSizeSelect.addEventListener('change', () => {
  saveExpensePageSize();
  expensePage = 1;
  renderExpenses(expensesData);
});

expensePreviousButton.addEventListener('click', () => {
  if (expensePage > 1) {
    expensePage -= 1;
    renderExpenses(expensesData);
  }
});

expenseNextButton.addEventListener('click', () => {
  if (expensePage < Math.ceil(expensesData.length / Number(expensePageSizeSelect.value))) {
    expensePage += 1;
    renderExpenses(expensesData);
  }
});

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
    await refreshLeaderboardIfVisible();
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
    isPremiumUser = true;
    renderReport();
    premiumBanner.classList.remove('d-none');
    leaderboardSection.classList.remove('d-none');
    leaderboardMessage.textContent = 'Loading leaderboard...';
    premiumButton.textContent = 'Premium membership active';
    premiumButton.disabled = true;
    premiumButton.removeAttribute('data-bs-toggle');
    premiumButton.removeAttribute('data-bs-target');
    try {
      await loadLeaderboard();
    } catch (error) {
      leaderboardMessage.textContent = error.message || 'Could not load the leaderboard.';
    }
  } else {
    isPremiumUser = false;
    renderReport();
    premiumBanner.classList.add('d-none');
    leaderboardSection.classList.add('d-none');
    premiumButton.disabled = false;
  }
}

async function verifyPayment(orderId) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(`/api/payments/orders/${encodeURIComponent(orderId)}/verify`, {
      method: 'POST'
    });
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
    if (!categoryManuallySelected && descriptionInput.value.trim()) {
      clearTimeout(suggestionTimer);
      if (requestedSuggestionVersion !== suggestionVersion) {
        suggestionPromise = requestCategorySuggestion(suggestionVersion).catch((error) => {
          if (error.name !== 'AbortError') {
            categoryHint.textContent = 'AI suggestion unavailable. Choose a category manually.';
          }
        });
      }
      if (suggestionPromise) await suggestionPromise;
    }
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
    suggestionVersion += 1;
    categoryManuallySelected = false;
    requestedSuggestionVersion = -1;
    categoryHint.textContent = 'AI will suggest a category from your description.';
    expensePage = 1;
    await loadExpenses();
    await refreshLeaderboardIfVisible();
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
  restoreExpensePageSize();
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
