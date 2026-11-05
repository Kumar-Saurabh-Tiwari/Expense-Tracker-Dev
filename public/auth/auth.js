const form = document.querySelector('#auth-form');
const message = document.querySelector('#message');
const nameField = document.querySelector('#name-field');
const welcomePanel = document.querySelector('#welcome-panel');
let loginMode = false;

function showAccount(user) {
  form.classList.add('d-none');
  document.querySelector('#toggle-prompt').classList.add('d-none');
  document.querySelector('#toggle-mode').classList.add('d-none');
  welcomePanel.classList.remove('d-none');
  document.querySelector('#intro').textContent = `Welcome, ${user.name}!`;
}

document.querySelector('#toggle-mode').addEventListener('click', () => {
  loginMode = !loginMode;
  nameField.classList.toggle('d-none', loginMode);
  document.querySelector('#name').required = !loginMode;
  document.querySelector('#password').autocomplete = loginMode ? 'current-password' : 'new-password';
  document.querySelector('#submit-button').textContent = loginMode ? 'Log in' : 'Create account';
  document.querySelector('#toggle-prompt').textContent = loginMode ? 'New here?' : 'Already have an account?';
  document.querySelector('#toggle-mode').textContent = loginMode ? 'Sign up' : 'Log in';
  document.querySelector('#intro').textContent = loginMode ? 'Welcome back.' : 'Create an account to get started.';
  message.textContent = '';
  message.className = 'alert d-none';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.querySelector('#submit-button');
  submit.disabled = true;
  try {
    const response = await fetch(`/api/auth/${loginMode ? 'login' : 'register'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
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
