import api from './api';
import { RouteSession } from '../models';

export interface SessionUpdateData {
  progressPercent: number;
  actualDurationMinutes: number;
  distanceWalkedMeters: number;
}

export async function startSession(routeId: number): Promise<RouteSession> {
  const { data } = await api.post<RouteSession>('/sessions', { routeId });
  return data;
}

export async function updateSession(
  sessionId: number,
  updateData: SessionUpdateData,
): Promise<RouteSession> {
  const { data } = await api.put<RouteSession>(
    `/sessions/${sessionId}`,
    updateData,
  );
  return data;
}

export async function pauseSession(sessionId: number): Promise<RouteSession> {
  const { data } = await api.put<RouteSession>(`/sessions/${sessionId}/pause`);
  return data;
}

export async function resumeSession(sessionId: number): Promise<RouteSession> {
  const { data } = await api.put<RouteSession>(`/sessions/${sessionId}/resume`);
  return data;
}

export async function completeSession(
  sessionId: number,
): Promise<RouteSession> {
  const { data } = await api.put<RouteSession>(
    `/sessions/${sessionId}/complete`,
  );
  return data;
}

export async function cancelSession(
  sessionId: number,
): Promise<void> {
  await api.delete(`/sessions/${sessionId}`);
}
