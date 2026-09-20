const { getGoldSession } = require("./goldSession");

function createMarketSnapshotService({ fetchPrice, readSavedPrice, now = Date.now, session = getGoldSession }) {
  let lastPrice = null, lastAt = null, lastFetch = -Infinity, pending = null;
  let wasClosed = false, closedRead = false, savedPending = null;
  return async function getSnapshot() {
    const state = session(now());
    if (!state.isOpen) {
      wasClosed = true;
      if (lastPrice === null && !closedRead) {
        closedRead = true;
        savedPending = (async () => {
          try {
            const saved = await readSavedPrice();
            if (Number.isFinite(saved?.price) && saved.price > 0) { lastPrice = saved.price; lastAt = saved.time; }
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
          if (session(now()).isOpen) { lastPrice = price; lastAt = new Date(now()).toISOString(); }
        })().finally(() => { pending = null; });
      }
      if (pending) await pending;
    }
    const current = session(now());
    return { xauusd: { symbol: "XAU/USD", price: lastPrice, receivedAt: lastAt,
      marketClosed: !current.isOpen, session: current.label, scheduleEstimated: true,
      stale: lastAt === null || now() - Date.parse(lastAt) > 90000 }, dxy: null };
  };
}
module.exports = { createMarketSnapshotService };
