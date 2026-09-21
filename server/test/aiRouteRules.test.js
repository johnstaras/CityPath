const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MIN_STOPS,
  MAX_STOPS,
  validateStopCount,
  deriveRouteCategory,
  accessibilityGateDecision,
  isRetryableProviderError,
} = require('../utils/aiRouteRules');

test('stop count bounds are 3-6', () => {
  assert.equal(MIN_STOPS, 3);
  assert.equal(MAX_STOPS, 6);
});

test('validateStopCount rejects fewer than 3 valid stops', () => {
  for (const n of [0, 1, 2]) {
    const result = validateStopCount(n);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'too_few');
    assert.match(result.feedback, /between 3 and 6/);
  }
});

test('validateStopCount accepts 3 to 6 stops', () => {
  for (const n of [3, 4, 5, 6]) {
    assert.deepEqual(validateStopCount(n), { ok: true });
  }
});

test('validateStopCount rejects more than 6 stops (no silent trim)', () => {
  const result = validateStopCount(7);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'too_many');
  assert.match(result.feedback, /at most 6/);
});

test('deriveRouteCategory: majority wins, historical is reachable', () => {
  const stops = [
    { category: 'museum' },
    { category: 'attraction' },
    { category: 'historical' },
    { category: 'monument' },
  ];
  assert.equal(deriveRouteCategory(stops), 'historical');
});

test('deriveRouteCategory: nature majority even when the first stop is not nature', () => {
  const stops = [{ category: 'museum' }, { category: 'park' }, { category: 'viewpoint' }];
  assert.equal(deriveRouteCategory(stops), 'nature');
});

test('deriveRouteCategory: unmapped categories (cafe, restaurant) do not vote', () => {
  const stops = [
    { category: 'cafe' },
    { category: 'cafe' },
    { category: 'gallery' },
    { category: 'restaurant' },
  ];
  assert.equal(deriveRouteCategory(stops), 'cultural');
});

test('deriveRouteCategory: a tie is broken by the earliest stop in walk order', () => {
  assert.equal(deriveRouteCategory([{ category: 'nature' }, { category: 'museum' }]), 'nature');
  assert.equal(deriveRouteCategory([{ category: 'museum' }, { category: 'nature' }]), 'cultural');
  assert.equal(
    deriveRouteCategory([{ category: 'cafe' }, { category: 'tourism' }, { category: 'artwork' }]),
    'historical',
  );
});

test('deriveRouteCategory: no mapped stop falls back to cultural', () => {
  assert.equal(deriveRouteCategory([{ category: 'cafe' }, { category: null }, {}]), 'cultural');
  assert.equal(deriveRouteCategory([]), 'cultural');
  assert.equal(deriveRouteCategory(undefined), 'cultural');
});

test('accessibilityGateDecision: scorer failure is unverifiable, never a pass', () => {
  const failed = { score: null, issues: ['Accessibility data unavailable'], unavailable: true };
  assert.equal(accessibilityGateDecision(failed), 'unverifiable');
  assert.equal(accessibilityGateDecision(null), 'unverifiable');
  assert.equal(accessibilityGateDecision(undefined), 'unverifiable');
  assert.equal(accessibilityGateDecision({ score: NaN }), 'unverifiable');
});

test('accessibilityGateDecision: 0 rejects, anything above passes', () => {
  assert.equal(accessibilityGateDecision({ score: 0, issues: ['steps'] }), 'reject');
  assert.equal(accessibilityGateDecision({ score: 1, issues: [] }), 'pass');
  assert.equal(accessibilityGateDecision({ score: 50, issues: [] }), 'pass');
  assert.equal(accessibilityGateDecision({ score: 100, issues: [] }), 'pass');
});

test('isRetryableProviderError: an explicit flag wins', () => {
  assert.equal(isRetryableProviderError(Object.assign(new Error('x'), { retryable: true, status: 400 })), true);
  assert.equal(isRetryableProviderError(Object.assign(new Error('x'), { retryable: false, status: 503 })), false);
});

test('isRetryableProviderError: 5xx, 429, 408 and timeouts retry; config errors do not', () => {
  const withStatus = status => Object.assign(new Error('x'), { status });
  assert.equal(isRetryableProviderError(withStatus(500)), true);
  assert.equal(isRetryableProviderError(withStatus(503)), true);
  assert.equal(isRetryableProviderError(withStatus(429)), true);
  assert.equal(isRetryableProviderError(withStatus(408)), true);
  assert.equal(isRetryableProviderError(withStatus(400)), false);
  assert.equal(isRetryableProviderError(withStatus(401)), false);
  assert.equal(isRetryableProviderError(withStatus(404)), false);

  const timeout = new Error('timed out');
  timeout.name = 'TimeoutError';
  assert.equal(isRetryableProviderError(timeout), true);

  assert.equal(isRetryableProviderError(Object.assign(new Error('off'), { code: 'AI_DISABLED' })), false);
  assert.equal(isRetryableProviderError(new Error('API key is not set')), false);
  assert.equal(isRetryableProviderError(null), false);
});
