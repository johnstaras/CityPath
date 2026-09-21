/**
 * Haversine formula — calculates the great-circle distance (in meters)
 * between two GPS coordinates.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Minimum distance (meters) from a GPS position to a route polyline given as
 * GeoJSON-ordered [lng, lat] pairs. Uses an equirectangular projection
 * centered on the position — accurate to well under a meter at the few
 * hundred meters that matter for off-route detection.
 */
/**
 * Whether a GPS position is within `radiusMeters` of the LAST coordinate of
 * a polyline ([lng, lat] pairs) — i.e. the walker has arrived where the
 * journey ends.
 */
export function isNearLineEnd(
  lat: number,
  lng: number,
  coordinates: [number, number][],
  radiusMeters: number,
): boolean {
  if (coordinates.length === 0) {
    return false;
  }
  const [endLng, endLat] = coordinates[coordinates.length - 1];
  return haversineDistance(lat, lng, endLat, endLng) <= radiusMeters;
}

/**
 * How far along the route a position sits, in metres from the start.
 *
 * Linear referencing: the position is projected onto the nearest segment and
 * the distance walked to reach that projection is returned. Unlike a plain
 * proximity check this answers "have I passed this point yet", which is what
 * stop arrival actually needs — a landmark can sit well off the walking line
 * (the Hellenic Parliament is 59 m from the street the route follows) and
 * never come within any sane arrival radius, even though the walker clearly
 * walked past it.
 */
export function distanceAlongRouteMeters(
  lat: number,
  lng: number,
  coordinates: [number, number][],
): number {
  if (coordinates.length < 2) {
    return 0;
  }

  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const cosLat = Math.cos(toRad(lat));
  const toXY = ([pLng, pLat]: [number, number]): [number, number] => [
    toRad(pLng - lng) * cosLat * R,
    toRad(pLat - lat) * R,
  ];

  let best = { distance: Infinity, along: 0 };
  let travelled = 0;
  let prev = toXY(coordinates[0]);

  for (let i = 1; i < coordinates.length; i++) {
    const curr = toXY(coordinates[i]);
    const dx = curr[0] - prev[0];
    const dy = curr[1] - prev[1];
    const lenSq = dx * dx + dy * dy;
    const segmentLength = Math.sqrt(lenSq);

    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(prev[0] * dx + prev[1] * dy) / lenSq));
    const perpendicular = Math.hypot(prev[0] + t * dx, prev[1] + t * dy);

    if (perpendicular < best.distance) {
      best = { distance: perpendicular, along: travelled + t * segmentLength };
    }

    travelled += segmentLength;
    prev = curr;
  }

  return best.along;
}

export function distanceToRouteMeters(
  lat: number,
  lng: number,
  coordinates: [number, number][],
): number {
  if (coordinates.length === 0) {
    return Infinity;
  }

  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const cosLat = Math.cos(toRad(lat));
  // Project every point to meters relative to the position.
  const toXY = ([pLng, pLat]: [number, number]): [number, number] => [
    toRad(pLng - lng) * cosLat * R,
    toRad(pLat - lat) * R,
  ];

  let min = Infinity;
  let prev = toXY(coordinates[0]);
  if (coordinates.length === 1) {
    return Math.hypot(prev[0], prev[1]);
  }
  for (let i = 1; i < coordinates.length; i++) {
    const curr = toXY(coordinates[i]);
    const dx = curr[0] - prev[0];
    const dy = curr[1] - prev[1];
    const lenSq = dx * dx + dy * dy;
    // Project the origin (the position) onto the segment, clamped to it.
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(prev[0] * dx + prev[1] * dy) / lenSq));
    const d = Math.hypot(prev[0] + t * dx, prev[1] + t * dy);
    if (d < min) {
      min = d;
    }
    prev = curr;
  }
  return min;
}
