export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface MobilityProfile {
  id: number;
  name: string;
  icon: string;
  maxIncline: number | null;
  avoidStairs: boolean;
  avoidCobblestone: boolean;
  minSidewalkWidth: number | null;
  requiresRamps: boolean;
  requiresTactilePaving: boolean;
  maxRouteDistanceKm: number | null;
  restStopIntervalM: number | null;
  speedFactor: number;
}

export interface Route {
  id: number;
  title: string;
  description?: string;
  estimatedDurationMinutes: number;
  distanceMeters: number;
  category: string;
  /**
   * Storage bucket of the route: 'admin' for the hand-authored seed routes,
   * 'ai' for the curated 100-route catalogue plus anything produced live by
   * the generator. It selects the curated-routes strip on Home, but it is NOT
   * proof that a language model was involved: the catalogue is static,
   * hand-curated data. Use `isLiveAi` for that.
   */
  createdBy?: 'admin' | 'ai';
  /**
   * True only for a route composed live by the language model. False (or
   * absent, from an older server) for the curated catalogue and admin routes.
   * The only field allowed to drive an "AI" badge.
   */
  isLiveAi?: boolean;
  lat?: number;
  lng?: number;
  distanceFromUser?: number;
  accessibilityScore?: number;
  imageUrl?: string;
}

/**
 * Walking-surface facts measured along the WHOLE route (server
 * `summarizePath`), from OpenStreetMap path barriers. `measured: false` when
 * the path could not be measured — never read that as "no barriers".
 */
export interface PathAccessibility {
  measured: boolean;
  /** Metres of the route on steps WITHOUT a ramp. 0 = no such steps recorded. */
  stepsMeters?: number;
  rampedStepsMeters?: number;
  cobblestonePercent?: number;
  raisedKerbs?: number;
  loweredKerbs?: number;
  lengthMeters?: number;
}

export interface POI {
  id: number;
  name: string;
  description?: string;
  category?: string;
  photoUrl?: string;
  wheelchair: 'yes' | 'limited' | 'no' | 'unknown';
  surface?: string;
  hasRamp: boolean;
  hasTactilePaving: boolean;
  hasRestArea: boolean;
  openingHours?: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  /** 1-based position within a route. Only present on route-detail payloads. */
  orderIndex?: number;
  /** Minutes of walking from the route start; 0 for the first stop. */
  estimatedArrivalMinutes?: number;
}

export interface POIRating {
  id: number;
  rating: number;
  accessibilityRating: number;
  comment?: string;
  createdAt: string;
  user: { name: string; avatarUrl?: string };
}

export interface RouteSession {
  id: number;
  routeId: number;
  startedAt: string;
  completedAt?: string;
  progressPercent: number;
  actualDurationMinutes: number;
  distanceWalkedMeters: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
}
