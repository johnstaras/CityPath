import {
  distanceAlongRouteMeters,
  distanceToRouteMeters,
  haversineDistance,
  isNearLineEnd,
} from './locationUtils';

interface DetourLeg {
  /** distanceWalked at the moment the detour was accepted. */
  walkedAtSwitch: number;
  /** Length of the detour leg (position -> POI -> route end), meters. */
  distanceMeters: number;
}

/**
 * Progress (0–100) of the whole journey, continuous across a detour switch.
 *
 * On the original route this is plain walked/total. When a detour is
 * accepted the journey is redefined as "everything already walked plus the
 * detour ahead", so the bar carries on from where it was instead of
 * resetting to zero. The value shown at the moment of the switch also acts
 * as a floor: an extra-long detour can shrink the blended fraction, but a
 * bar that jumps backwards reads as an error, so it holds until the walk
 * catches up.
 */
export function journeyProgressPercent(
  distanceWalked: number,
  routeDistanceMeters: number,
  detour: DetourLeg | null,
): number {
  const routeTotal = routeDistanceMeters || 1;
  if (!detour) {
    return Math.min(100, (distanceWalked / routeTotal) * 100);
  }
  const journeyTotal = detour.walkedAtSwitch + (detour.distanceMeters || 1);
  const blended = Math.min(100, (distanceWalked / journeyTotal) * 100);
  const floorAtSwitch = Math.min(100, (detour.walkedAtSwitch / routeTotal) * 100);
  return Math.max(blended, floorAtSwitch);
}

/** Average adult walking pace (~4.3 km/h), used until the walker's own is known. */
export const DEFAULT_WALKING_SPEED_MPS = 1.2;

// The measured pace only starts to count after this much walking and time...
const PACE_BLEND_START_METERS = 150;
const PACE_MIN_TRACKED_SECONDS = 60;
// ...and fully replaces the baseline from here on.
const PACE_BLEND_FULL_METERS = 600;
// Sanity bounds for a measured walking pace (GPS glitches, standing still).
const PACE_MIN_MPS = 0.3;
const PACE_MAX_MPS = 2.5;

interface RemainingTimeInput {
  /** Distance still ahead on the current leg, meters. */
  remainingMeters: number;
  /** Distance counted as walked so far, meters. */
  walkedMeters: number;
  /**
   * Seconds of active tracking since the first GPS fix. Deliberately NOT the
   * time since the start button: the seconds spent waiting for the first fix
   * are not walking, and counting them made the measured pace look slow.
   */
  trackedSeconds: number;
  /** Pace to assume before enough of the walk has been measured. */
  baselineSpeedMps?: number;
}

/**
 * Seconds left on the walk.
 *
 * Starts from a baseline pace and blends in the walker's measured pace
 * linearly between 150 m and 600 m walked. A pace measured over the first
 * hundred meters is dominated by startup noise (time before the first fix,
 * standing at the start, GPS settling), and dividing by it made the estimate
 * jump UP by several minutes right after starting (25 -> 30 min).
 */
export function estimateRemainingSeconds({
  remainingMeters,
  walkedMeters,
  trackedSeconds,
  baselineSpeedMps = DEFAULT_WALKING_SPEED_MPS,
}: RemainingTimeInput): number {
  const remaining = Math.max(0, remainingMeters);
  const baseline = baselineSpeedMps > 0 ? baselineSpeedMps : DEFAULT_WALKING_SPEED_MPS;

  let speed = baseline;
  if (trackedSeconds >= PACE_MIN_TRACKED_SECONDS && walkedMeters > PACE_BLEND_START_METERS) {
    const measured = Math.min(
      PACE_MAX_MPS,
      Math.max(PACE_MIN_MPS, walkedMeters / trackedSeconds),
    );
    const weight = Math.min(
      1,
      (walkedMeters - PACE_BLEND_START_METERS) /
        (PACE_BLEND_FULL_METERS - PACE_BLEND_START_METERS),
    );
    speed = baseline + (measured - baseline) * weight;
  }

  return remaining / speed;
}

