const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function stubModule(relative, exports) {
  const file = path.join(__dirname, '..', relative);
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

// Everything with a side effect is stubbed: no database, OSRM or model call.
const state = {};
const wheelchair = { id: 4, name: 'Wheelchair', avoidStairs: true, requiresRamps: true };
const pois = [1, 2, 3, 4].map(id => ({
  id, name: `Place ${id}`, category: 'museum', wheelchair: 'yes', lat: 37.97, lng: 23.72, distance_meters: 100,
}));

const tx = {
  route: { create: async () => ({ id: 77 }) },
  routePoi: { create: async () => ({}) },
  $executeRawUnsafe: async () => 1,
};
stubModule('config/database.js', {
  $transaction: async fn => {
    state.transactions += 1;
    const result = await fn(tx); // a throw here is a rollback
    state.commits += 1;
    return result;
  },
});
stubModule('config/aiConfig.js', { enabled: true });
stubModule('repositories/poiRepository.js', { findNearby: async () => pois });
stubModule('services/routeService.js', {
  resolveProfile: async id => state.resolveProfile(id),
  getRouteDetails: async id => ({ id }),
});
stubModule('services/aiProviders.js', { proposeRoute: async request => state.proposeRoute(request) });
stubModule('scripts/snap-routes.js', {
  snapRoute: async () => ({ distance: 1000, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }),
});
stubModule('utils/accessibilityScorer.js', {
  scoreRoute: async () => (state.onScore ? state.onScore() : state.score),
});

const { generateRoute } = require('../services/aiRouteService');

const position = { lat: 37.97, lng: 23.72 };
const proposal = { title: 'Walk', description: 'A walk.', stop_poi_ids: [1, 2, 3] };

function reset(overrides = {}) {
  Object.assign(state, {
    transactions: 0,
    commits: 0,
    modelCalls: 0,
    score: { score: 90, issues: [] },
    onScore: null,
    resolveProfile: async () => wheelchair,
    proposeRoute: async () => { state.modelCalls += 1; return proposal; },
  }, overrides);
}

test.beforeEach(t => {
  t.mock.method(console, 'warn', () => {});
});

test('an unknown mobility profile id is rejected, not silently unscored', async () => {
  reset({ resolveProfile: async () => null });
  await assert.rejects(generateRoute(position, 999, null), { code: 'INVALID_MOBILITY_PROFILE' });
  assert.equal(state.modelCalls, 0);
});

test('a non-retryable provider error becomes PROVIDER_ERROR immediately', async () => {
  reset({
    proposeRoute: async () => {
      state.modelCalls += 1;
      throw Object.assign(new Error('401 invalid x-api-key'), { retryable: false, status: 401 });
    },
  });
  await assert.rejects(generateRoute(position, 4, null), err => {
    assert.equal(err.code, 'PROVIDER_ERROR');
    assert.doesNotMatch(err.message, /api-key/);
    return true;
  });
  assert.equal(state.modelCalls, 1);
});

test('gate rejections on every attempt end as NO_SUITABLE_ROUTE with nothing committed', async () => {
  reset({ score: { score: 0, issues: ['Route runs along 12 m of steps with no ramp'] } });
  await assert.rejects(generateRoute(position, 4, null), { code: 'NO_SUITABLE_ROUTE' });
  assert.equal(state.transactions, 2);
  assert.equal(state.commits, 0);
});

test('a successful proposal commits once', async () => {
  reset();
  const route = await generateRoute(position, 4, null);
  assert.deepEqual(route, { id: 77 });
  assert.equal(state.commits, 1);
});

test('a client that disconnects before the commit gets nothing saved', async () => {
  reset();
  const controller = new AbortController();
  // Disconnect while the route is being scored, i.e. inside the transaction.
  state.onScore = () => { controller.abort(); return { score: 90, issues: [] }; };
  await assert.rejects(
    generateRoute(position, 4, null, { signal: controller.signal }),
    { code: 'CLIENT_DISCONNECTED' },
  );
  assert.equal(state.transactions, 1);
  assert.equal(state.commits, 0);
});

test('a client already gone skips the model call entirely', async () => {
  reset();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    generateRoute(position, 4, null, { signal: controller.signal }),
    { code: 'CLIENT_DISCONNECTED' },
  );
  assert.equal(state.modelCalls, 0);
});
