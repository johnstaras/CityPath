// Generates GPX tracks from the CityPaths routes so the Android emulator can
// play them back as simulated GPS movement (Extended Controls > Location >
// Routes > Import GPX/KML > Play route).
//
// The track follows the street-snapped route geometry, moving at walking pace
// with a short standstill at every POI stop so arrival/next-stop logic is
// visible during playback.
//
// Usage (server must be running):
//   node scripts/make-gpx.js [outDir] [speedMultiplier]
//     outDir           default ../../tools/gpx
//     speedMultiplier  compresses timestamps, e.g. 5 = five times faster than
//                      a real walk (default 1; the emulator's own playback
//                      speed slider multiplies on top of this)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const jwt = require('jsonwebtoken');
const fs = require('fs');

const OUT_DIR = process.argv[2] || path.join(__dirname, '..', '..', 'tools', 'gpx');
const SPEED_MULTIPLIER = Number(process.argv[3]) || 1;
const API = 'http://localhost:3000/api';

const WALK_SPEED_MPS = 1.4;     // ~5 km/h real-time pace
const STEP_METERS = 10;         // track point spacing after densification
const POI_PAUSE_SECONDS = 30;   // standstill at each stop
const POI_MATCH_METERS = 30;    // how close a track point must be to a POI

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

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// The emulator replays trkpts as discrete fixes without interpolating, so a
// sparse track teleports. Insert a point every STEP_METERS along each segment.
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

// Mark the track point nearest to each POI (first pass within range) so the
// walker "stops" there. Each POI pauses at most one point.
function findPauseIndices(coords, pois) {
  const pauses = new Set();
  for (const poi of pois) {
    const target = [poi.lng, poi.lat];
    let best = -1;
    let bestDist = POI_MATCH_METERS;
    for (let i = 0; i < coords.length; i++) {
      const d = haversine(coords[i], target);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best >= 0) pauses.add(best);
  }
  return pauses;
}

function toGpx(name, rawCoords, pois) {
  const coords = densify(rawCoords);
  const pauses = findPauseIndices(coords, pois);

  let t = Date.now();
  const lines = [];
  coords.forEach((c, i) => {
    if (i > 0) {
      t += (haversine(coords[i - 1], c) / WALK_SPEED_MPS / SPEED_MULTIPLIER) * 1000;
    }
    lines.push(`      <trkpt lat="${c[1]}" lon="${c[0]}"><time>${new Date(t).toISOString()}</time></trkpt>`);
    if (pauses.has(i)) {
      // Same position again after the pause -> the dot stands still at the POI.
      t += (POI_PAUSE_SECONDS / SPEED_MULTIPLIER) * 1000;
      lines.push(`      <trkpt lat="${c[1]}" lon="${c[0]}"><time>${new Date(t).toISOString()}</time></trkpt>`);
    }
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CityPaths" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${name}</name>
    <trkseg>
${lines.join('\n')}
    </trkseg>
  </trk>
</gpx>
`;
}

async function main() {
  // Routes endpoints only verify the token, so any userId works here.
  const token = jwt.sign({ userId: 'gpx-generator' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}` };

  const listRes = await fetch(`${API}/routes`, { headers });
  if (!listRes.ok) throw new Error(`GET /routes -> ${listRes.status}`);
  const routes = await listRes.json();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const r of routes) {
    const detRes = await fetch(`${API}/routes/${r.id}`, { headers });
    if (!detRes.ok) { console.error(`route ${r.id}: ${detRes.status}`); continue; }
    const det = await detRes.json();
    const coords = det.coordinates;
    if (!coords || coords.length < 2) { console.error(`route ${r.id}: no coordinates`); continue; }
    const file = path.join(OUT_DIR, `route-${r.id}-${slugify(det.title)}.gpx`);
    fs.writeFileSync(file, toGpx(det.title, coords, det.pois ?? []));
    const pauseCount = findPauseIndices(densify(coords), det.pois ?? []).size;
    console.log(
      `${file} (${densify(coords).length} points, ${pauseCount} POI pauses, ${SPEED_MULTIPLIER}x)`,
    );
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
