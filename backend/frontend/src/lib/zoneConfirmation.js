export const ZONE_LOOKBACK = 20;
export const SETUP_LIFETIME = 10;
export const RETEST_LIFETIME = 10;
export const CONFIRMATION_LIFETIME = 10;
export const RULE_VERSION = "zones-retest-v5-zone-reactions-technical-only";
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
      const supportBounce = setup.type === "support-bounce";
      const resistanceRejection = setup.type === "resistance-rejection";
      const activeZone = supportBounce ? setup.zones.support : resistanceRejection ? setup.zones.resistance : zone;
      const invalid = supportBounce ? candle.close < activeZone.low
        : resistanceRejection ? candle.close > activeZone.high
        : setup.direction === "buy" ? candle.close < zone.low : candle.close > zone.high;
      const phaseIndex = setup.confirmedIndex ?? setup.touchedIndex ?? setup.index;
      const phaseLimit = setup.confirmedIndex !== null ? CONFIRMATION_LIFETIME : setup.touchedIndex !== null ? RETEST_LIFETIME : SETUP_LIFETIME;
      if (invalid || i - phaseIndex >= phaseLimit) {
        state = invalid ? (supportBounce ? "Support bounce invalidated" : resistanceRejection ? "Resistance rejection invalidated" : "Retest invalidated") : "Setup expired";
        confirmation = "None";
        zones = setup.zones;
        setup = null;
        // Do not simultaneously invalidate and start another setup on the same candle.
        continue;
      }
      zones = setup.zones;
      const touched = candle.low <= activeZone.high && candle.high >= activeZone.low;
      const beyond = clears(candle.close, setup.direction === "buy" ? zones.buy : zones.sell, setup.direction === "buy");
      const reclaimedSupport = candle.close > activeZone.high && candle.close > candle.open;
      const rejectedResistance = candle.close < activeZone.low && candle.close < candle.open;
      // Record the first later touch. Repeated touches never extend the deadline.
      if (setup.touchedIndex === null && touched) { setup.touchedIndex = i; setup.touchedAt = candle.time; }
      // Recovery can happen on the touch candle or on a later completed candle.
      if (setup.confirmedIndex === null && setup.touchedIndex !== null && (supportBounce ? reclaimedSupport : resistanceRejection ? rejectedResistance : beyond)) {
        setup.confirmedAt = candle.time; setup.confirmedIndex = i;
      }
      const holdingConfirmation = supportBounce ? candle.close > activeZone.high : resistanceRejection ? candle.close < activeZone.low : beyond;
      confirmation = setup.confirmedAt && holdingConfirmation ? (supportBounce ? "Support Bounce" : resistanceRejection ? "Resistance Rejection" : setup.direction === "buy" ? "Buy Watch" : "Sell Watch") : "None";
      state = setup.confirmedAt ? (holdingConfirmation ? (supportBounce ? "Support bounce confirmed" : resistanceRejection ? "Resistance rejection confirmed" : setup.direction === "buy" ? "Successful retest" : "Failed support retest") : "Confirmation weakened")
        : setup.touchedIndex !== null ? (supportBounce ? "Support bounce developing" : resistanceRejection ? "Resistance rejection developing" : "Pullback developing")
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
    } else {
      const support = zones.support;
      const prior = completed[i - 1];
      const approachingSupport = prior.close > support.high && candle.low <= support.high && candle.close >= support.low;
      const resistance = zones.resistance;
      const approachingResistance = prior.close < resistance.low && candle.high >= resistance.low && candle.close <= resistance.high;
      if (approachingSupport && approachingResistance) {
        state = "Conflicting zone touches · wait";
      } else if (approachingSupport) {
        setup = { type: "support-bounce", direction: "buy", index: i, time: candle.time, zones,
          touchedIndex: i, touchedAt: candle.time, confirmedAt: null, confirmedIndex: null };
        const reclaimed = candle.close > support.high && candle.close > candle.open;
        if (reclaimed) { setup.confirmedAt = candle.time; setup.confirmedIndex = i; }
        confirmation = reclaimed ? "Support Bounce" : "None";
        state = reclaimed ? "Support bounce confirmed" : "Support bounce developing";
      } else if (approachingResistance) {
        setup = { type: "resistance-rejection", direction: "sell", index: i, time: candle.time, zones,
          touchedIndex: i, touchedAt: candle.time, confirmedAt: null, confirmedIndex: null };
        const rejected = candle.close < resistance.low && candle.close < candle.open;
        if (rejected) { setup.confirmedAt = candle.time; setup.confirmedIndex = i; }
        confirmation = rejected ? "Resistance Rejection" : "None";
        state = rejected ? "Resistance rejection confirmed" : "Resistance rejection developing";
      } else { state = "Between zones"; }
    }
  }
  const phase = setup?.confirmedIndex !== null && setup?.confirmedIndex !== undefined ? "confirmed" : setup?.touchedIndex !== null && setup?.touchedIndex !== undefined ? "retest" : "waiting";
  const phaseLimit = phase === "confirmed" ? CONFIRMATION_LIFETIME : phase === "retest" ? RETEST_LIFETIME : SETUP_LIFETIME;
  return { zones, state, confirmation, setup: setup ? { type: setup.type ?? "break-retest", direction: setup.direction, breakTime: ["support-bounce", "resistance-rejection"].includes(setup.type) ? null : setup.time,
    startTime: setup.time, touchedAt: setup.touchedAt, confirmedAt: setup.confirmedAt,
    phase, barsRemaining: phaseLimit - (completed.length - 1 - (setup.confirmedIndex ?? setup.touchedIndex ?? setup.index)) } : null };
}
