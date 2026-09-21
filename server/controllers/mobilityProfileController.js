const prisma = require('../config/database');

async function listProfiles(req, res) {
  try {
    const profiles = await prisma.mobilityProfile.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(profiles);
  } catch (error) {
    console.error('List mobility profiles error:', error);
    res.status(500).json({ error: 'Failed to load profiles' });
  }
}

module.exports = { listProfiles };