/**
 * Walking minutes left, rounded for display — see estimateRemainingSeconds.
 * Do not multiply this back into seconds for the API: anything under 30 s
 * rounds to 0.
 */
export function estimateRemainingMinutes(input: RemainingTimeInput): number {
  return Math.round(estimateRemainingSeconds(input) / 60);
}

/**
 * Sightseeing time budgeted per stop on top of the walking time. Must match
 * POI_DWELL_MIN in server/scripts/snap-routes.js, which computes the duration
 * shown on the route cards and details as round(distance / 72) + 15 per stop
 * (72 m/min = DEFAULT_WALKING_SPEED_MPS).
 */
export const STOP_VISIT_MINUTES = 15;

interface RemainingJourneyInput extends RemainingTimeInput {
  /** Stops of the current journey not visited yet. */
  unvisitedStops: number;
}

/**
 * Minutes left on the whole journey, as the «remaining» stat shows it: walking
 * time (estimateRemainingSeconds) plus STOP_VISIT_MINUTES for every stop not
 * visited yet. The same model as the route's advertised duration, so at the
 * start of a route the two agree instead of 47 min vs 2 min.
 *
 * Display only — the detour budget sent to the server stays WALKING time.
 */
export function estimateRemainingJourneyMinutes({
  unvisitedStops,
  ...walking
}: RemainingJourneyInput): number {
  return (
    Math.round(estimateRemainingSeconds(walking) / 60) +
    STOP_VISIT_MINUTES * Math.max(0, unvisitedStops)
  );
}

// A checkpoint crossed by more than this many percentage points is stale: the
// progress jumped past it (GPS catch-up, a detour of the counter), and asking
// "detour here?" about a point the walker left long ago makes no sense.
export const CHECKPOINT_MAX_OVERSHOOT_PERCENT = 10;
// With less than this left before the route auto-completes, a suggestion
// sheet would open only to be replaced by the completion screen seconds later.
export const CHECKPOINT_MIN_METERS_TO_COMPLETION = 150;

interface CheckpointInput {
  /** The checkpoint threshold, percent. */
  checkpoint: number;
  /** Current journey progress, percent. */
  progress: number;
  /** Length of the route the percentages refer to, meters. */
  routeDistanceMeters: number;
  /** Progress at which the route completes by itself, percent. */
  autoCompletePercent: number;
}

/**
 * Whether a checkpoint that progress has reached should still open the detour
 * suggestions. It must have been crossed recently (at most
 * CHECKPOINT_MAX_OVERSHOOT_PERCENT ago) AND leave at least
 * CHECKPOINT_MIN_METERS_TO_COMPLETION of walking before auto-completion.
 * A checkpoint that fails is spent silently — it is not retried later.
 */
export function shouldTriggerCheckpoint({
  checkpoint,
  progress,
  routeDistanceMeters,
  autoCompletePercent,
}: CheckpointInput): boolean {
  if (progress < checkpoint) {
    return false;
  }
  if (progress - checkpoint > CHECKPOINT_MAX_OVERSHOOT_PERCENT) {
    return false;
  }
  const metersToCompletion =
    ((autoCompletePercent - progress) / 100) * Math.max(0, routeDistanceMeters);
  return metersToCompletion >= CHECKPOINT_MIN_METERS_TO_COMPLETION;
}

// A stop counts as reached inside this radius...
export const POI_ARRIVAL_METERS = 30;
// ...or once the walker is this far past it measured ALONG the route line,
// which covers stops set back from the street the path follows.
export const POI_PASSED_MARGIN_METERS = 25;
// "Past it along the line" only means something while the walker is actually
// on the line. Far from it, the projection lands on whichever segment happens
// to be nearest — often the route end — and every stop looked passed.
export const POI_PASSED_MAX_LINE_DISTANCE_METERS = 50;

/**
 * Whether the walker has reached a stop or already walked past it.
 *
 * `line` is the journey polyline as [lng, lat] pairs, or null when the route
 * has no geometry (then only the arrival radius applies).
 */
