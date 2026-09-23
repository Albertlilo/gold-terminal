const { createHash } = require("node:crypto");
const RULE_VERSION = "zones-retest-v1";

function createSignalAuditService({ analyse, plan, store, now = Date.now, macro = () => null, session }) {
  const cache = new Map();
  return async function record(interval, rows) {
    const observedAt = now();
    const analysis = analyse(rows, interval, observedAt);
    if (!analysis.ready) return { status: "collecting", analysis };
    const completed = rows.filter(row => row.time <= analysis.lastTime);
    const inputHash = createHash("sha256").update(JSON.stringify(completed)).digest("hex");
    const key = `${RULE_VERSION}:${interval}:${analysis.lastTime}`;
    const cached = cache.get(interval);
    if (cached?.key === key && cached.inputHash === inputHash && (cached.saved || observedAt - cached.at < 30000)) return cached.promise;
    const context = macro();
    const macroFresh = Boolean(context && observedAt >= Date.parse(context.observedAt) && observedAt - Date.parse(context.observedAt) <= 90000);
    const marketSession = session(observedAt);
    const event = { key, ruleVersion: RULE_VERSION, interval, candleTime: analysis.lastTime,
      observedAt: new Date(observedAt).toISOString(), inputHash, analysis,
      macro: macroFresh ? context : null,
      combinedSignal: plan?.(context?.bias, analysis, { isOpen: marketSession.isOpen, macroFresh }).signal ?? "Not recorded",
      session: marketSession, inputWindow: completed.slice(-31) };
    const entry = { key, inputHash, at: observedAt, saved: false };
    entry.promise = (async () => { try {
      const saved = await store.insertOnce(event);
      const recent = await store.recent(interval, 8);
      entry.saved = true;
      return { status: "saved", analysis: saved.analysis, observedAt: saved.observedAt,
        ruleVersion: RULE_VERSION, revisedInput: saved.inputHash !== inputHash,
        macro: saved.macro, recent };
    } catch {
      return { status: "unavailable", analysis, warning: "Signal audit storage could not be verified. Treat this calculation as provisional." };
    } })();
    cache.set(interval, entry);
    return entry.promise;
  };
}
module.exports = { createSignalAuditService, RULE_VERSION };
