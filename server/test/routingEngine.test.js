const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// No database and no OSRM: stub Prisma and the path scorer before the engine
// loads them, then replace the OSRM / repository calls per test.
function stubModule(relativePath, exports) {
  const file = path.join(__dirname, '..', relativePath);
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stubModule('config/database.js', {});
stubModule('utils/accessibilityScorer.js', {
  scoreRoute: async () => ({ score: 90, issues: [] }),
});

const osrmClient = require('../utils/osrmClient');
const poiRepository = require('../repositories/poiRepository');
const routeRepository = require('../repositories/routeRepository');
const routingEngine = require('../services/routingEngine');

const position = { lat: 37.975, lng: 23.73 };
const routeEnd = { lat: 37.97, lng: 23.72 };
const poi = (id, extra = {}) => ({
  id, name: `POI ${id}`, category: 'museum', wheelchair: 'yes', lat: 37.976, lng: 23.731, ...extra,
});

// One candidate; durations[0][1] = direct walk to the end, durations[0][2] /
// durations[2][1] = the walk to the POI and from it to the end.
function mockEngine(t, { pois, direct, toPoi, back, distance = 900 }) {
  t.mock.method(poiRepository, 'findNearby', async (_lat, _lng, _radius, opts) =>
    (opts && opts.categories ? pois : []));
  t.mock.method(poiRepository, 'getAverageRatings', async () => ({}));
  t.mock.method(routeRepository, 'getUserCategoryHistory', async () => []);
  t.mock.method(osrmClient, 'getDurationTable', async points => {
    const n = points.length;
    const m = Array.from({ length: n }, () => Array(n).fill(0));
    m[0][1] = direct;
    for (let i = 2; i < n; i++) {
      m[0][i] = toPoi;
      m[i][1] = back;
    }
    return m;
  });
  t.mock.method(osrmClient, 'getRouteViaWaypoints', async () => [
    { geometry: { type: 'LineString', coordinates: [[23.73, 37.975], [23.72, 37.97]] }, distance, duration: toPoi + back },
  ]);
}

test('detour budget: the extra walking time is NOT divided by the profile speedFactor', async t => {
  // Direct 600 s, via the POI 600 + 500 = 1100 s -> 500 s extra.
  // Budget = remaining 1000 s * 0.5 = 500 s -> fits exactly. Dividing the
  // detour by speedFactor 0.6 (the old unit mix) made the extra 1233 s.
  mockEngine(t, { pois: [poi(1)], direct: 600, toPoi: 600, back: 500 });
  const slowProfile = { speedFactor: 0.6, requiresRamps: false };
  const result = await routingEngine.getAlternativeRoutes(position, 1000, slowProfile, [], routeEnd, null);
  assert.equal(result.length, 1);
  assert.equal(result[0].poi.id, 1);
});

test('detour budget: a detour whose extra walking exceeds half the remaining time is rejected', async t => {
  mockEngine(t, { pois: [poi(1)], direct: 600, toPoi: 600, back: 501 });
  const result = await routingEngine.getAlternativeRoutes(
    position, 1000, { speedFactor: 1, requiresRamps: false }, [], routeEnd, null,
  );
  assert.equal(result.length, 0);
});

test('detour duration: display-pace walk plus one stop visit, independent of speedFactor', async t => {
  mockEngine(t, { pois: [poi(1)], direct: 600, toPoi: 600, back: 500, distance: 1440 });
  const result = await routingEngine.getAlternativeRoutes(
    position, 1000, { speedFactor: 0.6, requiresRamps: false }, [], routeEnd, null,
  );
  // 1440 m / 1.2 m/s = 1200 s walking + 900 s visit.
  assert.equal(result[0].route.estimatedDuration, 2100);
  assert.equal(routingEngine.detourDisplaySeconds(1440), 2100);
  // Same as a route card: round(1440 / 72) + 15 = 35 min.
  assert.equal(Math.round(result[0].route.estimatedDuration / 60), Math.round(1440 / 72) + 15);
});

test("wheelchair 'designated' scores like 'yes', not like unknown", () => {
  assert.equal(routingEngine.WHEELCHAIR_SCORE.designated, routingEngine.WHEELCHAIR_SCORE.yes);
});

test("a 'designated' POI outranks an otherwise identical 'unknown' one", async t => {
  mockEngine(t, {
    pois: [poi(1, { wheelchair: 'unknown' }), poi(2, { wheelchair: 'designated' })],
    direct: 600,
    toPoi: 600,
    back: 400,
  });
  const result = await routingEngine.getAlternativeRoutes(
    position, 1000, { speedFactor: 1, requiresRamps: true }, [], routeEnd, null,
  );
  assert.deepEqual(result.map(r => r.poi.id), [2, 1]);
});
