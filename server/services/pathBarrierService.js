const prisma = require('../config/database');
const { getAccessibilityInfrastructure } = require('../utils/overpassClient');

// Athens bounding box: south, west, north, east — same extent as osmSyncService.
const ATHENS_BBOX = [37.94, 23.68, 38.05, 23.79];

const COBBLESTONE_SURFACES = ['cobblestone', 'sett', 'unhewn_cobblestone'];

/**
 * Import the walking surface from OpenStreetMap into `path_barriers`.
 *
 * This is deliberately NOT part of osmSyncService's POI import. A staircase is
 * not a place you visit, it is a property of the path, and it is a LINE: the
 * question the accessibility scorer needs to answer is "does this route run
 * along it", which a centroid cannot express. osmSyncService collapsed steps
 * and cobblestone ways to a single point, which is why the scorer had to fall
 * back on proximity.
 *
 * Ways keep their full geometry; nodes (kerbs, benches) stay points.
 */
function toWkt(element) {
  if (element.type === 'node') {
    if (element.lat == null || element.lon == null) return null;
    return `POINT(${element.lon} ${element.lat})`;
  }
  if (element.type === 'way' && element.geometry?.length > 1) {
    const points = element.geometry.map(p => `${p.lon} ${p.lat}`).join(',');
    return `LINESTRING(${points})`;
  }
  return null;
}

// Map an Overpass element to a barrier row, or null when it is not something
// that describes the walking surface.
function classify(element) {
  const tags = element.tags || {};

  if (tags.highway === 'steps') {
    return {
      kind: 'steps',
      // A staircase with a ramp alongside is passable with help; without one it
      // is an absolute barrier for anything on wheels.
      hasRamp: tags.ramp === 'yes' || tags['ramp:wheelchair'] === 'yes',
      surface: tags.surface || null,
      tactilePaving: tags.tactile_paving === 'yes',
      stepCount: tags.step_count ? parseInt(tags.step_count, 10) || null : null,
      kerbType: null,
    };
  }

  if (tags.kerb) {
    return {
      kind: 'kerb',
      // flush and lowered kerbs are crossable; raised ones are not.
      hasRamp: tags.kerb === 'flush' || tags.kerb === 'lowered',
      kerbType: tags.kerb,
      surface: null,
      tactilePaving: tags.tactile_paving === 'yes',
      stepCount: null,
    };
  }

  if (COBBLESTONE_SURFACES.includes(tags.surface)) {
    return {
      kind: 'cobblestone',
      hasRamp: false,
      kerbType: null,
      surface: tags.surface,
      tactilePaving: tags.tactile_paving === 'yes',
      stepCount: null,
    };
  }

  if (tags.amenity === 'bench' || tags.leisure === 'picnic_table') {
    return {
      kind: 'bench',
      hasRamp: false,
      kerbType: null,
      surface: null,
      tactilePaving: false,
      stepCount: null,
    };
  }

  return null;
}

async function syncPathBarriers(bbox = ATHENS_BBOX) {
  console.log('Fetching walking-surface data from OpenStreetMap...');
  const elements = await getAccessibilityInfrastructure(bbox);
  console.log(`Found ${elements.length} elements`);

  const counts = {};
  let written = 0;
  let skipped = 0;

  for (const element of elements) {
    const classified = classify(element);
    const wkt = classified ? toWkt(element) : null;
    if (!classified || !wkt) {
      skipped++;
      continue;
    }

    // Upsert on (osm_type, osm_id) so a re-run refreshes rather than duplicates.
    await prisma.$executeRawUnsafe(
      `INSERT INTO path_barriers
         (osm_id, osm_type, kind, has_ramp, kerb_type, surface, tactile_paving, step_count, geometry, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_GeomFromText($9), 4326), CURRENT_TIMESTAMP)
       ON CONFLICT (osm_type, osm_id) DO UPDATE SET
         kind = EXCLUDED.kind,
         has_ramp = EXCLUDED.has_ramp,
         kerb_type = EXCLUDED.kerb_type,
         surface = EXCLUDED.surface,
         tactile_paving = EXCLUDED.tactile_paving,
         step_count = EXCLUDED.step_count,
         geometry = EXCLUDED.geometry,
         updated_at = CURRENT_TIMESTAMP`,
      element.id ?? null,
      element.type,
      classified.kind,
      classified.hasRamp,
      classified.kerbType,
      classified.surface,
      classified.tactilePaving,
      classified.stepCount,
      wkt,
    );

    counts[classified.kind] = (counts[classified.kind] || 0) + 1;
    written++;
  }

  console.log(`Path barriers: ${written} written, ${skipped} skipped`);
  for (const [kind, n] of Object.entries(counts).sort()) {
    console.log(`  ${kind}: ${n}`);
  }
  return counts;
}

module.exports = { syncPathBarriers, ATHENS_BBOX };
