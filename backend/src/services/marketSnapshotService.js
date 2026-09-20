const { getGoldSession } = require("./goldSession");

function savedCandleQuote(rows, now = Date.now()) {
  const last = rows.filter(row => Number.isFinite(row.time) && row.time > 0 && row.time + 300 <= now / 1000 && Number.isFinite(row.close) && row.close > 0)
    .sort((a, b) => a.time - b.time).at(-1);
  return last ? { price: last.close, time: new Date((last.time + 300) * 1000).toISOString() } : null;
}

function createMarketSnapshotService({ fetchPrice, readSavedPrice, now = Date.now, session = getGoldSession }) {
  let lastPrice = null, lastAt = null, lastFetch = -Infinity, pending = null;
  let wasClosed = false, closedRead = false, savedPending = null, priceSource = null;
  return async function getSnapshot() {
    const state = session(now());
    if (!state.isOpen) {
      wasClosed = true;
      if (lastPrice === null && !closedRead) {
        closedRead = true;
        savedPending = (async () => {
          try {
            const saved = await readSavedPrice();
            if (Number.isFinite(saved?.price) && saved.price > 0) { lastPrice = saved.price; lastAt = saved.time; priceSource = "saved_candle"; }
          } catch { /* No saved quote is better than an invented closed-market price. */ }
        })();
      }
      if (savedPending) await savedPending;
    } else {
      closedRead = false;
      if (wasClosed) { lastFetch = -Infinity; wasClosed = false; }
      if (!pending && now() - lastFetch >= 30000) {
        lastFetch = now();
        pending = (async () => {
          const price = await fetchPrice();
          if (!Number.isFinite(price) || price <= 0) throw new Error("Gold quote unavailable");
          // A response arriving after the close must not move the frozen price.
          if (session(now()).isOpen) { lastPrice = price; lastAt = new Date(now()).toISOString(); priceSource = "quote"; }
        })().finally(() => { pending = null; });
      }
      if (pending) await pending;
    }
    const current = session(now());
    return { xauusd: { symbol: "XAU/USD", price: lastPrice, receivedAt: lastAt, priceSource,
      marketClosed: !current.isOpen, session: current.label, scheduleEstimated: true,
      stale: lastAt === null || now() - Date.parse(lastAt) > 90000 }, dxy: null };
  };
}
module.exports = { createMarketSnapshotService, savedCandleQuote };
