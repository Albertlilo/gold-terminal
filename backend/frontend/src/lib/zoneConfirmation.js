export const ZONE_LOOKBACK = 20;
export const SETUP_LIFETIME = 10;
export const RETEST_LIFETIME = 10;
export const CONFIRMATION_LIFETIME = 10;
export const RULE_VERSION = "zones-retest-v2";
export const NOISE_PERCENT = 0.1;

export function buildZones(previous) {
  const low = Math.min(...previous.map(row => row.low));
  const high = Math.max(...previous.map(row => row.high));
  const averageRange = previous.reduce((sum, row) => sum + row.high - row.low, 0) / previous.length;
  // Bound the bands so support and resistance cannot overlap.
  const width = Math.min((high - low) / 4, Math.max(averageRange / 4, ((high + low) / 2) * 0.0005));
  return {
    support: { label: "Support zone", low, high: low + width, color: "#70d69c" },
    resistance: { label: "Resistance zone", low: high - width, high, color: "#ef7b7b" },
    buy: high * (1 + NOISE_PERCENT / 100), sell: low * (1 - NOISE_PERCENT / 100),
  };
}

export function confirmZones(completed) {
  let setup = null;
  let zones = null;
  let state = "Between zones";
  let confirmation = "None";
  const clears = (value, level, above) => above ? value > level + level * 1e-12 : value < level - level * 1e-12;
  for (let i = ZONE_LOOKBACK; i < completed.length; i++) {
    const candle = completed[i];
    if (setup) {
      const zone = setup.direction === "buy" ? setup.zones.resistance : setup.zones.support;
      const invalid = setup.direction === "buy" ? candle.close < zone.low : candle.close > zone.high;
      const phaseIndex = setup.confirmedIndex ?? setup.touchedIndex ?? setup.index;
      const phaseLimit = setup.confirmedIndex !== null ? CONFIRMATION_LIFETIME : setup.touchedIndex !== null ? RETEST_LIFETIME : SETUP_LIFETIME;
      if (invalid || i - phaseIndex >= phaseLimit) {
        state = invalid ? "Retest invalidated" : "Setup expired";
        confirmation = "None";
        zones = setup.zones;
        setup = null;
        // Do not simultaneously invalidate and start another setup on the same candle.
        continue;
      }
      zones = setup.zones;
      const touched = candle.low <= zone.high && candle.high >= zone.low;
      const beyond = clears(candle.close, setup.direction === "buy" ? zones.buy : zones.sell, setup.direction === "buy");
      // Record the first later touch. Repeated touches never extend the deadline.
      if (setup.touchedIndex === null && touched) { setup.touchedIndex = i; setup.touchedAt = candle.time; }
      // Recovery can happen on the touch candle or on a later completed candle.
      if (setup.confirmedIndex === null && setup.touchedIndex !== null && beyond) {
        setup.confirmedAt = candle.time; setup.confirmedIndex = i;
      }
      confirmation = setup.confirmedAt && beyond ? (setup.direction === "buy" ? "Buy Watch" : "Sell Watch") : "None";
      state = setup.confirmedAt ? (beyond ? (setup.direction === "buy" ? "Successful retest" : "Failed support retest") : "Confirmation weakened")
        : setup.touchedIndex !== null ? "Pullback developing"
          : setup.direction === "buy" ? "Breakout · awaiting retest" : "Support break · awaiting retest";
      continue;
    }
    zones = buildZones(completed.slice(i - ZONE_LOOKBACK, i));
    confirmation = "None";
    const buy = clears(candle.close, zones.buy, true);
    const sell = clears(candle.close, zones.sell, false);
    if (buy || sell) {
      setup = { direction: buy ? "buy" : "sell", index: i, time: candle.time, zones, touchedIndex: null, touchedAt: null, confirmedAt: null, confirmedIndex: null };
      state = buy ? "Breakout · awaiting retest" : "Support break · awaiting retest";
    } else { state = "Between zones"; }
  }
  const phase = setup?.confirmedIndex !== null && setup?.confirmedIndex !== undefined ? "confirmed" : setup?.touchedIndex !== null && setup?.touchedIndex !== undefined ? "retest" : "waiting";
  const phaseLimit = phase === "confirmed" ? CONFIRMATION_LIFETIME : phase === "retest" ? RETEST_LIFETIME : SETUP_LIFETIME;
  return { zones, state, confirmation, setup: setup ? { direction: setup.direction, breakTime: setup.time, touchedAt: setup.touchedAt, confirmedAt: setup.confirmedAt,
    phase, barsRemaining: phaseLimit - (completed.length - 1 - (setup.confirmedIndex ?? setup.touchedIndex ?? setup.index)) } : null };
}
