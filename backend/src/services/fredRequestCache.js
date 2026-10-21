// One shared cache and paced queue per server process, rather than per visitor.
function createFredRequestCache({ request, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), ttlMs = 600000, staleTtlMs = 72 * 60 * 60 * 1000, spacingMs = 700, log = console.warn }) {
  const cache = new Map();
  const pending = new Map();
  const staleResults = new WeakSet();
  const staleLogTimes = new Map();
  let queue = Promise.resolve();
  let nextStart = 0;
  let blockedUntil = 0;
  let lastFailure;

  function failure(message, status, retryMs) {
    const error = new Error(message);
    error.upstreamStatus = status;
    error.retryAfter = Math.ceil(retryMs / 1000);
    return error;
  }

  async function load(seriesId, limit = 10) {
    const key = `${seriesId}:${limit}`;
    const saved = cache.get(key);
    if (saved && now() - saved.at < ttlMs) return saved.data;
    if (pending.has(key)) return pending.get(key);
    const useStaleOrThrow = error => {
      const ageMs = saved ? now() - saved.at : Infinity;
      if (saved && ageMs <= staleTtlMs) {
        staleResults.add(saved.data);
        if (now() - (staleLogTimes.get(key) ?? -Infinity) >= 10 * 60 * 1000) {
          staleLogTimes.set(key, now());
          log('Serving cached FRED data after refresh failure', {
            seriesId, ageMinutes: Math.floor(ageMs / 60000),
          });
        }
        return saved.data;
      }
      throw error;
    };
    const promise = (async () => {
      // Reserve a start slot; HTTP responses need not complete serially.
      const slot = queue.then(async () => {
        if (now() < blockedUntil) throw lastFailure;
        await sleep(Math.max(0, nextStart - now()));
        if (now() < blockedUntil) throw lastFailure;
        nextStart = now() + spacingMs;
      });
      queue = slot.catch(() => {});
      try {
        await slot;
        const data = await request(seriesId, limit);
        if (!Array.isArray(data) || !data.length) {
          const error = new Error('FRED returned an invalid observations payload');
          error.code = 'FRED_INVALID_RESPONSE';
          throw error;
        }
        if (cache.size >= 200) cache.delete(cache.keys().next().value);
        cache.set(key, { data, at: now() });
        return data;
      } catch (error) {
        // A shared provider cooldown can reject queued requests without making
        // a new upstream call. Reuse recent saved observations when available.
        if (error === lastFailure && now() < blockedUntil) return useStaleOrThrow(error);
        const status = Number(error.response?.status ?? error.upstreamStatus) || 0;
        const retryHeader = error.response?.headers?.['retry-after'];
        const retrySeconds = Number(retryHeader);
        const retryDate = Date.parse(retryHeader);
        const retryMs = Number.isFinite(retrySeconds) && retrySeconds > 0
          ? retrySeconds * 1000 : Number.isFinite(retryDate) ? Math.max(0, retryDate - now()) : 0;
        const cooldown = Math.max(retryMs, status === 403 ? 900000 : 60000);
        const providerText = typeof error.response?.data === 'string'
          ? error.response.data : String(error.response?.data?.error_message || '');
        const category = error.code === 'FRED_API_KEY_MISSING' ? 'configuration_missing'
          : error.code === 'FRED_INVALID_RESPONSE' ? 'invalid_response'
          : /api.?key.*(invalid|registered|set)|invalid.*api.?key/i.test(providerText)
          ? 'api_key_rejected' : /access denied|blocked|forbidden/i.test(providerText)
          ? 'access_blocked' : status === 429 ? 'rate_limit' : 'upstream_failure';
        const message = error.code === 'FRED_API_KEY_MISSING'
          ? 'FRED API key is not configured on the server. Check the FRED_API_KEY environment variable.'
          : error.code === 'FRED_INVALID_RESPONSE'
          ? 'FRED returned an unexpected data response. Economic data is temporarily unavailable.'
          : status === 403
          ? 'FRED refused economic-data access (403). Requests are paused for 15 minutes or the provider-requested delay. This is not an Atlas password error.'
          : status === 429 ? 'FRED rate limit reached. Economic-data requests are temporarily paused.'
          : status === 400 || status === 401 ? 'FRED rejected the request. Check the server API key and request configuration.'
          : 'Economic data is temporarily unavailable. Please retry shortly.';
        lastFailure = failure(message, status, cooldown);
        blockedUntil = Math.max(blockedUntil, now() + cooldown);
        // Log only a small allow-listed diagnostic; never log Axios objects,
        // request URLs, raw messages, response bodies, or API keys.
        const codeCandidate = error.code ?? error.cause?.code ?? error.cause?.cause?.code;
        const safeCode = typeof codeCandidate === 'string' && /^[A-Z0-9_]{2,40}$/.test(codeCandidate)
          ? codeCandidate : undefined;
        const causeCode = error.cause?.code;
        const safeCauseCode = typeof causeCode === 'string' && /^[A-Z0-9_]{2,40}$/.test(causeCode)
          && causeCode !== safeCode ? causeCode : undefined;
        const nameCandidate = error.name ?? error.cause?.name;
        const safeName = typeof nameCandidate === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(nameCandidate)
          ? nameCandidate : 'UnknownError';
        const diagnosticText = String(error.message ?? '').toLowerCase();
        const failureKind = error.code === 'FRED_INVALID_RESPONSE' ? 'invalid_payload'
          : /timed? ?out|timeout|time out/.test(diagnosticText) || ['ETIMEDOUT', 'ECONNABORTED'].includes(safeCode) ? 'timeout'
          : ['ENOTFOUND', 'EAI_AGAIN'].includes(safeCode) ? 'dns'
          : ['ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH'].includes(safeCode) ? 'connection'
          : /certificate|tls|ssl/.test(diagnosticText) || /CERT|TLS|SSL/.test(safeCode ?? '') ? 'tls'
          : status > 0 ? 'http_response' : 'unknown';
        log('FRED request failed', {
          status,
          seriesId,
          category,
          failureKind,
          errorName: safeName,
          networkCode: safeCode,
          causeCode: safeCauseCode,
          payloadType: error.payloadType,
          payloadKeys: error.payloadKeys,
          retrySeconds: Math.ceil(cooldown / 1000),
        });
        return useStaleOrThrow(lastFailure);
      }
    })();
    pending.set(key, promise);
    try { return await promise; }
    finally { pending.delete(key); }
  }
  return { load, wasStale: data => Array.isArray(data) && staleResults.has(data) };
}

module.exports = { createFredRequestCache };
