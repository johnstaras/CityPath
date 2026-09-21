require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { snapAllRoutes } = require('../scripts/snap-routes');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const profiles = [
    { id: 1, name: 'Πεζός', icon: 'walk', maxIncline: null, avoidStairs: false, avoidCobblestone: false, minSidewalkWidth: null, requiresRamps: false, requiresTactilePaving: false, maxRouteDistanceKm: null, restStopIntervalM: null, speedFactor: 1.0 },
    { id: 2, name: 'Ηλικιωμένος', icon: 'elderly', maxIncline: 6, avoidStairs: true, avoidCobblestone: true, minSidewalkWidth: 1.2, requiresRamps: true, requiresTactilePaving: false, maxRouteDistanceKm: 3, restStopIntervalM: 300, speedFactor: 0.6 },
    { id: 3, name: 'Γονέας με καρότσι', icon: 'stroller', maxIncline: 8, avoidStairs: true, avoidCobblestone: true, minSidewalkWidth: 1.5, requiresRamps: true, requiresTactilePaving: false, maxRouteDistanceKm: null, restStopIntervalM: null, speedFactor: 0.8 },
    { id: 4, name: 'Χρήστης αναπηρικού αμαξιδίου', icon: 'wheelchair', maxIncline: 8, avoidStairs: true, avoidCobblestone: true, minSidewalkWidth: 1.5, requiresRamps: true, requiresTactilePaving: false, maxRouteDistanceKm: null, restStopIntervalM: null, speedFactor: 0.7 },
    { id: 5, name: 'Έγκυος', icon: 'pregnant', maxIncline: 6, avoidStairs: true, avoidCobblestone: true, minSidewalkWidth: 1.2, requiresRamps: true, requiresTactilePaving: false, maxRouteDistanceKm: 2.5, restStopIntervalM: 250, speedFactor: 0.65 },
  ];

  const validIds = profiles.map(p => p.id);

  // Remove any user selections referencing profiles that will be deleted
  await prisma.$executeRawUnsafe(
    `DELETE FROM user_mobility_profiles WHERE mobility_profile_id NOT IN (${validIds.join(',')})`,
  );

  // Delete old profiles not in the current list
  await prisma.$executeRawUnsafe(
    `DELETE FROM mobility_profiles WHERE id NOT IN (${validIds.join(',')})`,
  );

  // Upsert current profiles
  for (const { id, ...data } of profiles) {
    await prisma.mobilityProfile.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
  }

  console.log(`Seeded ${profiles.length} mobility profiles`);

  await seedDemoContent();

  // Replace the coarse hand-drawn route lines with street-following geometry
  // (and honest distance/duration) via the public OSRM foot profile. Needs
  // network — an offline seed should still succeed with the coarse lines.
  try {
    await snapAllRoutes(prisma);
  } catch (err) {
    console.warn(`Route snapping skipped: ${err.message}`);
  }
}

