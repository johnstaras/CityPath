import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Geolocation, {
  GeoPosition,
} from 'react-native-geolocation-service';
import { RouteDetail, AlternativeRoute, getAlternativeRoutes } from '../services/routeService';
import * as sessionService from '../services/sessionService';
import { useActiveProfileId } from './useActiveProfileId';
import {
  haversineDistance,
  distanceToRouteMeters,
  isNearLineEnd,
} from '../utils/locationUtils';
import {
  AUTO_COMPLETE_PERCENT,
  END_ARRIVAL_METERS,
  END_ARRIVAL_MIN_PROGRESS,
  STOP_COUNTS_AS_COMPLETE_PERCENT,
  journeyProgressPercent,
  estimateRemainingSeconds,
  estimateRemainingJourneyMinutes,
  hasReachedOrPassedStop,
  shouldAutoComplete,
  shouldTriggerCheckpoint,
  stopsVisitedAtCompletion,
} from '../utils/progressUtils';
import { ensureLocationPermission } from '../utils/permissions';
import { POI } from '../models';
import { logRouteStarted, logRouteCompleted, logCheckpointReached } from '../services/firebaseService';

type RouteStatus = 'idle' | 'active' | 'paused';

/** Why the walk could not start: no location access, or the session call failed. */
export type StartError = 'permission' | 'session';

const CHECKPOINTS = [25, 50, 75] as const;

// Completion thresholds (arrival at the end, the distance fallback, the manual
// stop that still counts as completed) and the stop arrival / "walked past it"
// rules live in progressUtils so they can be unit-tested.

// A position the OS already has is used to place the map right away, but only
// if it is this fresh — an older one can be where the previous walk ended.
const INITIAL_FIX_MAX_AGE_MS = 10_000;

// Off-route detection: farther than ENTER meters from the planned line the
// walk stops counting toward progress (otherwise wandering anywhere would
// eventually auto-complete the route) and the screen shows a notice; back
// within EXIT meters it resumes. The gap prevents flapping at the boundary.
const OFF_ROUTE_ENTER_METERS = 50;
const OFF_ROUTE_EXIT_METERS = 40;

interface UserPosition {
  lat: number;
  lng: number;
}

export interface CompletionData {
  durationMinutes: number;
  distanceMeters: number;
  visitedPois: POI[];
  totalPois: number;
  route: RouteDetail;
}

interface ActiveRouteViewModel {
  route: RouteDetail;
  userPosition: UserPosition | null;
  progress: number;
  isOffRoute: boolean;
  status: RouteStatus;
  /** Set when starting failed; cleared by a new start attempt. */
  startError: StartError | null;
  elapsedMinutes: number;
  nextPoi: POI | null;
  nextPoiDistance: number | null;
  /** Minutes left: walking time plus the visit time of the stops still ahead. */
  remainingTime: number;
  remainingDistance: number;
  sessionId: number | null;
  showCheckpointModal: boolean;
  checkpointPercent: number;
  /**
   * Detour suggestions. `estimatedDurationMinutes` is replaced by the time to
   * finish via that POI, computed exactly as `remainingTime` will be right
   * after switching to it.
   */
  alternatives: AlternativeRoute[];
  isCompleted: boolean;
  completionData: CompletionData | null;
  startRoute: () => Promise<void>;
  pauseRoute: () => void;
  resumeRoute: () => void;
  /** Resolves false when the session was already being finished elsewhere. */
  stopRoute: () => Promise<boolean>;
  completeRoute: () => Promise<void>;
  selectAlternativeRoute: (route: AlternativeRoute) => Promise<void>;
  dismissCheckpoint: () => void;
}

/**
 * A checkpoint suggestion the user accepted: the journey ahead is replaced by
 * the walk to this POI, while the session and total-walked stats continue.
 */
interface ActiveDetour {
  poi: POI;
  geometry?: GeoJSON.Geometry;
  distanceMeters: number;
  /** distanceWalked at the moment of the switch — the new leg starts here. */
  walkedAtSwitch: number;
  /** Stops already visited on the original route, kept for the summary. */
  visitedBefore: POI[];
}

const SESSION_UPDATE_INTERVAL_MS = 30_000;

