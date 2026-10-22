export const ZONE_LOOKBACK = 20;
export const STRUCTURE_LOOKBACK = 120;
export const MIN_ZONE_TOUCHES = 3;
export const SETUP_LIFETIME = 10;
export const RETEST_LIFETIME = 10;
export const CONFIRMATION_LIFETIME = 10;
export const RULE_VERSION = "zones-retest-v14-lower-support";
export const NOISE_PERCENT = 0.05;
const SWING_RADIUS = 2;
// Reactions must be separated by several completed candles. This prevents a
// single choppy move from being counted as a stack of independent touches.
const MIN_TOUCH_SEPARATION = 4;
const MAX_PREVIOUS_ZONES = 6;

function beginReaction(type, index, candle, zones) {
  const supportBounce = type === "support-bounce";
  const zone = supportBounce ? zones.support : zones.resistance;
  const confirmed = supportBounce
    ? candle.close > zone.high && candle.close > candle.open
    : candle.close < zone.low && candle.close < candle.open;
  return {
    setup: { type, direction: supportBounce ? "buy" : "sell", index, time: candle.time, zones,
      touchedIndex: index, touchedAt: candle.time, confirmedAt: confirmed ? candle.time : null,
      confirmedIndex: confirmed ? index : null },
    confirmation: confirmed ? (supportBounce ? "Support Bounce" : "Resistance Rejection") : "None",
    state: supportBounce
      ? (confirmed ? "Support bounce confirmed" : "Support bounce developing")
      : (confirmed ? "Resistance rejection confirmed" : "Resistance rejection developing"),
  };
}

export function buildZones(previous) {
  const rows = previous.slice(-STRUCTURE_LOOKBACK);
  if (rows.length < ZONE_LOOKBACK) return null;
  const recent = rows.slice(-ZONE_LOOKBACK);
  // True range includes gaps as well as each candle's high/low distance.
  const averageRange = recent.reduce((sum, row, i) => {
    const priorClose = i ? recent[i - 1].close : rows[rows.length - recent.length - 1]?.close ?? row.open;
    return sum + Math.max(row.high - row.low, Math.abs(row.high - priorClose), Math.abs(row.low - priorClose));
  }, 0) / recent.length;
  const reference = rows.at(-1).close;
  const mergeDistance = Math.max(averageRange * 0.35, reference * 0.0004);
  const points = [];
  for (let i = SWING_RADIUS; i < rows.length - SWING_RADIUS; i++) {
    const neighbours = rows.slice(i - SWING_RADIUS, i + SWING_RADIUS + 1);
    if (neighbours.every(row => rows[i].low <= row.low)) points.push({ price: rows[i].low, index: i, time: rows[i].time, role: "support" });
    if (neighbours.every(row => rows[i].high >= row.high)) points.push({ price: rows[i].high, index: i, time: rows[i].time, role: "resistance" });
  }
  const clusters = [];
  for (const point of points.sort((a, b) => a.price - b.price)) {
    let cluster = clusters.find(item => item.role === point.role && Math.abs(item.center - point.price) <= mergeDistance);
    if (!cluster) { cluster = { values: [], points: [], center: point.price, role: point.role }; clusters.push(cluster); }
    cluster.values.push(point.price);
    cluster.points.push(point);
    cluster.center = cluster.values.reduce((sum, value) => sum + value, 0) / cluster.values.length;
  }
  const confirmed = clusters.map(cluster => {
    const separated = [];
    for (const point of cluster.points.sort((a, b) => a.index - b.index)) {
      const recovery = rows.slice(point.index + 1, point.index + SWING_RADIUS + 1);
      const departure = Math.max(averageRange * 0.25, reference * 0.0001);
      const reacted = recovery.some(row => cluster.role === "support"
        ? row.close >= point.price + departure : row.close <= point.price - departure);
      if (reacted && (!separated.length || point.index - separated.at(-1).index >= MIN_TOUCH_SEPARATION)) separated.push(point);
    }
    return { ...cluster, touches: separated.length, lastTouch: separated.at(-1)?.time ?? null };
  }).filter(cluster => cluster.touches >= MIN_ZONE_TOUCHES);
  const minimumGap = Math.max(averageRange * 0.2, reference * NOISE_PERCENT / 100);
  const recentLow = Math.min(...recent.map(row => row.low));
  const recentHigh = Math.max(...recent.map(row => row.high));
  const activeMargin = Math.max(averageRange * 2, reference * NOISE_PERCENT / 100);
  // Demand is the lower boundary of the observed range. An internal swing
  // near resistance is not promoted to support while the floor is unconfirmed.
  const lowerBand = recentLow + (recentHigh - recentLow) * 0.35;
  const supportCandidate = confirmed.filter(cluster => cluster.role === "support"
      && cluster.center < reference - minimumGap && cluster.center >= recentLow - activeMargin
      && cluster.center <= lowerBand)
    .sort((a, b) => a.center - b.center || b.touches - a.touches)[0];
  const resistanceCandidate = confirmed.filter(cluster => cluster.role === "resistance"
      && cluster.center > reference + minimumGap && cluster.center <= recentHigh + activeMargin)
    .sort((a, b) => a.center - b.center || b.touches - a.touches)[0];
  if (!supportCandidate && !resistanceCandidate) return null;
  const baseWidth = Math.max(averageRange * 0.2, reference * 0.00025);
  const gap = supportCandidate && resistanceCandidate ? resistanceCandidate.center - supportCandidate.center : null;
  // Do not squeeze the bands to manufacture two tradeable boundaries in chop.
  if (gap !== null && gap <= 2 * baseWidth + minimumGap) return null;
  const width = baseWidth;
  const breakBuffer = Math.max(averageRange * 0.2, reference * NOISE_PERCENT / 100);
  const support = supportCandidate ? { label: "Support zone", low: supportCandidate.center, high: supportCandidate.center + width,
    color: "#70d69c", active: true, touches: supportCandidate.touches, lastTouch: supportCandidate.lastTouch } : null;
  const resistance = resistanceCandidate ? { label: "Resistance zone", low: resistanceCandidate.center - width, high: resistanceCandidate.center,
    color: "#ef7b7b", active: true, touches: resistanceCandidate.touches, lastTouch: resistanceCandidate.lastTouch } : null;
  return { support, resistance, buy: resistance ? resistance.high + breakBuffer : null,
    sell: support ? support.low - breakBuffer : null,
    breakBuffer, averageRange };
}

