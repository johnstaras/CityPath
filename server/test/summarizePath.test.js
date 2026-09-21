const test = require('node:test');
const assert = require('node:assert');
const { summarizePath } = require('../utils/accessibilityScorer');

test('unmeasured path is reported as not measured', () => {
  assert.deepStrictEqual(summarizePath(null), { measured: false });
});

test('steps anywhere on the path are reported, not hidden', () => {
  const s = summarizePath({
    stepsMeters: 382.7, rampedStepsMeters: 0, cobbleMeters: 666, raisedKerbs: 2,
    loweredKerbs: 1, benches: 0, lengthMeters: 1800,
  });
  assert.strictEqual(s.measured, true);
  assert.strictEqual(s.stepsMeters, 383);
  assert.strictEqual(s.cobblestonePercent, 37);
  assert.strictEqual(s.raisedKerbs, 2);
  assert.strictEqual(s.loweredKerbs, 1);
});

test('a step-free path reports 0 m of steps', () => {
  const s = summarizePath({
    stepsMeters: 0, rampedStepsMeters: 12, cobbleMeters: 0, raisedKerbs: 0,
    loweredKerbs: 0, benches: 3, lengthMeters: 900,
  });
  assert.strictEqual(s.stepsMeters, 0);
  assert.strictEqual(s.rampedStepsMeters, 12);
  assert.strictEqual(s.cobblestonePercent, 0);
});
