const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');

function stubModule(relative, exports) {
  const file = path.join(__dirname, '..', relative);
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

// No model, database or OSRM: the service is replaced per test.
const service = { generateRoute: async () => ({ id: 1 }) };
stubModule('services/aiRouteService.js', service);
stubModule('config/aiConfig.js', { enabled: true, provider: 'test', model: 'test' });

const {
  generate,
  statusForGenerationError,
  parseMobilityProfileId,
} = require('../controllers/aiRouteController');

function fakeRes() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.body = undefined;
  res.writableFinished = false;
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.body = body; res.writableFinished = true; return res; };
  return res;
}

const body = extra => ({ body: { lat: 37.97, lng: 23.72, ...extra } });

test('generation errors map to honest status codes', () => {
  assert.equal(statusForGenerationError({ code: 'PROVIDER_ERROR' }), 502);
  assert.equal(statusForGenerationError({ code: 'INVALID_PROPOSAL' }), 502);
  assert.equal(statusForGenerationError({ code: 'NO_SUITABLE_ROUTE' }), 422);
  assert.equal(statusForGenerationError({ code: 'NO_CANDIDATES' }), 404);
  assert.equal(statusForGenerationError({ code: 'INVALID_MOBILITY_PROFILE' }), 400);
  assert.equal(statusForGenerationError({ code: 'AI_DISABLED' }), 503);
  // Unknown or missing codes (including Prisma's P-codes) are a 500.
  assert.equal(statusForGenerationError({ code: 'P2028' }), null);
  assert.equal(statusForGenerationError({ code: 'toString' }), null);
  assert.equal(statusForGenerationError(new Error('boom')), null);
});

test('mobilityProfileId: absent means default, anything but a positive integer is invalid', () => {
  for (const raw of [undefined, null, '']) {
    assert.deepEqual(parseMobilityProfileId(raw), { ok: true, id: null });
  }
  assert.deepEqual(parseMobilityProfileId(4), { ok: true, id: 4 });
  assert.deepEqual(parseMobilityProfileId('2'), { ok: true, id: 2 });
  for (const raw of ['abc', '3abc', 0, -1, 2.5, {}]) {
    assert.equal(parseMobilityProfileId(raw).ok, false, `expected ${JSON.stringify(raw)} to be rejected`);
  }
});

test('a malformed mobilityProfileId is a 400 before any generation work', async () => {
  let called = false;
  service.generateRoute = async () => { called = true; };
  const res = fakeRes();
  await generate(body({ mobilityProfileId: 'abc' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
});

test('a non-retryable provider failure is answered 502', async () => {
  service.generateRoute = async () => {
    throw Object.assign(new Error('The route provider is temporarily unavailable'), { code: 'PROVIDER_ERROR' });
  };
  const res = fakeRes();
  await generate(body(), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, 'PROVIDER_ERROR');
});

test('the service receives a signal that aborts when the client disconnects', async t => {
  t.mock.method(console, 'warn', () => {});
  const res = fakeRes();
  service.generateRoute = (position, profileId, prompt, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => {
      reject(Object.assign(new Error('gone'), { code: 'CLIENT_DISCONNECTED' }));
    });
    // The client gives up while generation is still running.
    setImmediate(() => res.emit('close'));
  });
  await generate(body({ mobilityProfileId: 4 }), res);
  assert.equal(res.body, undefined, 'nothing is written to a closed connection');
});
