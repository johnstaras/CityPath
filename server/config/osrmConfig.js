// Single source of truth for the OSRM pedestrian routing endpoint.
//
// Used by utils/osrmClient.js (checkpoint detours), scripts/snap-routes.js
// (seed snapping) and, through snapRoute, services/aiRouteService.js (live AI
// generation). Before this existed the client defaulted to localhost:5000 while
// the seeder hard-coded the public instance, so any run outside docker-compose
// (which injects OSRM_URL) silently returned an empty detour list.
//
// The URL is read lazily, on each call, rather than captured at require time:
// scripts load dotenv after their own requires, and a value frozen at import
// would ignore server/.env.

// Public FOSSGIS foot-profile instance. Swap via OSRM_URL for a self-hosted
// OSRM — the URL scheme is identical.
const DEFAULT_OSRM_URL = 'https://routing.openstreetmap.de/routed-foot';

// Per-request timeout. The mobile client abandons a request after 10 s, so an
// OSRM call that takes longer than this cannot produce a useful answer anyway.
const OSRM_TIMEOUT_MS = 8000;

function getOsrmUrl() {
  return (process.env.OSRM_URL || DEFAULT_OSRM_URL).replace(/\/+$/, '');
}

module.exports = { DEFAULT_OSRM_URL, OSRM_TIMEOUT_MS, getOsrmUrl };
