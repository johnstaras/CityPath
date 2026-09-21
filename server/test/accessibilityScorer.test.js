const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Stub the Prisma client before the scorer loads it, so the spatial query can
// be made to fail (or return fixed measurements) without a database.
const databasePath = path.join(__dirname, '..', 'config', 'database.js');
const fakePrisma = {
  $queryRawUnsafe: async () => { throw new Error('connection refused'); },
};
require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: fakePrisma,
};

const { scoreRoute, measureStepsOnPath } = require('../utils/accessibilityScorer');
const { accessibilityGateDecision } = require('../utils/aiRouteRules');

const geometry = { type: 'LineString', coordinates: [[23.72, 37.97], [23.73, 37.98]] };
const wheelchair = { avoidStairs: true, requiresRamps: true };

test('scorer failure returns score null (not 50) and is flagged unavailable', async t => {
  t.mock.method(console, 'error', () => {});
  fakePrisma.$queryRawUnsafe = async () => { throw new Error('connection refused'); };
  const result = await scoreRoute(geometry, wheelchair, { stops: [] });
  assert.equal(result.score, null);
  assert.equal(result.unavailable, true);
  assert.deepEqual(result.issues, ['Accessibility data unavailable']);
});

test('a failed score cannot pass the AI or detour gate', async t => {
  t.mock.method(console, 'error', () => {});
  fakePrisma.$queryRawUnsafe = async () => { throw new Error('connection refused'); };
  const result = await scoreRoute(geometry, wheelchair, { stops: [] });
  assert.equal(accessibilityGateDecision(result), 'unverifiable');
});

test('a measured path still scores and passes normally', async () => {
  fakePrisma.$queryRawUnsafe = async () => [
    { steps_m: 0, cobble_m: 0, raised_kerbs: 0, benches: 3, length_m: 800 },
  ];
  const result = await scoreRoute(geometry, wheelchair, { stops: [{ wheelchair: 'yes' }] });
  assert.equal(result.score, 100);
  assert.equal(accessibilityGateDecision(result), 'pass');
});

test('a deal-breaker path is rejected, not unverifiable', async () => {
  fakePrisma.$queryRawUnsafe = async () => [
    { steps_m: 40, cobble_m: 0, raised_kerbs: 0, benches: 0, length_m: 800 },
  ];
  const result = await scoreRoute(geometry, wheelchair, { stops: [] });
  assert.equal(result.score, 0);
  assert.equal(accessibilityGateDecision(result), 'reject');
});

test('steps measurement failure is null, not 0 ("no steps")', async t => {
  t.mock.method(console, 'error', () => {});
  fakePrisma.$queryRawUnsafe = async () => { throw new Error('boom'); };
  assert.equal(await measureStepsOnPath(geometry), null);
});

test('any staircase on the route blocks a stairs-avoiding profile (no graze allowance)', async () => {
  fakePrisma.$queryRawUnsafe = async () => [
    { steps_m: 3, ramped_steps_m: 0, cobble_m: 0, raised_kerbs: 0, lowered_kerbs: 0, benches: 3, length_m: 800 },
  ];
  const result = await scoreRoute(geometry, wheelchair, { stops: [{ wheelchair: 'yes' }] });
  assert.equal(result.score, 0);
});

test('sub-metre overlap is noise, not steps', async () => {
  fakePrisma.$queryRawUnsafe = async () => [
    { steps_m: 0.4, ramped_steps_m: 0, cobble_m: 0, raised_kerbs: 0, lowered_kerbs: 0, benches: 3, length_m: 800 },
  ];
  const result = await scoreRoute(geometry, wheelchair, { stops: [{ wheelchair: 'yes' }] });
  assert.equal(result.score, 100);
});
