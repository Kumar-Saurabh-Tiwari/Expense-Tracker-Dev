const form = document.querySelector('#auth-form');
const message = document.querySelector('#message');
const mode = form.dataset.mode;
const forgotForm = document.querySelector('#forgot-password-form');
const forgotLink = document.querySelector('#forgot-password-link');
const forgotEmail = document.querySelector('#forgot-email');

document.querySelector('#show-forgot-password')?.addEventListener('click', () => {
  forgotEmail.value = form.elements.email.value;
  form.classList.add('d-none');
  forgotLink.classList.add('d-none');
  document.querySelector('#auth-switch').classList.add('d-none');
  forgotForm.classList.remove('d-none');
  message.className = 'alert d-none';
  forgotEmail.focus();
});

document.querySelector('#back-to-login')?.addEventListener('click', () => {
  forgotForm.classList.add('d-none');
  form.classList.remove('d-none');
  forgotLink.classList.remove('d-none');
  document.querySelector('#auth-switch').classList.remove('d-none');
  message.className = 'alert d-none';
});

forgotForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.querySelector('#forgot-submit-button');
  submit.disabled = true;
  message.className = 'alert d-none';
  try {
    const response = await axios.post('/password/forgotpassword', {
      email: forgotEmail.value.trim()
    });
    message.textContent = response.data.message;
    message.className = 'alert alert-success';
  } catch (error) {
    message.textContent = error.response?.data?.message || 'Could not send the email. Please try again.';
    message.className = 'alert alert-danger';
  } finally {
    submit.disabled = false;
  }
});

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
