// Shared helpers for the Chapter 6 evaluation scripts.
// Node >= 18 (global fetch). Read-only: every request is a GET.
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.API_BASE || 'http://localhost:3000/api';
const OUT = process.env.OUT || path.join(os.tmpdir(), 'citypaths-eval');
fs.mkdirSync(OUT, { recursive: true });

const REPO = path.resolve(__dirname, '..', '..');

// Linear-interpolation percentile (same as numpy's default).
function percentile(values, p) {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return null;
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

function stats(values) {
  const s = [...values].sort((a, b) => a - b);
  return {
    n: s.length,
    min: s[0],
    median: percentile(s, 0.5),
    p90: percentile(s, 0.9),
    max: s[s.length - 1],
    mean: s.reduce((a, b) => a + b, 0) / (s.length || 1),
  };
}

async function timedGet(url, headers = {}) {
  const t0 = process.hrtime.bigint();
  const res = await fetch(url, { headers });
  const body = await res.text();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    // not JSON
  }
  return { ms, status: res.status, bytes: Buffer.byteLength(body), json };
}

function save(name, data) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Transpile a mobile/src TypeScript module on the fly (CommonJS) so the
// measurement runs against the CURRENT source, not a stale copy.
function requireTs(relFromMobileSrc, stubs = {}) {
  const ts = require(path.join(REPO, 'mobile', 'node_modules', 'typescript'));
  const Module = require('module');
  const cache = new Map();
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports;
    const src = fs.readFileSync(file, 'utf8');
    const { outputText } = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    });
    const m = new Module(file);
    cache.set(file, m);
    m.filename = file;
    m.require = spec => {
      if (stubs[spec]) return stubs[spec];
      if (spec.startsWith('.')) {
        const base = path.resolve(path.dirname(file), spec);
        for (const ext of ['.ts', '.tsx', '/index.ts']) {
          if (fs.existsSync(base + ext)) return load(base + ext);
        }
      }
      return require(spec);
    };
    m._compile(outputText, file);
    return m.exports;
  };
  return load(path.join(REPO, 'mobile', 'src', relFromMobileSrc));
}

module.exports = { BASE, OUT, REPO, percentile, stats, timedGet, save, sleep, requireTs };