function sameZone(first, second) {
  if (!first && !second) return true;
  if (!first || !second) return false;
  const width = Math.max(first.high - first.low, second.high - second.low);
  const firstMiddle = (first.low + first.high) / 2;
  const secondMiddle = (second.low + second.high) / 2;
  return Math.abs(firstMiddle - secondMiddle) <= width;
}

function structureState(zones) {
  if (zones?.support && zones?.resistance) return "Between zones";
  if (zones?.support) return "Support confirmed · finding resistance";
  if (zones?.resistance) return "Resistance confirmed · finding support";
  return "Collecting confirmed structure";
}

function archiveChangedZones(history, current, next, time) {
  const archived = [...history];
  for (const role of ["support", "resistance"]) {
    if (sameZone(current?.[role], next?.[role])) continue;
    const zone = current?.[role];
    if (!zone) continue;
    const duplicate = archived.some(item => item.role === role && sameZone(item, zone));
    if (!duplicate) archived.push({ ...zone, id: `${role}-${time}-${zone.low.toFixed(4)}`, role,
      label: `Previous ${role}`, active: false, color: role === "support" ? "#477f60" : "#8a4e4e", retiredAt: time });
  }
  return archived.slice(-MAX_PREVIOUS_ZONES);
}

export function confirmZones(completed) {
  let setup = null;
  let zones = null;
  let previousZones = [];
  let state = "Between zones";
  let confirmation = "None";
  const clears = (value, level, above) => above ? value > level + level * 1e-12 : value < level - level * 1e-12;
  for (let i = ZONE_LOOKBACK; i < completed.length; i++) {
    const candle = completed[i];
    if (!zones) zones = buildZones(completed.slice(0, i));
    if (!zones) { state = "Collecting confirmed structure"; continue; }
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
        // Preserve an actual break when it also invalidates a reaction. The
        // new watch still needs a different, later candle to retest the zone.
        const reactionBreak = invalid && ((supportBounce && clears(candle.close, zones.sell, false))
          || (resistanceRejection && clears(candle.close, zones.buy, true)));
        if (reactionBreak) setup = { direction: supportBounce ? "sell" : "buy", index: i,
          time: candle.time, zones, touchedIndex: null, touchedAt: null, confirmedAt: null, confirmedIndex: null };
        continue;
      }

      // A fresh reaction at the opposite edge supersedes an older reaction.
      // Otherwise a resistance rejection could stay selected while price has
      // already reached and bounced from support (and vice versa).
      if (setup.type === "support-bounce" || setup.type === "resistance-rejection") {
        // Opposite reactions use the same frozen range, not freshly moved levels.
        const reactionZones = setup.zones;
        if (reactionZones) {
          const prior = completed[i - 1];
          const approachingSupport = reactionZones.support && prior.close > reactionZones.support.high
            && candle.low <= reactionZones.support.high && candle.close >= reactionZones.support.low;
          const approachingResistance = reactionZones.resistance && prior.close < reactionZones.resistance.low
            && candle.high >= reactionZones.resistance.low && candle.close <= reactionZones.resistance.high;
          const nextType = setup.type === "resistance-rejection" && approachingSupport ? "support-bounce"
            : setup.type === "support-bounce" && approachingResistance ? "resistance-rejection" : null;
          if (nextType) {
            const next = beginReaction(nextType, i, candle, reactionZones);
            setup = next.setup;
            zones = reactionZones;
            state = next.state;
            confirmation = next.confirmation;
            continue;
          }
        }
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
    confirmation = "None";
    const priorClose = completed[i - 1].close;
    const buy = zones.resistance && !clears(priorClose, zones.buy, true) && clears(candle.close, zones.buy, true);
    const sell = zones.support && !clears(priorClose, zones.sell, false) && clears(candle.close, zones.sell, false);
    if (buy || sell) {
      setup = { direction: buy ? "buy" : "sell", index: i, time: candle.time, zones, touchedIndex: null, touchedAt: null, confirmedAt: null, confirmedIndex: null };
      state = buy ? "Breakout · awaiting retest" : "Support break · awaiting retest";
    } else {
      const prior = completed[i - 1];
      const support = zones.support;
      const approachingSupport = support && prior.close > support.high && candle.low <= support.high && candle.close >= support.low;
      const resistance = zones.resistance;
      const approachingResistance = resistance && prior.close < resistance.low && candle.high >= resistance.low && candle.close <= resistance.high;
      if (approachingSupport && approachingResistance) {
        state = "Conflicting zone touches · wait";
      } else if (approachingSupport) {
        const next = beginReaction("support-bounce", i, candle, zones);
        setup = next.setup;
        confirmation = next.confirmation;
        state = next.state;
      } else if (approachingResistance) {
        const next = beginReaction("resistance-rejection", i, candle, zones);
        setup = next.setup;
        confirmation = next.confirmation;
        state = next.state;
      } else {
        state = structureState(zones);
        // Evaluate this candle against the existing structure before allowing
        // three confirmed swing reactions to introduce a new pair of zones.
        // A recalculation can therefore never hide a break on the same candle.
        const nextZones = buildZones(completed.slice(0, i));
        // Keep an established two-sided range while price is still inside it.
        // Smaller internal swings are not evidence that its boundaries failed.
        const insideEstablishedRange = zones.support && zones.resistance
          && candle.close >= zones.support.low && candle.close <= zones.resistance.high;
        if (!insideEstablishedRange && nextZones && (!sameZone(zones.support, nextZones.support) || !sameZone(zones.resistance, nextZones.resistance))) {
          previousZones = archiveChangedZones(previousZones, zones, nextZones, candle.time);
          zones = nextZones;
          state = structureState(zones);
        }
      }
    }
  }
  const phase = setup?.confirmedIndex !== null && setup?.confirmedIndex !== undefined ? "confirmed" : setup?.touchedIndex !== null && setup?.touchedIndex !== undefined ? "retest" : "waiting";
  const phaseLimit = phase === "confirmed" ? CONFIRMATION_LIFETIME : phase === "retest" ? RETEST_LIFETIME : SETUP_LIFETIME;
  return { zones, previousZones, state, confirmation, setup: setup ? { type: setup.type ?? "break-retest", direction: setup.direction, breakTime: ["support-bounce", "resistance-rejection"].includes(setup.type) ? null : setup.time,
    startTime: setup.time, touchedAt: setup.touchedAt, confirmedAt: setup.confirmedAt,
    phase, barsRemaining: phaseLimit - (completed.length - 1 - (setup.confirmedIndex ?? setup.touchedIndex ?? setup.index)) } : null };
}
