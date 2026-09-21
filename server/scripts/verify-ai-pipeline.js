// Verifies the AI route generation pipeline WITHOUT calling a real model and
// without needing any API key.
//
// Only the model call is stubbed. Everything that protects the user is real and
// exercised: candidate selection, the id-validation trust boundary, OSRM
// routing, snapRoute, the accessibility gate, persistence and rollback.
//
// This is the check to run before a demo, and the evidence behind the claim
// that a hallucinated place cannot reach the map.
//
//   node scripts/verify-ai-pipeline.js
//
// Exits non-zero if any assertion fails. Leaves the database exactly as found.

require('dotenv').config();
process.env.AI_ROUTE_GENERATION = 'on';
process.env.AI_ROUTE_BASE_URL = 'http://stub.invalid/v1';
process.env.AI_ROUTE_API_KEY = 'stub-key';

const providersPath = require.resolve('../services/aiProviders');
const prisma = require('../config/database');

let mode = 'valid';

// Replace the provider module in the require cache before aiRouteService pulls
// it in, so the service under test is otherwise completely untouched.
require.cache[providersPath] = {
  id: providersPath,
  filename: providersPath,
  loaded: true,
  exports: {
    proposeRoute: async ({ message }) => {
      // Read the ids straight out of the rendered candidate list, so the stub
      // always answers with places that genuinely were on offer.
      const ids = [...message.matchAll(/^(\d+) \| /gm)].map(m => Number(m[1]));
      if (mode === 'hallucinate') {
        return {
          title: 'Ghost Walk',
          description: 'Two invented ids mixed in with real ones.',
          stop_poi_ids: [999999, 888888, ids[0], ids[1], ids[2]],
        };
      }
      if (mode === 'allbad') {
        return {
          title: 'All Ghosts',
          description: 'Every id invented.',
          stop_poi_ids: [999999, 888888],
        };
      }
      return {
        title: 'Stubbed Central Walk',
        description: 'A generated walk through the historic centre.',
        stop_poi_ids: ids.slice(0, 4),
      };
    },
  },
};

const aiRouteService = require('../services/aiRouteService');
const aiConfig = require('../config/aiConfig');

const SYNTAGMA = { lat: 37.9755, lng: 23.7348 };

let failures = 0;
function check(label, condition, detail) {
  const status = condition ? 'PASS' : 'FAIL';
  if (!condition) failures++;
  console.log(`  [${status}] ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const routesBefore = await prisma.route.count();
  const created = [];

  console.log('\n1. Happy path');
  mode = 'valid';
  const route = await aiRouteService.generateRoute(SYNTAGMA, 1, 'something historic');
  created.push(route.id);
  check('route persisted', route.id != null, `id ${route.id}`);
  check('stops attached (3-6)', route.pois.length >= 3 && route.pois.length <= 6, `${route.pois.length} stops`);
  check('real geometry from OSRM', route.coordinates.length > 10, `${route.coordinates.length} points`);
  check('distance derived', route.distanceMeters > 0, `${route.distanceMeters} m`);
  check('duration derived', route.estimatedDurationMinutes > 0, `${route.estimatedDurationMinutes} min`);
  check('arrival times derived', route.pois.slice(1).every(p => p.estimatedArrivalMinutes > 0),
    route.pois.map(p => p.estimatedArrivalMinutes).join(', '));
  check('accessibility scored', route.accessibilityScore != null, String(route.accessibilityScore));
  check("provenance is 'ai'", route.createdBy === 'ai', route.createdBy);
  check('marked as live AI', route.isLiveAi === true, String(route.isLiveAi));

  console.log('\n2. Invented ids are dropped, real ones kept');
  mode = 'hallucinate';
  const partial = await aiRouteService.generateRoute(SYNTAGMA, 1, null);
  created.push(partial.id);
  check('only real places kept', partial.pois.length === 3, `${partial.pois.length} stops (5 proposed, 2 invented)`);

  console.log('\n3. All ids invented — refused, nothing left behind');
  mode = 'allbad';
  const countBefore = await prisma.route.count();
  let rejected = null;
  try {
    await aiRouteService.generateRoute(SYNTAGMA, 1, null);
  } catch (err) {
    rejected = err;
  }
  check('request refused', rejected?.code === 'INVALID_PROPOSAL', rejected?.message);
  check('no rows leaked', (await prisma.route.count()) === countBefore);

  console.log('\n4. Switch off — refused before any model call');
  mode = 'valid';
  const wasEnabled = aiConfig.enabled;
  aiConfig.enabled = false;
  let disabled = null;
  try {
    await aiRouteService.generateRoute(SYNTAGMA, 1, null);
  } catch (err) {
    disabled = err;
  }
  aiConfig.enabled = wasEnabled;
  check('request refused', disabled?.code === 'AI_DISABLED', disabled?.message);

  // Leave the database as we found it.
  for (const id of created) {
    await prisma.routePoi.deleteMany({ where: { routeId: id } });
    await prisma.route.delete({ where: { id } }).catch(() => {});
  }
  const routesAfter = await prisma.route.count();
  console.log('\n5. Cleanup');
  check('database unchanged', routesAfter === routesBefore, `${routesBefore} routes before, ${routesAfter} after`);

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
