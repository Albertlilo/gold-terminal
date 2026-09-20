const SYMBOL = "XAU/USD";
const INTERVALS = ["5min", "1h", "1day"];
const PAGE_SIZE = 500;
const REFRESH_MS = 5 * 60 * 1000;

function normalizeCandles(values) {
  if (!Array.isArray(values)) throw new Error("Invalid candle response");
  const byTime = new Map();
  for (const row of values) {
    const stamp = /^\d{4}-\d{2}-\d{2}$/.test(row.datetime)
      ? `${row.datetime}T00:00:00Z`
      : `${String(row.datetime).replace(" ", "T")}Z`;
    const candle = {
      time: Date.parse(stamp) / 1000,
      open: Number(row.open), high: Number(row.high),
      low: Number(row.low), close: Number(row.close),
    };
    if (!Object.values(candle).every(value => Number.isFinite(value) && value > 0)
      || !Number.isInteger(candle.time)
      || candle.high < Math.max(candle.open, candle.close)
      || candle.low > Math.min(candle.open, candle.close)) {
      throw new Error("Invalid candle values");
    }
    byTime.set(candle.time, candle);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

// Dependencies are injected so persistence, retries and paging can be tested offline.
function createHistoryService({ store, fetchCandles, now = Date.now, canRefresh = () => true }) {
  const requests = new Map();
  return async function getHistory(interval = "5min", before) {
    if (!INTERVALS.includes(interval)
      || (before !== undefined && (!Number.isSafeInteger(before) || before <= 0 || before > now() / 1000))) {
      const error = new Error("Choose 5min, 1h or 1day and a valid history timestamp.");
      error.status = 400;
      throw error;
    }
    // A successful read is required: never describe volatile history as saved.
    let candles = await store.read(interval, before, PAGE_SIZE);
    const key = `${interval}:${before ?? "latest"}`;
    // Refresh requested pages as well as the latest page, so long periods offline
    // can be backfilled instead of silently jumping across a gap in stored data.
    const shouldRefresh = canRefresh();
    let state = requests.get(key);
    if (shouldRefresh && (!state || (!state.pending && now() - state.startedAt >= (state.warning ? 15000 : REFRESH_MS)))) {
      if (requests.size >= 40) {
        for (const [oldKey, value] of requests) {
          if (!value.pending) requests.delete(oldKey);
          if (requests.size < 40) break;
        }
      }
      if (requests.size >= 40) {
        const error = new Error("History is busy. Please try again shortly.");
        error.status = 429;
        throw error;
      }
      state = { startedAt: now(), pending: true, warning: null, refreshedAt: null };
      state.promise = (async () => {
        try {
          const fresh = await fetchCandles(interval, before);
          if (fresh.length && canRefresh()) await store.save(interval, fresh);
          state.refreshedAt = new Date(now()).toISOString();
        } catch {
          state.warning = "Could not refresh candles. Showing saved history; check the data plan, API quota and database connection.";
        } finally {
          state.pending = false;
        }
      })();
      requests.set(key, state);
    }
    // Return saved data immediately; the next request can pick up refreshed data.
    // Only first-time/empty pages need to wait for the provider.
    if (!candles.length && state) {
      await state.promise;
      candles = await store.read(interval, before, PAGE_SIZE);
    }
    if (!candles.length && state?.warning) {
      const error = new Error("Candle history is unavailable. Check Twelve Data historical access and Atlas configuration.");
      error.status = 503;
      throw error;
    }
    return {
      symbol: SYMBOL, interval, candles, saved: true,
      refreshedAt: state?.refreshedAt ?? null,
      refreshing: shouldRefresh && (state?.pending ?? false),
      warning: !shouldRefresh ? "Market closed by the selected session schedule. Showing saved candles; provider refresh is paused." : state?.warning ?? null,
      // An empty older page is the definitive end of available history.
      hasMore: candles.length > 0,
    };
  };
}

module.exports = { SYMBOL, INTERVALS, PAGE_SIZE, normalizeCandles, createHistoryService };
