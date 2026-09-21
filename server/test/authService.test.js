const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Fake Prisma: records every refreshToken call so the rules can be checked
// without a database.
const databasePath = path.join(__dirname, '..', 'config', 'database.js');
const calls = [];
const store = { tokens: [] };
const fakePrisma = {
  refreshToken: {
    findUnique: async ({ where }) => {
      calls.push(['findUnique', where]);
      const row = store.tokens.find(t => t.token === where.token);
      return row ? { ...row, user: { id: row.userId, email: 'a@b.c' } } : null;
    },
    create: async ({ data }) => { calls.push(['create', data]); return data; },
    deleteMany: async ({ where }) => {
      calls.push(['deleteMany', where]);
      return { count: store.deleteCount ?? 1 };
    },
  },
};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: fakePrisma };

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const auth = require('../services/authService');

function reset(tokens = [], deleteCount) {
  calls.length = 0;
  store.tokens = tokens;
  store.deleteCount = deleteCount;
}

const future = () => new Date(Date.now() + 60_000);

test('an unknown refresh token is rejected with INVALID_REFRESH_TOKEN', async () => {
  reset();
  await assert.rejects(auth.refreshAccessToken('nope'), { code: auth.INVALID_REFRESH_TOKEN });
});

test('an expired refresh token is rejected with INVALID_REFRESH_TOKEN', async () => {
  reset([{ id: 1, token: 'old', userId: 'u1', expiresAt: new Date(Date.now() - 1000) }]);
  await assert.rejects(auth.refreshAccessToken('old'), { code: auth.INVALID_REFRESH_TOKEN });
});

test('a token already rotated by a concurrent request is invalid, not a server error', async () => {
  reset([{ id: 1, token: 'rt', userId: 'u1', expiresAt: future() }], 0);
  await assert.rejects(auth.refreshAccessToken('rt'), { code: auth.INVALID_REFRESH_TOKEN });
});

test('a database failure is NOT tagged as an invalid token', async () => {
  reset();
  const original = fakePrisma.refreshToken.findUnique;
  fakePrisma.refreshToken.findUnique = async () => { throw new Error('connection refused'); };
  try {
    await assert.rejects(auth.refreshAccessToken('rt'), err => err.code !== auth.INVALID_REFRESH_TOKEN);
  } finally {
    fakePrisma.refreshToken.findUnique = original;
  }
});

test('issuing a refresh token first deletes only that user\'s expired tokens', async () => {
  reset();
  await auth.generateRefreshToken('u1');
  const [first, second] = calls;
  assert.equal(first[0], 'deleteMany');
  assert.equal(first[1].userId, 'u1');
  assert.ok(first[1].expiresAt.lt instanceof Date);
  assert.equal(second[0], 'create');
});

test('logout by refresh token revokes all of its owner\'s tokens', async () => {
  reset([{ id: 1, token: 'rt', userId: 'u7', expiresAt: future() }]);
  assert.equal(await auth.logoutSession({ userId: null, refreshToken: 'rt' }), true);
  assert.deepEqual(calls.at(-1), ['deleteMany', { userId: 'u7' }]);
});

test('logout with an unknown refresh token and no user revokes nothing', async () => {
  reset();
  assert.equal(await auth.logoutSession({ userId: null, refreshToken: 'unknown' }), false);
  assert.equal(calls.some(c => c[0] === 'deleteMany'), false);
});
