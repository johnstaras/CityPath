// Bring an existing database in line with the corrected route catalogue data.
//
// Two data corrections (2026-09) live in the seed data files:
//   1. Route titles and descriptions that the measured path or the actual stops
//      contradicted (e.g. "step-free" over 700 m of steps, "loop" for a route
//      that ends 600 m from its start) were rewritten to say only what the data
//      shows — prisma/data/athens-routes.js and admin routes 3 and 5 in
//      prisma/seed.js.
//   2. Stop photos that showed a different place were replaced with a photo of
//      that place — prisma/data/athens-landmarks.js and POIs 10004/10008/10009
//      in prisma/seed.js. Credits: docs/analysis/photo-credits.md.
//   3. Landmark descriptions with unmeasured claims ("flat", "shaded",
//      "low-effort", "quiet") were reworded — prisma/data/athens-landmarks.js,
//      rows listed in DESCRIPTION_FIX_IDS; and admin route 2 no longer says
//      "perfect for families and elderly visitors".
//
// A fresh `npx prisma db seed` + `node scripts/seed-ai-routes.js` already
// produces these values. This script applies the same values to a database
// seeded before the correction WITHOUT re-running the seeders, which would
// re-snap every route through OSRM and rebuild route_pois. It only UPDATEs
// routes.title / routes.description, pois.photo_url, and pois.description of
// the DESCRIPTION_FIX_IDS rows, for existing rows:
// no inserts, no deletes, no id or geometry changes, so favorites and route
// sessions that reference these routes are untouched. Idempotent — a second
// run reports 0 changes.
//
// Usage (from server/):
//   node scripts/apply-catalogue-fixes.js            # apply
//   node scripts/apply-catalogue-fixes.js --dry-run  # list what would change

const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');
const { ROUTES } = require('../prisma/data/athens-routes');
const { LANDMARKS } = require('../prisma/data/athens-landmarks');

// The admin rows are defined inline in prisma/seed.js, which runs the seed when
// required and so cannot be imported. These values must match it; main()
// refuses to run if seed.js no longer contains them verbatim.
const ADMIN_ROUTES = [
  { id: 2, title: 'National Garden Stroll', description: 'A walk through the National Garden to the Zappeion, with no steps on the path; some stretches are cobbled.' },
  { id: 3, title: 'Monastiraki to the Ancient Agora', description: 'From the busy square beside the flea market to the marketplace of classical Athens.' },
  { id: 5, title: 'Thissio to Kerameikos', description: 'From the Thissio pedestrian promenade to the ancient cemetery beside the city walls.' },
];

const ADMIN_POI_PHOTOS = [
  { id: 10004, photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Attica_06-13_Athens_12_National_Garden.jpg/960px-Attica_06-13_Athens_12_National_Garden.jpg' },
  { id: 10008, photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Apostolou_Pavlou_Pedestrian_Street_on_March_20%2C_2020.jpg/960px-Apostolou_Pavlou_Pedestrian_Street_on_March_20%2C_2020.jpg' },
  { id: 10009, photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Kerameikos_Cemetery_on_July_28%2C_2019.jpg/960px-Kerameikos_Cemetery_on_July_28%2C_2019.jpg' },
];

// Landmarks whose description was reworded (Strefi Hill, Ardittos Hill, Aigli
// Zappiou, Apostolou Pavlou Promenade, Dexameni Square). Only these rows get
// their description written; the text comes from athens-landmarks.js.
const DESCRIPTION_FIX_IDS = [10156, 10158, 10159, 10162, 10163];

function assertMatchesSeed() {
  const seed = fs.readFileSync(path.join(__dirname, '../prisma/seed.js'), 'utf8');
  const expected = [
    ...ADMIN_ROUTES.flatMap(r => [`title: '${r.title}'`, `description: '${r.description}'`]),
    ...ADMIN_POI_PHOTOS.map(p => `photoUrl: '${p.photoUrl}'`),
  ];
  const missing = expected.filter(s => !seed.includes(s));
  if (missing.length) {
    throw new Error(`prisma/seed.js no longer matches this script:\n  ${missing.join('\n  ')}`);
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  assertMatchesSeed();

  const routeTexts = [...ADMIN_ROUTES, ...ROUTES.map(({ id, title, description }) => ({ id, title, description }))];
  const poiPhotos = [...ADMIN_POI_PHOTOS, ...LANDMARKS.map(({ id, photoUrl }) => ({ id, photoUrl: photoUrl || null }))];

  let routeChanges = 0;
  let missingRoutes = 0;
  for (const { id, title, description } of routeTexts) {
    const row = await prisma.route.findUnique({ where: { id }, select: { title: true, description: true } });
    if (!row) { missingRoutes++; continue; }
    if (row.title === title && row.description === description) continue;
    routeChanges++;
    console.log(`route ${id}: "${row.title}" -> "${title}"`);
    if (!dryRun) await prisma.route.update({ where: { id }, data: { title, description } });
  }

  let photoChanges = 0;
  let missingPois = 0;
  for (const { id, photoUrl } of poiPhotos) {
    const row = await prisma.poi.findUnique({ where: { id }, select: { name: true, photoUrl: true } });
    if (!row) { missingPois++; continue; }
    if (row.photoUrl === photoUrl) continue;
    photoChanges++;
    console.log(`poi ${id} ${row.name}: photo updated`);
    if (!dryRun) await prisma.poi.update({ where: { id }, data: { photoUrl } });
  }

  let descriptionChanges = 0;
  for (const id of DESCRIPTION_FIX_IDS) {
    const { description } = LANDMARKS.find(l => l.id === id);
    const row = await prisma.poi.findUnique({ where: { id }, select: { name: true, description: true } });
    if (!row) { missingPois++; continue; }
    if (row.description === description) continue;
    descriptionChanges++;
    console.log(`poi ${id} ${row.name}: "${row.description}" -> "${description}"`);
    if (!dryRun) await prisma.poi.update({ where: { id }, data: { description } });
  }

  console.log(
    `${dryRun ? 'Dry run — would change' : 'Changed'}: ${routeChanges} route texts, ${photoChanges} POI photos, ${descriptionChanges} POI descriptions` +
    (missingRoutes || missingPois ? ` (not in this database: ${missingRoutes} routes, ${missingPois} POIs — run the seeders)` : ''),
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
