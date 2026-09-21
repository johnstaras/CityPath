// Smoke-test the CONFIGURED provider with one real route generation.
//
// Unlike verify-ai-pipeline.js (which stubs the model and needs no key), this
// makes a real call, so it needs real credentials in .env. Use it the moment a
// key is added, to confirm the provider, the model name and the whole pipeline
// work together before relying on the feature in a demo.
//
//   node scripts/try-ai-provider.js --list      list the models the provider offers
//   node scripts/try-ai-provider.js             generate one route and keep it
//   node scripts/try-ai-provider.js --cleanup   generate one route, then delete it
//
// --list matters because Groq retires model names on its own schedule: rather
// than guessing what is current, ask the endpoint.

require('dotenv').config();

const aiConfig = require('../config/aiConfig');
const prisma = require('../config/database');

// Syntagma Square — central, dense with candidates, and the same origin the
// other scripts and the seeded catalogue use.
const ORIGIN = { lat: 37.9755, lng: 23.7348 };

// Pedestrian baseline. Pass a different id to exercise a stricter profile.
const PROFILE_ID = Number(process.env.TRY_PROFILE_ID || 1);

function describeConfig() {
  console.log('Provider configuration');
  console.log(`  provider : ${aiConfig.provider}`);
  console.log(`  model    : ${aiConfig.model}`);
  console.log(`  base URL : ${aiConfig.baseUrl}`);
  console.log(`  api key  : ${aiConfig.apiKey ? 'set' : 'NOT SET'}`);
  console.log(`  switch   : AI_ROUTE_GENERATION=${aiConfig.flagOn ? 'on' : 'off'}`);
  console.log(`  enabled  : ${aiConfig.enabled}${aiConfig.enabled ? '' : ` — ${aiConfig.disabledReason}`}`);
  console.log('');
}

async function listModels() {
  if (!aiConfig.baseUrl) {
    console.log('AI_ROUTE_BASE_URL is not set — nothing to query.');
    return;
  }

  const url = `${aiConfig.baseUrl.replace(/\/$/, '')}/models`;
  const headers = {};
  if (aiConfig.apiKey) headers.Authorization = `Bearer ${aiConfig.apiKey}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.log(`Could not list models: ${response.status} ${detail.slice(0, 200)}`);
    return;
  }

  const body = await response.json();
  const ids = (body.data || body.models || []).map(m => m.id || m.name).filter(Boolean).sort();
  if (ids.length === 0) {
    console.log('Provider returned no model list.');
    return;
  }
  console.log(`Models available (${ids.length}):`);
  ids.forEach(id => console.log(`  ${id}${id === aiConfig.model ? '   <-- currently configured' : ''}`));
  if (!ids.includes(aiConfig.model)) {
    console.log(`\nWARNING: the configured model "${aiConfig.model}" is not in this list.`);
    console.log('Set AI_ROUTE_MODEL to one of the ids above.');
  }
}

async function generateOnce(cleanup) {
  if (!aiConfig.enabled) {
    console.log(`Generation is disabled: ${aiConfig.disabledReason}`);
    console.log('Set AI_ROUTE_GENERATION=on and AI_ROUTE_API_KEY in server/.env, then re-run.');
    process.exitCode = 1;
    return;
  }

  // Required late: aiRouteService reads config at call time, and importing it
  // before the disabled check would make a misconfiguration fail less clearly.
  const aiRouteService = require('../services/aiRouteService');

  console.log(`Generating one route near Syntagma for mobility profile ${PROFILE_ID}...`);
  const started = Date.now();

  const route = await aiRouteService.generateRoute(
    ORIGIN,
    PROFILE_ID,
    'something historic and not too long',
  );

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\nGenerated in ${elapsed}s\n`);
  console.log(`  id          : ${route.id}`);
  console.log(`  title       : ${route.title}`);
  console.log(`  description : ${route.description}`);
  console.log(`  category    : ${route.category}`);
  console.log(`  distance    : ${route.distanceMeters} m`);
  console.log(`  duration    : ${route.estimatedDurationMinutes} min`);
  console.log(`  geometry    : ${route.coordinates.length} street points`);
  console.log(`  a11y score  : ${route.accessibilityScore}`);
  console.log(`  provenance  : ${route.createdBy}`);
  console.log('  stops:');
  route.pois.forEach(p =>
    console.log(`    ${p.orderIndex}. ${p.name}  (+${p.estimatedArrivalMinutes} min, wheelchair: ${p.wheelchair})`),
  );

  if (cleanup) {
    await prisma.routePoi.deleteMany({ where: { routeId: route.id } });
    await prisma.route.delete({ where: { id: route.id } });
    console.log('\nCleaned up: the generated route was deleted.');
  } else {
    console.log(`\nKept in the database. To remove it later:`);
    console.log(`  DELETE FROM route_pois WHERE route_id = ${route.id}; DELETE FROM routes WHERE id = ${route.id};`);
  }
}

async function main() {
  describeConfig();
  if (process.argv.includes('--list')) {
    await listModels();
    return;
  }
  await generateOnce(process.argv.includes('--cleanup'));
}

main()
  .catch(error => {
    console.error('\nFailed:', error.message);
    if (error.code) console.error('code:', error.code);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
