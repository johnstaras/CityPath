// 2. Accessibility scorer consistency, all routes x all mobility profiles.
// Usage: OUT=<dir> node 03-scorer-consistency.js
// Per profile: GET /api/routes?mobilityProfileId=p (list, what Home shows) and
// GET /api/routes/:id?mobilityProfileId=p for every route (details: score +
// path chips). No OSRM calls — scoring is PostGIS over path_barriers.
const { BASE, timedGet, save } = require('./common');

const LAT = 37.9755;
const LNG = 23.7348;

function bucket(score) {
  if (score == null) return 'null';
  if (score === 0) return '0';
  if (score < 0.4) return '0<s<0.4';
  if (score < 0.7) return '0.4<=s<0.7';
  return '>=0.7';
}

(async () => {
  const profiles = (await timedGet(`${BASE}/mobility-profiles`)).json;
  const all = (await timedGet(`${BASE}/routes`)).json; // no profile: every route
  const allIds = all.map(r => r.id).sort((a, b) => a - b);
  const out = { date: new Date().toISOString(), totalRoutes: allIds.length, profiles: [] };

  for (const profile of profiles) {
    const list = (await timedGet(`${BASE}/routes?lat=${LAT}&lng=${LNG}&mobilityProfileId=${profile.id}`)).json;
    const listScore = new Map(list.map(r => [r.id, r.accessibilityScore]));
    const buckets = { '0': 0, '0<s<0.4': 0, '0.4<=s<0.7': 0, '>=0.7': 0, null: 0 };
    const detailBuckets = { '0': 0, '0<s<0.4': 0, '0.4<=s<0.7': 0, '>=0.7': 0, null: 0 };
    let stepFree = 0;
    let unmeasured = 0;
    const contradictions = [];
    const listVsDetail = [];
    const detailMs = [];
    for (const r of list) buckets[bucket(r.accessibilityScore)]++;
    for (const id of allIds) {
      const d = await timedGet(`${BASE}/routes/${id}?mobilityProfileId=${profile.id}`);
      detailMs.push(d.ms);
      const det = d.json;
      const pa = det.pathAccessibility || {};
      detailBuckets[bucket(det.accessibilityScore)]++;
      if (!pa.measured) unmeasured++;
      else if (pa.stepsMeters === 0) stepFree++;
      if (profile.avoidStairs && pa.stepsMeters > 0 && det.accessibilityScore > 0) {
        contradictions.push({ id, score: det.accessibilityScore, stepsMeters: pa.stepsMeters });
      }
      if (listScore.has(id) && listScore.get(id) !== det.accessibilityScore) {
        listVsDetail.push({ id, list: listScore.get(id), detail: det.accessibilityScore });
      }
    }
    const p = {
      id: profile.id,
      name: profile.name,
      avoidStairs: profile.avoidStairs,
      maxRouteDistanceKm: profile.maxRouteDistanceKm,
      listed: list.length,
      listBuckets: buckets,
      detailBuckets,
      stepFreeRoutes: stepFree,
      unmeasuredRoutes: unmeasured,
      contradictions,
      listVsDetailMismatches: listVsDetail,
      detailRequestMsMedian: [...detailMs].sort((a, b) => a - b)[detailMs.length >> 1],
    };
    out.profiles.push(p);
    console.log(JSON.stringify({ ...p, contradictions: p.contradictions.length, listVsDetailMismatches: p.listVsDetailMismatches.length }));
  }
  console.log('saved', save('scorer-consistency.json', out));
})();
