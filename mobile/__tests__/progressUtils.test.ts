import {
  AUTO_COMPLETE_PERCENT,
  END_ARRIVAL_MIN_PROGRESS,
  STOP_VISIT_MINUTES,
  endArrivalMinProgress,
  estimateRemainingJourneyMinutes,
  hasArrivedAtEnd,
  shouldAutoComplete,
  stopsVisitedAtCompletion,
  journeyProgressPercent,
  estimateRemainingMinutes,
  estimateRemainingSeconds,
  hasReachedOrPassedStop,
  shouldTriggerCheckpoint,
} from '../src/utils/progressUtils';

describe('estimateRemainingSeconds', () => {
  it('keeps sub-minute remainders instead of rounding them to 0', () => {
    // 24 m at 1.2 m/s = 20 s; round(minutes) * 60 used to send 0.
    const seconds = estimateRemainingSeconds({ remainingMeters: 24, walkedMeters: 0, trackedSeconds: 0 });
    expect(Math.round(seconds)).toBe(20);
    expect(estimateRemainingMinutes({ remainingMeters: 24, walkedMeters: 0, trackedSeconds: 0 })).toBe(0);
  });

  it('agrees with the minute estimate', () => {
    const input = { remainingMeters: 1000, walkedMeters: 800, trackedSeconds: 1600 };
    expect(Math.round(estimateRemainingSeconds(input) / 60)).toBe(estimateRemainingMinutes(input));
  });

  it('is never negative', () => {
    expect(estimateRemainingSeconds({ remainingMeters: -50, walkedMeters: 0, trackedSeconds: 0 })).toBe(0);
  });
});

describe('shouldTriggerCheckpoint', () => {
  const base = { routeDistanceMeters: 2000, autoCompletePercent: 90 };

  it('does not trigger before the checkpoint', () => {
    expect(shouldTriggerCheckpoint({ ...base, checkpoint: 50, progress: 49.9 })).toBe(false);
  });

  it('triggers right after crossing with plenty of route left', () => {
    expect(shouldTriggerCheckpoint({ ...base, checkpoint: 25, progress: 25.4 })).toBe(true);
    expect(shouldTriggerCheckpoint({ ...base, checkpoint: 50, progress: 58 })).toBe(true);
  });

  it('skips a checkpoint the progress jumped far past', () => {
    // Regression: progress leapt from ~45% to ~86% and the 50% sheet opened
    // seconds before auto-complete.
    expect(shouldTriggerCheckpoint({ ...base, checkpoint: 50, progress: 86 })).toBe(false);
    expect(shouldTriggerCheckpoint({ ...base, checkpoint: 50, progress: 61 })).toBe(false);
  });

  it('skips when auto-completion is less than 150 m away', () => {
    // 1000 m route: 76% leaves 14% = 140 m before completing at 90%.
    expect(
      shouldTriggerCheckpoint({ checkpoint: 75, progress: 76, routeDistanceMeters: 1000, autoCompletePercent: 90 }),
    ).toBe(false);
    // Same crossing on a 2 km route leaves 280 m.
    expect(shouldTriggerCheckpoint({ ...base, checkpoint: 75, progress: 76 })).toBe(true);
  });

  it('never triggers at or beyond auto-completion', () => {
    expect(shouldTriggerCheckpoint({ ...base, checkpoint: 75, progress: 90 })).toBe(false);
    expect(shouldTriggerCheckpoint({ ...base, checkpoint: 75, progress: 75, routeDistanceMeters: 0 })).toBe(false);
  });
});

describe('estimateRemainingMinutes', () => {
  const ROUTE = 1800; // 1800 m at 1.2 m/s = 25 min

  it('uses the default pace before anything is walked', () => {
    expect(
      estimateRemainingMinutes({ remainingMeters: ROUTE, walkedMeters: 0, trackedSeconds: 0 }),
    ).toBe(25);
  });

  it('does not jump up after the first ~110 m, however long startup took', () => {
    // Regression: 110 m over 150 s (standing still before the first fixes)
    // measured 0.73 m/s and pushed the estimate from 25 to ~38 min.
    const initial = estimateRemainingMinutes({ remainingMeters: ROUTE, walkedMeters: 0, trackedSeconds: 0 });
    for (const trackedSeconds of [30, 90, 150, 300]) {
      const after = estimateRemainingMinutes({
        remainingMeters: ROUTE - 110,
        walkedMeters: 110,
        trackedSeconds,
      });
      expect(after).toBeLessThanOrEqual(initial);
    }
  });

  it('never rises by more than a minute while the measured pace blends in', () => {
    // A slowish walker (1.0 m/s) with a 60 s startup delay counted in.
    let previous = estimateRemainingMinutes({ remainingMeters: ROUTE, walkedMeters: 0, trackedSeconds: 0 });
    for (let walked = 20; walked <= 800; walked += 20) {
      const minutes = estimateRemainingMinutes({
        remainingMeters: ROUTE - walked,
        walkedMeters: walked,
        trackedSeconds: 60 + walked / 1.0,
      });
      expect(minutes).toBeLessThanOrEqual(previous + 1);
      previous = minutes;
    }
  });

  it('converges to the measured pace once enough is walked', () => {
    // 800 m in 1600 s = 0.5 m/s; 1000 m left -> ~33 min.
    expect(
      estimateRemainingMinutes({ remainingMeters: 1000, walkedMeters: 800, trackedSeconds: 1600 }),
    ).toBe(33);
  });

  it('honours a custom baseline pace', () => {
    expect(
      estimateRemainingMinutes({
        remainingMeters: 1800,
        walkedMeters: 0,
        trackedSeconds: 0,
        baselineSpeedMps: 0.6,
      }),
    ).toBe(50);
  });

  it('is finite and non-negative for degenerate input', () => {
    const r = estimateRemainingMinutes({
      remainingMeters: -5,
      walkedMeters: 500,
      trackedSeconds: 0,
      baselineSpeedMps: 0,
    });
    expect(r).toBe(0);
    const stuck = estimateRemainingMinutes({ remainingMeters: 1000, walkedMeters: 700, trackedSeconds: 1e9 });
    expect(Number.isFinite(stuck)).toBe(true);
  });
});

