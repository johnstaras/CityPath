const sessionRepo = require('../repositories/sessionRepository');

async function startSession(userId, routeId) {
  // A user can only walk one route at a time: any lingering active/paused
  // session is an orphan (app reload, crash, force-quit) — cancel it instead
  // of blocking every future start with a 409 the client can't recover from.
  await sessionRepo.cancelUnfinishedSessions(userId);
  return sessionRepo.createSession(userId, routeId);
}

async function validateOwnership(sessionId, userId) {
  const session = await sessionRepo.getSession(sessionId);
  if (!session) {
    throw { status: 404, message: 'Session not found' };
  }
  if (session.userId !== userId) {
    throw { status: 403, message: 'Not authorized to modify this session' };
  }
  return session;
}

async function updateProgress(sessionId, userId, { progressPercent, actualDurationMinutes, distanceWalkedMeters }) {
  const session = await validateOwnership(sessionId, userId);
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw { status: 400, message: 'Cannot update a finished session' };
  }

  const data = {};
  if (progressPercent !== undefined) data.progressPercent = progressPercent;
  if (actualDurationMinutes !== undefined) data.actualDurationMinutes = actualDurationMinutes;
  if (distanceWalkedMeters !== undefined) data.distanceWalkedMeters = distanceWalkedMeters;

  return sessionRepo.updateSession(sessionId, data);
}

async function pauseSession(sessionId, userId) {
  const session = await validateOwnership(sessionId, userId);
  if (session.status !== 'active') {
    throw { status: 400, message: 'Only active sessions can be paused' };
  }
  return sessionRepo.updateSession(sessionId, { status: 'paused' });
}

async function resumeSession(sessionId, userId) {
  const session = await validateOwnership(sessionId, userId);
  if (session.status !== 'paused') {
    throw { status: 400, message: 'Only paused sessions can be resumed' };
  }
  return sessionRepo.updateSession(sessionId, { status: 'active' });
}

async function completeSession(sessionId, userId) {
  const session = await validateOwnership(sessionId, userId);
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw { status: 400, message: 'Session is already finished' };
  }
  return sessionRepo.completeSession(sessionId);
}

async function cancelSession(sessionId, userId) {
  const session = await validateOwnership(sessionId, userId);
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw { status: 400, message: 'Session is already finished' };
  }
  return sessionRepo.cancelSession(sessionId);
}

module.exports = {
  startSession,
  updateProgress,
  pauseSession,
  resumeSession,
  completeSession,
  cancelSession,
};
