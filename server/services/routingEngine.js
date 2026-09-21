const osrmClient = require('../utils/osrmClient');
const { scoreRoute } = require('../utils/accessibilityScorer');
const poiRepository = require('../repositories/poiRepository');
const routeRepository = require('../repositories/routeRepository');
const { POI_TO_ROUTE_CATEGORY, accessibilityGateDecision } = require('../utils/aiRouteRules');

const DEFAULT_POI_SEARCH_RADIUS = 1000; // meters
// Duration shown for a detour: walking at the app's display pace plus one stop
// visit (the detour POI), the same model as a route's advertised duration
// (scripts/snap-routes.js: round(distance / 72) + 15 per stop) and the mobile
// «remaining» stat (progressUtils STOP_VISIT_MINUTES). The app recomputes it
// with the walker's measured pace; this is the baseline for other clients.
const DISPLAY_WALK_METERS_PER_SECOND = 1.2;
const STOP_VISIT_SECONDS = 15 * 60;

// Nearby POIs are dominated by cafes/restaurants; a sightseeing detour should
// suggest sights first and fall back to everything else only when needed.
const SIGHT_CATEGORIES = new Set([
  'tourism', 'attraction', 'museum', 'gallery', 'artwork',
  'historical', 'cultural', 'nature', 'monument', 'viewpoint', 'information',
]);

// How many nearby POIs enter the one-shot travel-time matrix. Geometry is
// only fetched for the final top picks, so this can be generous.
const TABLE_CANDIDATES = 30;

// Fraction of the remaining time a detour may ADD on top of finishing the
// route directly. The full triangle (position -> POI -> end) always costs at
// least as much as the direct walk to the end — and the direct walk is what
// the remaining time was computed from — so budgeting the total against the
// remaining time (the pre-2026-08-15 behavior) rejected every candidate at
// normal pace. Only the extra time is a real cost to the user.
const DETOUR_EXTRA_FACTOR = 0.5;

const MAX_SUGGESTIONS = 3;

// Upper bound on geometry fetches per request: for restrictive profiles the
// path-accessibility gate can reject candidate after candidate, and without
// a cap the loop would walk all 30 (one OSRM call each, >10 s of latency)
// just to return an honest empty list.
const MAX_GEOMETRY_ATTEMPTS = 8;

// Multi-criteria ranking weights (documented in
// docs/analysis/06-suggestion-engine.md). Accessibility dominates on
// purpose — it is the app's core value proposition. All terms are 0–1.
const WEIGHTS = {
  accessibility: 0.4,
  timeFit: 0.25,
  affinity: 0.2,
  rating: 0.15,
};

// Destination suitability from the POI's own attributes (the path is scored
// separately by accessibilityScorer on the final geometry).
// 'designated' (built for wheelchair users) counts as 'yes', as the app's
// badges treat it — it used to fall through to unknown (0.5).
const WHEELCHAIR_SCORE = { yes: 1, designated: 1, limited: 0.6, unknown: 0.5, no: 0.1 };

// POI categories -> route categories: POI_TO_ROUTE_CATEGORY, imported from
// utils/aiRouteRules so AI route generation derives route categories from the
// same table. Lets a POI be compared with the user's favorited/completed
// route history.

/** Seconds shown for a detour of `distanceMeters` (see the constants above). */
function detourDisplaySeconds(distanceMeters) {
  return Math.round(Math.max(0, distanceMeters) / DISPLAY_WALK_METERS_PER_SECOND) + STOP_VISIT_SECONDS;
}

const categoryTier = poi => (SIGHT_CATEGORIES.has(poi.category) ? 0 : 1);

// Share of the user's favorited + completed routes matching each category.
// Returns null for users with no history (cold start -> neutral 0.5).
async function getCategoryAffinity(userId) {
  if (!userId) return null;
  const history = await routeRepository.getUserCategoryHistory(userId);
  const total = history.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return null;
  const freq = {};
  for (const row of history) {
    freq[row.category] = row.count / total;
  }
  return freq;
}

/**
 * Calculate the best accessible route between two points.
 * Requests 2-3 alternatives from OSRM, scores each for accessibility,
 * and returns the best-scoring route with adjusted estimated time.
 *
 * @param {{ lat: number, lng: number }} startPoint
 * @param {{ lat: number, lng: number }} endPoint
 * @param {object} mobilityProfile - MobilityProfile record
 * @returns {object|null} Best route with accessibility score, or null if OSRM unavailable
 */
