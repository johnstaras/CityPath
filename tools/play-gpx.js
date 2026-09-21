// Replay a GPX track into the Android emulator from the command line.
//
// The emulator's Extended Controls can play GPX files, but only through its
// GUI. This does the same with `adb emu geo fix`, honouring each point's
// <time> so the app sees a realistic walking pace — which matters: the app
// measures pace on the wall clock, and the checkpoint-suggestion budget is
// derived from it. Use it to script demos and recordings.
//
// Usage (emulator booted, route already started in the app):
//   node tools/play-gpx.js <file.gpx> [speed]
//
//   file.gpx  track with <trkpt lat lon><time>…</time></trkpt> points
//   speed     playback multiplier (default 1). Keep 1 for checkpoint demos;
//             faster playback inflates the measured pace and suggestions
//             come back empty.

const fs = require('fs');
const { execFileSync } = require('child_process');

const file = process.argv[2];
const speed = Number(process.argv[3]) || 1;

if (!file) {
  console.error('Usage: node tools/play-gpx.js <file.gpx> [speed]');
  process.exit(1);
}

const xml = fs.readFileSync(file, 'utf8');
const points = [...xml.matchAll(/<trkpt lat="([\d.-]+)" lon="([\d.-]+)">\s*<time>([^<]+)<\/time>/g)]
  .map(m => ({ lat: m[1], lon: m[2], t: Date.parse(m[3]) }));

if (points.length === 0) {
  console.error(`No timed <trkpt> points found in ${file}`);
  process.exit(1);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const totalSeconds = Math.round((points[points.length - 1].t - points[0].t) / 1000 / speed);
  console.log(`${points.length} points, ~${totalSeconds} s at ${speed}x`);

  const wallStart = Date.now();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    // Schedule against the track's own clock so drift from adb latency does
    // not accumulate over a long walk.
    const due = wallStart + (p.t - points[0].t) / speed;
    const wait = due - Date.now();
    if (wait > 0) await sleep(wait);

    // `geo fix` takes longitude first.
    execFileSync('adb', ['emu', 'geo', 'fix', p.lon, p.lat], { stdio: 'ignore' });
    if (i % 10 === 0 || i === points.length - 1) {
      const pct = Math.round(((i + 1) / points.length) * 100);
      console.log(`${String(pct).padStart(4)}%  ${p.lat}, ${p.lon}`);
    }
  }
  console.log('Playback complete.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
