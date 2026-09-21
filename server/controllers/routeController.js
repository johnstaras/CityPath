const routeService = require('../services/routeService');
const routingEngine = require('../services/routingEngine');
const prisma = require('../config/database');
const { parseRemainingTime } = require('../utils/queryParsers');

async function listRoutes(req, res) {
  try {
    const { lat, lng, radius, category, time, q, mobilityProfileId, createdBy } = req.query;

    const filters = {};
    if (lat && lng) {
      filters.lat = parseFloat(lat);
      filters.lng = parseFloat(lng);
      if (isNaN(filters.lat) || isNaN(filters.lng)) {
        return res.status(400).json({ error: 'lat and lng must be valid numbers' });
      }
      if (radius) filters.radius = parseInt(radius, 10);
    }
    if (category) filters.category = category;
    if (time) {
      // A trailing "+" (e.g. "180+") means "this long or more"; otherwise the
      // value is an upper bound (e.g. "60" = up to an hour).
      if (String(time).endsWith('+')) {
        filters.minDurationMinutes = parseInt(time, 10);
      } else {
        filters.maxDurationMinutes = parseInt(time, 10);
      }
    }
    if (q) filters.q = q;
    if (mobilityProfileId) filters.mobilityProfileId = mobilityProfileId;
    // Only the two provenances the app actually writes are accepted, so this
    // never becomes a way to probe arbitrary column values.
    if (createdBy === 'ai' || createdBy === 'admin') filters.createdBy = createdBy;

    const routes = await routeService.getRoutes(filters);
    res.json(routes);
  } catch (error) {
    console.error('List routes error:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
}

async function getRoute(req, res) {
  try {
    const routeId = parseInt(req.params.id, 10);

    if (isNaN(routeId)) {
      return res.status(400).json({ error: 'Invalid route ID' });
    }

    const route = await routeService.getRouteDetails(routeId, req.query.mobilityProfileId);

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json(route);
  } catch (error) {
    console.error('Get route error:', error);
    res.status(500).json({ error: 'Failed to fetch route' });
  }
}

async function getAlternatives(req, res) {
  try {
    const { lat, lng, remaining_time, mobility_profile_id, visited_pois } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ error: 'lat and lng must be valid numbers' });
    }

    const remaining = parseRemainingTime(remaining_time);
    if (!remaining.ok) {
      return res.status(400).json({ error: remaining.error });
    }
    const remainingTimeSeconds = remaining.seconds;

    // No time left (the app sends its remaining WALKING estimate in whole
    // seconds, so 0 only when the walk is effectively over): a checkpoint with
    // nothing left in the budget has nothing to suggest. Answer before any DB/OSRM work.
    if (remainingTimeSeconds === 0) {
      return res.json([]);
    }

    // Load mobility profile (default to id=1 if not specified)
    const profileId = mobility_profile_id ? parseInt(mobility_profile_id, 10) : 1;
    const mobilityProfile = await prisma.mobilityProfile.findUnique({
      where: { id: profileId },
    });

    if (!mobilityProfile) {
      return res.status(404).json({ error: 'Mobility profile not found' });
    }

    // Parse visited POI IDs
    const visitedPoiIds = visited_pois
      ? visited_pois.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
      : [];

    // Where the current route finishes — the detour budget covers getting
    // there, not just reaching the suggested POI. The route's own stops are
    // also excluded from the candidate pool: the user is already walking
    // toward them, so offering one as a "detour" is noise.
    let routeEndPoint = null;
    const excludedPoiIds = [...visitedPoiIds];
    const routeId = parseInt(req.params.id, 10);
    if (!isNaN(routeId)) {
      const currentRoute = await routeService.getRouteDetails(routeId);
      const coords = currentRoute?.coordinates;
      if (coords && coords.length > 0) {
        const [endLng, endLat] = coords[coords.length - 1];
        routeEndPoint = { lat: endLat, lng: endLng };
      }
      for (const poi of currentRoute?.pois ?? []) {
        if (!excludedPoiIds.includes(poi.id)) excludedPoiIds.push(poi.id);
      }
    }

    const alternatives = await routingEngine.getAlternativeRoutes(
      { lat: parsedLat, lng: parsedLng },
      remainingTimeSeconds,
      mobilityProfile,
      excludedPoiIds,
      routeEndPoint,
      req.userId
    );

    // Flatten to the Route shape the mobile app renders (id/title/duration/
    // distance), instead of the engine's internal {poi, route} pairs.
    res.json(alternatives.map(alt => ({
      id: alt.poi.id,
      title: alt.poi.name,
      category: alt.poi.category,
      distanceMeters: Math.round(alt.route.distance),
      // Time to finish via the POI (walk + the POI visit), not scaled by the
      // profile's speedFactor — the same model as a route card's duration.
      // The app replaces it with the same model at the walker's own pace.
      estimatedDurationMinutes: Math.max(1, Math.round(alt.route.estimatedDuration / 60)),
      accessibilityScore: alt.accessibilityScore,
      lat: alt.poi.lat,
      lng: alt.poi.lng,
      // For the seamless in-place switch: the walking path (via the POI and
      // onward to the original route's end when known) and the POI itself
      // (with its accessibility attributes).
      geometry: alt.route.geometry,
      poi: alt.poi,
      rejoinsRoute: alt.rejoinsRoute === true,
      // Route-shaped for the client, but a detour to an existing POI, never an
      // AI-composed route. Present so every Route JSON carries the field.
      isLiveAi: false,
      suggestionScore: alt.suggestionScore,
    })));
  } catch (error) {
    console.error('Get alternatives error:', error);
    res.status(500).json({ error: 'Failed to fetch alternative routes' });
  }
}

module.exports = { listRoutes, getRoute, getAlternatives };