// Curated demo POIs and routes for Athens (ids 10001+ to avoid clashing with
// OSM-synced POIs). Geometry is set via raw SQL since it's a PostGIS column.
// Photo URLs: Unsplash CDN images, except National Garden, Thissio Promenade and Kerameikos, whose
// Unsplash images showed other places and now use Wikimedia Commons photographs
// of those sites. upload.wikimedia.org answers 403 to a request without a
// descriptive User-Agent (e.g. the default okhttp one) and 400 to non-standard
// thumbnail widths — see the header of data/athens-landmarks.js. Image subjects,
// authors and licences: data/athens-landmarks.js and docs/analysis/photo-credits.md.
async function seedDemoContent() {
  const pois = [
    { id: 10001, name: 'Syntagma Square', description: 'The central square of Athens, home to the Greek Parliament and the Tomb of the Unknown Soldier.', category: 'tourism', photoUrl: 'https://images.unsplash.com/photo-1747560249491-25708b62b71a?w=800&q=70&auto=format&fit=crop', wheelchair: 'yes', surface: 'asphalt', hasRamp: true, hasTactilePaving: true, hasRestArea: true, lon: 23.7348, lat: 37.9755 },
    { id: 10002, name: 'Plaka', description: 'The oldest neighborhood of Athens with neoclassical architecture and narrow streets.', category: 'tourism', photoUrl: 'https://images.unsplash.com/photo-1602769247692-126fdf1f1da6?w=800&q=70&auto=format&fit=crop', wheelchair: 'limited', surface: 'cobblestone', hasRamp: false, hasTactilePaving: false, hasRestArea: true, lon: 23.7285, lat: 37.972 },
    { id: 10003, name: 'Acropolis', description: 'The ancient citadel of Athens, home to the Parthenon and other classical Greek monuments.', category: 'tourism', photoUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=800&q=70&auto=format&fit=crop', wheelchair: 'limited', surface: 'stone', hasRamp: true, hasTactilePaving: false, hasRestArea: true, lon: 23.7257, lat: 37.9715 },
    { id: 10004, name: 'National Garden', description: 'A large public park in central Athens with botanical gardens and a small zoo.', category: 'nature', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Attica_06-13_Athens_12_National_Garden.jpg/960px-Attica_06-13_Athens_12_National_Garden.jpg', wheelchair: 'yes', surface: 'gravel', hasRamp: true, hasTactilePaving: false, hasRestArea: true, lon: 23.7365, lat: 37.9745 },
    { id: 10005, name: 'Zappeion', description: 'A neoclassical building next to the National Garden, used for exhibitions and events.', category: 'tourism', photoUrl: 'https://images.unsplash.com/photo-1779891425209-49363e38601b?w=800&q=70&auto=format&fit=crop', wheelchair: 'yes', surface: 'asphalt', hasRamp: true, hasTactilePaving: true, hasRestArea: true, lon: 23.7355, lat: 37.97 },
    { id: 10006, name: 'Monastiraki Square', description: 'A bustling square near the flea market with views of the Acropolis.', category: 'tourism', photoUrl: 'https://images.unsplash.com/photo-1583656696771-2afded31a36c?w=800&q=70&auto=format&fit=crop', wheelchair: 'yes', surface: 'asphalt', hasRamp: true, hasTactilePaving: false, hasRestArea: true, lon: 23.7255, lat: 37.976 },
    { id: 10007, name: 'Ancient Agora', description: 'The ancient marketplace of Athens with the well-preserved Temple of Hephaestus.', category: 'tourism', photoUrl: 'https://images.unsplash.com/photo-1558297733-383c11030c44?w=800&q=70&auto=format&fit=crop', wheelchair: 'limited', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: true, lon: 23.7235, lat: 37.97 },
    { id: 10008, name: 'Thissio Promenade', description: 'A pedestrian walkway with cafes and views of the Acropolis, popular for evening walks.', category: 'tourism', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Apostolou_Pavlou_Pedestrian_Street_on_March_20%2C_2020.jpg/960px-Apostolou_Pavlou_Pedestrian_Street_on_March_20%2C_2020.jpg', wheelchair: 'yes', surface: 'asphalt', hasRamp: true, hasTactilePaving: true, hasRestArea: true, lon: 23.72, lat: 37.977 },
    { id: 10009, name: 'Kerameikos', description: 'An ancient cemetery and archaeological site near the city walls.', category: 'tourism', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Kerameikos_Cemetery_on_July_28%2C_2019.jpg/960px-Kerameikos_Cemetery_on_July_28%2C_2019.jpg', wheelchair: 'limited', surface: 'gravel', hasRamp: false, hasTactilePaving: false, hasRestArea: false, lon: 23.715, lat: 37.9755 },
    { id: 10010, name: 'Odeon of Herodes Atticus', description: 'A stone Roman theater on the southwest slope of the Acropolis.', category: 'tourism', photoUrl: 'https://images.unsplash.com/photo-1635672097594-a0cbb7aa3a9e?w=800&q=70&auto=format&fit=crop', wheelchair: 'no', surface: 'stone', hasRamp: false, hasTactilePaving: false, hasRestArea: true, lon: 23.724, lat: 37.9685 },
  ];

  for (const { id, lon, lat, ...data } of pois) {
    await prisma.poi.upsert({ where: { id }, update: data, create: { id, ...data } });
    await prisma.$executeRawUnsafe(
      `UPDATE pois SET geometry = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
      lon, lat, id,
    );
  }

  const routes = [
    { id: 1, title: 'Historic Center Walk', description: 'Explore the ancient heart of Athens, from Syntagma Square through Plaka to the Acropolis area.', estimatedDurationMinutes: 90, distanceMeters: 3200, category: 'historical', coords: [[23.7348, 37.9755], [23.7285, 37.972], [23.7257, 37.9715]] },
    { id: 2, title: 'National Garden Stroll', description: 'A walk through the National Garden to the Zappeion, with no steps on the path; some stretches are cobbled.', estimatedDurationMinutes: 45, distanceMeters: 1800, category: 'nature', coords: [[23.7365, 37.9745], [23.738, 37.972], [23.7355, 37.97]] },
    { id: 3, title: 'Monastiraki to the Ancient Agora', description: 'From the busy square beside the flea market to the marketplace of classical Athens.', estimatedDurationMinutes: 75, distanceMeters: 2600, category: 'cultural', coords: [[23.7255, 37.976], [23.723, 37.9775], [23.721, 37.978]] },
    { id: 4, title: 'Acropolis & Surroundings', description: 'The iconic Acropolis hill with panoramic views, the Odeon of Herodes Atticus, and the Ancient Agora.', estimatedDurationMinutes: 120, distanceMeters: 4100, category: 'historical', coords: [[23.7257, 37.9715], [23.7235, 37.97], [23.724, 37.9685]] },
    { id: 5, title: 'Thissio to Kerameikos', description: 'From the Thissio pedestrian promenade to the ancient cemetery beside the city walls.', estimatedDurationMinutes: 60, distanceMeters: 2200, category: 'cultural', coords: [[23.72, 37.977], [23.718, 37.976], [23.715, 37.9755]] },
  ];

  for (const { id, coords, ...data } of routes) {
    await prisma.route.upsert({ where: { id }, update: data, create: { id, ...data } });
    const wkt = `LINESTRING(${coords.map(([x, y]) => `${x} ${y}`).join(', ')})`;
    await prisma.$executeRawUnsafe(
      `UPDATE routes SET geometry = ST_SetSRID(ST_GeomFromText($1), 4326) WHERE id = $2`,
      wkt, id,
    );
  }

  const routePois = [
    { routeId: 1, poiId: 10001, orderIndex: 1, estimatedArrivalMinutes: 0 },
    { routeId: 1, poiId: 10002, orderIndex: 2, estimatedArrivalMinutes: 30 },
    { routeId: 1, poiId: 10003, orderIndex: 3, estimatedArrivalMinutes: 70 },
    { routeId: 2, poiId: 10004, orderIndex: 1, estimatedArrivalMinutes: 0 },
    { routeId: 2, poiId: 10005, orderIndex: 2, estimatedArrivalMinutes: 25 },
    { routeId: 3, poiId: 10006, orderIndex: 1, estimatedArrivalMinutes: 0 },
    { routeId: 3, poiId: 10007, orderIndex: 2, estimatedArrivalMinutes: 35 },
    { routeId: 4, poiId: 10003, orderIndex: 1, estimatedArrivalMinutes: 0 },
    { routeId: 4, poiId: 10010, orderIndex: 2, estimatedArrivalMinutes: 40 },
    { routeId: 4, poiId: 10007, orderIndex: 3, estimatedArrivalMinutes: 80 },
    { routeId: 5, poiId: 10008, orderIndex: 1, estimatedArrivalMinutes: 0 },
    { routeId: 5, poiId: 10009, orderIndex: 2, estimatedArrivalMinutes: 40 },
  ];

  for (const { routeId, poiId, ...data } of routePois) {
    await prisma.routePoi.upsert({
      where: { routeId_poiId: { routeId, poiId } },
      update: data,
      create: { routeId, poiId, ...data },
    });
  }

  // Seeding with explicit PKs leaves each SERIAL sequence at its old value, so
  // the next runtime create() would collide (routes at id 1, POIs at 10001 once
  // OSM sync inserts). Advance every touched sequence past MAX(id).
  for (const table of ['mobility_profiles', 'pois', 'routes']) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`,
    );
  }

  console.log(`Seeded ${pois.length} POIs, ${routes.length} routes, ${routePois.length} route stops`);
}

main()
  .catch((error) => {
    // Exit non-zero so CI/deploy pipelines see a failed seed as a failure.
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
