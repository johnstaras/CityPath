const axios = require('axios');

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// overpass-api.de rejects axios's default User-Agent ("axios/1.x") with
// HTTP 406 Not Acceptable — every query fails, whatever it asks for. Sending a
// real identifying User-Agent is all it takes. scripts/snap-routes.js already
// does this for its OSRM calls; this client was missing it, which is why
// syncAccessibilityInfrastructure() never imported a single stairs, kerb or
// bench row (verified 2026-09-10: same query, default UA -> 406, named UA -> OK).
const REQUEST_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'CityPaths/1.0 (diploma project; accessibility routing)',
};

// Statuses the public Overpass instance returns when it is busy rather than
// when the query is wrong: rate limit, gateway timeout, overloaded slot.
// 406 is NOT here — that means the request itself was rejected (see the
// User-Agent note above) and retrying it would fail identically.
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function queryOverpass(query) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.post(OVERPASS_API, `data=${encodeURIComponent(query)}`, {
        headers: REQUEST_HEADERS,
        timeout: 180000,
      });
      return response.data.elements;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      if (!TRANSIENT_STATUSES.has(status) || attempt === MAX_ATTEMPTS) {
        throw error;
      }
      // Linear backoff: the public instance queues by slot, so waiting longer
      // each time is more useful than hammering it.
      const waitMs = 15000 * attempt;
      console.warn(
        `Overpass returned ${status} (attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${waitMs / 1000}s...`,
      );
      await sleep(waitMs);
    }
  }

  throw lastError;
}

// Query wheelchair-tagged POIs in a bounding box
async function getAccessiblePOIs(bbox) {
  const [south, west, north, east] = bbox;
  const query = `
    [out:json][timeout:90];
    (
      node["wheelchair"](${south},${west},${north},${east});
      node["tourism"](${south},${west},${north},${east});
      node["amenity"~"restaurant|cafe|toilets|pharmacy|hospital"](${south},${west},${north},${east});
    );
    out body;
  `;
  return queryOverpass(query);
}

// Query accessibility-relevant infrastructure: stairs, benches, cobblestone surfaces
async function getAccessibilityInfrastructure(bbox) {
  const [south, west, north, east] = bbox;
  const query = `
    [out:json][timeout:90];
    (
      way["highway"="steps"](${south},${west},${north},${east});
      node["amenity"="bench"](${south},${west},${north},${east});
      node["leisure"="picnic_table"](${south},${west},${north},${east});
      way["surface"~"cobblestone|sett|unhewn_cobblestone"](${south},${west},${north},${east});
      node["kerb"](${south},${west},${north},${east});
    );
    out body geom;
  `;
  return queryOverpass(query);
}

// Query sidewalk and path data
async function getPathData(bbox) {
  const [south, west, north, east] = bbox;
  const query = `
    [out:json][timeout:90];
    (
      way["highway"="footway"](${south},${west},${north},${east});
      way["highway"="pedestrian"](${south},${west},${north},${east});
      way["sidewalk"](${south},${west},${north},${east});
    );
    out body geom;
  `;
  return queryOverpass(query);
}

module.exports = { queryOverpass, getAccessiblePOIs, getAccessibilityInfrastructure, getPathData };
