function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Please log in to continue.' });
  }
  return next();
}

function requireLoginPage(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/');
  return next();
}

module.exports = { requireLogin, requireLoginPage };
