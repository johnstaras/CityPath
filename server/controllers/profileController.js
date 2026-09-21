const profileService = require('../services/profileService');

async function getProfile(req, res) {
  try {
    const profile = await profileService.getUserProfile(req.userId);
    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
}

async function updateProfile(req, res) {
  try {
    const { ageGroup, mobilityProfileIds } = req.body;
    const profile = await profileService.updateProfile(req.userId, { ageGroup, mobilityProfileIds });
    res.json(profile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

async function getStats(req, res) {
  try {
    const stats = await profileService.getStats(req.userId);
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}

module.exports = { getProfile, updateProfile, getStats };
