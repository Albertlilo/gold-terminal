function markDashboardStale(data, savedAt, reason = "provider") {
  if (!data || typeof data !== "object") return null;
  const stale = structuredClone(data);
  const warning = reason === "snapshot"
    ? "The data provider failed. Showing the last complete dashboard saved in Atlas; both economic readings and the gold quote may be out of date."
    : "FRED could not refresh. Showing cached economic readings from the last successful provider response; check their observation dates before relying on the macro score.";
  stale.meta = {
    ...stale.meta,
    status: "stale",
    lastProviderSuccessAt: stale.meta?.lastProviderSuccessAt || (savedAt ? new Date(savedAt).toISOString() : null),
    warning,
  };
  if (reason === "snapshot" && stale.market?.xauusd) {
    stale.market.xauusd = {
      ...stale.market.xauusd,
      stale: true,
      fallback: true,
      providerFailed: true,
      status: "fallback",
      priceSource: "saved_dashboard_snapshot",
    };
  }
  return stale;
}

module.exports = { markDashboardStale };
