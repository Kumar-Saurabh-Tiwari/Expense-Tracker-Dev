const form = document.querySelector('#auth-form');
const message = document.querySelector('#message');
const mode = form.dataset.mode;

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
    window.location.assign('/app/');
  } catch {
    message.textContent = 'Could not reach the server. Please try again.';
    message.className = 'alert alert-danger';
  } finally {
    submit.disabled = false;
  }
});

fetch('/api/auth/me').then((response) => response.ok)
  .then((loggedIn) => { if (loggedIn) window.location.replace('/app/'); })
  .catch(() => {
    message.textContent = 'Could not check your login status. Please refresh the page.';
    message.className = 'alert alert-danger';
  });