describe('hasReachedOrPassedStop', () => {
  // West-to-east line ~1.76 km long at lat 37.975 (1 deg lng ~ 87.8 km).
  const LAT = 37.975;
  const line: [number, number][] = [
    [23.72, LAT],
    [23.73, LAT],
    [23.74, LAT],
  ];
  // Stop ~440 m along, set 59 m back from the street (like the Parliament).
  const stop = { lat: LAT + 0.00053, lng: 23.725 };

  it('is true within the arrival radius', () => {
    expect(hasReachedOrPassedStop({ lat: LAT + 0.0003, lng: 23.725 }, stop, line)).toBe(true);
  });

  it('is false on the line before the stop', () => {
    expect(hasReachedOrPassedStop({ lat: LAT, lng: 23.722 }, stop, line)).toBe(false);
  });

  it('is true on the line past the stop although never within the radius', () => {
    expect(hasReachedOrPassedStop({ lat: LAT, lng: 23.7256 }, stop, line)).toBe(true);
  });

  it('is false for a position far from the line that projects past the stop', () => {
    // Regression: a first fix ~2 km east (where the previous walk ended)
    // projects onto the route end and made every stop count as passed.
    expect(hasReachedOrPassedStop({ lat: LAT, lng: 23.76 }, stop, line)).toBe(false);
    expect(hasReachedOrPassedStop({ lat: LAT + 0.01, lng: 23.738 }, stop, line)).toBe(false);
  });

  it('falls back to the radius only without geometry', () => {
    expect(hasReachedOrPassedStop({ lat: LAT, lng: 23.7256 }, stop, null)).toBe(false);
  });
});

describe('journeyProgressPercent', () => {
  it('is walked/total on the original route', () => {
    expect(journeyProgressPercent(456, 1823, null)).toBeCloseTo(25, 0);
  });

  it('caps at 100', () => {
    expect(journeyProgressPercent(2500, 1823, null)).toBe(100);
  });

  it('continues (not resets) when a detour is accepted', () => {
    // At 25% of a 1823 m route the user accepts a 1333 m detour: the bar
    // must stay ~25%, not drop to 0.
    const detour = { walkedAtSwitch: 456, distanceMeters: 1333 };
    const atSwitch = journeyProgressPercent(456, 1823, detour);
    expect(atSwitch).toBeGreaterThanOrEqual(25);
    expect(atSwitch).toBeLessThan(30);
  });

  it('never moves backwards even for a detour longer than the remainder', () => {
    // Huge detour would mathematically dip the blended fraction below the
    // pre-switch 25% — the pre-switch value acts as a floor.
    const detour = { walkedAtSwitch: 456, distanceMeters: 3000 };
    expect(journeyProgressPercent(456, 1823, detour)).toBeGreaterThanOrEqual(
      journeyProgressPercent(456, 1823, null),
    );
  });

  it('grows along the detour and reaches ~100 at its end', () => {
    const detour = { walkedAtSwitch: 456, distanceMeters: 1333 };
    const midway = journeyProgressPercent(456 + 666, 1823, detour);
    const atEnd = journeyProgressPercent(456 + 1333, 1823, detour);
    expect(midway).toBeGreaterThan(50);
    expect(midway).toBeLessThan(75);
    expect(atEnd).toBeCloseTo(100, 0);
  });

  it('survives zero totals without dividing by zero', () => {
    expect(journeyProgressPercent(10, 0, null)).toBe(100);
    expect(Number.isFinite(journeyProgressPercent(10, 0, { walkedAtSwitch: 5, distanceMeters: 0 }))).toBe(true);
  });
});