export function hasReachedOrPassedStop(
  walker: { lat: number; lng: number },
  stop: { lat: number; lng: number },
  line: [number, number][] | null,
): boolean {
  if (haversineDistance(walker.lat, walker.lng, stop.lat, stop.lng) < POI_ARRIVAL_METERS) {
    return true;
  }
  if (!line || line.length < 2) {
    return false;
  }
  if (distanceToRouteMeters(walker.lat, walker.lng, line) > POI_PASSED_MAX_LINE_DISTANCE_METERS) {
    return false;
  }
  const walkerAlong = distanceAlongRouteMeters(walker.lat, walker.lng, line);
  const stopAlong = distanceAlongRouteMeters(stop.lat, stop.lng, line);
  return walkerAlong > stopAlong + POI_PASSED_MARGIN_METERS;
}

// Completion. A walk finishes on ARRIVAL: within END_ARRIVAL_METERS of the
// journey's last coordinate with at least END_ARRIVAL_MIN_PROGRESS counted.
// The progress floor keeps loop-shaped routes, whose end sits next to their
// start, from completing at the start line; 60% leaves room for GPS distance
// undercounting (jitter filter, cut corners — a 10% undercount still arrives
// at 90%).
export const END_ARRIVAL_METERS = 40;
export const END_ARRIVAL_MIN_PROGRESS = 60;
// Some routes pass within END_ARRIVAL_METERS of their own end coordinate well
// before finishing — an out-and-back tail, where the walk goes past the end
// point, on to a last stop and back. Seven catalogue routes did, three of them
// at ~70%, before their third stop. Projecting the walker onto the line cannot
// tell the two passes apart (both run along the same street), so for such a
// line the distance counter decides: arrival additionally needs this fraction
// of the way from the end of the earlier pass to the start of the final one.
// Low on purpose, so a walker whose GPS undercounts still finishes.
export const END_REVISIT_GAP_FRACTION = 0.3;
// Distance-only fallback for an end coordinate the walker cannot get within
// 40 m of (e.g. inside a pedestrian square the GPS places elsewhere). It used
// to be 90%, which finished a 1.8 km walk ~180 m early — before the last stop
// — so the final stop was almost never counted (103 of 105 catalogue routes).
// At 98% it only fires when the arrival rule could not.
export const AUTO_COMPLETE_PERCENT = 98;
// Stopping manually with this much counted records the walk as completed
// rather than cancelled (the previous auto-complete threshold, unchanged).
export const STOP_COUNTS_AS_COMPLETE_PERCENT = 90;
// At completion a stop also counts when it lies within this distance of the
// journey's end measured along the line, or of the walker. Completion fires
// up to END_ARRIVAL_METERS before the end, and the last stop usually sits AT
// the end, so the regular 30 m / passed-by-25 m rules cannot have fired yet.
export const FINISH_STOP_RADIUS_METERS = 50;

// Sampling step for walking the line when looking for earlier passes.
const END_ZONE_SAMPLE_METERS = 5;

const endZoneCache = new WeakMap<[number, number][], number>();

/**
 * Minimum progress (percent of the line) the arrival rule needs for this line:
 * END_ARRIVAL_MIN_PROGRESS, raised for a line that enters the end zone
 * (END_ARRIVAL_METERS around its last coordinate) before its final approach.
 * Cached per line array, since it runs on every GPS fix.
 */
