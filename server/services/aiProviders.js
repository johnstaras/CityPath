// Model access for AI route generation, behind one function.
//
// The provider is Groq, called through its OpenAI-compatible chat-completions
// endpoint with plain fetch — no extra dependency. It was chosen because its
// free tier covers this use entirely and it answers in a couple of seconds.
//
// The function returns the parsed arguments of a single structured proposal
// ({ title, description, stop_poi_ids }). Everything downstream — id
// validation, OSRM routing, the accessibility gate — is independent of the
// model, so the provider cannot change what the app is willing to show a user.

const aiConfig = require('../config/aiConfig');

const MAX_TOKENS = 4096;

// Upper bound on one model round trip. Without it a hung provider holds the
// request open indefinitely (fetch has no default timeout). aiRouteService
// owns the retry policy.
const PROVIDER_TIMEOUT_MS = 30000;

// Tag an error with whether a second attempt could plausibly succeed. Read by
// utils/aiRouteRules.isRetryableProviderError.
function providerError(message, { retryable, status, cause } = {}) {
  const err = new Error(message);
  err.retryable = Boolean(retryable);
  if (status !== undefined) err.status = status;
  if (cause) err.cause = cause;
  return err;
}

const isTransientStatus = status => status === 408 || status === 429 || status >= 500;


// The provider call is bounded by PROVIDER_TIMEOUT_MS and, when the caller
// passes one, also cancelled by its signal (the client disconnected), so an
// abandoned request does not keep a model call running.
function requestSignal(signal) {
  const timeout = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

// Smaller open models frequently ignore tool definitions and return the JSON as
// plain text instead, often fenced. Recover that rather than failing the
// request — the id validation downstream is what protects us either way.
function parseLooseJson(text) {
  if (!text) return null;
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callGroq({ system, message, tool, signal }) {
  const url = `${aiConfig.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  if (aiConfig.apiKey) headers.Authorization = `Bearer ${aiConfig.apiKey}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      signal: requestSignal(signal),
      body: JSON.stringify({
        model: aiConfig.model,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message },
        ],
        tools: [{
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.schema,
          },
        }],
        tool_choice: { type: 'function', function: { name: tool.name } },
      }),
    });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    const code = err.cause?.code;
    // An unresolvable host or invalid URL means a wrong AI_ROUTE_BASE_URL
    // (config), not a blip; resets, refusals and timeouts are retried once.
    const configLike = code === 'ENOTFOUND' || code === 'ERR_INVALID_URL';
    throw providerError(
      timedOut ? `Provider timed out after ${PROVIDER_TIMEOUT_MS} ms` : `Provider unreachable: ${code || err.message}`,
      { retryable: timedOut || !configLike, cause: err },
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw providerError(`Provider returned ${response.status}: ${detail.slice(0, 200)}`, {
      retryable: isTransientStatus(response.status),
      status: response.status,
    });
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw providerError('Provider returned a non-JSON body', { retryable: true });
  }
  const choice = body.choices?.[0]?.message;

  const args = choice?.tool_calls?.[0]?.function?.arguments;
  if (args) {
    try {
      return typeof args === 'string' ? JSON.parse(args) : args;
    } catch {
      throw providerError('Provider returned malformed tool arguments', { retryable: true });
    }
  }

  const loose = parseLooseJson(choice?.content);
  if (loose) return loose;

  throw providerError('Model returned no route proposal', { retryable: true });
}

/**
 * Ask the configured model for one route proposal.
 *
 * @param {{ system: string, message: string, tool: { name: string, description: string, schema: object }, signal?: AbortSignal }} request
 * @returns {Promise<object>} the raw proposal — NOT yet validated against the candidate list
 */
async function proposeRoute(request) {
  return callGroq(request);
}

module.exports = { proposeRoute };
