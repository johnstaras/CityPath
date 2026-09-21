const router = require('express').Router();
const authMiddleware = require('../middleware/authMiddleware');
const { validateProfileUpdate, handleValidationErrors } = require('../middleware/validation');
const { getProfile, updateProfile, getStats } = require('../controllers/profileController');

router.get('/', authMiddleware, getProfile);
router.put('/', authMiddleware, validateProfileUpdate, handleValidationErrors, updateProfile);
router.get('/stats', authMiddleware, getStats);

module.exports = router;
