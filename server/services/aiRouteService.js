const prisma = require('../config/database');
const aiConfig = require('../config/aiConfig');
const poiRepository = require('../repositories/poiRepository');
const routeService = require('./routeService');
const { proposeRoute } = require('./aiProviders');
const { snapRoute } = require('../scripts/snap-routes');
const { scoreRoute } = require('../utils/accessibilityScorer');
const {
  MIN_STOPS,
  MAX_STOPS,
  validateStopCount,
  deriveRouteCategory,
  accessibilityGateDecision,
  isRetryableProviderError,
} = require('../utils/aiRouteRules');

const CANDIDATE_RADIUS_METERS = 1200;
const MAX_CANDIDATES = 40;

// Attempts allowed per request. Each is a full model + OSRM round trip, so this
// trades a few seconds for a usable answer on restrictive mobility profiles.
// Transient provider failures (5xx, timeout, empty reply) spend the same budget.
const MAX_ATTEMPTS = 2;

// The route is written inside one interactive transaction that spans the OSRM
// call (bounded by OSRM_TIMEOUT_MS) and the scorer query; Prisma's 5 s default
// would abort a slow-but-valid snap.
const MATERIALISE_TX_TIMEOUT_MS = 20000;

// Same ceiling the offline catalogue seeder applies: a longer result means the
// selection zigzagged rather than describing a walk.
const MAX_ROUTE_METERS = 7000;

const CREATED_BY = 'ai';

// Nearby POIs are overwhelmingly cafes and pharmacies (of the ~7.7k OSM rows,
// over 3k are one or the other), so a single "nearest N" query would never
// surface an actual sight. Query sights across the whole radius separately and
// only then fill up with the nearest of everything else — the same two-pool
// approach routingEngine uses for checkpoint detours.
const SIGHT_CATEGORIES = [
  'tourism', 'attraction', 'museum', 'gallery', 'artwork',
  'historical', 'cultural', 'nature', 'monument', 'viewpoint', 'information',
];

const TOOL_NAME = 'propose_route';

const SYSTEM_PROMPT = `You plan short walking routes in Athens for CityPaths, an accessibility-first tourism app.

You will be given a numbered list of candidate places, each with an id, a name, a category and the accessibility attributes recorded for it in OpenStreetMap. You must call the ${TOOL_NAME} tool exactly once.

Rules:
- Choose between ${MIN_STOPS} and ${MAX_STOPS} places, ONLY from the candidate list, and return their ids.
- Order the ids as a walking sequence: each stop should be near the previous one. Never zigzag back and forth across the city.
- Prefer genuine sights (monuments, museums, viewpoints, parks, historic squares) over cafes, restaurants, pharmacies and shops. A cafe is acceptable only as a rest stop between two sights.
- Respect the stated mobility profile. If it needs step-free access, do not choose places recorded as wheelchair: no.
- Write a short title (max 6 words) and one descriptive sentence.

Never state or imply an accessibility fact that is not in the candidate data you were given. Describe the character of the walk, not how accessible it is — the app computes and displays accessibility itself.`;

// A schema constrains the shape of the reply, but never its truthfulness: the
// only validation that matters is whether the returned ids are real, which
// resolveStops checks against the candidate list we actually sent.
const ROUTE_TOOL = {
  name: TOOL_NAME,
  description: 'Propose one walking route as an ordered list of candidate place ids.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short route title, max 6 words.' },
      description: { type: 'string', description: 'One sentence describing the walk.' },
      stop_poi_ids: {
        type: 'array',
        description: `Ordered ids of the chosen places, ${MIN_STOPS}-${MAX_STOPS} of them.`,
        items: { type: 'integer' },
        // Advisory only — the model may ignore it. The real check is
        // validateStopCount, after unknown and duplicate ids are dropped.
        minItems: MIN_STOPS,
        maxItems: MAX_STOPS,
      },
    },
    required: ['title', 'description', 'stop_poi_ids'],
    additionalProperties: false,
  },
};

