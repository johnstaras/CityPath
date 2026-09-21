const prisma = require('../config/database');

async function createSession(userId, routeId) {
  return prisma.routeSession.create({
    data: {
      userId,
      routeId,
      status: 'active',
      startedAt: new Date(),
    },
  });
}

async function getSession(sessionId) {
  return prisma.routeSession.findUnique({
    where: { id: sessionId },
  });
}

async function getActiveSession(userId) {
  return prisma.routeSession.findFirst({
    where: {
      userId,
      status: { in: ['active', 'paused'] },
    },
  });
}

async function updateSession(sessionId, data) {
  return prisma.routeSession.update({
    where: { id: sessionId },
    data,
  });
}

async function completeSession(sessionId) {
  return prisma.routeSession.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  });
}

async function cancelUnfinishedSessions(userId) {
  return prisma.routeSession.updateMany({
    where: {
      userId,
      status: { in: ['active', 'paused'] },
    },
    data: { status: 'cancelled' },
  });
}

async function cancelSession(sessionId) {
  return prisma.routeSession.update({
    where: { id: sessionId },
    data: { status: 'cancelled' },
  });
}

module.exports = {
  createSession,
  getSession,
  getActiveSession,
  cancelUnfinishedSessions,
  updateSession,
  completeSession,
  cancelSession,
};
