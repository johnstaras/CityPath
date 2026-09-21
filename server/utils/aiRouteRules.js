// Pure decision rules for live AI route generation and the checkpoint detour
// gate. No database, network or model access here — every function is
// synchronous so it can be unit-tested in isolation (see test/).

const MIN_STOPS = 3;
const MAX_STOPS = 6;

// POI categories -> route categories. Shared with routingEngine (category
// affinity) so there is one definition of which POI belongs to which of the
// three route categories the mobile FilterBar offers.
const POI_TO_ROUTE_CATEGORY = {
  historical: 'historical',
  attraction: 'historical',
  tourism: 'historical',
  monument: 'historical',
  information: 'historical',
  cultural: 'cultural',
  museum: 'cultural',
  gallery: 'cultural',
  artwork: 'cultural',
  nature: 'nature',
  park: 'nature',
  viewpoint: 'nature',
};

const ROUTE_CATEGORIES = ['historical', 'cultural', 'nature'];
const DEFAULT_ROUTE_CATEGORY = 'cultural';

/**
 * Is the number of valid, unique stops acceptable?
 *
 * Out-of-range counts are REJECTED (and retried with feedback), never trimmed:
 * the title and description were written for the model's full selection, so
 * silently dropping stops 7+ could leave text describing places that are not on
 * the route. The bounds match the prompt and the tool schema (minItems/maxItems).
 *
 * @param {number} count - valid unique stops after resolveStops
 * @returns {{ ok: true } | { ok: false, reason: 'too_few'|'too_many', feedback: string }}
 */
function validateStopCount(count) {
  if (count < MIN_STOPS) {
    return {
      ok: false,
      reason: 'too_few',
      feedback: `Your previous answer contained only ${count} valid place id(s); a route needs between ${MIN_STOPS} and ${MAX_STOPS}. Choose ids only from the candidate list below.`,
    };
  }
  if (count > MAX_STOPS) {
    return {
      ok: false,
      reason: 'too_many',
      feedback: `Your previous answer contained ${count} places; a route must have at most ${MAX_STOPS}. Choose between ${MIN_STOPS} and ${MAX_STOPS}.`,
    };
  }
  return { ok: true };
}

/**
 * Derive a route's category from its stops.
 *
 * Rule: map each stop's POI category to historical/cultural/nature
 * (POI_TO_ROUTE_CATEGORY); stops with no mapping (cafes, shops, 'other') do
 * not vote. The category with the most votes wins. A tie is broken by walk
 * order — the tied category whose first stop comes earliest wins, since the
 * route opens with it. If no stop maps at all, fall back to 'cultural' (the
 * previous default).
 *
 * @param {Array<{category?: string|null}>} stops - in walking order
 * @returns {'historical'|'cultural'|'nature'}
 */
function deriveRouteCategory(stops) {
  const votes = {};
  const firstSeen = {};
  (stops || []).forEach((stop, index) => {
    const category = POI_TO_ROUTE_CATEGORY[stop?.category];
    if (!category) return;
    votes[category] = (votes[category] || 0) + 1;
    if (firstSeen[category] === undefined) firstSeen[category] = index;
  });

  let best = null;
  for (const category of ROUTE_CATEGORIES) {
    if (!votes[category]) continue;
    if (
      best === null
      || votes[category] > votes[best]
      || (votes[category] === votes[best] && firstSeen[category] < firstSeen[best])
    ) {
      best = category;
    }
  }
  return best || DEFAULT_ROUTE_CATEGORY;
}

/**
 * What an accessibility gate should do with a scorer result.
 *
 * 'unverifiable' — the scorer could not measure the path (score null, e.g. the
 *   spatial query failed). Must NOT pass: the AI pipeline rejects and retries,
 *   the detour engine drops the candidate.
 * 'reject'       — score 0, a deal-breaker for this profile.
 * 'pass'         — anything else.
 *
 * @param {{ score: number|null }|null|undefined} result
 * @returns {'pass'|'reject'|'unverifiable'}
 */
function accessibilityGateDecision(result) {
  if (!result || result.score == null || Number.isNaN(result.score)) return 'unverifiable';
  if (result.score === 0) return 'reject';
  return 'pass';
}

/**
 * Should a failed model call be retried?
 *
 * Transient provider failures are: HTTP 408/429/5xx, timeouts, network errors,
 * and an empty or unparseable reply. Anything else — notably 400/401/403/404
 * (bad key, unknown model, bad base URL) or a local configuration error — will
 * fail identically on a second attempt, so it is not retried.
 *
 * Errors are classified by aiProviders.js, which sets `retryable`; an explicit
 * flag always wins. Unflagged errors fall back to status / name inspection.
 *
 * @param {Error & { retryable?: boolean, status?: number }} err
 * @returns {boolean}
 */
function isRetryableProviderError(err) {
  if (!err) return false;
  if (typeof err.retryable === 'boolean') return err.retryable;
  if (err.code === 'AI_DISABLED') return false;
  const status = Number(err.status);
  if (Number.isFinite(status) && status > 0) {
    return status === 408 || status === 429 || status >= 500;
  }
  return ['TimeoutError', 'AbortError', 'APIConnectionError', 'APIConnectionTimeoutError', 'FetchError']
    .includes(err.name)
    || ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(err.code);
}

module.exports = {
  MIN_STOPS,
  MAX_STOPS,
  POI_TO_ROUTE_CATEGORY,
  validateStopCount,
  deriveRouteCategory,
  accessibilityGateDecision,
  isRetryableProviderError,
};
