const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Stub the auth service and database before the controller loads them. The
// controller destructures its imports, so each stub delegates to `impl`, which
// the tests replace.
function stubModule(relative, exports) {
  const file = path.join(__dirname, '..', relative);
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

const impl = {};
const INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN';
stubModule('services/authService.js', {
  verifyGoogleToken: (...a) => impl.verifyGoogleToken(...a),
  verifyJWT: (...a) => impl.verifyJWT(...a),
  findOrCreateUser: (...a) => impl.findOrCreateUser(...a),
  generateJWT: (...a) => impl.generateJWT(...a),
  generateRefreshToken: (...a) => impl.generateRefreshToken(...a),
  refreshAccessToken: (...a) => impl.refreshAccessToken(...a),
  logoutSession: (...a) => impl.logoutSession(...a),
  INVALID_REFRESH_TOKEN,
});
stubModule('config/database.js', {
  userProfile: { findUnique: async () => null },
});

const { googleLogin, refresh, logout } = require('../controllers/authController');

function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.body = body; return res; };
  return res;
}

test('refresh: an invalid or expired refresh token is a 401', async t => {
  t.mock.method(console, 'error', () => {});
  impl.refreshAccessToken = async () => {
    throw Object.assign(new Error('Refresh token expired'), { code: INVALID_REFRESH_TOKEN });
  };
  const res = fakeRes();
  await refresh({ body: { refreshToken: 'rt' } }, res);
  assert.equal(res.statusCode, 401);
});

test('refresh: a server failure is a 500, not a 401 that would log the user out', async t => {
  t.mock.method(console, 'error', () => {});
  impl.refreshAccessToken = async () => { throw new Error('connection refused'); };
  const res = fakeRes();
  await refresh({ body: { refreshToken: 'rt' } }, res);
  assert.equal(res.statusCode, 500);
});

test('googleLogin: a rejected Google token is a 401', async t => {
  t.mock.method(console, 'error', () => {});
  impl.verifyGoogleToken = async () => { throw new Error('Wrong recipient'); };
  const res = fakeRes();
  await googleLogin({ body: { idToken: 'bad' } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Authentication failed');
});

test('googleLogin: a failure after verification is a 500 with a generic message', async t => {
  t.mock.method(console, 'error', () => {});
  impl.verifyGoogleToken = async () => ({ sub: 'g1', email: 'a@b.c', name: 'A' });
  impl.findOrCreateUser = async () => { throw new Error('database is down'); };
  const res = fakeRes();
  await googleLogin({ body: { idToken: 'good' } }, res);
  assert.equal(res.statusCode, 500);
  assert.doesNotMatch(res.body.error, /database/);
});

test('logout: works with only a refresh token (expired access token)', async () => {
  impl.verifyJWT = () => { throw new Error('jwt expired'); };
  const calls = [];
  impl.logoutSession = async session => { calls.push(session); return true; };
  const res = fakeRes();
  await logout({ headers: { authorization: 'Bearer expired' }, body: { refreshToken: 'rt' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [{ userId: null, refreshToken: 'rt' }]);
});

test('logout: a valid access token identifies the user', async () => {
  impl.verifyJWT = () => ({ userId: 'u1' });
  const calls = [];
  impl.logoutSession = async session => { calls.push(session); return true; };
  const res = fakeRes();
  await logout({ headers: { authorization: 'Bearer valid' }, body: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [{ userId: 'u1', refreshToken: null }]);
});

test('logout: neither a refresh token nor a valid access token is a 400', async () => {
  impl.verifyJWT = () => { throw new Error('jwt expired'); };
  impl.logoutSession = async () => { throw new Error('must not be called'); };
  const res = fakeRes();
  await logout({ headers: { authorization: 'Bearer expired' }, body: {} }, res);
  assert.equal(res.statusCode, 400);
});
