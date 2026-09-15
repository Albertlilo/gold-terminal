// One shared cache and paced queue per server process, rather than per visitor.
function createFredRequestCache({ request, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), ttlMs = 600000, spacingMs = 700, log = console.warn }) {
  const cache = new Map();
  const pending = new Map();
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
    const promise = (async () => {
      // Reserve a start slot; HTTP responses need not complete serially.
      const slot = queue.then(async () => {
        if (now() < blockedUntil) throw lastFailure;
        await sleep(Math.max(0, nextStart - now()));
        if (now() < blockedUntil) throw lastFailure;
        nextStart = now() + spacingMs;
      });
      queue = slot.catch(() => {});
      await slot;
      try {
        const data = await request(seriesId, limit);
        if (!Array.isArray(data) || !data.length) throw new Error('Invalid observations');
        if (cache.size >= 200) cache.delete(cache.keys().next().value);
        cache.set(key, { data, at: now() });
        return data;
      } catch (error) {
        const status = Number(error.response?.status) || 0;
        const retryHeader = error.response?.headers?.['retry-after'];
        const retrySeconds = Number(retryHeader);
        const retryDate = Date.parse(retryHeader);
        const retryMs = Number.isFinite(retrySeconds) && retrySeconds > 0
          ? retrySeconds * 1000 : Number.isFinite(retryDate) ? Math.max(0, retryDate - now()) : 0;
        const cooldown = Math.max(retryMs, status === 403 ? 900000 : 60000);
        const providerText = typeof error.response?.data === 'string'
          ? error.response.data : String(error.response?.data?.error_message || '');
        const category = /api.?key.*(invalid|registered|set)|invalid.*api.?key/i.test(providerText)
          ? 'api_key_rejected' : /access denied|blocked|forbidden/i.test(providerText)
          ? 'access_blocked' : status === 429 ? 'rate_limit' : 'upstream_failure';
        const message = status === 403
          ? 'FRED refused economic-data access (403). Requests are paused for 15 minutes or the provider-requested delay. This is not an Atlas password error.'
          : status === 429 ? 'FRED rate limit reached. Economic-data requests are temporarily paused.'
          : status === 400 || status === 401 ? 'FRED rejected the request. Check the server API key and request configuration.'
          : 'Economic data is temporarily unavailable. Please retry shortly.';
        lastFailure = failure(message, status, cooldown);
        blockedUntil = Math.max(blockedUntil, now() + cooldown);
        // Never log Axios error objects, request URLs, response bodies, or API keys.
        log('FRED request failed', { status, seriesId, category, responseType: typeof error.response?.data, retrySeconds: Math.ceil(cooldown / 1000) });
        throw lastFailure;
      }
    })();
    pending.set(key, promise);
    try { return await promise; }
    finally { pending.delete(key); }
  }
  return { load };
}

module.exports = { createFredRequestCache };
