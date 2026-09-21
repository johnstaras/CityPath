const express = require('express');
const router = express.Router();
const poiController = require('../controllers/poiController');
const authMiddleware = require('../middleware/authMiddleware');
const { validateRating, handleValidationErrors } = require('../middleware/validation');

router.get('/', poiController.listPOIs);
router.get('/:id', poiController.getPOI);
router.post('/:id/rate', authMiddleware, validateRating, handleValidationErrors, poiController.ratePOI);

module.exports = router;
