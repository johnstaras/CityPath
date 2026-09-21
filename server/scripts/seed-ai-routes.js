// Populate the generated route catalogue.
//
// Takes the curated landmark set (prisma/data/athens-landmarks.js) and the 100
// composed itineraries (prisma/data/athens-routes.js) and turns each one into a
// real, navigable route by running the ordered stop list through the SAME
// OSRM + dwell-time pipeline the original seeded routes use (scripts/snap-routes.js).
//
// What is authored vs. what is derived:
//   authored  — which landmarks, in what order, plus the title and description
//   derived   — the street-following geometry, the true walking distance, the
//               duration, and each stop's estimated arrival minute
//
// Nothing here invents an accessibility fact. Landmark rows carry conservative,
// hand-checked approach values (see the header of athens-landmarks.js) and are
// stored with dataSource 'admin'; OSM-synced POIs keep dataSource 'osm'. The
// accessibility SCORE shown for a route is not stored at all — routeService
// computes it per request from the route geometry against the user's mobility
// profile, so these routes are scored by exactly the same code as every other.
//
// Routes are written with createdBy 'ai', which is what keeps them in their own
// Home-screen section instead of flooding the main browse list
// (see repositories/routeRepository.js -> buildRouteQuery).
//
// Usage:
//   node scripts/seed-ai-routes.js              # all 100
//   node scripts/seed-ai-routes.js --limit 5    # first 5 (smoke test)
//   node scripts/seed-ai-routes.js --dry-run    # resolve + validate, no writes

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { snapRoute } = require('./snap-routes');
const { LANDMARKS } = require('../prisma/data/athens-landmarks');
const { ROUTES } = require('../prisma/data/athens-routes');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// A snapped route longer than this is a sign the stop order zigzagged across
// the centre rather than describing a coherent walk — reject rather than ship
// a route no one could reasonably follow.
const MAX_ROUTE_METERS = 7000;

// Politeness delay between OSRM calls. The public FOSSGIS instance is a free
// service and this script makes one request per route.
const OSRM_DELAY_MS = 600;

const CREATED_BY = 'ai';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function parseArgs(argv) {
  const limitIndex = argv.indexOf('--limit');
  return {
    limit: limitIndex !== -1 ? parseInt(argv[limitIndex + 1], 10) : null,
    dryRun: argv.includes('--dry-run'),
  };
}

// Landmarks become ordinary POI rows: the same table, columns and geometry
// format as the OSM-synced ones, so every existing query, the detour engine
// and the accessibility scorer treat them identically.
async function upsertLandmarks() {
  for (const { key, id, lat, lng, ...data } of LANDMARKS) {
    await prisma.poi.upsert({
      where: { id },
      update: { ...data, dataSource: 'admin' },
      create: { id, ...data, dataSource: 'admin' },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE pois SET geometry = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
      lng, lat, id,
    );
  }
  console.log(`Landmarks: ${LANDMARKS.length} upserted`);
}

async function seedRoute(definition, byKey) {
  const { id, title, description, category, stops } = definition;

  const landmarks = stops.map(k => byKey.get(k));
  const waypoints = landmarks.map(l => ({ lat: l.lat, lng: l.lng }));

  // Placeholder distance/duration: snapRoute overwrites both with the real
  // values OSRM returns. They exist only because the columns are NOT NULL.
  await prisma.route.upsert({
    where: { id },
    // generatedLive false: catalogue routes are static data, not composed live
    // by the model (only services/aiRouteService.js sets it true).
    update: { title, description, category, createdBy: CREATED_BY, generatedLive: false },
    create: {
      id, title, description, category, createdBy: CREATED_BY, generatedLive: false,
      estimatedDurationMinutes: 0, distanceMeters: 0,
    },
  });

  // Rebuild the stop list from scratch so a re-run with edited stops does not
  // leave orphaned rows from the previous shape of the route.
  await prisma.routePoi.deleteMany({ where: { routeId: id } });
  for (let i = 0; i < landmarks.length; i++) {
    await prisma.routePoi.create({
      data: {
        routeId: id,
        poiId: landmarks[i].id,
        orderIndex: i + 1,
        estimatedArrivalMinutes: 0,
      },
    });
  }

  // Coarse straight-line geometry, immediately replaced by snapRoute. Present
  // so the row is never left with a NULL geometry if snapping fails.
  const wkt = `LINESTRING(${waypoints.map(w => `${w.lng} ${w.lat}`).join(',')})`;
  await prisma.$executeRawUnsafe(
    `UPDATE routes SET geometry = ST_SetSRID(ST_GeomFromText($1), 4326) WHERE id = $2`,
    wkt, id,
  );

  const result = await snapRoute(prisma, { id, title }, waypoints, landmarks);

  if (result.distance > MAX_ROUTE_METERS) {
    throw new Error(`snapped to ${result.distance} m, over the ${MAX_ROUTE_METERS} m limit`);
  }

  return result;
}

async function main() {
  const { limit, dryRun } = parseArgs(process.argv);
  const byKey = new Map(LANDMARKS.map(l => [l.key, l]));
  const definitions = limit ? ROUTES.slice(0, limit) : ROUTES;

  if (dryRun) {
    const unresolved = [];
    for (const r of definitions) {
      for (const s of r.stops) if (!byKey.has(s)) unresolved.push(`${r.id}:${s}`);
    }
    console.log(`Dry run: ${definitions.length} routes, ${LANDMARKS.length} landmarks`);
    console.log(unresolved.length ? `Unresolved stops: ${unresolved.join(', ')}` : 'All stops resolve.');
    return;
  }

  await upsertLandmarks();

  const failures = [];
  let ok = 0;
  let totalDistance = 0;

  for (const definition of definitions) {
    try {
      const { distance, duration, points } = await seedRoute(definition, byKey);
      ok++;
      totalDistance += distance;
      console.log(
        `route ${definition.id} (${definition.title}): ${definition.stops.length} stops -> ` +
        `${points} street points, ${distance} m, ${duration} min`,
      );
    } catch (err) {
      failures.push({ id: definition.id, title: definition.title, error: err.message });
      console.error(`route ${definition.id} (${definition.title}): ${err.message}`);
    }
    await sleep(OSRM_DELAY_MS);
  }

  // Seeding with explicit primary keys leaves the SERIAL sequences behind, so
  // the next runtime insert would collide. Same guard as prisma/seed.js.
  for (const table of ['pois', 'routes']) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`,
    );
  }

  console.log(`\nGenerated routes: ${ok} succeeded, ${failures.length} failed`);
  if (ok > 0) {
    console.log(`Average length: ${Math.round(totalDistance / ok)} m`);
  }
  if (failures.length) {
    console.log('Failed routes:');
    failures.forEach(f => console.log(`  ${f.id} ${f.title} — ${f.error}`));
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
