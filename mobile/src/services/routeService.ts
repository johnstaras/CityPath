import api from './api';
import { Route, POI, PathAccessibility } from '../models';

export interface RouteFilters {
  lat?: number;
  lng?: number;
  radius?: number;
  category?: string;
  time?: string;
  q?: string;
  mobilityProfileId?: number;
  /** Restrict to one provenance. The main browse list leaves this unset. */
  createdBy?: 'admin' | 'ai';
}

export interface RouteDetail extends Route {
  pois: POI[];
  geometry?: GeoJSON.Geometry;
  /** Raw [lng, lat] pairs as sent by the API. */
  coordinates?: [number, number][];
  pathAccessibility?: PathAccessibility;
}

export async function getRoutes(filters: RouteFilters = {}): Promise<Route[]> {
  const params: Record<string, string | number> = {};

  if (filters.lat != null) params.lat = filters.lat;
  if (filters.lng != null) params.lng = filters.lng;
  if (filters.radius != null) params.radius = filters.radius;
  if (filters.category) params.category = filters.category;
  if (filters.time) params.time = filters.time;
  if (filters.q) params.q = filters.q;
  if (filters.mobilityProfileId != null) params.mobilityProfileId = filters.mobilityProfileId;
  if (filters.createdBy) params.createdBy = filters.createdBy;

  const { data } = await api.get<Route[]>('/routes', { params });
  return data;
}

/** Whether live route generation is switched on for this deployment. */
export interface AiRouteStatus {
  enabled: boolean;
  provider: string | null;
  model: string | null;
}

/**
 * The generated catalogue is always present in the database, so the app never
 * depends on this being enabled — it only decides whether the "generate one for
 * me" action is offered. A backend without credentials answers `enabled: false`
 * and the button is simply not rendered.
 */
export async function getAiRouteStatus(): Promise<AiRouteStatus> {
  const { data } = await api.get<AiRouteStatus>('/routes/ai/status');
  return data;
}

export interface GenerateRouteRequest {
  lat: number;
  lng: number;
  mobilityProfileId?: number;
  /** Optional free-text preference, e.g. "somewhere shaded and quiet". */
  prompt?: string;
}

// Per-request timeouts for the two slow endpoints; everything else keeps the
// shared instance's 10 s.
// Live generation: up to 2 provider attempts x 30 s, then OSRM snapping and
// the database transaction.
export const GENERATE_ROUTE_TIMEOUT_MS = 90_000;
// Detour suggestions: one OSRM table request plus up to two parallel waves of
// route requests — about 24 s in the worst case on the public OSRM instance.
export const ALTERNATIVES_TIMEOUT_MS = 30_000;

export async function generateRoute(request: GenerateRouteRequest): Promise<RouteDetail> {
  const { data } = await api.post<RouteDetail>('/routes/ai/generate', request, {
    timeout: GENERATE_ROUTE_TIMEOUT_MS,
  });
  if (!data.geometry && data.coordinates && data.coordinates.length >= 2) {
    data.geometry = { type: 'LineString', coordinates: data.coordinates };
  }
  return data;
}

export async function getRouteById(
  id: number,
  mobilityProfileId?: number,
): Promise<RouteDetail> {
  const params: Record<string, number> = {};
  if (mobilityProfileId != null) params.mobilityProfileId = mobilityProfileId;
  const { data } = await api.get<RouteDetail>(`/routes/${id}`, { params });
  // The API sends the path as a bare coordinates array; the map screens draw
  // route.geometry, so normalize it into a GeoJSON LineString here.
  if (!data.geometry && data.coordinates && data.coordinates.length >= 2) {
    data.geometry = { type: 'LineString', coordinates: data.coordinates };
  }
  return data;
}

/**
 * Checkpoint suggestion: a nearby POI detour flattened into the Route shape
 * the cards render, plus the walking path and full POI for the in-place
 * journey switch.
 */
export interface AlternativeRoute extends Route {
  geometry?: GeoJSON.Geometry;
  poi?: POI;
}

export interface AlternativeRoutesParams {
  lat: number;
  lng: number;
  /**
   * Remaining WALKING time in seconds — the detour budget. Excludes the stop
   * visit time the «remaining» stat adds.
   */
  remaining_time: number;
  mobility_profile_id: number;
  visited_pois: number[];
}

export async function getAlternativeRoutes(
  routeId: number,
  params: AlternativeRoutesParams,
): Promise<AlternativeRoute[]> {
  const { data } = await api.get<AlternativeRoute[]>(`/routes/${routeId}/alternatives`, {
    params: {
      lat: params.lat,
      lng: params.lng,
      remaining_time: params.remaining_time,
      mobility_profile_id: params.mobility_profile_id,
      visited_pois: params.visited_pois.join(','),
    },
    timeout: ALTERNATIVES_TIMEOUT_MS,
  });
  return data;
}
