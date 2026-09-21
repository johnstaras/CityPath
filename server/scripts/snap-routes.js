// Seed enrichment: snap each route's coarse geometry to real pedestrian
// streets using the public OSRM foot profile (FOSSGIS
// routing.openstreetmap.de), then store the street-following LineString, the
// real walking distance, and a recalculated duration back into the routes
// table.
//
// Runs automatically at the end of `prisma db seed`; can also be run alone
// (DB must be up):
//   node scripts/snap-routes.js
const path = require('path');
const { getOsrmUrl, OSRM_TIMEOUT_MS } = require('../config/osrmConfig');

// OSRM instance with a pedestrian profile (config/osrmConfig.js, OSRM_URL); the
// "driving" path segment is a fixed placeholder in OSRM's URL scheme, the
// instance itself routes on foot.
const osrmRouteBase = () => `${getOsrmUrl()}/route/v1/driving`;

// Same average pace the mobile viewmodel assumes (1.2 m/s ≈ 4.3 km/h).
const WALK_METERS_PER_MIN = 72;
// Sightseeing time budgeted per POI stop on top of the walking time.
const POI_DWELL_MIN = 15;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const OSRM_HEADERS = { 'User-Agent': 'CityPaths-seed-enrichment (diploma project)' };

async function fetchOsrm(coords, { alternatives = false } = {}) {
  const url = `${osrmRouteBase()}/${coords}?overview=full&geometries=geojson&steps=false`
    + `&alternatives=${alternatives ? '3' : 'false'}`;
  let res;
  try {
    // Bounded: live AI generation calls this inside a request the mobile app
    // abandons after 10 s, and fetch has no timeout of its own.
    res = await fetch(url, { headers: OSRM_HEADERS, signal: AbortSignal.timeout(OSRM_TIMEOUT_MS) });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error(`OSRM timed out after ${OSRM_TIMEOUT_MS} ms`);
    }
    throw new Error(`OSRM unreachable: ${err.message}`);
  }
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const body = await res.json();
  if (body.code !== 'Ok' || !body.routes?.length) {
    throw new Error(`OSRM returned ${body.code}`);
  }
  return body.routes;
}

// Step avoidance cannot be done against the public FOSSGIS foot profile, and
// this is where an attempt at it was removed. Recorded so it is not retried:
//
//   - `exclude=steps` (and any other class) returns
//     "Exclude flag combination is not supported" — the profile defines none.
//   - `alternatives` only applies to TWO-coordinate requests. A four-stop route
//     returns exactly one path however many alternatives are asked for.
//   - Routing each leg separately to get real alternatives, then keeping the
//     leg with fewest metres of steps, was measured over ten step-heavy routes:
//     it reduced steps on 2, left 5 unchanged, and made 3 WORSE (a chain of
//     per-leg optima is not a good whole path). It also costs n-1 OSRM calls.
//
// The profile simply does not penalise `highway=steps`, so every path it
// returns is equally willing to use them. Genuine avoidance needs a
// self-hosted OSRM with a foot profile that excludes or heavily penalises
// steps — one `OSRM_URL` change once such an instance exists. Until then the
// accessibility scorer gates honestly on what the path actually crosses.
async function snapRoute(prisma, route, waypoints, pois) {
  const poiCount = pois.length;
  const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');

  const snapped = (await fetchOsrm(coords))[0];
  const distance = Math.round(snapped.distance);
  const duration =
    Math.round(distance / WALK_METERS_PER_MIN) + poiCount * POI_DWELL_MIN;

  await prisma.$executeRawUnsafe(
    `UPDATE routes
     SET geometry = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
         distance_meters = $2,
         estimated_duration_minutes = $3
     WHERE id = $4`,
    JSON.stringify(snapped.geometry),
    distance,
    duration,
    route.id,
  );

  // When the waypoints are the route's POIs, OSRM returns one leg per stop
  // pair — derive each stop's arrival time from the walked legs plus the
  // sightseeing dwell spent at every earlier stop.
  const legs = snapped.legs ?? [];
  if (poiCount >= 2 && legs.length === poiCount - 1) {
    let arrival = 0;
    for (let i = 0; i < poiCount; i++) {
      if (i > 0) {
        arrival +=
          Math.round(legs[i - 1].distance / WALK_METERS_PER_MIN) + POI_DWELL_MIN;
      }
      await prisma.$executeRawUnsafe(
        `UPDATE route_pois SET estimated_arrival_minutes = $1
         WHERE route_id = $2 AND order_index = $3`,
        arrival,
        route.id,
        i + 1,
      );
    }
  }

  // geometry is returned so a caller inside an uncommitted transaction (live AI
  // generation) can score the path without reading the row back.
  return { points: snapped.geometry.coordinates.length, distance, duration, geometry: snapped.geometry };
}

async function snapAllRoutes(prisma) {
  const routes = await prisma.$queryRawUnsafe(
    `SELECT r.id, r.title, r.distance_meters AS "distanceMeters",
            ST_AsGeoJSON(r.geometry)::json AS geometry
     FROM routes r ORDER BY r.id`,
  );

  for (const route of routes) {
    const pois = await prisma.$queryRawUnsafe(
      `SELECT ST_Y(p.geometry::geometry) AS lat, ST_X(p.geometry::geometry) AS lng
       FROM route_pois rp JOIN pois p ON p.id = rp.poi_id
       WHERE rp.route_id = $1 ORDER BY rp.order_index`,
      route.id,
    );

    // Route through the ordered POIs; fall back to the stored geometry's
    // points for routes without at least two POIs.
    const waypoints =
      pois.length >= 2
        ? pois
        : (route.geometry?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng }));

    if (waypoints.length < 2) {
      console.warn(`route ${route.id} (${route.title}): no usable waypoints, skipped`);
      continue;
    }

    try {
      const { points, distance, duration } = await snapRoute(
        prisma, route, waypoints, pois,
      );
      console.log(
        `route ${route.id} (${route.title}): ${waypoints.length} waypoints -> ` +
        `${points} street points, ${distance} m, ${duration} min`,
      );
    } catch (err) {
      console.error(`route ${route.id} (${route.title}): ${err.message}`);
    }

    await sleep(1000); // be polite to the public instance
  }
}

// snapRoute is exported alongside snapAllRoutes so the generated-route
// pipeline (scripts/seed-ai-routes.js, services/aiRouteService.js) derives
// geometry, distance, duration and per-stop arrival times through exactly the
// same code path as the original seeded routes — there is no second, parallel
// implementation of "turn an ordered stop list into a real walkable route".
module.exports = { snapAllRoutes, snapRoute };

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  const prisma = require('../config/database');
  snapAllRoutes(prisma)
    .then(() => prisma.$disconnect())
    .catch(e => { console.error(e); process.exit(1); });
}
