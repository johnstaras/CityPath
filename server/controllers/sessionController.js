const sessionService = require('../services/sessionService');

async function startSession(req, res) {
  try {
    const { routeId } = req.body;
    if (!routeId) {
      return res.status(400).json({ error: 'routeId is required' });
    }
    const session = await sessionService.startSession(req.userId, routeId);
    res.status(201).json(session);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
}

async function updateSession(req, res) {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    const { progressPercent, actualDurationMinutes, distanceWalkedMeters } = req.body;
    const session = await sessionService.updateProgress(sessionId, req.userId, {
      progressPercent,
      actualDurationMinutes,
      distanceWalkedMeters,
    });
    res.json(session);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
}

// Pause/resume only flip the session status (active <-> paused); the service
// rejects a pause of a non-active or a resume of a non-paused session with 400.
function statusChangeHandler(serviceFn, verb) {
  return async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: 'Invalid session ID' });
      }
      const session = await serviceFn(sessionId, req.userId);
      res.json(session);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error(`${verb} session error:`, error);
      res.status(500).json({ error: `Failed to ${verb.toLowerCase()} session` });
    }
  };
}

const pauseSession = statusChangeHandler(
  (id, userId) => sessionService.pauseSession(id, userId),
  'Pause',
);
const resumeSession = statusChangeHandler(
  (id, userId) => sessionService.resumeSession(id, userId),
  'Resume',
);

async function completeSession(req, res) {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    const session = await sessionService.completeSession(sessionId, req.userId);
    res.json(session);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Complete session error:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
}

async function cancelSession(req, res) {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    await sessionService.cancelSession(sessionId, req.userId);
    res.status(204).send();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Cancel session error:', error);
    res.status(500).json({ error: 'Failed to cancel session' });
  }
}

module.exports = {
  startSession,
  updateSession,
  pauseSession,
  resumeSession,
  completeSession,
  cancelSession,
};