// A compact, human-readable description of the mobility profile. The model
// only needs the constraints that change which places are suitable.
function describeProfile(profile) {
  if (!profile) return 'No specific mobility needs.';
  const needs = [];
  if (profile.avoidStairs) needs.push('must avoid stairs');
  if (profile.avoidCobblestone) needs.push('must avoid cobblestone');
  if (profile.requiresRamps) needs.push('needs step-free access and ramps');
  if (profile.requiresTactilePaving) needs.push('needs tactile paving');
  if (profile.maxRouteDistanceKm) needs.push(`total walk under ${profile.maxRouteDistanceKm} km`);
  if (profile.restStopIntervalM) needs.push(`a rest stop roughly every ${profile.restStopIntervalM} m`);
  return `Mobility profile "${profile.name}": ${needs.length ? needs.join(', ') : 'no special constraints'}.`;
}

async function buildCandidates(position, profile) {
  const [sights, others] = await Promise.all([
    poiRepository.findNearby(position.lat, position.lng, CANDIDATE_RADIUS_METERS, {
      categories: SIGHT_CATEGORIES,
    }),
    poiRepository.findNearby(position.lat, position.lng, CANDIDATE_RADIUS_METERS, {}),
  ]);

  const seen = new Set();
  const candidates = [];
  for (const poi of [...sights, ...others]) {
    if (candidates.length >= MAX_CANDIDATES) break;
    if (seen.has(poi.id) || !poi.name) continue;
    // Hard filter before the model ever sees the row: an inaccessible
    // destination is not a candidate for a profile that needs step-free access,
    // regardless of what the model would have picked.
    if (profile?.requiresRamps && poi.wheelchair === 'no') continue;
    seen.add(poi.id);
    candidates.push(poi);
  }
  return candidates;
}

function renderCandidates(candidates) {
  return candidates
    .map(p => {
      const attrs = [`wheelchair: ${p.wheelchair}`];
      if (p.surface) attrs.push(`surface: ${p.surface}`);
      if (p.hasRamp) attrs.push('ramp');
      if (p.hasRestArea) attrs.push('rest area');
      return `${p.id} | ${p.name} | ${p.category || 'other'} | ${p.distance_meters} m away | ${attrs.join(', ')}`;
    })
    .join('\n');
}

// The only trust boundary that matters: every id the model returns must be one
// we actually sent. Anything else is dropped silently rather than looked up —
// a hallucinated id must never reach the map.
function resolveStops(returnedIds, candidates) {
  const byId = new Map(candidates.map(p => [p.id, p]));
  const stops = [];
  const rejected = [];
  const seen = new Set();

  for (const raw of returnedIds) {
    const id = Number(raw);
    if (!byId.has(id)) { rejected.push(raw); continue; }
    if (seen.has(id)) continue;
    seen.add(id);
    stops.push(byId.get(id));
  }
  return { stops, rejected };
}

async function callModel(candidates, profile, userPrompt, feedback, signal) {
  const message = [
    describeProfile(profile),
    // Present only on a retry: says what was wrong with the last attempt.
    feedback || null,
    userPrompt ? `What the visitor asked for: ${userPrompt}` : 'The visitor did not state a preference.',
    '',
    'Candidate places (id | name | category | distance | accessibility):',
    renderCandidates(candidates),
    '',
    `Call ${TOOL_NAME} once with your chosen route.`,
  ].filter(line => line !== null).join('\n');

  return proposeRoute({
    system: SYSTEM_PROMPT,
    message,
    tool: ROUTE_TOOL,
    signal,
  });
}

function codedError(message, code, extra = {}) {
  return Object.assign(new Error(message), { code }, extra);
}

// The client that asked for this route has gone (app timeout, closed screen).
// Checked before every expensive step and, crucially, as the last statement of
// the write transaction: throwing there rolls the route back, so a user who was
// told generation failed never finds the route in their list afterwards.
function throwIfClientGone(signal) {
  if (signal?.aborted) {
    throw codedError('The client disconnected before the route was ready', 'CLIENT_DISCONNECTED');
  }
}

// A gate rejection: the proposal was valid, but the path is unsuitable.
function gateRejection(message) {
  return codedError(message, 'NO_SUITABLE_ROUTE');
}