describe('estimateRemainingJourneyMinutes', () => {
  it('matches the advertised route duration at the start (walk at 72 m/min + 15 min per stop)', () => {
    // Regression: a 139 m, three-stop route showed 47 min on its card and
    // 2 min in «remaining».
    const minutes = estimateRemainingJourneyMinutes({
      remainingMeters: 139,
      walkedMeters: 0,
      trackedSeconds: 0,
      unvisitedStops: 3,
    });
    expect(minutes).toBe(Math.round(139 / 72) + 15 * 3);
    expect(STOP_VISIT_MINUTES).toBe(15);
  });

  it('drops the visit time of stops already visited', () => {
    const input = { remainingMeters: 720, walkedMeters: 0, trackedSeconds: 0 };
    expect(estimateRemainingJourneyMinutes({ ...input, unvisitedStops: 2 })).toBe(10 + 30);
    expect(estimateRemainingJourneyMinutes({ ...input, unvisitedStops: 0 })).toBe(10);
  });

  it('uses the same walking estimate as estimateRemainingMinutes', () => {
    const input = { remainingMeters: 1000, walkedMeters: 800, trackedSeconds: 1600 };
    expect(estimateRemainingJourneyMinutes({ ...input, unvisitedStops: 1 })).toBe(
      estimateRemainingMinutes(input) + STOP_VISIT_MINUTES,
    );
  });
});

describe('completion', () => {
  const LAT = 37.975;
  // ~1.76 km west to east; 0.001 deg lng ~ 87.8 m at this latitude.
  const line: [number, number][] = [
    [23.72, LAT],
    [23.73, LAT],
    [23.74, LAT],
  ];
  const at = (lng: number, dLat = 0) => ({ lat: LAT + dLat, lng });

  it('does not finish at 90% far from the end any more (used to, ~180 m early)', () => {
    expect(shouldAutoComplete(at(23.738), line, 90)).toBe(false);
    expect(AUTO_COMPLETE_PERCENT).toBeGreaterThan(90);
  });

  it('finishes on arrival within 40 m of the end with enough progress', () => {
    expect(shouldAutoComplete(at(23.7397), line, 85)).toBe(true);
    // A 10% GPS undercount still arrives at ~90%.
    expect(hasArrivedAtEnd(at(23.7399), line, 90)).toBe(true);
    expect(hasArrivedAtEnd(at(23.7397), line, END_ARRIVAL_MIN_PROGRESS - 1)).toBe(false);
  });

  it('keeps the distance-only fallback for an end the walker cannot get near', () => {
    expect(shouldAutoComplete(at(23.735, 0.001), line, AUTO_COMPLETE_PERCENT)).toBe(true);
  });

  describe('a line that passes its own end before finishing (out-and-back tail)', () => {
    // East to 23.74, then back west to 23.736 — the end coordinate lies on
    // the street walked earlier, ~1.4 km into a 2.1 km line.
    const tail: [number, number][] = [
      [23.72, LAT],
      [23.74, LAT],
      [23.736, LAT + 0.00005],
    ];

    it('needs more progress than the default floor', () => {
      expect(endArrivalMinProgress(tail)).toBeGreaterThan(END_ARRIVAL_MIN_PROGRESS);
      expect(endArrivalMinProgress(line)).toBe(END_ARRIVAL_MIN_PROGRESS);
    });

    it('does not finish on the way out, but does on the way back', () => {
      // On the way out at the end point: ~1400 of ~2110 m = 66%.
      expect(hasArrivedAtEnd(at(23.736), tail, 66)).toBe(false);
      // Back at the end with a 10% undercount: ~90%.
      expect(hasArrivedAtEnd(at(23.7362), tail, 90)).toBe(true);
    });
  });

  describe('stopsVisitedAtCompletion', () => {
    const first = { id: 1, ...at(23.72) };
    const middle = { id: 2, ...at(23.73, 0.0002) };
    // At the very end of the line: the live rules (30 m / passed by 25 m)
    // cannot fire before completion 40 m earlier.
    const last = { id: 3, ...at(23.74) };
    const stops = [first, middle, last];

    it('credits the final stop when completing 40 m before it', () => {
      const walker = at(23.7396);
      expect(stopsVisitedAtCompletion(walker, stops, 2, line).map(s => s.id)).toEqual([1, 2, 3]);
    });

    it('loses nothing when the live counter is stale by a stop', () => {
      // The completing fix also passed the middle stop, not rendered yet.
      const walker = at(23.7396);
      expect(stopsVisitedAtCompletion(walker, stops, 1, line).map(s => s.id)).toEqual([1, 2, 3]);
    });

    it('does not credit stops the walker has not reached', () => {
      // Completion by the distance fallback far from the end: the last stop
      // is ~440 m ahead.
      const walker = at(23.735);
      expect(stopsVisitedAtCompletion(walker, stops, 1, line).map(s => s.id)).toEqual([1, 2]);
    });

    it('credits a stop near the walker even without geometry', () => {
      expect(stopsVisitedAtCompletion(at(23.7396), stops, 2, null).map(s => s.id)).toEqual([1, 2, 3]);
      expect(stopsVisitedAtCompletion(null, stops, 2, line).map(s => s.id)).toEqual([1, 2]);
    });
  });
});
