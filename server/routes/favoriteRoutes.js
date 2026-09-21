const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, favoriteController.listFavorites);
router.post('/:routeId', authMiddleware, favoriteController.addFavorite);
router.delete('/:routeId', authMiddleware, favoriteController.removeFavorite);

module.exports = router;
