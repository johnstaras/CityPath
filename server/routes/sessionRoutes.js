const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, sessionController.startSession);
router.put('/:id', authMiddleware, sessionController.updateSession);
router.put('/:id/pause', authMiddleware, sessionController.pauseSession);
router.put('/:id/resume', authMiddleware, sessionController.resumeSession);
router.put('/:id/complete', authMiddleware, sessionController.completeSession);
router.delete('/:id', authMiddleware, sessionController.cancelSession);

module.exports = router;
