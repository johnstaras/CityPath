// 3. Walk simulation over every catalogue route, against the CURRENT
// mobile/src/utils/progressUtils.ts + locationUtils.ts (transpiled on load).
// Usage: OUT=<dir> node 04-walk-sim.js
//
// Mirrors useActiveRouteViewModel:
//  - a GPS fix every 5 m along the route line (distanceFilter: 5)
//  - distance counter: delta in [2, 100] m and not off route
//    (off-route hysteresis: enter > 50 m, exit <= 40 m from the line)
//  - progress = walked / route.distanceMeters (journeyProgressPercent, no detour)
//  - sequential stop advance with hasReachedOrPassedStop
//  - shouldAutoComplete -> stopsVisitedAtCompletion(position, stops, reachedCount)
//    where reachedCount is the index BEFORE this fix (stale-render case)
//  - checkpoints 25/50/75: spent once when reached, fire only if
//    shouldTriggerCheckpoint (at most one per fix, as the effect breaks)
// Scenarios: perfect walk; 10% GPS undercount (every counted delta x 0.9);
// 10% undercount + correlated GPS noise, AR(1) per axis, rho = 0.9 per fix,
// stationary sd 8/sqrt(2) m per axis (8 m radial RMS), fixed seed.
const { BASE, timedGet, save, stats, requireTs } = require('./common');

const P = requireTs('utils/progressUtils.ts');
const L = requireTs('utils/locationUtils.ts');

const STEP_M = 5;
const OFF_ROUTE_ENTER_METERS = 50;
const OFF_ROUTE_EXIT_METERS = 40;
const CHECKPOINTS = [25, 50, 75];

function lineLength(c) {
  let s = 0;
  for (let i = 1; i < c.length; i++) s += L.haversineDistance(c[i - 1][1], c[i - 1][0], c[i][1], c[i][0]);
  return s;
}

// Points every STEP_M metres along the line, with their along-line distance.
function samplePoints(c, step) {
  const out = [{ lat: c[0][1], lng: c[0][0], along: 0 }];
  let travelled = 0;
  let next = step;
  for (let i = 1; i < c.length; i++) {
    const [lng0, lat0] = c[i - 1];
    const [lng1, lat1] = c[i];
    const d = L.haversineDistance(lat0, lng0, lat1, lng1);
    while (d > 0 && next <= travelled + d) {
      const f = (next - travelled) / d;
      out.push({ lat: lat0 + (lat1 - lat0) * f, lng: lng0 + (lng1 - lng0) * f, along: next });
      next += step;
    }
    travelled += d;
  }
  out.push({ lat: c[c.length - 1][1], lng: c[c.length - 1][0], along: travelled });
  return out;
}

function makeRng(seed) {
  let s = seed;
  const uni = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return () => Math.sqrt(-2 * Math.log(uni())) * Math.cos(2 * Math.PI * uni()); // N(0,1)
}

function simulate(route, { undercount = 1, noiseM = 0, seed = 1 }) {
  const c = route.coordinates;
  const stops = route.pois;
  const D = route.distanceMeters;
  const len = lineLength(c);
  const pts = samplePoints(c, STEP_M);
  const gauss = makeRng(seed);
  const rho = 0.9;
  const sdAxis = noiseM / Math.SQRT2;
  const innov = sdAxis * Math.sqrt(1 - rho * rho);
  let ox = noiseM ? gauss() * sdAxis : 0;
  let oy = noiseM ? gauss() * sdAxis : 0;

  let walked = 0;
  let last = null;
  let offRoute = false;
  let idx = 0;
  const spent = new Set();
  const fired = [];
  const skipped = [];
  for (let k = 0; k < pts.length; k++) {
    let { lat, lng } = pts[k];
    if (noiseM) {
      ox = rho * ox + innov * gauss();
      oy = rho * oy + innov * gauss();
      lat += oy / 111320;
      lng += ox / (111320 * Math.cos((lat * Math.PI) / 180));
    }
    const pos = { lat, lng };
    const wasOff = offRoute;
    const dist = L.distanceToRouteMeters(lat, lng, c);
    offRoute = offRoute ? dist > OFF_ROUTE_EXIT_METERS : dist > OFF_ROUTE_ENTER_METERS;
    if (last) {
      const delta = L.haversineDistance(last.lat, last.lng, lat, lng);
      if (delta >= 2 && delta <= 100 && !offRoute && !wasOff) walked += delta * undercount;
    }
    last = pos;
    const progress = P.journeyProgressPercent(walked, D, null);

    const reachedBefore = idx;
    if (idx < stops.length && P.hasReachedOrPassedStop(pos, stops[idx], c)) idx++;

    const completes = P.shouldAutoComplete(pos, c, progress);

    // Checkpoint effect (same render, status still active).
    for (const cp of CHECKPOINTS) {
      if (progress < cp || spent.has(cp)) continue;
      spent.add(cp);
      if (
        P.shouldTriggerCheckpoint({
          checkpoint: cp,
          progress,
          routeDistanceMeters: D,
          autoCompletePercent: P.AUTO_COMPLETE_PERCENT,
        })
      ) {
        fired.push({ cp, progress, onCompletingFix: completes });
        break;
      }
      skipped.push({ cp, progress });
    }

    if (completes) {
      const visited = P.stopsVisitedAtCompletion(pos, stops, reachedBefore, c);
      return {
        id: route.id,
        completed: true,
        reason: progress >= P.AUTO_COMPLETE_PERCENT ? 'distance98' : 'arrival',
        progressAtCompletion: progress,
        metersBeforeEnd: Math.max(0, len - pts[k].along),
        stops: stops.length,
        visited: visited.length,
        fired,
        skipped,
      };
    }
  }
  return { id: route.id, completed: false, stops: stops.length, visited: 0, finalProgress: P.journeyProgressPercent(walked, D, null), fired, skipped };
}

