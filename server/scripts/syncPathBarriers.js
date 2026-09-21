// Import the walking surface (steps, kerbs, cobblestone, benches) from
// OpenStreetMap into `path_barriers`.
//
// Separate from scripts/syncOsmData.js on purpose: that imports destinations
// into `pois`, this imports properties of the path itself. The accessibility
// scorer gates on this table.
//
//   node scripts/syncPathBarriers.js
require('dotenv').config({ quiet: true });
const prisma = require('../config/database');
const { syncPathBarriers } = require('../services/pathBarrierService');

syncPathBarriers()
  .then(() => prisma.$disconnect())
  .catch(error => {
    console.error(error.message);
    prisma.$disconnect();
    process.exit(1);
  });
