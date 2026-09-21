/**
 * Splitting a walking line into the part that matters now and the part that
 * doesn't.
 *
 * Drawing a whole multi-stop route as one uniform line tells the walker where
 * the route goes but not where to go NEXT — at a junction the line ahead and
 * the line coming back look identical. Slicing it lets the map draw the leg to
 * the next stop prominently and everything beyond it muted.
 */

export type LineCoords = [number, number][];

/** Metres between two [lng, lat] points. Equirectangular: fine at street scale. */
function metersBetween(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x = toRad(b[0] - a[0]) * Math.cos(toRad((a[1] + b[1]) / 2));
  const y = toRad(b[1] - a[1]);
  return Math.hypot(x, y) * R;
}

/**
 * Split a polyline where the given point projects onto it.
 *
 * The point does not need to lie on the line — a landmark set back from the
 * street, or a GPS fix a few metres off it, both project cleanly onto the
 * nearest segment. Both halves include the projection itself, so drawing them
 * together leaves no visual gap.
 *
 * @returns `before` (start -> point) and `after` (point -> end). When the line
 *   is too short to split, `before` is empty and `after` is the whole line.
 */
export function sliceRouteAtPoint(
  coordinates: LineCoords,
  point: { lat: number; lng: number },
): { before: LineCoords; after: LineCoords } {
  if (!coordinates || coordinates.length < 2) {
    return { before: [], after: coordinates ?? [] };
  }

  const target: [number, number] = [point.lng, point.lat];
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const cosLat = Math.cos(toRad(point.lat));
  // Local metre grid centred on the point, so the projection maths is planar.
  const toXY = (c: [number, number]): [number, number] => [
    toRad(c[0] - target[0]) * cosLat * R,
    toRad(c[1] - target[1]) * R,
  ];

  let bestIndex = 0;
  let bestT = 0;
  let bestDistance = Infinity;

  let prev = toXY(coordinates[0]);
  for (let i = 1; i < coordinates.length; i++) {
    const curr = toXY(coordinates[i]);
    const dx = curr[0] - prev[0];
    const dy = curr[1] - prev[1];
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(prev[0] * dx + prev[1] * dy) / lenSq));
    const distance = Math.hypot(prev[0] + t * dx, prev[1] + t * dy);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i - 1;
      bestT = t;
    }
    prev = curr;
  }

  const a = coordinates[bestIndex];
  const b = coordinates[bestIndex + 1];
  const split: [number, number] = [
    a[0] + (b[0] - a[0]) * bestT,
    a[1] + (b[1] - a[1]) * bestT,
  ];

  return {
    before: [...coordinates.slice(0, bestIndex + 1), split],
    after: [split, ...coordinates.slice(bestIndex + 1)],
  };
}

/** Wrap a coordinate list as a FeatureCollection, or null when too short to draw. */
export function toLineFeature(coordinates: LineCoords): GeoJSON.FeatureCollection | null {
  if (!coordinates || coordinates.length < 2) {
    return null;
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      },
    ],
  };
}

/**
 * Split a route into the three things a walker needs to tell apart: what they
 * have already walked, the leg to their next stop, and everything after that.
 *
 * @param coordinates full route line, [lng, lat]
 * @param nextStop the stop being walked to; omit and the whole line is upcoming
 * @param position current position; omit (e.g. on a preview screen) and the
 *   active leg starts at the beginning of the route
 */
export function splitRouteForNavigation(
  coordinates: LineCoords,
  nextStop?: { lat: number; lng: number } | null,
  position?: { lat: number; lng: number } | null,
): { walked: LineCoords; activeLeg: LineCoords; upcoming: LineCoords } {
  if (!coordinates || coordinates.length < 2) {
    return { walked: [], activeLeg: [], upcoming: coordinates ?? [] };
  }

  let walked: LineCoords = [];
  let ahead = coordinates;

  if (position) {
    const atWalker = sliceRouteAtPoint(coordinates, position);
    walked = atWalker.before;
    ahead = atWalker.after;
  }

  if (!nextStop) {
    return { walked, activeLeg: ahead, upcoming: [] };
  }

  const atStop = sliceRouteAtPoint(ahead, nextStop);
  return { walked, activeLeg: atStop.before, upcoming: atStop.after };
}

export { metersBetween };