// Persist the proposal, then derive geometry/distance/duration/arrivals through
// the same OSRM pipeline the seeded routes use.
//
// Everything runs in ONE database transaction: the route row, its stops, the
// snapped geometry and every gate. A gate that throws rolls the whole write
// back, so a rejected proposal leaves no orphan route. (This replaced a
// compensating delete whose failure was swallowed with `.catch(() => {})`.)
// If the rollback itself fails, Prisma rejects with that error and it
// propagates to the caller, which logs it.
async function materialise(proposal, stops, profile, signal) {
  return prisma.$transaction(async tx => {
    const route = await tx.route.create({
      data: {
        title: proposal.title,
        description: proposal.description,
        category: deriveRouteCategory(stops),
        createdBy: CREATED_BY,
        // The one thing that separates a live model-composed route from the
        // curated catalogue (also createdBy 'ai'). Exposed as `isLiveAi`.
        generatedLive: true,
        estimatedDurationMinutes: 0,
        distanceMeters: 0,
      },
    });

    for (let i = 0; i < stops.length; i++) {
      await tx.routePoi.create({
        data: {
          routeId: route.id,
          poiId: stops[i].id,
          orderIndex: i + 1,
          estimatedArrivalMinutes: 0,
        },
      });
    }

    const waypoints = stops.map(s => ({ lat: s.lat, lng: s.lng }));
    const wkt = `LINESTRING(${waypoints.map(w => `${w.lng} ${w.lat}`).join(',')})`;
    await tx.$executeRawUnsafe(
      `UPDATE routes SET geometry = ST_SetSRID(ST_GeomFromText($1), 4326) WHERE id = $2`,
      wkt, route.id,
    );

    // snapRoute writes through the client it is given, so passing tx keeps its
    // geometry/distance/arrival updates inside the same transaction.
    const snapped = await snapRoute(tx, { id: route.id, title: proposal.title }, waypoints, stops);

    if (snapped.distance > MAX_ROUTE_METERS) {
      throw gateRejection(`route is ${snapped.distance} m, over the ${MAX_ROUTE_METERS} m limit`);
    }
    if (profile?.maxRouteDistanceKm && snapped.distance > profile.maxRouteDistanceKm * 1000) {
      throw gateRejection(`route is ${snapped.distance} m, beyond the profile limit of ${profile.maxRouteDistanceKm} km`);
    }

    // The same gate the checkpoint detour engine applies: a path the scorer
    // rates 0 for this profile is not offered, whatever the model said — and
    // neither is a path it could not measure. Scored from the snapped geometry
    // directly (the row is not committed yet); the scorer only reads
    // path_barriers, which this transaction does not touch.
    if (profile) {
      const result = snapped.geometry
        ? await scoreRoute(snapped.geometry, profile, { stops })
        : null;
      const decision = accessibilityGateDecision(result);
      if (decision === 'unverifiable') {
        throw gateRejection('accessibility of this path could not be verified');
      }
      if (decision === 'reject') {
        // Report WHY, so the retry feedback can tell the model something useful
        // and the caller can explain it to the user.
        throw gateRejection(result.issues[0] || 'no accessible path for this mobility profile');
      }
    }

    // Last check before COMMIT: nobody is waiting for this route any more.
    throwIfClientGone(signal);

    return route.id;
  }, { timeout: MATERIALISE_TX_TIMEOUT_MS, maxWait: 5000 });
}

/**
 * Generate one walking route near a position, tailored to a mobility profile.
 *
 * The model chooses WHICH places and in what order, and writes the title and
 * description. Everything with a consequence is computed here: OSRM builds the
 * real path, snapRoute derives distance/duration/arrival times, and the
 * accessibility scorer validates the result. Ids the model invents are dropped
 * before anything is persisted.
 *
 * @param {{ lat: number, lng: number }} position
 * @param {number|null} mobilityProfileId
 * @param {string|null} userPrompt - optional free-text preference
 * @param {{ signal?: AbortSignal }} [options] - aborted when the client disconnects;
 *   nothing is committed after that
 * @returns {Promise<object>} the generated route, in the same shape as GET /api/routes/:id
 */
