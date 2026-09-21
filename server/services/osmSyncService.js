const prisma = require('../config/database');
const { getAccessiblePOIs, getAccessibilityInfrastructure } = require('../utils/overpassClient');

// Athens bounding box: south, west, north, east
const ATHENS_BBOX = [37.94, 23.68, 38.05, 23.79];

function derivePhotoUrl(tags) {
  if (tags.image) return tags.image;
  if (tags.wikimedia_commons) {
    const filename = tags.wikimedia_commons.replace(/^File:/, '');
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=800`;
  }
  return null;
}

// Compute centroid of a way's geometry nodes
function wayCentroid(geometry) {
  if (!geometry || geometry.length === 0) return null;
  let sumLat = 0, sumLon = 0;
  for (const pt of geometry) {
    sumLat += pt.lat;
    sumLon += pt.lon;
  }
  return { lat: sumLat / geometry.length, lon: sumLon / geometry.length };
}

async function upsertPoi(osmId, lat, lon, data) {
  const existing = await prisma.poi.findFirst({ where: { osmId: BigInt(osmId) } });

  if (existing) {
    await prisma.poi.update({ where: { id: existing.id }, data });
    await prisma.$executeRaw`
      UPDATE pois SET geometry = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
      WHERE id = ${existing.id}
    `;
    return 'updated';
  } else {
    const poi = await prisma.poi.create({ data: { ...data, osmId: BigInt(osmId) } });
    await prisma.$executeRaw`
      UPDATE pois SET geometry = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
      WHERE id = ${poi.id}
    `;
    return 'created';
  }
}

async function syncPOIs() {
  console.log('Fetching POIs from OpenStreetMap...');
  const elements = await getAccessiblePOIs(ATHENS_BBOX);
  console.log(`Found ${elements.length} POI elements`);

  let created = 0;
  let updated = 0;

  for (const el of elements) {
    if (el.type !== 'node' || !el.tags?.name) continue;

    const data = {
      name: el.tags.name,
      description: el.tags.description || null,
      category: el.tags.tourism || el.tags.amenity || 'other',
      wheelchair: el.tags.wheelchair || 'unknown',
      surface: el.tags.surface || null,
      hasRamp: el.tags.ramp === 'yes',
      hasTactilePaving: el.tags.tactile_paving === 'yes',
      hasRestArea: el.tags.bench === 'yes' || el.tags.amenity === 'bench',
      openingHours: el.tags.opening_hours || null,
      photoUrl: derivePhotoUrl(el.tags),
      dataSource: 'osm',
    };

    const result = await upsertPoi(el.id, el.lat, el.lon, data);
    if (result === 'created') created++;
    else updated++;
  }

  console.log(`POI sync: ${created} created, ${updated} updated`);

  // Sync accessibility infrastructure (stairs, benches, cobblestone)
  await syncAccessibilityInfrastructure();
}

async function syncAccessibilityInfrastructure() {
  console.log('Fetching accessibility infrastructure from OpenStreetMap...');
  const elements = await getAccessibilityInfrastructure(ATHENS_BBOX);
  console.log(`Found ${elements.length} infrastructure elements`);

  let created = 0;
  let updated = 0;

  for (const el of elements) {
    const tags = el.tags || {};
    let lat, lon, data;

    if (el.type === 'node') {
      lat = el.lat;
      lon = el.lon;

      // Benches and picnic tables → rest areas
      if (tags.amenity === 'bench' || tags.leisure === 'picnic_table') {
        data = {
          name: tags.name || 'Rest Area',
          description: null,
          category: 'rest_area',
          wheelchair: tags.wheelchair || 'unknown',
          surface: tags.surface || null,
          hasRamp: false,
          hasTactilePaving: false,
          hasRestArea: true,
          openingHours: null,
          photoUrl: null,
          dataSource: 'osm',
        };
      }
      // Kerb nodes
      else if (tags.kerb) {
        data = {
          name: 'Kerb',
          description: `Kerb type: ${tags.kerb}`,
          category: 'kerb',
          wheelchair: tags.kerb === 'flush' ? 'yes' : tags.kerb === 'lowered' ? 'limited' : 'no',
          surface: null,
          hasRamp: tags.kerb === 'flush' || tags.kerb === 'lowered',
          hasTactilePaving: tags.tactile_paving === 'yes',
          hasRestArea: false,
          openingHours: null,
          photoUrl: null,
          dataSource: 'osm',
        };
      } else {
        continue;
      }
    } else if (el.type === 'way' && el.geometry) {
      const center = wayCentroid(el.geometry);
      if (!center) continue;
      lat = center.lat;
      lon = center.lon;

      // Stairs
      if (tags.highway === 'steps') {
        data = {
          name: tags.name || 'Stairs',
          description: tags.step_count ? `${tags.step_count} steps` : null,
          category: 'stairs',
          wheelchair: 'no',
          surface: tags.surface || null,
          hasRamp: tags.ramp === 'yes',
          hasTactilePaving: tags.tactile_paving === 'yes',
          hasRestArea: false,
          openingHours: null,
          photoUrl: null,
          dataSource: 'osm',
        };
      }
      // Cobblestone/sett surface ways
      else if (['cobblestone', 'sett', 'unhewn_cobblestone'].includes(tags.surface)) {
        data = {
          name: tags.name || 'Cobblestone Path',
          description: `Surface: ${tags.surface}`,
          category: tags.highway || 'path',
          wheelchair: tags.wheelchair || 'limited',
          surface: tags.surface,
          hasRamp: false,
          hasTactilePaving: false,
          hasRestArea: false,
          openingHours: null,
          photoUrl: null,
          dataSource: 'osm',
        };
      } else {
        continue;
      }
    } else {
      continue;
    }

    const result = await upsertPoi(el.id, lat, lon, data);
    if (result === 'created') created++;
    else updated++;
  }

  console.log(`Infrastructure sync: ${created} created, ${updated} updated`);
}

module.exports = { syncPOIs };