async function calculateRoute(startPoint, endPoint, mobilityProfile) {
  const routes = await osrmClient.getRoute(
    startPoint.lng, startPoint.lat,
    endPoint.lng, endPoint.lat,
    true // request alternatives
  );

  if (!routes || routes.length === 0) {
    return null;
  }

  const scoredRoutes = await Promise.all(
    routes.map(async (route) => {
      // A point-to-point leg with no stop list, so only the path is scored.
      const accessibility = await scoreRoute(route.geometry, mobilityProfile);
      const speedFactor = mobilityProfile.speedFactor || 1.0;
      const adjustedDuration = route.duration / speedFactor;

      return {
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
        estimatedDuration: Math.round(adjustedDuration),
        // Normalized to 0–1, matching GET /api/routes (see routeService).
        // null when the path could not be measured (shown as unknown).
        accessibilityScore: accessibility.score == null ? null : accessibility.score / 100,
        accessibilityIssues: accessibility.issues,
      };
    })
  );

  // Sort by accessibility score descending, then by duration ascending
  scoredRoutes.sort((a, b) => {
    // An unmeasured path (null) ranks below every measured one.
    const aScore = a.accessibilityScore ?? -1;
    const bScore = b.accessibilityScore ?? -1;
    if (bScore !== aScore) {
      return bScore - aScore;
    }
    return a.estimatedDuration - b.estimatedDuration;
  });

  return scoredRoutes[0];
}

/**
 * Find alternative journeys from the current position to nearby unvisited
 * POIs, budgeting the FULL detour (current position -> POI -> route end) so
 * an accepted suggestion still leaves the user where they meant to finish.
 *
 * Two-phase: one OSRM table request prices every candidate at once, then
 * full route geometry is fetched only for the top picks.
 *
 * @param {{ lat: number, lng: number }} currentPosition
 * @param {number} remainingTimeSeconds - Remaining time in seconds
 * @param {object} mobilityProfile - MobilityProfile record
 * @param {number[]} excludedPoiIds - POIs that must not be suggested: stops
 *   already visited AND the current route's own stops (suggesting a stop the
 *   user is already walking toward is not a detour).
 * @param {{ lat: number, lng: number }|null} routeEndPoint - Where the
 *   original route finishes; null falls back to POI-only budgeting.
 * @param {string|null} userId - For category-affinity personalization.
 * @returns {Array} Top 1-3 alternative journeys with POIs and scores
 */
