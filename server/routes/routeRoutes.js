const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const aiRouteController = require('../controllers/aiRouteController');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');

router.get('/', routeController.listRoutes);

// Both must precede '/:id', which would otherwise capture 'ai' as a route id.
router.get('/ai/status', aiRouteController.getStatus);
// Generation writes rows and (on a paid provider) spends tokens, so it is the
// one route endpoint behind authentication.
router.post('/ai/generate', authMiddleware, aiRouteController.generate);

router.get('/:id', routeController.getRoute);
// Optional auth: detours work anonymously, but a signed-in user's favourites
// and completed routes feed the category-affinity term of the ranking.
router.get('/:id/alternatives', optionalAuthMiddleware, routeController.getAlternatives);

module.exports = router;
