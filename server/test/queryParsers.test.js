const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRemainingTime } = require('../utils/queryParsers');

test('remaining_time=0 is accepted (the controller answers with an empty list)', () => {
  assert.deepEqual(parseRemainingTime('0'), { ok: true, seconds: 0 });
  assert.deepEqual(parseRemainingTime(0), { ok: true, seconds: 0 });
});

test('positive remaining_time is parsed to whole seconds', () => {
  assert.deepEqual(parseRemainingTime('1800'), { ok: true, seconds: 1800 });
  assert.deepEqual(parseRemainingTime('90.7'), { ok: true, seconds: 90 });
});

test('missing remaining_time is rejected', () => {
  for (const raw of [undefined, null, '']) {
    const result = parseRemainingTime(raw);
    assert.equal(result.ok, false);
    assert.match(result.error, /required/);
  }
});

test('negative and non-numeric remaining_time are rejected', () => {
  for (const raw of ['-1', '-60', 'abc', 'NaN', '12abc', 'Infinity', '   ']) {
    assert.equal(parseRemainingTime(raw).ok, false, `expected ${JSON.stringify(raw)} to be rejected`);
  }
});
