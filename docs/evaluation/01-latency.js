// 1a. API latency of the local endpoints (no OSRM involved).
// Usage: TOKEN=<jwt> OUT=<dir> node 01-latency.js
// Each endpoint: 5 warm-up requests (discarded), then N=30 sequential timed
// requests. Timing = client-side wall time from fetch() to full body read.
const { BASE, stats, timedGet, save } = require('./common');

const N = Number(process.env.N || 30);
const WARMUP = 5;
const LAT = 37.9755;
const LNG = 23.7348;
const auth = process.env.TOKEN ? { Authorization: `Bearer ${process.env.TOKEN}` } : null;

const endpoints = [
  { name: 'GET /api/health', url: `${BASE}/health` },
  { name: 'GET /api/routes (προφίλ 1)', url: `${BASE}/routes?lat=${LAT}&lng=${LNG}&mobilityProfileId=1` },
  { name: 'GET /api/routes (προφίλ 4)', url: `${BASE}/routes?lat=${LAT}&lng=${LNG}&mobilityProfileId=4` },
  { name: 'GET /api/routes/1?mobilityProfileId=4', url: `${BASE}/routes/1?mobilityProfileId=4` },
  { name: 'GET /api/pois?lat&lng', url: `${BASE}/pois?lat=${LAT}&lng=${LNG}` },
  { name: 'GET /api/favorites (auth)', url: `${BASE}/favorites`, auth: true },
  { name: 'GET /api/profile/stats (auth)', url: `${BASE}/profile/stats`, auth: true },
];

(async () => {
  const results = [];
  for (const ep of endpoints) {
    if (ep.auth && !auth) {
      console.warn(`skip ${ep.name}: no TOKEN`);
      continue;
    }
    const headers = ep.auth ? auth : {};
    for (let i = 0; i < WARMUP; i++) await timedGet(ep.url, headers);
    const samples = [];
    let status = null;
    let bytes = null;
    let items = null;
    for (let i = 0; i < N; i++) {
      const r = await timedGet(ep.url, headers);
      samples.push(r.ms);
      status = r.status;
      bytes = r.bytes;
      items = Array.isArray(r.json) ? r.json.length : null;
    }
    const s = stats(samples);
    results.push({ ...ep, status, bytes, items, ...s, samples });
    console.log(
      `${ep.name.padEnd(42)} status=${status} bytes=${bytes} items=${items ?? '-'} ` +
        `median=${s.median.toFixed(1)} p90=${s.p90.toFixed(1)} min=${s.min.toFixed(1)} max=${s.max.toFixed(1)} ms`,
    );
  }
  console.log('saved', save('latency.json', { date: new Date().toISOString(), n: N, warmup: WARMUP, results }));
})();
