const poiService = require('../services/poiService');

async function listPOIs(req, res) {
  try {
    const { lat, lng, radius, category, wheelchair } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng query parameters are required' });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ error: 'lat and lng must be valid numbers' });
    }

    const radiusMeters = radius ? parseInt(radius, 10) : 1000;
    const filters = {};
    if (category) filters.category = category;
    if (wheelchair) filters.wheelchair = wheelchair;

    const pois = await poiService.getNearbyPOIs(parsedLat, parsedLng, radiusMeters, filters);
    res.json(pois);
  } catch (error) {
    console.error('List POIs error:', error);
    res.status(500).json({ error: 'Failed to fetch POIs' });
  }
}

async function getPOI(req, res) {
  try {
    const poiId = parseInt(req.params.id, 10);

    if (isNaN(poiId)) {
      return res.status(400).json({ error: 'Invalid POI ID' });
    }

    const poi = await poiService.getPOIDetails(poiId);

    if (!poi) {
      return res.status(404).json({ error: 'POI not found' });
    }

    res.json(poi);
  } catch (error) {
    console.error('Get POI error:', error);
    res.status(500).json({ error: 'Failed to fetch POI' });
  }
}

async function ratePOI(req, res) {
  try {
    const poiId = parseInt(req.params.id, 10);

    if (isNaN(poiId)) {
      return res.status(400).json({ error: 'Invalid POI ID' });
    }

    const { rating, accessibilityRating, comment } = req.body;

    const newRating = await poiService.ratePOI(
      poiId,
      req.userId,
      rating,
      accessibilityRating,
      comment
    );

    res.status(201).json(newRating);
  } catch (error) {
    console.error('Rate POI error:', error);
    res.status(500).json({ error: 'Failed to rate POI' });
  }
}

module.exports = { listPOIs, getPOI, ratePOI };