function summarize(label, results) {
  const done = results.filter(r => r.completed);
  const early = done.map(r => r.metersBeforeEnd);
  const cpFiredCount = { 25: 0, 50: 0, 75: 0 };
  let duplicates = 0;
  let maxOvershoot = 0;
  let firedOnCompletingFix = 0;
  let routesAll3 = 0;
  const skippedByCp = { 25: 0, 50: 0, 75: 0 };
  for (const r of results) {
    const seen = new Set();
    for (const f of r.fired) {
      if (seen.has(f.cp)) duplicates++;
      seen.add(f.cp);
      cpFiredCount[f.cp]++;
      maxOvershoot = Math.max(maxOvershoot, f.progress - f.cp);
      if (f.onCompletingFix) firedOnCompletingFix++;
    }
    for (const s of r.skipped) skippedByCp[s.cp]++;
    if (seen.size === 3) routesAll3++;
  }
  return {
    label,
    routes: results.length,
    completed: done.length,
    byReason: done.reduce((a, r) => ((a[r.reason] = (a[r.reason] || 0) + 1), a), {}),
    allStopsCounted: done.filter(r => r.visited === r.stops).length,
    stopsTotal: results.reduce((a, r) => a + r.stops, 0),
    stopsCounted: done.reduce((a, r) => a + r.visited, 0),
    notAllStops: done.filter(r => r.visited !== r.stops).map(r => ({ id: r.id, visited: r.visited, stops: r.stops })),
    notCompleted: results.filter(r => !r.completed).map(r => ({ id: r.id, finalProgress: r.finalProgress })),
    metersBeforeEnd: early.length ? stats(early) : null,
    progressAtCompletion: done.length ? stats(done.map(r => r.progressAtCompletion)) : null,
    checkpoints: {
      firedPerCheckpoint: cpFiredCount,
      skippedPerCheckpoint: skippedByCp,
      routesWithAllThreeFired: routesAll3,
      duplicateFirings: duplicates,
      maxOvershootPercent: maxOvershoot,
      firedOnCompletingFix,
    },
  };
}

(async () => {
  const list = (await timedGet(`${BASE}/routes`)).json;
  const ids = list.map(r => r.id).sort((a, b) => a - b);
  const routes = [];
  for (const id of ids) {
    const d = (await timedGet(`${BASE}/routes/${id}`)).json;
    routes.push({ id, distanceMeters: d.distanceMeters, coordinates: d.coordinates, pois: d.pois.map(p => ({ id: p.id, lat: p.lat, lng: p.lng })) });
  }
  const scenarios = [
    { label: 'Τέλειο περπάτημα', opts: {} },
    { label: 'Υποκαταμέτρηση GPS 10%', opts: { undercount: 0.9 } },
    { label: 'Υποκαταμέτρηση 10% + θόρυβος 8 m', opts: { undercount: 0.9, noiseM: 8 } },
  ];
  const out = { date: new Date().toISOString(), stepMeters: STEP_M, constants: {
    END_ARRIVAL_METERS: P.END_ARRIVAL_METERS, END_ARRIVAL_MIN_PROGRESS: P.END_ARRIVAL_MIN_PROGRESS,
    AUTO_COMPLETE_PERCENT: P.AUTO_COMPLETE_PERCENT, POI_ARRIVAL_METERS: P.POI_ARRIVAL_METERS,
    POI_PASSED_MARGIN_METERS: P.POI_PASSED_MARGIN_METERS, FINISH_STOP_RADIUS_METERS: P.FINISH_STOP_RADIUS_METERS,
    CHECKPOINT_MAX_OVERSHOOT_PERCENT: P.CHECKPOINT_MAX_OVERSHOOT_PERCENT, CHECKPOINT_MIN_METERS_TO_COMPLETION: P.CHECKPOINT_MIN_METERS_TO_COMPLETION,
  }, scenarios: [] };
  for (const s of scenarios) {
    const results = routes.map((r, i) => simulate(r, { ...s.opts, seed: 1000 + i }));
    const sum = summarize(s.label, results);
    out.scenarios.push(sum);
    console.log(JSON.stringify(sum));
  }
  console.log('saved', save('walk-sim.json', out));
})();
