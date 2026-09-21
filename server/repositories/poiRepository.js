const prisma = require('../config/database');

async function findNearby(lat, lng, radiusMeters, filters = {}) {
  const conditions = [];
  const params = [lng, lat, radiusMeters];
  let paramIndex = 4;

  if (filters.category) {
    conditions.push(`p.category = $${paramIndex}`);
    params.push(filters.category);
    paramIndex++;
  }

  if (filters.categories && filters.categories.length > 0) {
    conditions.push(`p.category = ANY($${paramIndex})`);
    params.push(filters.categories);
    paramIndex++;
  }

  if (filters.wheelchair) {
    conditions.push(`p.wheelchair = $${paramIndex}`);
    params.push(filters.wheelchair);
    paramIndex++;
  }

  const whereClause = conditions.length > 0
    ? 'AND ' + conditions.join(' AND ')
    : '';

  const sql = `
    SELECT
      p.id, p.osm_id AS "osmId", p.name, p.description, p.category,
      p.photo_url AS "photoUrl", p.wheelchair, p.surface,
      p.has_ramp AS "hasRamp", p.has_tactile_paving AS "hasTactilePaving",
      p.has_rest_area AS "hasRestArea", p.opening_hours AS "openingHours",
      ST_Y(p.geometry::geometry) AS lat,
      ST_X(p.geometry::geometry) AS lng,
      ST_Distance(
        p.geometry::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_meters
    FROM pois p
    WHERE ST_DWithin(
      p.geometry::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    ${whereClause}
    ORDER BY distance_meters
    LIMIT 50
  `;

  const results = await prisma.$queryRawUnsafe(sql, ...params);

  return results.map(row => ({
    ...row,
    osmId: row.osmId ? Number(row.osmId) : null,
    lat: Number(row.lat),
    lng: Number(row.lng),
    distance_meters: Math.round(Number(row.distance_meters)),
  }));
}

async function findById(id) {
  const results = await prisma.$queryRawUnsafe(
    `SELECT
      p.id, p.osm_id AS "osmId", p.name, p.description, p.category,
      p.photo_url AS "photoUrl", p.wheelchair, p.surface,
      p.has_ramp AS "hasRamp", p.has_tactile_paving AS "hasTactilePaving",
      p.has_rest_area AS "hasRestArea", p.opening_hours AS "openingHours",
      p.data_source AS "dataSource", p.updated_at AS "updatedAt",
      ST_Y(p.geometry::geometry) AS lat,
      ST_X(p.geometry::geometry) AS lng
    FROM pois p
    WHERE p.id = $1`,
    id
  );

  if (results.length === 0) return null;

  const row = results[0];
  return {
    ...row,
    osmId: row.osmId ? Number(row.osmId) : null,
    lat: Number(row.lat),
    lng: Number(row.lng),
  };
}

// Batch variant for ranking many candidates in one query.
async function getAverageRatings(poiIds) {
  if (!poiIds || poiIds.length === 0) return {};
  const results = await prisma.$queryRawUnsafe(
    `SELECT poi_id AS "poiId", AVG(rating) AS avg_rating
     FROM poi_ratings
     WHERE poi_id = ANY($1)
     GROUP BY poi_id`,
    poiIds
  );
  const byId = {};
  for (const row of results) {
    byId[row.poiId] = Number(Number(row.avg_rating).toFixed(1));
  }
  return byId;
}

async function getAverageRating(poiId) {
  const results = await prisma.$queryRawUnsafe(
    `SELECT
      COALESCE(AVG(rating), 0) AS avg_rating,
      COALESCE(AVG(accessibility_rating), 0) AS avg_accessibility_rating,
      COUNT(*)::int AS count
    FROM poi_ratings
    WHERE poi_id = $1`,
    poiId
  );

  const row = results[0];
  return {
    avgRating: Number(Number(row.avg_rating).toFixed(1)),
    avgAccessibilityRating: Number(Number(row.avg_accessibility_rating).toFixed(1)),
    count: Number(row.count),
  };
}

// One rating per (user, POI): re-rating updates the existing row. A submission
// without a comment (e.g. quick star taps on the route summary) keeps the
// comment already written; a non-empty one replaces it. createdAt is bumped so
// the review sorts by when it was last given.
async function addRating(poiId, userId, rating, accessibilityRating, comment) {
  const trimmed = typeof comment === 'string' ? comment.trim() : '';
  const newComment = trimmed ? comment : null;

  return prisma.poiRating.upsert({
    where: { userId_poiId: { userId, poiId } },
    create: {
      poiId,
      userId,
      rating,
      accessibilityRating,
      comment: newComment,
    },
    update: {
      rating,
      accessibilityRating,
      createdAt: new Date(),
      ...(newComment ? { comment: newComment } : {}),
    },
  });
}

async function getRatings(poiId) {
  return prisma.poiRating.findMany({
    where: { poiId },
    include: {
      user: {
        select: { name: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

module.exports = {
  findNearby,
  findById,
  getAverageRating,
  getAverageRatings,
  addRating,
  getRatings,
};
