// Generates a UC-06 checkpoint-suggestion demo track for the Android
// emulator (Extended Controls > Location > Routes > Import GPX > Play route):
//
//   1. Walks the route at a natural 1.4 m/s with a 30 s stop at each POI
//      passed before the checkpoint.
//   2. Stands still for 75 s right at the 25% crossing — the suggestion
//      modal appears there; tap the FIRST suggestion during the standstill.
//   3. Continues along that first suggestion's actual engine geometry
//      (checkpoint -> suggested POI -> original route end), pausing at the
//      POI so arrival detection shows.
//
// The suggestion is fetched live from the engine at generation time (the
// simulated pace/remaining-time match what the app will report), so
// regenerate whenever the seed data or the engine changes:
//   node scripts/make-demo-gpx.js [routeId]   (API must be running; default 1)
//
// IMPORTANT: play this track at 1x speed only. The app's timer runs on wall
// clock, so any emulator speed multiplier inflates the measured pace,
// collapses the remaining-time budget, and the suggestions come back empty.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Node >=17 resolves localhost to ::1 while the API container listens on IPv4.
const API = 'http://127.0.0.1:3000/api';

const ROUTE_ID = Number(process.argv[2]) || 1;
const OUT_FILE = path.join(
  __dirname, '..', '..', 'tools', 'gpx',
  `demo-route-${ROUTE_ID}-checkpoint-suggestion.gpx`,
);
const WALK_SPEED_MPS = 1.4;      // cruise pace between pauses
const STEP_METERS = 10;          // trackpoint spacing (emulator does not interpolate)
const POI_PAUSE_SECONDS = 30;    // ordinary sightseeing stop
const DECISION_SECONDS = 75;     // standstill at 25% while the modal is up
const POI_MATCH_METERS = 30;     // same arrival radius as the app
const CHECKPOINT = 0.25;         // first checkpoint fraction (see viewmodel)

function haversine(a, b) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function densify(coords) {
  const out = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const [a, b] = [coords[i - 1], coords[i]];
    const dist = haversine(a, b);
    const steps = Math.max(1, Math.round(dist / STEP_METERS));
    for (let s = 1; s <= steps; s++) {
      out.push([a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps]);
    }
  }
  return out;
}

function nearestIndex(coords, target) {
  let best = -1;
  let bestDist = POI_MATCH_METERS;
  for (let i = 0; i < coords.length; i++) {
    const d = haversine(coords[i], target);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

async function main() {
  const token = jwt.sign({ userId: 'gpx-generator' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}` };

  const res = await fetch(`${API}/routes/${ROUTE_ID}`, { headers });
  if (!res.ok) throw new Error(`GET /routes/${ROUTE_ID} -> ${res.status}`);
  const route = await res.json();
  const coords = densify(route.coordinates);
  const total = route.distanceMeters;
  const pois = route.pois ?? [];

  // Walk the track the way the app will measure it: accumulate distance and
  // elapsed time (including pauses) up to the 25% crossing.
  let walked = 0;
  let elapsed = 0;
  const visited = [];
  const pauseIdxs = new Set();
  let checkpointIdx = -1;
  for (let i = 1; i < coords.length; i++) {
    walked += haversine(coords[i - 1], coords[i]);
    elapsed += haversine(coords[i - 1], coords[i]) / WALK_SPEED_MPS;
    for (const p of pois) {
      if (!visited.includes(p.id) && haversine(coords[i], [p.lng, p.lat]) < POI_MATCH_METERS) {
        visited.push(p.id);
        pauseIdxs.add(i);
        elapsed += POI_PAUSE_SECONDS;
      }
    }
    if (walked / total >= CHECKPOINT) { checkpointIdx = i; break; }
  }
  if (checkpointIdx < 0) throw new Error('never crossed the checkpoint');

  const speed = walked / elapsed;
  const remainingSec = Math.round((total - walked) / speed);
  const [cpLng, cpLat] = coords[checkpointIdx];
  console.log(
    `checkpoint at ${Math.round(walked)} m / ${Math.round(elapsed)} s ` +
    `(avg ${speed.toFixed(2)} m/s) -> remaining_time ${remainingSec} s, visited [${visited}]`,
  );

  // Ask the live engine what the modal will offer there; the track follows
  // suggestion #1 (the demo taps the first card).
  const qs = new URLSearchParams({
    lat: String(cpLat),
    lng: String(cpLng),
    remaining_time: String(remainingSec),
    mobility_profile_id: '1',
    visited_pois: visited.join(','),
  });
  const altRes = await fetch(`${API}/routes/${ROUTE_ID}/alternatives?${qs}`, { headers });
  if (!altRes.ok) throw new Error(`GET alternatives -> ${altRes.status}`);
  const alts = await altRes.json();
  if (alts.length === 0) {
    // Usually a transient public-OSRM failure (the engine degrades to an
    // empty list); a retry a few seconds later typically succeeds.
    throw new Error('engine returned no suggestions - retry in a few seconds');
  }
  const pick = alts[0];
  console.log(
    `suggestions: ${alts.map(a => a.title).join(' | ')}\n` +
    `-> following #1: ${pick.title} (${pick.distanceMeters} m, rejoins=${pick.rejoinsRoute})`,
  );

  const detourCoords = densify(pick.geometry.coordinates);
  const detourPoiIdx = nearestIndex(detourCoords, [pick.lng, pick.lat]);

  // Assemble the timed track.
  let t = Date.now();
  const lines = [];
  const emit = c => lines.push(
    `      <trkpt lat="${c[1]}" lon="${c[0]}"><time>${new Date(t).toISOString()}</time></trkpt>`,
  );
  const pauseHere = (c, seconds) => { t += seconds * 1000; emit(c); };

  for (let i = 0; i <= checkpointIdx; i++) {
    if (i > 0) t += (haversine(coords[i - 1], coords[i]) / WALK_SPEED_MPS) * 1000;
    emit(coords[i]);
    if (pauseIdxs.has(i)) pauseHere(coords[i], POI_PAUSE_SECONDS);
  }
  // Standstill while the modal is up; tap suggestion #1 now.
  pauseHere(coords[checkpointIdx], DECISION_SECONDS);

  for (let i = 1; i < detourCoords.length; i++) {
    t += (haversine(detourCoords[i - 1], detourCoords[i]) / WALK_SPEED_MPS) * 1000;
    emit(detourCoords[i]);
    if (i === detourPoiIdx) pauseHere(detourCoords[i], POI_PAUSE_SECONDS);
  }
  // Brief final standstill so auto-complete lands before playback ends.
  pauseHere(detourCoords[detourCoords.length - 1], 20);

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CityPaths" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${route.title} - checkpoint suggestion demo (play at 1x)</name>
    <trkseg>
${lines.join('\n')}
    </trkseg>
  </trk>
</gpx>
`;
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, gpx);
  const durMin = Math.round((t - Number(new Date(lines[0].match(/<time>(.+?)<\/time>/)[1]).getTime())) / 60000);
  console.log(`${OUT_FILE} (${lines.length} points, ~${durMin} min of playback)`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
