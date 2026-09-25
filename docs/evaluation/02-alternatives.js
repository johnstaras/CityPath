// 1b. Checkpoint detour suggestions — GET /api/routes/:id/alternatives.
// This endpoint calls the PUBLIC OSRM instance, so the request count is kept
// small: routes 1 and 2 x profiles 1 and 4 x N=5 = 20 calls, spaced >= 3 s.
// Usage: TOKEN=<jwt> OUT=<dir> node 02-alternatives.js
//
// The request is built as the app builds it at the 25% checkpoint
// (useActiveRouteViewModel.fetchAlternatives):
//   position        = point 25% along the route line
//   remaining_time  = estimateRemainingSeconds(...) of the CURRENT
//                     progressUtils.ts, walked at the default pace 1.2 m/s
//   visited_pois    = stops hasReachedOrPassedStop() credits up to that point
const { BASE, stats, timedGet, save, sleep, requireTs } = require('./common');

const P = requireTs('utils/progressUtils.ts');
const L = requireTs('utils/locationUtils.ts');

const ROUTES = [1, 2];
const PROFILES = [1, 4];
const N = Number(process.env.N || 5);
const SPACING_MS = 3000;
const FRACTION = 0.25;
const auth = process.env.TOKEN ? { Authorization: `Bearer ${process.env.TOKEN}` } : {};

function pointAlong(coords, fraction) {
  let total = 0;
  const seg = [];
  for (let i = 1; i < coords.length; i++) {
    const d = L.haversineDistance(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    seg.push(d);
    total += d;
  }
  const target = total * fraction;
  let acc = 0;
  for (let i = 0; i < seg.length; i++) {
    if (acc + seg[i] >= target) {
      const f = (target - acc) / seg[i];
      const [lng0, lat0] = coords[i];
      const [lng1, lat1] = coords[i + 1];
      return { lat: lat0 + (lat1 - lat0) * f, lng: lng0 + (lng1 - lng0) * f, total };
    }
    acc += seg[i];
  }
  const [lng, lat] = coords[coords.length - 1];
  return { lat, lng, total };
}

(async () => {
  const runs = [];
  let calls = 0;
  for (const routeId of ROUTES) {
    const det = (await timedGet(`${BASE}/routes/${routeId}`)).json;
    const coords = det.coordinates;
    const pos = pointAlong(coords, FRACTION);
    const walked = det.distanceMeters * FRACTION;
    const remainingSeconds = P.estimateRemainingSeconds({
      remainingMeters: det.distanceMeters - walked,
      walkedMeters: walked,
      trackedSeconds: walked / P.DEFAULT_WALKING_SPEED_MPS,
    });
    let idx = 0;
    while (idx < det.pois.length && P.hasReachedOrPassedStop(pos, det.pois[idx], coords)) idx++;
    const visited = det.pois.slice(0, idx).map(p => p.id);
    for (const profileId of PROFILES) {
      const url =
        `${BASE}/routes/${routeId}/alternatives?lat=${pos.lat}&lng=${pos.lng}` +
        `&remaining_time=${Math.max(0, Math.round(remainingSeconds))}` +
        `&mobility_profile_id=${profileId}&visited_pois=${visited.join(',')}`;
      const samples = [];
      const counts = [];
      const titles = new Set();
      const statuses = [];
      for (let i = 0; i < N; i++) {
        if (calls > 0) await sleep(SPACING_MS);
        calls++;
        const r = await timedGet(url, auth);
        samples.push(r.ms);
        statuses.push(r.status);
        const arr = Array.isArray(r.json) ? r.json : [];
        counts.push(arr.length);
        arr.forEach(a => titles.add(a.title));
        console.log(`route ${routeId} profile ${profileId} #${i + 1}: ${r.status} ${arr.length} suggestions ${r.ms.toFixed(0)} ms`);
      }
      runs.push({
        routeId,
        profileId,
        routeDistanceMeters: det.distanceMeters,
        position: { lat: pos.lat, lng: pos.lng },
        remainingTimeSeconds: Math.round(remainingSeconds),
        visitedPois: visited,
        statuses,
        suggestionCounts: counts,
        suggestionTitles: [...titles],
        ...stats(samples),
        samples,
      });
    }
  }
  console.log('total alternatives calls:', calls);
  console.log('saved', save('alternatives.json', { date: new Date().toISOString(), calls, runs }));
})();