async function getAlternativeRoutes(
  currentPosition,
  remainingTimeSeconds,
  mobilityProfile,
  excludedPoiIds = [],
  routeEndPoint = null,
  userId = null,
) {
  // Two candidate queries: in dense areas the N nearest POIs are all
  // cafes/restaurants, which would push every actual sight out of the pool.
  // Query sights across the whole radius separately, then fill up with the
  // nearest of everything else.
  const [sightPois, otherPois, affinity] = await Promise.all([
    poiRepository.findNearby(
      currentPosition.lat,
      currentPosition.lng,
      DEFAULT_POI_SEARCH_RADIUS,
      { categories: [...SIGHT_CATEGORIES] }
    ),
    poiRepository.findNearby(
      currentPosition.lat,
      currentPosition.lng,
      DEFAULT_POI_SEARCH_RADIUS,
      {}
    ),
    getCategoryAffinity(userId),
  ]);

  const seen = new Set();
  const shortlist = [];
  for (const poi of [...sightPois, ...otherPois]) {
    if (shortlist.length >= TABLE_CANDIDATES) break;
    if (seen.has(poi.id) || excludedPoiIds.includes(poi.id)) continue;
    // Hard filter: the destination itself must suit the mobility profile —
    // an accessible path to an inaccessible sight is not a suggestion.
    if (mobilityProfile.requiresRamps && poi.wheelchair === 'no') continue;
    seen.add(poi.id);
    shortlist.push(poi);
  }

  if (shortlist.length === 0) {
    return [];
  }

  // Both sides of the budget are plain walking time: remaining_time is the
  // app's remaining WALKING estimate (no stop visit time) and OSRM foot
  // durations are walking time too. The extra used to be divided by the
  // profile's speedFactor while the budget was not, so a 0.6 profile saw every
  // detour as 1.67x longer against the same budget (unit mix).
  const extraBudgetSeconds = remainingTimeSeconds * DETOUR_EXTRA_FACTOR;

  // One matrix request prices every candidate: [0] = current position,
  // [1] = route end (when known), [2..] = candidate POIs.
  const hasEnd = routeEndPoint != null;
  const points = hasEnd
    ? [currentPosition, routeEndPoint, ...shortlist]
    : [currentPosition, ...shortlist];
  const durations = await osrmClient.getDurationTable(points);
  if (!durations) {
    return [];
  }

  const firstPoiIndex = hasEnd ? 2 : 1;
  // What finishing WITHOUT the detour costs from here; the budget applies to
  // the difference. Falls back to 0 (whole detour counts as extra) when the
  // route end could not be snapped.
  const directSeconds = hasEnd ? (durations[0]?.[1] ?? 0) : 0;
  const priced = [];
  shortlist.forEach((poi, i) => {
    const idx = firstPoiIndex + i;
    const toPoi = durations[0]?.[idx];
    if (toPoi == null) return; // OSRM could not snap this POI
    const back = hasEnd ? durations[idx]?.[1] : 0;
    if (back == null) return;
    const detourSeconds = toPoi + back;
    const extraSeconds = Math.max(0, detourSeconds - directSeconds);
    if (extraSeconds > extraBudgetSeconds) return;
    priced.push({ poi, detourSeconds, extraSeconds });
  });

  // Multi-criteria score (see docs/analysis/06-suggestion-engine.md):
  //   0.40 destination accessibility + 0.25 time fit
  // + 0.20 category affinity from the user's history + 0.15 avg rating.
  const ratings = await poiRepository.getAverageRatings(priced.map(c => c.poi.id));
  for (const candidate of priced) {
    const { poi, extraSeconds } = candidate;
    const accessibility = WHEELCHAIR_SCORE[poi.wheelchair] ?? WHEELCHAIR_SCORE.unknown;
    const timeFit = 1 - extraSeconds / extraBudgetSeconds;
    const routeCategory = POI_TO_ROUTE_CATEGORY[poi.category];
    const affinityScore =
      affinity == null ? 0.5 : (routeCategory ? (affinity[routeCategory] ?? 0) : 0);
    const ratingScore = ratings[poi.id] != null ? ratings[poi.id] / 5 : 0.5;

    candidate.score =
      WEIGHTS.accessibility * accessibility +
      WEIGHTS.timeFit * timeFit +
      WEIGHTS.affinity * affinityScore +
      WEIGHTS.rating * ratingScore;
  }

  // Sights always outrank other categories; the blended score ranks within
  // each tier.
  priced.sort((a, b) => {
    if (categoryTier(a.poi) !== categoryTier(b.poi)) {
      return categoryTier(a.poi) - categoryTier(b.poi);
    }
    return b.score - a.score;
  });

  // Fetch real geometry for the whole detour (walk to the POI and onward to
  // the original destination) and gate on path accessibility. Returns null
  // when the candidate does not survive.
  const evaluateCandidate = async ({ poi, score }) => {
    const waypoints = hasEnd
      ? [currentPosition, { lat: poi.lat, lng: poi.lng }, routeEndPoint]
      : [currentPosition, { lat: poi.lat, lng: poi.lng }];
    const routes = await osrmClient.getRouteViaWaypoints(waypoints);
    if (!routes || routes.length === 0) {
      return null;
    }

    const route = routes[0];
    // The detour's destination IS the candidate POI, so it is the stop list.
    const accessibility = await scoreRoute(route.geometry, mobilityProfile, { stops: [poi] });

    // Deal-breaker accessibility issues on the path itself — or a path the
    // scorer could not measure at all: an unverified detour is not offered.
    const decision = accessibilityGateDecision(accessibility);
    if (decision !== 'pass') {
      if (decision === 'unverifiable') {
        console.warn(`Detour candidate POI ${poi.id} excluded: accessibility could not be verified`);
      }
      return null;
    }

    return {
      // Full POI record: the client needs the accessibility attributes when
      // the user switches their journey toward this stop.
      poi,
      route: {
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
        // Seconds to finish via this POI: display-pace walk + the POI visit.
        estimatedDuration: detourDisplaySeconds(route.distance),
      },
      // Normalized to 0–1, matching GET /api/routes (see routeService).
      accessibilityScore: accessibility.score / 100,
      accessibilityIssues: accessibility.issues,
      rejoinsRoute: hasEnd,
      // Blended ranking score — surfaced for transparency/debugging.
      suggestionScore: Number(score.toFixed(3)),
    };
  };

  // Two parallel waves: the top picks usually all survive, so the common
  // case costs one round-trip; a second wave only runs when restrictive
  // profiles reject the leaders (capped so an honest empty answer is fast).
  const waveOne = priced.slice(0, MAX_SUGGESTIONS);
  const waveTwo = priced.slice(MAX_SUGGESTIONS, MAX_GEOMETRY_ATTEMPTS);

  let candidates = (await Promise.all(waveOne.map(evaluateCandidate))).filter(Boolean);
  if (candidates.length < MAX_SUGGESTIONS && waveTwo.length > 0) {
    const extra = (await Promise.all(waveTwo.map(evaluateCandidate))).filter(Boolean);
    candidates = candidates.concat(extra);
  }

  return candidates.slice(0, MAX_SUGGESTIONS);
}

module.exports = {
  calculateRoute,
  getAlternativeRoutes,
  detourDisplaySeconds,
  WHEELCHAIR_SCORE,
};
