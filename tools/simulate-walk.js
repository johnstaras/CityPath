// Walk a route in the Android emulator by feeding it GPS fixes.
//
// The GPX files in tools/gpx are the richer option, but importing one needs the
// emulator's Extended Controls GUI. This drives the same thing from the command
// line — `adb emu geo fix` along the route's real geometry — so a full walk can
// be replayed unattended, in CI, or while screenshotting.
//
// Usage (server must be running, emulator booted, route already started in the app):
//   node tools/simulate-walk.js <routeId> [stepSeconds] [shotDir]
//
//   routeId      route to walk
//   stepSeconds  delay between fixes (default 1.2). Lower = faster walk.
//   shotDir      if given, a screenshot is pulled at each 10% of progress

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ADB = process.env.ADB_PATH
  || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');

const API = process.env.API_URL || 'http://localhost:3000/api';

const routeId = process.argv[2];
const stepSeconds = Number(process.argv[3]) || 1.2;
const shotDir = process.argv[4] || null;

if (!routeId) {
  console.error('usage: node tools/simulate-walk.js <routeId> [stepSeconds] [shotDir]');
  process.exit(1);
}

const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Metres between two lon/lat points (equirectangular is plenty at street scale).
function distance([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const x = ((lng2 - lng1) * Math.PI / 180) * Math.cos((lat1 + lat2) * Math.PI / 360);
  const y = (lat2 - lat1) * Math.PI / 180;
  return Math.sqrt(x * x + y * y) * R;
}

// Resample the polyline to evenly spaced points so the walk moves at a constant
// pace rather than lurching between far-apart OSRM vertices.
function resample(coords, spacingMeters) {
  const out = [coords[0]];
  let carry = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const segment = distance(a, b);
    if (segment === 0) continue;
    let travelled = spacingMeters - carry;
    while (travelled <= segment) {
      const t = travelled / segment;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      travelled += spacingMeters;
    }
    carry = segment - (travelled - spacingMeters);
  }
  out.push(coords[coords.length - 1]);
  return out;
}

async function main() {
  const response = await fetch(`${API}/routes/${routeId}`);
  if (!response.ok) throw new Error(`GET /routes/${routeId} -> ${response.status}`);
  const route = await response.json();

  const coords = route.coordinates;
  if (!coords || coords.length < 2) throw new Error('route has no geometry');

  // ~12 m per fix: close to a walking second, and enough points that the app's
  // progress and off-route logic see continuous movement.
  const points = resample(coords, 12);

  console.log(`Route ${route.id}: ${route.title}`);
  console.log(`${route.distanceMeters} m, ${route.pois?.length ?? 0} stops`);
  console.log(`${points.length} GPS fixes at ${stepSeconds}s each (~${Math.round(points.length * stepSeconds)}s)\n`);

  if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

  let nextShot = 0;
  for (let i = 0; i < points.length; i++) {
    const [lng, lat] = points[i];
    adb('emu', 'geo', 'fix', String(lng), String(lat));

    const percent = Math.round((i / (points.length - 1)) * 100);
    if (percent >= nextShot) {
      process.stdout.write(`  ${String(percent).padStart(3)}%  ${lat.toFixed(5)}, ${lng.toFixed(5)}\n`);
      if (shotDir) {
        const name = `walk-${String(nextShot).padStart(3, '0')}.png`;
        adb('shell', 'screencap', '-p', '/data/local/tmp/w.png');
        adb('pull', '/data/local/tmp/w.png', path.join(shotDir, name));
      }
      nextShot += 10;
    }
    await sleep(stepSeconds * 1000);
  }

  console.log('\nWalk complete.');
}

main().catch(err => {
  console.error('Simulation failed:', err.message);
  process.exit(1);
});
