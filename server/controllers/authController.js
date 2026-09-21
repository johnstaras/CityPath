const {
  verifyGoogleToken,
  verifyJWT,
  findOrCreateUser,
  generateJWT,
  generateRefreshToken,
  refreshAccessToken,
  logoutSession,
  INVALID_REFRESH_TOKEN,
} = require('../services/authService');
const prisma = require('../config/database');

async function googleLogin(req, res) {
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    // Only a rejected Google token is an authentication failure (401). Anything
    // after it (database, token issue) is a server error: answering 401 for
    // those told the user their Google account was refused.
    let googlePayload;
    try {
      googlePayload = await verifyGoogleToken(idToken);
    } catch (error) {
      console.error('Google token verification failed:', error.message);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const user = await findOrCreateUser(googlePayload);
    const token = generateJWT(user);
    const refreshToken = await generateRefreshToken(user.id);

    // Check if user has a profile set up
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });

    res.json({
      token,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      hasProfile: !!profile,
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again later.' });
  }
}

async function refresh(req, res) {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }

    const tokens = await refreshAccessToken(refreshToken);
    res.json(tokens);
  } catch (error) {
    // 401 means "this refresh token is dead, sign in again" and the mobile
    // client logs out on it. A database or server failure must not say that.
    if (error.code === INVALID_REFRESH_TOKEN) {
      return res.status(401).json({ error: 'Invalid or expired refresh token. Please login again.' });
    }
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Could not refresh the session' });
  }
}

// The user id of a valid Bearer access token, or null. Logout must not REQUIRE
// one: an expired access token is exactly when the refresh token still needs
// revoking.
function userIdFromAuthHeader(header) {
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    return verifyJWT(header.slice('Bearer '.length)).userId || null;
  } catch {
    return null;
  }
}

async function logout(req, res) {
  try {
    const userId = userIdFromAuthHeader(req.headers.authorization);
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null;

    if (!userId && !refreshToken) {
      return res.status(400).json({ error: 'refreshToken or a valid access token is required' });
    }

    // Revokes all of the identified user's refresh tokens (UC-12). An unknown
    // refresh token is still a successful logout: nothing is left to revoke.
    await logoutSession({ userId, refreshToken });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
}

module.exports = { googleLogin, refresh, logout, userIdFromAuthHeader };
