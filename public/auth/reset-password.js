const form = document.querySelector('#reset-password-form');
const message = document.querySelector('#message');
const token = new URLSearchParams(window.location.search).get('token') || '';

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = form.elements.password.value;
  const confirmPassword = form.elements['confirm-password'].value;
  const submit = document.querySelector('#submit-button');

  if (password !== confirmPassword) {
    message.textContent = 'Passwords do not match.';
    message.className = 'alert alert-danger';
    return;
  }
  if (!token) {
    message.textContent = 'This password reset link is invalid or expired.';
    message.className = 'alert alert-danger';
    submit.disabled = true;
    return;
  }

  submit.disabled = true;
  message.className = 'alert d-none';
  try {
    const response = await axios.post('/password/resetpassword', { token, password });
    message.textContent = response.data.message;
    message.className = 'alert alert-success';
    form.classList.add('d-none');
  } catch (error) {
    message.textContent = error.response?.data?.message || 'Could not reset password. Please try again.';
    message.className = 'alert alert-danger';
    submit.disabled = false;
  }
});
