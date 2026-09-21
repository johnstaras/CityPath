// Pure query-string parsers shared by controllers. No I/O, so they are unit
// tested directly (see test/).

/**
 * Parse the `remaining_time` query parameter of GET /routes/:id/alternatives.
 *
 * The value is WALKING time left, in whole seconds: the mobile app sends
 * Math.round(remainingSeconds) of its walking estimate (no stop visit time).
 * 0 is VALID — a walk with nothing left sends it. With no time left there is
 * nothing to suggest, which the controller answers with an empty list rather
 * than a 400.
 * Missing, non-numeric, and negative values are still rejected.
 *
 * @param {unknown} raw - req.query.remaining_time
 * @returns {{ ok: true, seconds: number } | { ok: false, error: string }}
 */
function parseRemainingTime(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: false, error: 'remaining_time is required (in seconds)' };
  }
  const text = String(raw).trim();
  const value = text === '' ? NaN : Number(text);
  // Rejects 'abc', '12abc', 'Infinity', negatives. A fractional value is
  // floored to whole seconds, as parseInt did before.
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: 'remaining_time must be a non-negative number of seconds' };
  }
  return { ok: true, seconds: Math.floor(value) };
}

module.exports = { parseRemainingTime };
