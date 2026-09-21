const prisma = require('../config/database');

async function getProfile(userId) {
  return prisma.userProfile.findUnique({
    where: { userId },
  });
}

async function getMobilityProfiles(userId) {
  return prisma.userMobilityProfile.findMany({
    where: { userId },
    include: { mobilityProfile: true },
  });
}

async function findMobilityProfileIds(ids) {
  const rows = await prisma.mobilityProfile.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  return rows.map(row => row.id);
}

// Age group and mobility selection are written in ONE transaction: a failure in
// either (e.g. a bad foreign key) leaves the previous profile untouched instead
// of a new age group with the old — or no — mobility selection.
// `ageGroup` undefined leaves it unchanged; `mobilityProfileIds` not an array
// leaves the selection unchanged; any array (including []) replaces it.
async function saveProfile(userId, { ageGroup, mobilityProfileIds }) {
  const operations = [];
  if (ageGroup !== undefined) {
    operations.push(prisma.userProfile.upsert({
      where: { userId },
      update: { ageGroup },
      create: { userId, ageGroup },
    }));
  }
  if (Array.isArray(mobilityProfileIds)) {
    operations.push(prisma.userMobilityProfile.deleteMany({ where: { userId } }));
    if (mobilityProfileIds.length > 0) {
      operations.push(prisma.userMobilityProfile.createMany({
        data: mobilityProfileIds.map(id => ({ userId, mobilityProfileId: id })),
      }));
    }
  }
  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }
}

async function getStats(userId) {
  const [completedRoutes, totalDistance, favoritesCount, ratingsCount] = await Promise.all([
    prisma.routeSession.count({ where: { userId, status: 'completed' } }),
    prisma.routeSession.aggregate({ where: { userId, status: 'completed' }, _sum: { distanceWalkedMeters: true } }),
    prisma.favorite.count({ where: { userId } }),
    prisma.poiRating.count({ where: { userId } }),
  ]);

  return {
    completedRoutes,
    totalDistanceMeters: totalDistance._sum.distanceWalkedMeters || 0,
    favoritesCount,
    ratingsCount,
  };
}

module.exports = { getProfile, getMobilityProfiles, findMobilityProfileIds, saveProfile, getStats };
