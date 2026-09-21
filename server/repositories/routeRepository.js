const prisma = require('../config/database');

// Upper bound on a single list response. Raised from 50 when the generated
// catalogue landed: with 105 routes in the table a 50-row cap silently hid
// half the app's content from search and filtering. Safe to raise because
// routeService strips the route geometry from list responses, which was ~85%
// of the payload.
const LIST_LIMIT = 200;

// Build the route-list query. When includeLocation is true it adds the spatial
// distance filter + ordering; otherwise it keeps only the attribute filters
// (category / duration / search). The location-less form is reused as a
// fallback so a no-match nearby still respects the user's category/time filters
// instead of returning every route.
function buildRouteQuery(filters, includeLocation) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (includeLocation) {
    const radiusMeters = filters.radius || 5000;
    conditions.push(
      `ST_DWithin(r.geometry::geography, ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography, $${paramIndex + 2})`
    );
    params.push(filters.lng, filters.lat, radiusMeters);
    paramIndex += 3;
  }

  if (filters.category) {
    conditions.push(`r.category = $${paramIndex}`);
    params.push(filters.category);
    paramIndex++;
  }

  if (filters.maxDurationMinutes) {
    conditions.push(`r.estimated_duration_minutes <= $${paramIndex}`);
    params.push(filters.maxDurationMinutes);
    paramIndex++;
  }

  if (filters.minDurationMinutes) {
    conditions.push(`r.estimated_duration_minutes >= $${paramIndex}`);
    params.push(filters.minDurationMinutes);
    paramIndex++;
  }

  if (filters.q) {
    conditions.push(
      `(r.title ILIKE $${paramIndex} OR r.description ILIKE $${paramIndex})`
    );
    params.push(`%${filters.q}%`);
    paramIndex++;
  }

  // Optional provenance filter. Left unset by the main browse list on purpose:
  // the generated catalogue is the bulk of the app's content, so hiding it by
  // default would leave five routes to search and filter. The Home screen's
  // generated-routes section passes createdBy='ai' to show only those.
  if (filters.createdBy) {
    conditions.push(`r.created_by = $${paramIndex}`);
    params.push(filters.createdBy);
    paramIndex++;
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const distanceSelect = includeLocation
    ? `, ST_Distance(r.geometry::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters`
    : '';

  const orderClause = includeLocation
    ? 'ORDER BY distance_meters'
    : 'ORDER BY r.id';

  const sql = `
    SELECT
      r.id, r.title, r.description, r.category,
      r.estimated_duration_minutes AS "estimatedDurationMinutes",
      r.distance_meters AS "distanceMeters",
      r.created_by AS "createdBy",
      r.generated_live AS "generatedLive",
      r.updated_at AS "updatedAt",
      ST_AsGeoJSON(r.geometry)::json AS geometry,
      (SELECT p.photo_url FROM route_pois rp JOIN pois p ON p.id = rp.poi_id WHERE rp.route_id = r.id AND p.photo_url IS NOT NULL ORDER BY rp.order_index LIMIT 1) AS "imageUrl"
      ${distanceSelect}
    FROM routes r
    ${whereClause}
    ${orderClause}
    LIMIT ${LIST_LIMIT}
  `;

  return { sql, params };
}

async function findAll(filters = {}) {
  const hasLocation = filters.lat != null && filters.lng != null;

  const main = buildRouteQuery(filters, hasLocation);
  let results = await prisma.$queryRawUnsafe(main.sql, ...main.params);

  // If the nearby search returned nothing, retry without the location
  // constraint but keep the category/duration/search filters intact.
  if (results.length === 0 && hasLocation) {
    const fallback = buildRouteQuery(filters, false);
    results = await prisma.$queryRawUnsafe(fallback.sql, ...fallback.params);
  }

  return results.map(row => {
    const route = {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      estimatedDurationMinutes: row.estimatedDurationMinutes,
      distanceMeters: row.distanceMeters,
      createdBy: row.createdBy,
      // true only for a route the LLM composed live (aiRouteService); the
      // curated catalogue is also createdBy 'ai' but isLiveAi false.
      isLiveAi: row.generatedLive === true,
      updatedAt: row.updatedAt,
      coordinates: row.geometry ? row.geometry.coordinates : [],
      imageUrl: row.imageUrl || null,
    };
    if (row.distance_meters != null) {
      route.distance_meters = Math.round(Number(row.distance_meters));
    }
    return route;
  });
}

async function findById(id) {
  const routeResults = await prisma.$queryRawUnsafe(
    `SELECT
      r.id, r.title, r.description, r.category,
      r.estimated_duration_minutes AS "estimatedDurationMinutes",
      r.distance_meters AS "distanceMeters",
      r.created_by AS "createdBy",
      r.generated_live AS "generatedLive",
      r.updated_at AS "updatedAt",
      ST_AsGeoJSON(r.geometry)::json AS geometry
    FROM routes r
    WHERE r.id = $1`,
    id
  );

  if (routeResults.length === 0) return null;

  const row = routeResults[0];

  const poiResults = await prisma.$queryRawUnsafe(
    `SELECT
      rp.order_index AS "orderIndex",
      rp.estimated_arrival_minutes AS "estimatedArrivalMinutes",
      p.id, p.name, p.description, p.category,
      p.photo_url AS "photoUrl", p.wheelchair, p.surface,
      p.has_ramp AS "hasRamp", p.has_tactile_paving AS "hasTactilePaving",
      p.has_rest_area AS "hasRestArea", p.opening_hours AS "openingHours",
      ST_Y(p.geometry::geometry) AS lat,
      ST_X(p.geometry::geometry) AS lng
    FROM route_pois rp
    JOIN pois p ON p.id = rp.poi_id
    WHERE rp.route_id = $1
    ORDER BY rp.order_index`,
    id
  );

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    distanceMeters: row.distanceMeters,
    createdBy: row.createdBy,
    isLiveAi: row.generatedLive === true,
    updatedAt: row.updatedAt,
    coordinates: row.geometry ? row.geometry.coordinates : [],
    pois: poiResults.map(poi => ({
      ...poi,
      lat: Number(poi.lat),
      lng: Number(poi.lng),
    })),
  };
}

// Category distribution of the routes a user has favorited or completed —
// the signal behind profile-based (non-AI) suggestion personalization.
async function getUserCategoryHistory(userId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT r.category, COUNT(*)::int AS cnt
     FROM (
       SELECT route_id FROM favorites WHERE user_id = $1
       UNION ALL
       SELECT route_id FROM route_sessions WHERE user_id = $1 AND status = 'completed'
     ) h
     JOIN routes r ON r.id = h.route_id
     GROUP BY r.category`,
    userId
  );
  return rows.map(row => ({ category: row.category, count: Number(row.cnt) }));
}

module.exports = {
  findAll,
  findById,
  getUserCategoryHistory,
};
