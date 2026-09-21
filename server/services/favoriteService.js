const favoriteRepository = require('../repositories/favoriteRepository');
const routeService = require('./routeService');

/**
 * The user's favorites, each route scored against the requested mobility
 * profile exactly as GET /api/routes scores it — path AND the route's own
 * stops — so a badge reads the same on Home, the curated strip, Favorites and
 * the details screen.
 */
async function listFavorites(userId, mobilityProfileId) {
  const favorites = await favoriteRepository.getFavorites(userId);
  const profile = await routeService.resolveProfile(mobilityProfileId);
  const scoredRoutes = await routeService.scoreRoutes(
    favorites.map(fav => fav.route),
    profile,
  );
  return favorites.map((fav, i) => ({ ...fav, route: scoredRoutes[i] }));
}

module.exports = { listFavorites };
