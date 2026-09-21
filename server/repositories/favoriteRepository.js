const prisma = require('../config/database');

async function getFavorites(userId) {
  const favorites = await prisma.$queryRawUnsafe(
    `SELECT
      f.created_at AS "createdAt",
      r.id, r.title, r.description, r.category,
      r.estimated_duration_minutes AS "estimatedDurationMinutes",
      r.distance_meters AS "distanceMeters",
      r.created_by AS "createdBy",
      r.generated_live AS "generatedLive",
      ST_AsGeoJSON(r.geometry)::json AS geometry,
      (SELECT p.photo_url FROM route_pois rp JOIN pois p ON p.id = rp.poi_id WHERE rp.route_id = r.id AND p.photo_url IS NOT NULL ORDER BY rp.order_index LIMIT 1) AS "imageUrl"
    FROM favorites f
    JOIN routes r ON r.id = f.route_id
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC`,
    userId
  );

  return favorites.map(row => ({
    createdAt: row.createdAt,
    route: {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      estimatedDurationMinutes: row.estimatedDurationMinutes,
      distanceMeters: row.distanceMeters,
      createdBy: row.createdBy,
      // Same provenance marker as GET /api/routes and /api/routes/:id.
      isLiveAi: row.generatedLive === true,
      coordinates: row.geometry ? row.geometry.coordinates : [],
      imageUrl: row.imageUrl || null,
    },
  }));
}

async function addFavorite(userId, routeId) {
  return prisma.favorite.create({
    data: {
      userId,
      routeId,
    },
  });
}

async function removeFavorite(userId, routeId) {
  return prisma.favorite.delete({
    where: {
      userId_routeId: { userId, routeId },
    },
  });
}

async function isFavorite(userId, routeId) {
  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_routeId: { userId, routeId },
    },
  });
  return !!favorite;
}

module.exports = {
  getFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
};
