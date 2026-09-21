const favoriteRepository = require('../repositories/favoriteRepository');
const favoriteService = require('../services/favoriteService');

async function listFavorites(req, res) {
  try {
    const scored = await favoriteService.listFavorites(req.userId, req.query.mobilityProfileId);
    res.json(scored);
  } catch (error) {
    console.error('List favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
}

async function addFavorite(req, res) {
  try {
    const routeId = parseInt(req.params.routeId, 10);

    if (isNaN(routeId)) {
      return res.status(400).json({ error: 'Invalid route ID' });
    }

    // Idempotent: saving a route that is already a favorite is a success, not
    // a conflict. The client's goal ("this route is in my favorites") already
    // holds, and a 409 surfaced as an error on screens that could not know the
    // current state (e.g. the route summary).
    const already = await favoriteRepository.isFavorite(req.userId, routeId);
    if (already) {
      return res.status(200).json({ message: 'Route already in favorites' });
    }

    await favoriteRepository.addFavorite(req.userId, routeId);
    res.status(201).json({ message: 'Route added to favorites' });
  } catch (error) {
    // Two concurrent saves: the loser hits the (user_id, route_id) unique key.
    if (error.code === 'P2002') {
      return res.status(200).json({ message: 'Route already in favorites' });
    }
    // Foreign key on route_id: the route does not exist.
    if (error.code === 'P2003') {
      return res.status(404).json({ error: 'Route not found' });
    }
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
}

async function removeFavorite(req, res) {
  try {
    const routeId = parseInt(req.params.routeId, 10);

    if (isNaN(routeId)) {
      return res.status(400).json({ error: 'Invalid route ID' });
    }

    const exists = await favoriteRepository.isFavorite(req.userId, routeId);
    if (!exists) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    await favoriteRepository.removeFavorite(req.userId, routeId);
    res.status(204).send();
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
}

module.exports = { listFavorites, addFavorite, removeFavorite };
