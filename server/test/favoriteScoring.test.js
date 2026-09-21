const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// No database: stub Prisma, the favorites repository and the scorer before the
// services load them, and record what the scorer is asked to score.
function stubModule(relative, exports) {
  const file = path.join(__dirname, '..', relative);
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

const profile = { id: 2, requiresRamps: true, maxRouteDistanceKm: null };
const coordinates = [[23.72, 37.97], [23.73, 37.98]];

const stopRows = [
  { routeId: 129, wheelchair: 'no' },
  { routeId: 129, wheelchair: 'yes' },
];

stubModule('config/database.js', {
  mobilityProfile: { findUnique: async () => profile },
  $queryRawUnsafe: async sql => (sql.includes('route_pois') ? stopRows : []),
});

const scoreCalls = [];
stubModule('utils/accessibilityScorer.js', {
  scoreRoute: async (_geometry, _profile, options) => {
    scoreCalls.push(options);
    return { score: options.stops && options.stops.length > 0 ? 67 : 100 };
  },
  evaluate: () => ({ score: 67 }),
  measureRoutePath: async () => null,
  summarizePath: () => ({ measured: false }),
});

stubModule('repositories/routeRepository.js', {
  findAll: async () => [{ id: 129, title: 'Route 129', distanceMeters: 1800, coordinates }],
  findById: async () => null,
});

stubModule('repositories/favoriteRepository.js', {
  getFavorites: async () => [
    { createdAt: '2026-09-01', route: { id: 129, title: 'Route 129', distanceMeters: 1800, coordinates } },
  ],
});

const routeService = require('../services/routeService');
const favoriteService = require('../services/favoriteService');

test('favorites are scored with the route stops, like the route list', async () => {
  scoreCalls.length = 0;
  const [listed] = await routeService.getRoutes({ mobilityProfileId: '2' });
  const listStops = scoreCalls[0].stops;

  scoreCalls.length = 0;
  const [favorite] = await favoriteService.listFavorites(1, '2');
  const favoriteStops = scoreCalls[0].stops;

  assert.deepEqual(favoriteStops, [{ wheelchair: 'no' }, { wheelchair: 'yes' }]);
  assert.deepEqual(favoriteStops, listStops);
  assert.equal(favorite.route.accessibilityScore, listed.accessibilityScore);
  assert.equal(favorite.route.accessibilityScore, 0.67);
  assert.equal(favorite.createdAt, '2026-09-01');
});
