const router = require('express').Router();
const { listProfiles } = require('../controllers/mobilityProfileController');

router.get('/', listProfiles); // Public — no auth needed

module.exports = router;
