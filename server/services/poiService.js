const poiRepository = require('../repositories/poiRepository');

async function getNearbyPOIs(lat, lng, radiusMeters, filters) {
  return poiRepository.findNearby(lat, lng, radiusMeters, filters);
}

async function getPOIDetails(poiId) {
  const poi = await poiRepository.findById(poiId);
  if (!poi) return null;

  const [ratingStats, reviews] = await Promise.all([
    poiRepository.getAverageRating(poiId),
    poiRepository.getRatings(poiId),
  ]);

  return {
    ...poi,
    ratingStats,
    reviews,
  };
}

async function ratePOI(poiId, userId, rating, accessibilityRating, comment) {
  return poiRepository.addRating(poiId, userId, rating, accessibilityRating, comment);
}

module.exports = {
  getNearbyPOIs,
  getPOIDetails,
  ratePOI,
};
