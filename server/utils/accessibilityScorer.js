const prisma = require('../config/database');

// ── Geometric tolerances ──────────────────────────────────────────────────
// A route snapped to OSM ways and a barrier drawn on those same ways should
// very nearly coincide, so these are tight on purpose. The old 50 m radius was
// what turned the score into a measure of POI density.
const PATH_TOLERANCE_M = 4;     // route "runs along" a barrier line
const KERB_TOLERANCE_M = 6;     // route passes over a kerb node
const BENCH_TOLERANCE_M = 25;   // a bench is usable from the path

// A staircase counts as ON the route only if the route runs along it: the
// route distance between the projections of the staircase's two ends must be at
// least this fraction of the staircase's own length. A staircase meeting the
// route at an angle (a building entrance or side stairs beside the pavement)
// projects to almost a single point and is not on the route, however close.
const STEPS_ALONG_RATIO = 0.5;
// Overlap below this is rounding noise, not a step the user must climb.
const STEPS_MIN_M = 1;

// ── Penalty weights ───────────────────────────────────────────────────────
// Every term is bounded. The previous version summed an unbounded per-POI
// penalty, so a route through a busy street accumulated hundreds of points of
// penalty and clamped to 0 no matter how walkable it actually was.
const PENALTY = {
  COBBLESTONE_MAX: 30,    // scaled by the FRACTION of the route on cobbles
  KERB_MAX: 20,           // scaled by count, capped
  NO_REST_STOPS: 15,      // profile needs rest stops, none found
  FEW_REST_STOPS: 8,      // fewer than the profile's interval implies
  DESTINATION_MAX: 25,    // scaled by the route's OWN stops, not passers-by
  DISTANCE_EXCEEDED: 20,
};

// How unsuitable a destination is, 0..1, by its recorded wheelchair tag.
// `unknown` is missing data, not a confirmed barrier, so it costs far less
// than `no` — 43% of OSM POIs are unknown and punishing that at full weight
// meant sparse mapping looked like inaccessibility.
const DESTINATION_WEIGHT = { no: 1, limited: 0.5, unknown: 0.25, yes: 0, designated: 0 };

/**
 * Measure how the route interacts with the walking surface.
 *
 * All four questions are answered against `path_barriers`, which stores steps
 * and cobblestone as LINES and kerbs and benches as POINTS. That is what makes
 * "does this route traverse a staircase" answerable at all — the previous
 * implementation only had centroids in `pois` and had to approximate it with
 * "is a staircase within 50 m", which in central Athens is almost always true.
 */
// Values under `min` are noise: report them as 0.
function atLeast(value, min) {
  return value >= min ? value : 0;
}

async function measurePath(geojsonStr) {
  const rows = await prisma.$queryRawUnsafe(
    `WITH route AS (
       SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom
     ),
     -- every staircase within the path tolerance, with how much of the route
     -- runs along it (along_m: route distance between the projections of its
     -- two ends) — the basis for "on the route" vs "beside the route"
     steps_near AS (
       SELECT
         b.has_ramp,
         ST_Length(b.geometry::geography) AS steps_len_m,
         ST_Length(ST_Intersection(
           ST_Buffer(b.geometry::geography, $2)::geometry, r.geom)::geography) AS overlap_m,
         ABS(ST_LineLocatePoint(r.geom, ST_EndPoint(b.geometry))
             - ST_LineLocatePoint(r.geom, ST_StartPoint(b.geometry)))
           * ST_Length(r.geom::geography) AS along_m
       FROM path_barriers b, route r
       WHERE b.kind = 'steps'
         AND ST_DWithin(b.geometry::geography, r.geom::geography, $2)
     )
     SELECT
       -- metres of this route that run ALONG a ramp-less staircase
       COALESCE((
         SELECT SUM(overlap_m) FROM steps_near
         WHERE NOT has_ramp AND steps_len_m > 0 AND along_m >= $5 * steps_len_m
       ), 0) AS steps_m,
       -- metres of this route that run along a staircase that HAS a ramp
       COALESCE((
         SELECT SUM(overlap_m) FROM steps_near
         WHERE has_ramp AND steps_len_m > 0 AND along_m >= $5 * steps_len_m
       ), 0) AS ramped_steps_m,
       -- metres of this route on cobblestone
       COALESCE((
         SELECT SUM(ST_Length(ST_Intersection(
                  ST_Buffer(b.geometry::geography, $2)::geometry, r.geom)::geography))
         FROM path_barriers b, route r
         WHERE b.kind = 'cobblestone'
           AND ST_DWithin(b.geometry::geography, r.geom::geography, $2)
       ), 0) AS cobble_m,
       -- raised kerbs crossed (flush and lowered ones are marked has_ramp)
       COALESCE((
         SELECT COUNT(*) FROM path_barriers b, route r
         WHERE b.kind = 'kerb' AND b.has_ramp = FALSE
           AND ST_DWithin(b.geometry::geography, r.geom::geography, $3)
       ), 0) AS raised_kerbs,
       -- lowered or flush kerbs crossed
       COALESCE((
         SELECT COUNT(*) FROM path_barriers b, route r
         WHERE b.kind = 'kerb' AND b.has_ramp = TRUE
           AND ST_DWithin(b.geometry::geography, r.geom::geography, $3)
       ), 0) AS lowered_kerbs,
       COALESCE((
         SELECT COUNT(*) FROM path_barriers b, route r
         WHERE b.kind = 'bench'
           AND ST_DWithin(b.geometry::geography, r.geom::geography, $4)
       ), 0) AS benches,
       (SELECT ST_Length(geom::geography) FROM route) AS length_m`,
    geojsonStr,
    PATH_TOLERANCE_M,
    KERB_TOLERANCE_M,
    BENCH_TOLERANCE_M,
    STEPS_ALONG_RATIO,
  );

  const row = rows[0] || {};
  return {
    stepsMeters: atLeast(Number(row.steps_m) || 0, STEPS_MIN_M),
    rampedStepsMeters: atLeast(Number(row.ramped_steps_m) || 0, STEPS_MIN_M),
    cobbleMeters: Number(row.cobble_m) || 0,
    raisedKerbs: Number(row.raised_kerbs) || 0,
    loweredKerbs: Number(row.lowered_kerbs) || 0,
    benches: Number(row.benches) || 0,
    lengthMeters: Number(row.length_m) || 0,
  };
}

