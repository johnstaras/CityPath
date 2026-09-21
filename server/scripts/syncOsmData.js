require('dotenv').config();
const { syncPOIs } = require('../services/osmSyncService');

syncPOIs()
  .then(() => {
    console.log('OSM sync completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('OSM sync failed:', err);
    process.exit(1);
  });