export function endArrivalMinProgress(line: [number, number][]): number {
  const cached = endZoneCache.get(line);
  if (cached != null) {
    return cached;
  }
  let result = END_ARRIVAL_MIN_PROGRESS;
  if (line.length >= 2) {
    const [endLng, endLat] = line[line.length - 1];
    // Along-line intervals [from, to] spent inside the end zone.
    const runs: [number, number][] = [];
    let travelled = 0;
    let inside = false;
    const visit = (lat: number, lng: number, along: number) => {
      const isIn = haversineDistance(lat, lng, endLat, endLng) <= END_ARRIVAL_METERS;
      const last = runs[runs.length - 1];
      // Leaving the zone for a few metres (a line grazing its edge) is the
      // same approach, not an earlier pass.
      if (isIn && !inside && last && along - last[1] <= END_ARRIVAL_METERS) {
        last[1] = along;
      } else if (isIn && !inside) {
        runs.push([along, along]);
      } else if (isIn) {
        runs[runs.length - 1][1] = along;
      }
      inside = isIn;
    };
    visit(line[0][1], line[0][0], 0);
    for (let i = 1; i < line.length; i++) {
      const [lng0, lat0] = line[i - 1];
      const [lng1, lat1] = line[i];
      const segment = haversineDistance(lat0, lng0, lat1, lng1);
      const steps = Math.max(1, Math.ceil(segment / END_ZONE_SAMPLE_METERS));
      for (let s = 1; s <= steps; s++) {
        const f = s / steps;
        visit(lat0 + (lat1 - lat0) * f, lng0 + (lng1 - lng0) * f, travelled + segment * f);
      }
      travelled += segment;
    }
    if (runs.length >= 2 && travelled > 0) {
      const earlierExit = runs[runs.length - 2][1];
      const finalEntry = runs[runs.length - 1][0];
      const threshold = earlierExit + (finalEntry - earlierExit) * END_REVISIT_GAP_FRACTION;
      result = Math.max(END_ARRIVAL_MIN_PROGRESS, (threshold / travelled) * 100);
    }
  }
  endZoneCache.set(line, result);
  return result;
}

/** Whether a fix is at the journey's end (the arrival rule). */
export function hasArrivedAtEnd(
  walker: { lat: number; lng: number } | null,
  line: [number, number][] | null,
  progress: number,
): boolean {
  return (
    walker != null &&
    line != null &&
    line.length > 0 &&
    progress >= endArrivalMinProgress(line) &&
    isNearLineEnd(walker.lat, walker.lng, line, END_ARRIVAL_METERS)
  );
}

/** Whether the walk should finish by itself on this fix. */
export function shouldAutoComplete(
  walker: { lat: number; lng: number } | null,
  line: [number, number][] | null,
  progress: number,
): boolean {
  return progress >= AUTO_COMPLETE_PERCENT || hasArrivedAtEnd(walker, line, progress);
}

/**
 * The stops to credit when the walk completes.
 *
 * `reachedCount` is how many stops the live, sequential tracking had already
 * counted. The rest are re-checked against the completing position: a stop
 * counts if it is reached or passed (hasReachedOrPassedStop) or lies within
 * FINISH_STOP_RADIUS_METERS of the end along the line or of the walker. Every
 * remaining stop is checked on its own, so one genuinely skipped stop does
 * not hide the final one behind it; and a stale `reachedCount` (the fix that
 * completes the walk also reached a stop) loses nothing.
 */
export function stopsVisitedAtCompletion<T extends { lat: number; lng: number }>(
  walker: { lat: number; lng: number } | null,
  stops: T[],
  reachedCount: number,
  line: [number, number][] | null,
): T[] {
  const count = Math.max(0, Math.min(stops.length, reachedCount));
  const visited = stops.slice(0, count);
  if (!walker) {
    return visited;
  }
  // "Near the end along the line" only credits a stop when the walker is at
  // the end too — not on a distance-fallback completion somewhere before it.
  const walkerAtEnd =
    line != null &&
    line.length >= 2 &&
    isNearLineEnd(walker.lat, walker.lng, line, FINISH_STOP_RADIUS_METERS);
  const lineLength = walkerAtEnd && line ? lineLengthMeters(line) : null;
  for (const stop of stops.slice(count)) {
    const nearWalker =
      haversineDistance(walker.lat, walker.lng, stop.lat, stop.lng) <= FINISH_STOP_RADIUS_METERS;
    const nearEnd =
      line != null &&
      lineLength != null &&
      lineLength - distanceAlongRouteMeters(stop.lat, stop.lng, line) <= FINISH_STOP_RADIUS_METERS;
    if (nearWalker || nearEnd || hasReachedOrPassedStop(walker, stop, line)) {
      visited.push(stop);
    }
  }
  return visited;
}

function lineLengthMeters(line: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    total += haversineDistance(line[i - 1][1], line[i - 1][0], line[i][1], line[i][0]);
  }
  return total;
}