/**
 * The scoring rules, over an already-measured route.
 *
 * Pure and synchronous so the rules can be read and tested on their own, and so
 * there is one definition of what a score means. Every term is bounded and, where
 * it depends on quantity, normalised by route length or stop count — the score
 * describes THIS route, never how busy the neighbourhood happens to be.
 *
 * @param {object} path - output of measurePath
 * @param {object} profile - MobilityProfile record
 * @param {Array<{wheelchair: string}>} stops - the route's own stops (optional)
 * @returns {{ score: number, issues: string[] }}
 */
function evaluate(path, profile, stops) {
  let score = 100;
  const issues = [];

  // ── Deal-breaker: the path itself is impassable ────────────────────────
  // Any ramp-less staircase ON the route, however short, blocks a profile that
  // avoids stairs. Staircases merely beside the route never reach stepsMeters
  // (see steps_near in measurePath), so this is strict without false alarms,
  // and it is the same number the route details show as "Steps on the route".
  if (profile.avoidStairs && path.stepsMeters > 0) {
    return {
      score: 0,
      issues: [`Route runs along ${Math.round(path.stepsMeters)} m of steps with no ramp`],
    };
  }

  // ── Cobblestone, as a proportion of the walk ───────────────────────────
  if (profile.avoidCobblestone && path.cobbleMeters > 0 && path.lengthMeters > 0) {
    const fraction = Math.min(1, path.cobbleMeters / path.lengthMeters);
    const penalty = Math.round(PENALTY.COBBLESTONE_MAX * fraction);
    if (penalty > 0) {
      score -= penalty;
      issues.push(`${Math.round(fraction * 100)}% of the route is cobblestone`);
    }
  }

  // ── Raised kerbs actually crossed ──────────────────────────────────────
  if (profile.requiresRamps && path.raisedKerbs > 0) {
    const penalty = Math.min(PENALTY.KERB_MAX, path.raisedKerbs * 4);
    score -= penalty;
    issues.push(`${path.raisedKerbs} raised kerb${path.raisedKerbs > 1 ? 's' : ''} on the route`);
  }

  // ── Rest stops, against the interval the profile actually needs ────────
  if (profile.restStopIntervalM && path.lengthMeters > 0) {
    const expected = Math.floor(path.lengthMeters / profile.restStopIntervalM);
    if (path.benches === 0) {
      score -= PENALTY.NO_REST_STOPS;
      issues.push('No benches or rest areas along the route');
    } else if (expected > 0 && path.benches < expected) {
      score -= PENALTY.FEW_REST_STOPS;
      issues.push(`Only ${path.benches} rest stop${path.benches > 1 ? 's' : ''} for a ${(path.lengthMeters / 1000).toFixed(1)} km walk`);
    }
  }

  // ── Destination suitability: the route's OWN stops ─────────────────────
  // Not every business within 50 m. A cafe with wheelchair: no beside the path
  // says nothing about whether the path can be walked, and counting them made
  // the score a function of commercial density.
  if (profile.requiresRamps && stops && stops.length > 0) {
    const total = stops.reduce(
      (sum, stop) => sum + (DESTINATION_WEIGHT[stop.wheelchair] ?? DESTINATION_WEIGHT.unknown),
      0,
    );
    const penalty = Math.round(PENALTY.DESTINATION_MAX * (total / stops.length));
    if (penalty > 0) {
      score -= penalty;
      const blocked = stops.filter(s => s.wheelchair === 'no').length;
      issues.push(
        blocked > 0
          ? `${blocked} of ${stops.length} stops are not wheelchair accessible`
          : `Accessibility of some stops is unconfirmed`,
      );
    }
  }

  // ── Distance against the profile's limit ───────────────────────────────
  if (profile.maxRouteDistanceKm && path.lengthMeters > 0) {
    const lengthKm = path.lengthMeters / 1000;
    if (lengthKm > profile.maxRouteDistanceKm) {
      score -= PENALTY.DISTANCE_EXCEEDED;
      issues.push(`Route distance (${lengthKm.toFixed(1)} km) exceeds recommended max (${profile.maxRouteDistanceKm} km)`);
    }
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

/**
 * Score a route's accessibility for a mobility profile.
 *
 * Takes geometry rather than a route id so it also works for a path that is not
 * in the database yet — an OSRM alternative at a checkpoint, or a freshly
 * generated route being validated before it is kept.
 *
 * @param {object} routeGeometry - GeoJSON LineString from OSRM or PostGIS
 * @param {object} mobilityProfile - MobilityProfile record
 * @param {{ stops?: Array<{wheelchair: string}> }} [options] - the route's own
 *   stops. Omit them and the destination term is skipped; pass them consistently
 *   across list and detail responses so a route does not score differently in
 *   two places.
 * @returns {{ score: number|null, issues: string[], unavailable?: true }}
 *   `score` is null (with `unavailable: true`) when the path could not be
 *   measured. That is "cannot verify", NOT a middling score: gates must treat it
 *   as a failure (utils/aiRouteRules.accessibilityGateDecision) and display
 *   paths must show it as unknown. It used to be 50, which silently passed both
 *   the AI generation gate and the detour gate.
 */
async function scoreRoute(routeGeometry, mobilityProfile, options = {}) {
  if (!routeGeometry || !mobilityProfile) {
    return { score: 100, issues: [] };
  }

  try {
    const path = await measurePath(JSON.stringify(routeGeometry));
    return evaluate(path, mobilityProfile, options.stops);
  } catch (error) {
    console.error('Accessibility scoring failed, score unavailable:', error.message);
    return { score: null, issues: ['Accessibility data unavailable'], unavailable: true };
  }
}

/**
 * Measure a whole route's walking surface, or null if it cannot be measured.
 *
 * @param {object} routeGeometry - GeoJSON LineString
 * @returns {Promise<object|null>} output of measurePath
 */
async function measureRoutePath(routeGeometry) {
  if (!routeGeometry) return null;
  try {
    return await measurePath(JSON.stringify(routeGeometry));
  } catch (error) {
    console.error('Path measurement failed:', error.message);
    return null;
  }
}

/**
 * What the user is told about the WHOLE path (route details chips).
 *
 * The "no stairs" claim must hold for every metre of the route, not for its
 * stops: a wheelchair user relies on it to decide whether the walk is possible.
 * So it is derived from the same path measurement as the score. Pure.
 *
 * @param {object|null} path - output of measurePath, or null when unmeasured
 */
function summarizePath(path) {
  if (!path) return { measured: false };
  const cobblestonePercent = path.lengthMeters > 0
    ? Math.round(Math.min(1, path.cobbleMeters / path.lengthMeters) * 100)
    : 0;
  return {
    measured: true,
    // Rounded up so a measured 1.2 m never displays as "0 m" / "no steps".
    stepsMeters: Math.ceil(path.stepsMeters),
    rampedStepsMeters: Math.round(path.rampedStepsMeters || 0),
    cobblestonePercent,
    raisedKerbs: path.raisedKerbs,
    loweredKerbs: path.loweredKerbs || 0,
    lengthMeters: Math.round(path.lengthMeters),
  };
}

/**
 * Does this path force a step-avoiding user over a staircase?
 *
 * Used by the routing layer to reject a candidate path before it is ever
 * offered, rather than building it and scoring it as impassable afterwards.
 *
 * @param {object} routeGeometry - GeoJSON LineString
 * @returns {Promise<number|null>} metres of ramp-less steps on the path, or
 *   null if the measurement failed (never 0, which would read as "no steps")
 */
async function measureStepsOnPath(routeGeometry) {
  if (!routeGeometry) return 0;
  try {
    const path = await measurePath(JSON.stringify(routeGeometry));
    return path.stepsMeters;
  } catch (error) {
    console.error('Step measurement failed:', error.message);
    return null;
  }
}

module.exports = {
  scoreRoute,
  evaluate,
  measureRoutePath,
  summarizePath,
  measureStepsOnPath,
  STEPS_ALONG_RATIO,
  STEPS_MIN_M,
};
