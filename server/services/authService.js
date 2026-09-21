const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/database');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- Google Token Verification ---

async function verifyGoogleToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

// --- User Management ---

async function findOrCreateUser(googlePayload) {
  const { sub: googleId, email, name, picture } = googlePayload;

  let user = await prisma.user.findUnique({ where: { googleId } });

  if (!user) {
    user = await prisma.user.create({
      data: { googleId, email, name, avatarUrl: picture },
    });
  }

  return user;
}

// --- JWT (Access Token) ---
// 7 days (designed as 1 hour; lengthened in 8cafcc2 for development convenience)

function generateJWT(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyJWT(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// --- Refresh Token ---
// Long-lived: 30 days, stored in database

// Thrown for a refresh token that does not exist, has expired, or was already
// rotated by a concurrent request. The controller answers 401 for exactly this
// code (the client must sign in again) and 500 for anything else (database
// down, etc.), which the client must NOT treat as a dead session.
const INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN';

function invalidRefreshToken(message) {
  return Object.assign(new Error(message), { code: INVALID_REFRESH_TOKEN });
}

async function generateRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Housekeeping on the one path that adds rows: drop THIS user's expired
  // tokens (a handful at most), so abandoned devices do not accumulate forever.
  await cleanExpiredTokens(userId);

  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });

  return token;
}

async function refreshAccessToken(refreshToken) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored) {
    throw invalidRefreshToken('Invalid refresh token');
  }

  if (stored.expiresAt < new Date()) {
    // Expired — delete it and reject
    await prisma.refreshToken.deleteMany({ where: { id: stored.id } });
    throw invalidRefreshToken('Refresh token expired');
  }

  // Rotate refresh token (delete old, create new) for security. deleteMany
  // rather than delete: if a concurrent request already rotated this token the
  // count is 0 and the token is reported invalid, not as a server error.
  const { count } = await prisma.refreshToken.deleteMany({ where: { id: stored.id } });
  if (count === 0) {
    throw invalidRefreshToken('Refresh token already used');
  }

  const newAccessToken = generateJWT(stored.user);
  const newRefreshToken = await generateRefreshToken(stored.userId);

  return { token: newAccessToken, refreshToken: newRefreshToken };
}

async function revokeRefreshTokens(userId) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

/**
 * End a session (UC-12). Works without a valid access token, so a user whose
 * access token has already expired can still sign out.
 *
 * Who is signed out: the user identified by a valid access token, otherwise the
 * owner of the presented refresh token. As before, ALL of that user's refresh
 * tokens are revoked (every device), matching UC-12 step 4. An unknown refresh
 * token is a no-op: there is nothing left to revoke.
 *
 * @param {{ userId?: string|null, refreshToken?: string|null }} session
 * @returns {Promise<boolean>} whether a user was identified
 */
async function logoutSession({ userId, refreshToken }) {
  let owner = userId || null;
  if (!owner && refreshToken) {
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    owner = stored?.userId || null;
  }
  if (!owner) return false;
  await revokeRefreshTokens(owner);
  return true;
}

// Delete expired refresh tokens: one user's when userId is given (called on
// every token issue), otherwise all of them.
async function cleanExpiredTokens(userId) {
  const where = { expiresAt: { lt: new Date() } };
  if (userId) where.userId = userId;
  const result = await prisma.refreshToken.deleteMany({ where });
  return result.count;
}

module.exports = {
  verifyGoogleToken,
  findOrCreateUser,
  generateJWT,
  verifyJWT,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshTokens,
  logoutSession,
  cleanExpiredTokens,
  INVALID_REFRESH_TOKEN,
};
