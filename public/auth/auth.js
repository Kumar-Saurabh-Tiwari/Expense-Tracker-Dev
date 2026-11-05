const form = document.querySelector('#auth-form');
const message = document.querySelector('#message');
const welcomePanel = document.querySelector('#welcome-panel');
const authSwitch = document.querySelector('#auth-switch');
const mode = form.dataset.mode;

function showAccount(user) {
  form.classList.add('d-none');
  authSwitch.classList.add('d-none');
  welcomePanel.classList.remove('d-none');
  document.querySelector('#intro').textContent = `Welcome, ${user.name}!`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.querySelector('#submit-button');
  submit.disabled = true;
  try {
    const userDetails = Object.fromEntries(new FormData(form));
    const response = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userDetails)
    });
    const result = await response.json();
    if (!response.ok) {
      message.textContent = result.message;
      message.className = 'alert alert-danger';
      return;
    }
    showAccount(result.user);
  } catch {
    message.textContent = 'Could not reach the server. Please try again.';
    message.className = 'alert alert-danger';
  } finally {
    submit.disabled = false;
  }
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Logout failed');
    location.reload();
  } catch {
    message.textContent = 'Could not log out. Please try again.';
    message.className = 'alert alert-danger';
  }
});

fetch('/api/auth/me').then((response) => response.ok ? response.json() : null)
  .then((result) => { if (result) showAccount(result.user); })
  .catch(() => {
    message.textContent = 'Could not check your login status. Please refresh the page.';
    message.className = 'alert alert-danger';
  });
