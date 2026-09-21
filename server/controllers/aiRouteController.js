const aiRouteService = require('../services/aiRouteService');
const aiConfig = require('../config/aiConfig');

// Lets the mobile client decide whether to render the "generate a route"
// action at all, so a deployment with no credentials simply does not offer it
// rather than failing when the user taps.
function getStatus(req, res) {
  res.json({
    enabled: aiConfig.enabled,
    provider: aiConfig.enabled ? aiConfig.provider : null,
    model: aiConfig.enabled ? aiConfig.model : null,
  });
}

// Failure modes the caller can act on, mapped to honest status codes. Anything
// unrecognised is a 500 — an unexpected failure must not be dressed up as a
// clean "no route found".
const ERROR_STATUS = {
  INVALID_MOBILITY_PROFILE: 400,
  AI_DISABLED: 503,
  NO_CANDIDATES: 404,
  // Every attempt was rejected by a gate (distance, accessibility): the request
  // was fine, but no route here suits this profile.
  NO_SUITABLE_ROUTE: 422,
  INVALID_PROPOSAL: 502,
  // The model provider failed (transiently on every attempt, or with a
  // non-retryable error such as a bad key). The message is generic; provider
  // detail stays in the server log.
  PROVIDER_ERROR: 502,
};

/**
 * HTTP status for a generation error, or null when the error is unexpected and
 * must be reported as a 500. Pure.
 */
function statusForGenerationError(error) {
  return (error && Object.prototype.hasOwnProperty.call(ERROR_STATUS, error.code))
    ? ERROR_STATUS[error.code]
    : null;
}

/**
 * Validate an optional mobilityProfileId from the request body. Pure.
 * Absent (undefined/null/'') means "use the default profile".
 *
 * @returns {{ ok: true, id: number|null } | { ok: false, error: string }}
 */
function parseMobilityProfileId(raw) {
  if (raw === undefined || raw === null || raw === '') return { ok: true, id: null };
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'mobilityProfileId must be a positive integer' };
  }
  return { ok: true, id };
}

async function generate(req, res) {
  // Aborted when the connection closes before we answered (the app timed out
  // or the user left). The service checks it before committing, so a route the
  // user was told had failed is never saved.
  const disconnect = new AbortController();
  const onClose = () => {
    if (!res.writableFinished) disconnect.abort();
  };
  res.on('close', onClose);

  try {
    const { lat, lng, mobilityProfileId, prompt } = req.body || {};

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ error: 'lat and lng are required and must be valid numbers' });
    }

    if (prompt != null && (typeof prompt !== 'string' || prompt.length > 300)) {
      return res.status(400).json({ error: 'prompt must be a string of at most 300 characters' });
    }

    const profileId = parseMobilityProfileId(mobilityProfileId);
    if (!profileId.ok) {
      return res.status(400).json({ error: profileId.error, code: 'INVALID_MOBILITY_PROFILE' });
    }

    const route = await aiRouteService.generateRoute(
      { lat: parsedLat, lng: parsedLng },
      profileId.id,
      prompt ? prompt.trim() : null,
      { signal: disconnect.signal },
    );

    res.status(201).json(route);
  } catch (error) {
    if (error.code === 'CLIENT_DISCONNECTED' || disconnect.signal.aborted) {
      console.warn('AI route generation abandoned: client disconnected, nothing saved');
      return;
    }
    const status = statusForGenerationError(error);
    if (status) {
      return res.status(status).json({ error: error.message, code: error.code });
    }
    console.error('AI route generation error:', error);
    res.status(500).json({ error: 'Failed to generate a route' });
  } finally {
    res.off('close', onClose);
  }
}

module.exports = { getStatus, generate, statusForGenerationError, parseMobilityProfileId, ERROR_STATUS };