async function generateRoute(position, mobilityProfileId, userPrompt, { signal } = {}) {
  if (!aiConfig.enabled) {
    const error = new Error(aiConfig.disabledReason || 'AI route generation is disabled');
    error.code = 'AI_DISABLED';
    throw error;
  }

  const profile = await routeService.resolveProfile(mobilityProfileId);
  // An explicit id that matches no profile used to resolve to null, which
  // silently skipped the wheelchair filter, the distance limit and the scorer.
  if (!profile) {
    throw codedError(`Unknown mobility profile: ${mobilityProfileId}`, 'INVALID_MOBILITY_PROFILE');
  }

  const candidates = await buildCandidates(position, profile);
  if (candidates.length < MIN_STOPS) {
    const error = new Error('Not enough places nearby to build a route');
    error.code = 'NO_CANDIDATES';
    throw error;
  }

  // Strict profiles fail the gates often and legitimately: a first proposal
  // can be 200 m over the profile's distance limit, or route past stairs the
  // scorer treats as a deal-breaker. Rejecting outright would mean a wheelchair
  // user — the app's core audience — reliably taps the button and gets nothing,
  // so the failure reason is fed back and the model gets one more try. Bounded
  // at MAX_ATTEMPTS because each attempt is a full model + OSRM round trip.
  let feedback = null;
  let lastFailure = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    throwIfClientGone(signal);
    let proposal;
    try {
      proposal = await callModel(candidates, profile, userPrompt, feedback, signal);
    } catch (err) {
      throwIfClientGone(signal);
      // Transient provider failures (5xx, 429, timeout, empty or unparseable
      // reply) use the same single retry as a rejected proposal. Configuration
      // errors (bad key, unknown model, 4xx) would fail identically, so they
      // surface immediately. Feedback is left unchanged: the model never saw
      // this attempt.
      console.warn(`AI route generation attempt ${attempt}: provider error: ${err.message}`);
      const failure = codedError('The route provider is temporarily unavailable', 'PROVIDER_ERROR', { cause: err });
      // Not retryable (bad key, unknown model, refusal): fail now, still as a
      // provider failure (502) rather than an unexplained 500.
      if (!isRetryableProviderError(err)) throw failure;
      lastFailure = failure;
      continue;
    }

    const returnedIds = Array.isArray(proposal?.stop_poi_ids) ? proposal.stop_poi_ids : [];
    const { stops, rejected } = resolveStops(returnedIds, candidates);

    if (rejected.length) {
      console.warn(`AI route generation: dropped ${rejected.length} unknown POI id(s): ${rejected.join(', ')}`);
    }

    const count = validateStopCount(stops.length);
    if (!count.ok) {
      lastFailure = Object.assign(
        new Error(count.reason === 'too_few'
          ? 'Model did not return enough valid places'
          : `Model returned more than ${MAX_STOPS} places`),
        { code: 'INVALID_PROPOSAL' },
      );
      feedback = count.feedback;
      console.warn(`AI route generation attempt ${attempt} rejected: ${stops.length} valid stop(s), need ${MIN_STOPS}-${MAX_STOPS}`);
      continue;
    }

    try {
      const routeId = await materialise(proposal, stops, profile, signal);
      // Return through the normal read path so the response carries the same
      // accessibility score and shape as any other route the client fetches.
      return routeService.getRouteDetails(routeId, mobilityProfileId);
    } catch (err) {
      if (err.code === 'CLIENT_DISCONNECTED') throw err;
      lastFailure = err;
      feedback = `Your previous selection (${stops.map(s => s.name).join(', ')}) was rejected: ${err.message}. `
        + `Choose fewer stops (still at least ${MIN_STOPS}) that are closer together, and prefer places recorded as wheelchair: yes on main paved streets.`;
      // The transaction has already rolled back; nothing was kept.
      console.warn(`AI route generation attempt ${attempt} rejected (rolled back): ${err.message}`);
    }
  }

  // Every attempt failed a gate. This is an honest "no suitable route here",
  // not a bug — the alternative would be offering a walk the profile cannot make.
  // (An uncoded failure — e.g. OSRM finding no path — also counts as
  // NO_SUITABLE_ROUTE; database errors carry Prisma's own P-code and so still
  // surface as a 500 in the controller.)
  throw codedError(
    lastFailure?.message || 'Could not build a suitable route',
    lastFailure?.code || 'NO_SUITABLE_ROUTE',
  );
}

module.exports = { generateRoute };
