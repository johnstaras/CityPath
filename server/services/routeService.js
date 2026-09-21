const routeRepository = require('../repositories/routeRepository');
const prisma = require('../config/database');
const { scoreRoute, evaluate, measureRoutePath, summarizePath } = require('../utils/accessibilityScorer');

// Pedestrian baseline used when the request doesn't specify a mobility profile.
// Matches the default used by the alternative-routes endpoint.
const DEFAULT_PROFILE_ID = 1;

async function resolveProfile(mobilityProfileId) {
  const id = mobilityProfileId ? parseInt(mobilityProfileId, 10) : DEFAULT_PROFILE_ID;
  if (isNaN(id)) return null;
  return prisma.mobilityProfile.findUnique({ where: { id } });
}

// Score a route against the resolved mobility profile: the walking surface it
// crosses (steps, cobblestone, kerbs, benches from `path_barriers`) plus the
// accessibility of its own stops. Returns the route with accessibilityScore
// normalized to 0–1 (the scale the mobile RouteCard/RouteDetails expect).
async function attachAccessibility(route, profile, stops) {
  if (!profile || !route.coordinates || route.coordinates.length < 2) {
    return route;
  }
  const geometry = { type: 'LineString', coordinates: route.coordinates };
  // Stops are passed in both the list and the detail path on purpose: the
  // destination term of the score depends on them, so omitting them in one
  // place would make the same route score differently in two screens.
  const { score } = await scoreRoute(geometry, profile, { stops });
  // A failed measurement is null, not 0: null/100 would be 0 and render as
  // "not accessible". The mobile badge maps null to "unknown".
  return { ...route, accessibilityScore: score == null ? null : score / 100 };
}

// One query for the whole page's stops, keyed by route.
async function fetchStopsByRoute(routeIds) {
  if (routeIds.length === 0) return new Map();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT rp.route_id AS "routeId", p.wheelchair
     FROM route_pois rp JOIN pois p ON p.id = rp.poi_id
     WHERE rp.route_id = ANY($1)
     ORDER BY rp.route_id, rp.order_index`,
    routeIds,
  );
  const byRoute = new Map(routeIds.map(id => [id, []]));
  for (const row of rows) {
    byRoute.get(row.routeId)?.push({ wheelchair: row.wheelchair });
  }
  return byRoute;
}

// Score a list of routes with their own stops. Every screen that shows a list
// of route badges (Home, curated strip, Favorites) goes through here, so the
// same route never scores differently on two screens: before this, Favorites
// scored without stops and e.g. an elderly user's route 129 read "partial ·
// 67%" on Home but "accessible" in Favorites.
async function scoreRoutes(routes, profile) {
  const stopsByRoute = profile
    ? await fetchStopsByRoute(routes.map(r => r.id))
    : new Map();
  return Promise.all(
    routes.map(route => attachAccessibility(route, profile, stopsByRoute.get(route.id))),
  );
}

async function getRoutes(filters) {
  let routes = await routeRepository.findAll(filters);

  const profile = await resolveProfile(filters.mobilityProfileId);

  // Only hard-filter by max distance when the user explicitly picked a profile.
  if (profile && filters.mobilityProfileId) {
    routes = routes.filter(route => {
      if (profile.maxRouteDistanceKm && route.distanceMeters > profile.maxRouteDistanceKm * 1000) {
        return false;
      }
      return true;
    });
  }

  const scored = await scoreRoutes(routes, profile);

  // Drop the geometry from the LIST response: the client never draws a path
  // from this endpoint (RouteCard shows title/duration/distance/badge, and the
  // map screens refetch the full route via GET /routes/:id). With the generated
  // catalogue in place it was ~85% of the payload.
  return scored.map(({ coordinates, ...route }) => route);
}

async function getRouteDetails(routeId, mobilityProfileId) {
  const route = await routeRepository.findById(routeId);
  if (!route) return null;

  const profile = await resolveProfile(mobilityProfileId);
  if (!route.coordinates || route.coordinates.length < 2) {
    return { ...route, pathAccessibility: summarizePath(null) };
  }
  // One path measurement serves both the score and the path facts shown as
  // chips ("no stairs on the route" etc.), so the two can never disagree.
  // findById already loaded the stops; reuse them rather than re-querying.
  const geometry = { type: 'LineString', coordinates: route.coordinates };
  const path = await measureRoutePath(geometry);
  const score = path && profile ? evaluate(path, profile, route.pois).score : null;
  return {
    ...route,
    accessibilityScore: profile ? (score == null ? null : score / 100) : route.accessibilityScore,
    pathAccessibility: summarizePath(path),
  };
}

module.exports = {
  getRoutes,
  getRouteDetails,
  resolveProfile,
  attachAccessibility,
  scoreRoutes,
};
