// The switch for live, per-user AI route generation.
//
// The feature is live only when BOTH hold:
//   1. AI_ROUTE_GENERATION is explicitly 'on'  — the operator opted in
//   2. a provider key is present
//
// Defaulting to off matters: the 100-route catalogue in the database was
// produced offline by scripts/seed-ai-routes.js and needs no credentials at
// all, so a checkout with no keys still runs the full app, still shows every
// generated route, and simply does not offer the "generate one for me" action.
// The mobile client asks GET /api/routes/ai/status and hides the button when
// this returns disabled, so a missing key is never an error a user sees.
//
// ── Provider ─────────────────────────────────────────────────────────────
//
// One provider: Groq, through its OpenAI-compatible chat-completions endpoint.
// It was chosen for a student project because its free tier covers this use
// entirely — route curation is a few thousand input tokens and a short reply —
// and because it is fast enough (~1.7 s per route) for the loading state the
// mobile screen already has.
//
//     AI_ROUTE_GENERATION=on
//     AI_ROUTE_API_KEY=gsk_...
//     AI_ROUTE_MODEL=openai/gpt-oss-120b        (optional, this is the default)
//     AI_ROUTE_BASE_URL=https://api.groq.com/openai/v1   (optional, the default)
//
// Groq retires model ids on its own schedule. If generation starts failing,
// run `node scripts/try-ai-provider.js --list` to see what it serves today.
//
// Because the endpoint is the OpenAI-compatible one, any other service
// speaking the same shape works by overriding AI_ROUTE_BASE_URL — but Groq is
// what the project documents, tests and demonstrates.
//
// The provider cannot affect what the app is willing to show: the returned ids
// are validated against the candidate list, OSRM computes the real path, and
// the accessibility scorer gates the result — all downstream of the model.

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

const model = process.env.AI_ROUTE_MODEL || DEFAULT_MODEL;
const baseUrl = process.env.AI_ROUTE_BASE_URL || DEFAULT_BASE_URL;
const apiKey = process.env.AI_ROUTE_API_KEY || '';

const flagOn = String(process.env.AI_ROUTE_GENERATION || 'off').toLowerCase() === 'on';
const hasCredentials = Boolean(apiKey);

function describeMissing() {
  if (!flagOn) return 'AI_ROUTE_GENERATION is not set to "on"';
  return 'AI_ROUTE_API_KEY is not set';
}

module.exports = {
  provider: 'groq',
  model,
  baseUrl,
  apiKey,
  flagOn,
  hasCredentials,
  enabled: flagOn && hasCredentials,

  // Why the feature is off, for the /status endpoint and the server log. Never
  // surfaced to end users as-is — the client shows its own copy.
  disabledReason: flagOn && hasCredentials ? null : describeMissing(),
};