export function useActiveRouteViewModel(
  route: RouteDetail,
): ActiveRouteViewModel {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RouteStatus>('idle');
  const [startError, setStartError] = useState<StartError | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [distanceWalked, setDistanceWalked] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Active seconds since the first GPS fix — the pace denominator. Excludes
  // the wait for the first fix, which is not walking time.
  const [trackedSeconds, setTrackedSeconds] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [nextPoiIndex, setNextPoiIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionData, setCompletionData] = useState<CompletionData | null>(null);
  const [isOffRoute, setIsOffRoute] = useState(false);

  // Checkpoint state
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [checkpointPercent, setCheckpointPercent] = useState(0);
  const [alternatives, setAlternatives] = useState<AlternativeRoute[]>([]);
  const [detour, setDetour] = useState<ActiveDetour | null>(null);
  const triggeredCheckpointsRef = useRef<Set<number>>(new Set());

  // Alternative-route suggestions must respect the user's actual mobility
  // needs. Falls back to profile 1 (pedestrian baseline) only when the user
  // has no profile. Ref keeps the value fresh inside tracking callbacks.
  const activeProfileId = useActiveProfileId();
  const mobilityProfileIdRef = useRef<number>(1);
  useEffect(() => {
    if (activeProfileId != null) {
      mobilityProfileIdRef.current = activeProfileId;
    }
  }, [activeProfileId]);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<UserPosition | null>(null);
  const lastSyncRef = useRef<number>(0);
  const statusRef = useRef<RouteStatus>(status);
  // Set once the session starts finishing (auto-complete, stop, complete) so
  // it is synced and closed exactly once even if two paths race.
  const finishedRef = useRef(false);
  // The line the walker is expected to follow, as [lng, lat] pairs — refs so
  // the stable GPS callback always sees the current journey.
  const routeLineRef = useRef<[number, number][] | null>(null);
  const offRouteRef = useRef(false);
  // Pause/resume reach the server in order: a resume sent before the pause it
  // follows has landed would be rejected ("only paused sessions can be resumed").
  const pauseSyncRef = useRef<Promise<void>>(Promise.resolve());

  // Keep statusRef in sync
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const activeGeometry = detour ? detour.geometry ?? route.geometry : route.geometry;
  useEffect(() => {
    routeLineRef.current =
      activeGeometry && activeGeometry.type === 'LineString'
        ? (activeGeometry.coordinates as [number, number][])
        : null;
  }, [activeGeometry]);

  const routePois = useMemo(() => route.pois ?? [], [route.pois]);
  const pois = useMemo(() => (detour ? [detour.poi] : routePois), [detour, routePois]);
  const totalDistance = (detour ? detour.distanceMeters : route.distanceMeters) || 1;
  // Remaining time/distance are about the leg AHEAD, so they stay leg-based;
  // the progress bar measures the whole journey and carries on continuously
  // across a detour switch (never resets, never moves backwards).
  const walkedOnLeg = detour
    ? Math.max(0, distanceWalked - detour.walkedAtSwitch)
    : distanceWalked;
  const progress = journeyProgressPercent(distanceWalked, route.distanceMeters, detour);
  const elapsedMinutes = Math.round(elapsedSeconds / 60);

  // Latest walk stats for the session sync. Read through a ref so the 30 s
  // sync interval does not have to be recreated on every GPS fix and timer
  // tick (it used to be, and so practically never fired). Declared before the
  // auto-complete effect so the final sync it triggers sees this render.
  const statsRef = useRef({ progress, elapsedMinutes, distanceWalked });
  useEffect(() => {
    statsRef.current = { progress, elapsedMinutes, distanceWalked };
  });

  // Remaining calculations
  const remainingDistance = Math.max(0, totalDistance - walkedOnLeg);
  // WALKING seconds only: default pace first, the walker's measured pace
  // blended in once enough of the walk has been measured (see
  // estimateRemainingSeconds). This is what the detour budget is sent as.
  const remainingSeconds = estimateRemainingSeconds({
    remainingMeters: remainingDistance,
    walkedMeters: distanceWalked,
    trackedSeconds,
  });
  // What the screen shows: the walking time plus the visit time of every stop
  // not reached yet — the same model as the route's advertised duration.
  const remainingTime = estimateRemainingJourneyMinutes({
    remainingMeters: remainingDistance,
    walkedMeters: distanceWalked,
    trackedSeconds,
    unvisitedStops: Math.max(0, pois.length - nextPoiIndex),
  });

  // Next POI
  const nextPoi = nextPoiIndex < pois.length ? pois[nextPoiIndex] : null;
  const nextPoiDistance =
    nextPoi && userPosition
      ? Math.round(
          haversineDistance(
            userPosition.lat,
            userPosition.lng,
            nextPoi.lat,
            nextPoi.lng,
          ),
        )
      : null;

  // Completion reads these instead of its render's closure: it runs after an
  // await, and the GPS fix that completes the walk can also be the one that
  // reaches a stop — its index update is not rendered yet at that point.
  const nextPoiIndexRef = useRef(nextPoiIndex);
  const userPositionRef = useRef<UserPosition | null>(userPosition);
  const completionInputsRef = useRef({ detour, pois, elapsedSeconds, distanceWalked, route });
  useEffect(() => {
    nextPoiIndexRef.current = nextPoiIndex;
    userPositionRef.current = userPosition;
    completionInputsRef.current = { detour, pois, elapsedSeconds, distanceWalked, route };
  });

  // Advance to the next stop once this one is either reached or left behind.
  useEffect(() => {
    if (!userPosition || nextPoiIndex >= pois.length) {
      return;
    }
    // Proximity alone is not enough. OSRM routes along the street while a
    // landmark's coordinate can sit well back from it — the Hellenic
    // Parliament is 59 m from its own route line, and 10% of all catalogue
    // stops are further than the arrival radius from the path they belong to.
    // Because the index is sequential, one such stop used to stall every stop
    // after it for the rest of the walk (a five-stop route finished 1/5).
    // So a stop also counts once the walker has gone past it along the line —
    // but only while the walker is ON the line. A first fix far from the route
    // (e.g. where the previous walk ended) projects onto the route end, and
    // used to skip every stop at once, hiding the next-stop cards for the
    // whole walk.
    if (hasReachedOrPassedStop(userPosition, pois[nextPoiIndex], routeLineRef.current)) {
      nextPoiIndexRef.current = nextPoiIndex + 1;
      userPositionRef.current = userPosition;
      setNextPoiIndex(prev => prev + 1);
    }
  }, [userPosition, nextPoiIndex, pois]);

  // Auto-complete on arrival at the journey's end, or once the distance
  // counter alone says the route is done (see progressUtils).
  useEffect(() => {
    if (status !== 'active' || sessionId == null) {
      return;
    }
    if (shouldAutoComplete(userPosition, routeLineRef.current, progress)) {
      userPositionRef.current = userPosition;
      handleAutoComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, status, sessionId, userPosition]);

  // Checkpoint detection: trigger at 25%, 50%, 75%. Suspended on a detour —
  // suggesting a detour from a detour on a few-hundred-meter leg is noise.
  useEffect(() => {
    if (status !== 'active' || !userPosition || detour != null) {
      return;
    }
    for (const cp of CHECKPOINTS) {
      if (progress < cp || triggeredCheckpointsRef.current.has(cp)) {
        continue;
      }
      // Reached: spend it either way. A stale one (progress jumped well past
      // it) or one too close to auto-completion is skipped instead of opening
      // a suggestion sheet the completion screen replaces seconds later.
      triggeredCheckpointsRef.current.add(cp);
      if (
        shouldTriggerCheckpoint({
          checkpoint: cp,
          progress,
          routeDistanceMeters: route.distanceMeters,
          autoCompletePercent: AUTO_COMPLETE_PERCENT,
        })
      ) {
        fetchAlternatives(cp);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, status, userPosition, detour]);

  const fetchAlternatives = useCallback(
    async (cp: number) => {
      if (!userPosition) return;
      logCheckpointReached(route.id, cp).catch(() => {});
      const visitedPoiIds = pois
        .slice(0, nextPoiIndex)
        .map(p => p.id);
      try {
        const result = await getAlternativeRoutes(route.id, {
          lat: userPosition.lat,
          lng: userPosition.lng,
          // Seconds of WALKING left, without the stop visit time the screen
          // adds: the server budgets a detour's extra walking against it.
          // Unrounded to minutes — rounding first turned anything under 30 s
          // into 0.
          remaining_time: Math.max(0, Math.round(remainingSeconds)),
          mobility_profile_id: mobilityProfileIdRef.current,
          visited_pois: visitedPoiIds,
        });
        // The walk may have finished while the request was in flight.
        if (result.length > 0 && !finishedRef.current) {
          setAlternatives(result);
          setCheckpointPercent(cp);
          setShowCheckpointModal(true);
        }
      } catch (err) {
        console.warn('Failed to fetch alternative routes:', err);
      }
    },
    [userPosition, remainingSeconds, route.id, pois, nextPoiIndex],
  );

  // `atEnd`: the walk finished by arriving (auto-complete), so stops at the
  // journey's end count even though the regular arrival rules had not fired.
  const buildCompletionData = useCallback((atEnd: boolean): CompletionData => {
    const inputs = completionInputsRef.current;
    const reachedCount = nextPoiIndexRef.current;
    const reached = atEnd
      ? stopsVisitedAtCompletion(userPositionRef.current, inputs.pois, reachedCount, routeLineRef.current)
      : inputs.pois.slice(0, reachedCount);
    // On a detour, credit the stops visited before the switch plus the
    // detour stop itself once reached.
    const visitedPois = inputs.detour ? [...inputs.detour.visitedBefore, ...reached] : reached;
    return {
      durationMinutes: Math.round(inputs.elapsedSeconds / 60),
      distanceMeters: Math.round(inputs.distanceWalked),
      visitedPois,
      totalPois: inputs.detour ? inputs.detour.visitedBefore.length + 1 : inputs.pois.length,
      route: inputs.route,
    };
  }, []);

  const syncSession = useCallback(
    async (force = false) => {
      if (sessionId == null) {
        return;
      }
      const now = Date.now();
      if (!force && now - lastSyncRef.current < SESSION_UPDATE_INTERVAL_MS) {
        return;
      }
      lastSyncRef.current = now;
      const latest = statsRef.current;
      try {
        await sessionService.updateSession(sessionId, {
          progressPercent: Math.round(latest.progress),
          actualDurationMinutes: latest.elapsedMinutes,
          distanceWalkedMeters: Math.round(latest.distanceWalked),
        });
      } catch (err) {
        console.warn('Failed to sync session:', err);
      }
    },
    [sessionId],
  );

  const handlePositionUpdate = useCallback((position: GeoPosition) => {
    const { latitude, longitude } = position.coords;
    const newPos: UserPosition = { lat: latitude, lng: longitude };
    setUserPosition(newPos);

    if (statusRef.current !== 'active') {
      return;
    }

    // Off-route detection with hysteresis; no line geometry means the check
    // is disabled and everything counts (legacy routes without geometry).
    const line = routeLineRef.current;
    const wasOff = offRouteRef.current;
    if (line) {
      const dist = distanceToRouteMeters(latitude, longitude, line);
      const nowOff = offRouteRef.current
        ? dist > OFF_ROUTE_EXIT_METERS
        : dist > OFF_ROUTE_ENTER_METERS;
      if (nowOff !== offRouteRef.current) {
        offRouteRef.current = nowOff;
        setIsOffRoute(nowOff);
      }
    }

    if (lastPositionRef.current) {
      const delta = haversineDistance(
        lastPositionRef.current.lat,
        lastPositionRef.current.lng,
        newPos.lat,
        newPos.lng,
      );
      // Ignore GPS jitter (< 2m) and implausible jumps (> 100m in one
      // update); off-route movement is not progress along the route, and
      // neither is the walk back: the fix that re-enters the route is measured
      // from the last off-route point, so it is skipped too.
      if (delta >= 2 && delta <= 100 && !offRouteRef.current && !wasOff) {
        setDistanceWalked(prev => prev + delta);
      }
    }
    lastPositionRef.current = newPos;
  }, []);

  const startGpsWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      return;
    }
    watchIdRef.current = Geolocation.watchPosition(
      handlePositionUpdate,
      error => console.warn('GPS error:', error.message),
      {
        enableHighAccuracy: true,
        distanceFilter: 5,
        interval: 3000,
        fastestInterval: 1500,
      },
    );
  }, [handlePositionUpdate]);

  const stopGpsWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current != null) {
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
      if (lastPositionRef.current != null) {
        setTrackedSeconds(prev => prev + 1);
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracking = useCallback(() => {
    stopGpsWatch();
    stopTimer();
  }, [stopGpsWatch, stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Periodic session sync. syncSession only changes with sessionId, so the
  // interval lives for the whole active stretch. Forced because the interval
  // already sets the cadence — a slightly early tick must not be throttled
  // away and silently halve the sync rate.
  useEffect(() => {
    if (status === 'active' && sessionId != null) {
      const interval = setInterval(() => {
        syncSession(true);
      }, SESSION_UPDATE_INTERVAL_MS);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [status, sessionId, syncSession]);

  // Ends the session once: stop tracking, push the final walk stats, then
  // close it. The final sync must come first — the server rejects progress
  // updates on a finished session, and complete/cancel only set the status.
  // A failed sync is logged inside syncSession and never blocks the close.
  const finishSession = useCallback(
    async (outcome: 'complete' | 'cancel'): Promise<boolean> => {
      if (finishedRef.current) {
        return false;
      }
      finishedRef.current = true;
      stopTracking();
      setStatus('idle');
      if (sessionId != null) {
        await syncSession(true);
        try {
          if (outcome === 'complete') {
            await sessionService.completeSession(sessionId);
            // Completed routes and walked distance feed the profile stats.
            queryClient.invalidateQueries({ queryKey: ['profileStats'] });
          } else {
            await sessionService.cancelSession(sessionId);
          }
        } catch (err) {
          console.warn(`Failed to ${outcome} session:`, err);
        }
      }
      return true;
    },
    [sessionId, stopTracking, syncSession, queryClient],
  );

  const handleAutoComplete = useCallback(async () => {
    if (!(await finishSession('complete'))) {
      return;
    }
    const data = buildCompletionData(true);
    logRouteCompleted(route.id, data.durationMinutes).catch(() => {});
    setCompletionData(data);
    setIsCompleted(true);
  }, [finishSession, route.id, buildCompletionData]);

  const startRoute = useCallback(async () => {
    setStartError(null);
    // Rationale texts come from i18n inside permissions.ts.
    const hasPermission = await ensureLocationPermission();
    if (!hasPermission) {
      setStartError('permission');
      return;
    }
    try {
      const session = await sessionService.startSession(route.id);
      setSessionId(session.id);
      setStatus('active');
      setDistanceWalked(0);
      setElapsedSeconds(0);
      setTrackedSeconds(0);
      setNextPoiIndex(0);
      nextPoiIndexRef.current = 0;
      finishedRef.current = false;
      lastPositionRef.current = null;
      lastSyncRef.current = Date.now();
      startGpsWatch();
      // The watch only reports once the next fix arrives. If the OS already
      // holds a recent position, show it now so the map and the next-stop
      // distance do not wait for it. Display only: distance is still counted
      // from the watch's first fix.
      Geolocation.getCurrentPosition(
        ({ coords }) =>
          setUserPosition(prev => prev ?? { lat: coords.latitude, lng: coords.longitude }),
        () => {},
        { enableHighAccuracy: true, maximumAge: INITIAL_FIX_MAX_AGE_MS, timeout: 10_000 },
      );
      startTimer();
      logRouteStarted(route.id, route.title).catch(() => {});
    } catch (err) {
      console.warn('Failed to start session:', err);
      setStartError('session');
    }
  }, [route.id, route.title, startGpsWatch, startTimer]);

  // Fire-and-forget, like the progress sync: a failed call is logged and never
  // blocks the walk (the next start cancels any session left unfinished).
  const syncPauseState = useCallback(
    (action: 'pause' | 'resume') => {
      if (sessionId == null) {
        return;
      }
      const call = action === 'pause' ? sessionService.pauseSession : sessionService.resumeSession;
      pauseSyncRef.current = pauseSyncRef.current
        .then(() => call(sessionId))
        .then(
          () => undefined,
          err => console.warn(`Failed to ${action} session:`, err),
        );
    },
    [sessionId],
  );

  const pauseRoute = useCallback(() => {
    if (statusRef.current !== 'active') {
      return;
    }
    statusRef.current = 'paused';
    setStatus('paused');
    stopTimer();
    syncPauseState('pause');
  }, [stopTimer, syncPauseState]);

  const resumeRoute = useCallback(() => {
    if (statusRef.current !== 'paused') {
      return;
    }
    // Fixes are not counted while paused, so the last counted one is where the
    // pause began. Measuring the first fix after resuming from there added
    // everything moved during the pause; start from the next fix instead.
    lastPositionRef.current = null;
    statusRef.current = 'active';
    setStatus('active');
    startTimer();
    syncPauseState('resume');
  }, [startTimer, syncPauseState]);

  // Read from refs: the confirm dialog keeps the stopRoute it was opened with,
  // and the walker may have gone on moving while it was showing. Stopping at
  // the destination counts as completed even when the distance counter fell
  // short of STOP_COUNTS_AS_COMPLETE_PERCENT.
  const stopRoute = useCallback(() => {
    const { progress: latestProgress } = statsRef.current;
    const position = userPositionRef.current;
    const line = routeLineRef.current;
    const atDestination =
      position != null &&
      line != null &&
      latestProgress >= END_ARRIVAL_MIN_PROGRESS &&
      isNearLineEnd(position.lat, position.lng, line, END_ARRIVAL_METERS);
    return finishSession(
      latestProgress >= STOP_COUNTS_AS_COMPLETE_PERCENT || atDestination ? 'complete' : 'cancel',
    );
  }, [finishSession]);

  const completeRoute = useCallback(async () => {
    if (!(await finishSession('complete'))) {
      return;
    }
    const data = buildCompletionData(false);
    logRouteCompleted(route.id, data.durationMinutes).catch(() => {});
    setCompletionData(data);
    setIsCompleted(true);
  }, [finishSession, buildCompletionData, route.id]);

  // Seamless switch: same screen, same session, tracking never stops — only
  // the journey ahead changes. The map line becomes the walking path to the
  // chosen POI; the progress bar carries on (journeyProgressPercent) while
  // remaining time/distance switch to the new leg. The original route's
  // unvisited stops are dropped: the new leg's only stop is the chosen POI.
  const selectAlternativeRoute = useCallback(
    async (selected: AlternativeRoute) => {
      setShowCheckpointModal(false);
      setAlternatives([]);
      if (selected.lat == null || selected.lng == null) {
        return;
      }
      const detourPoi: POI = selected.poi ?? {
        id: selected.id,
        name: selected.title,
        category: selected.category,
        wheelchair: 'unknown',
        hasRamp: false,
        hasTactilePaving: false,
        hasRestArea: false,
        lat: selected.lat,
        lng: selected.lng,
      };
      setDetour({
        poi: detourPoi,
        geometry: selected.geometry,
        distanceMeters: selected.distanceMeters || 1,
        walkedAtSwitch: distanceWalked,
        visitedBefore: routePois.slice(0, nextPoiIndex),
      });
      setNextPoiIndex(0);
      nextPoiIndexRef.current = 0;
    },
    [distanceWalked, routePois, nextPoiIndex],
  );

  const dismissCheckpoint = useCallback(() => {
    setShowCheckpointModal(false);
    setAlternatives([]);
  }, []);

  // Each card's minutes = what «remaining» shows right after switching to it:
  // the detour leg's walking time at the same blended pace plus one stop visit
  // (the chosen POI — the switch keeps no other stop). Same helper, same
  // inputs, so the two numbers agree by construction. The server's own
  // estimate is not used for display.
  const alternativesForDisplay = useMemo(
    () =>
      alternatives.map(alt => ({
        ...alt,
        estimatedDurationMinutes: estimateRemainingJourneyMinutes({
          remainingMeters: alt.distanceMeters || 1,
          walkedMeters: distanceWalked,
          trackedSeconds,
          unvisitedStops: 1,
        }),
      })),
    [alternatives, distanceWalked, trackedSeconds],
  );

  // What the screen renders: on a detour the map line and stops become the
  // walk to the chosen POI, everything else stays the original route.
  const activeRoute: RouteDetail = detour
    ? {
        ...route,
        geometry: detour.geometry ?? route.geometry,
        pois,
        distanceMeters: detour.distanceMeters,
      }
    : route;

  return {
    route: activeRoute,
    userPosition,
    progress,
    isOffRoute,
    status,
    startError,
    elapsedMinutes,
    nextPoi,
    nextPoiDistance,
    remainingTime,
    remainingDistance,
    sessionId,
    showCheckpointModal,
    checkpointPercent,
    alternatives: alternativesForDisplay,
    isCompleted,
    completionData,
    startRoute,
    pauseRoute,
    resumeRoute,
    stopRoute,
    completeRoute,
    selectAlternativeRoute,
    dismissCheckpoint,
  };
}
