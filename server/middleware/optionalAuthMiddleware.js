const { verifyJWT } = require('../services/authService');

// Like authMiddleware, but never rejects: a valid Bearer token sets req.userId
// (used for personalisation), while a missing, invalid or expired token lets
// the request through anonymously.
function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyJWT(token);
    req.userId = decoded.userId;
  } catch (error) {
    // Invalid or expired token: continue without a user.
  }
  next();
}

module.exports = optionalAuthMiddleware;
