export const ZONE_LOOKBACK = 20;
export const STRUCTURE_LOOKBACK = 120;
export const MIN_ZONE_TOUCHES = 3;
export const SETUP_LIFETIME = 10;
export const RETEST_LIFETIME = 10;
export const CONFIRMATION_LIFETIME = 10;
import { historicalSupports } from "./historicalSupport.js";
import { analyzeMarketStructure } from "./marketStructure.js";
import { assessTechnicalRisk } from "./technicalRisk.js";

export const RULE_VERSION = "zones-structure-risk-v18";
export const NOISE_PERCENT = 0.05;
export const DEFAULT_TECHNICAL_CONFIG = Object.freeze({ breakAtrMultiplier: 0.2, minimumBreakPercent: 0.0005, minRewardRisk: 1.5, enforceRisk: true });
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

export function buildZones(previous, config = DEFAULT_TECHNICAL_CONFIG) {
  const rows = previous.slice(-STRUCTURE_LOOKBACK);
  if (rows.length < ZONE_LOOKBACK) return null;
  const recent = rows.slice(-ZONE_LOOKBACK);
  // True range includes gaps as well as each candle's high/low distance.
  const averageRange = recent.reduce((sum, row, i) => {
    const priorClose = i ? recent[i - 1].close : rows[rows.length - recent.length - 1]?.close ?? row.open;
    return sum + Math.max(row.high - row.low, Math.abs(row.high - priorClose), Math.abs(row.low - priorClose));
  }, 0) / recent.length;
  const atrRows = rows.slice(-14);
  const atr = atrRows.reduce((sum, row, i) => {
    const priorClose = i ? atrRows[i - 1].close : rows[rows.length - atrRows.length - 1]?.close ?? row.open;
    return sum + Math.max(row.high - row.low, Math.abs(row.high - priorClose), Math.abs(row.low - priorClose));
  }, 0) / atrRows.length;
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
  const assessed = clusters.map(cluster => {
    const separated = [];
    for (const point of cluster.points.sort((a, b) => a.index - b.index)) {
      const recovery = rows.slice(point.index + 1, point.index + SWING_RADIUS + 1);
      const departure = Math.max(averageRange * 0.25, reference * 0.0001);
      const reacted = recovery.some(row => cluster.role === "support"
        ? row.close >= point.price + departure : row.close <= point.price - departure);
      if (reacted && (!separated.length || point.index - separated.at(-1).index >= MIN_TOUCH_SEPARATION)) separated.push(point);
    }
    return { ...cluster, touches: separated.length, lastTouch: separated.at(-1)?.time ?? null,
      lastTouchIndex: separated.at(-1)?.index ?? null };
  });
  const confirmed = assessed.filter(cluster => cluster.touches >= MIN_ZONE_TOUCHES);
  const minimumGap = Math.max(averageRange * 0.2, reference * NOISE_PERCENT / 100);
  const recentLow = Math.min(...recent.map(row => row.low));
  const recentHigh = Math.max(...recent.map(row => row.high));
  const activeMargin = Math.max(averageRange * 2, reference * NOISE_PERCENT / 100);
  // Demand is the lower boundary of the observed range. An internal swing
  // near resistance is not promoted to support while the floor is unconfirmed.
  const lowerBand = recentLow + (recentHigh - recentLow) * 0.35;
  const supportCandidate = assessed.filter(cluster => cluster.role === "support"
      && cluster.touches >= 2
      && cluster.center < reference - minimumGap && cluster.center >= recentLow - activeMargin
      && cluster.center <= lowerBand
      // A new floor may qualify after two separated swing reactions when a
      // completed bullish candle returns from it. A later close through the
      // floor cancels it, so an untested dip cannot become active support.
      && recent.slice(-3).some(row => row.low <= cluster.center + minimumGap
        && row.close > cluster.center + minimumGap && row.close > row.open)
      && !rows.some((row, index) => index > cluster.lastTouchIndex
        && row.close < cluster.center - minimumGap))
    .sort((a, b) => a.center - b.center || b.touches - a.touches)[0];
  // If the recent candles have not formed a floor, check older, independently
  // tested lows near the current range. Broken or distant history stays inactive.
  const historicalFloor = !supportCandidate && historicalSupports(previous.slice(-500), 2)
    .filter(zone => zone.high < reference - minimumGap
      && Math.abs(zone.low - recentLow) <= Math.max(averageRange * 1.5, reference * 0.001)
      && (zone.touches >= MIN_ZONE_TOUCHES || recent.slice(-3).some(row => row.low <= zone.high + minimumGap
        && row.close > zone.high && row.close > row.open))
      && !previous.some(row => row.time > zone.lastTime && row.close < zone.low - minimumGap))
    .sort((a, b) => Math.abs(a.low - recentLow) - Math.abs(b.low - recentLow) || b.touches - a.touches)[0];
  const formingSupportCandidate = !supportCandidate && !historicalFloor
    ? assessed.filter(cluster => cluster.role === "support" && cluster.touches >= 1
      && cluster.lastTouchIndex >= rows.length - ZONE_LOOKBACK
      && cluster.center < reference - minimumGap && cluster.center >= recentLow - activeMargin
      && cluster.center <= lowerBand
      && recent.slice(-3).some(row => row.low <= cluster.center + minimumGap
        && row.close > cluster.center + minimumGap && row.close > row.open)
      && !rows.some((row, index) => index > cluster.lastTouchIndex
        && row.close < cluster.center - minimumGap))
      .sort((a, b) => a.center - b.center || b.touches - a.touches)[0]
    : null;
  const resistanceCandidate = confirmed.filter(cluster => cluster.role === "resistance"
      && cluster.center > reference + minimumGap && cluster.center <= recentHigh + activeMargin)
    .sort((a, b) => a.center - b.center || b.touches - a.touches)[0];
  if (!supportCandidate && !historicalFloor && !formingSupportCandidate && !resistanceCandidate) return null;
  const baseWidth = Math.max(averageRange * 0.2, reference * 0.00025);
  const supportPrice = supportCandidate?.center ?? historicalFloor?.low;
  const gap = supportPrice && resistanceCandidate ? resistanceCandidate.center - supportPrice : null;
  // Do not squeeze the bands to manufacture two tradeable boundaries in chop.
  if (gap !== null && gap <= 2 * baseWidth + minimumGap) return null;
  const width = baseWidth;
  const breakBuffer = Math.max(atr * config.breakAtrMultiplier, reference * config.minimumBreakPercent);
  const identifiedAt = rows.at(-1).time;
  const support = supportPrice ? { label: "Support zone", low: supportPrice, high: supportPrice + width,
    color: "#70d69c", active: true, touches: supportCandidate?.touches ?? historicalFloor.touches,
    lastTouch: supportCandidate?.lastTouch ?? historicalFloor.lastTime,
    source: supportCandidate ? "recent" : "older_history", role: "support", status: "active", identifiedAt, statusAt: identifiedAt } : null;
  const formingSupport = !support && formingSupportCandidate ? { label: "Potential support · forming",
    low: formingSupportCandidate.center, high: formingSupportCandidate.center + width,
    color: "#70d69c", active: false, touches: formingSupportCandidate.touches,
    lastTouch: formingSupportCandidate.lastTouch, source: "forming", role: "support", status: "forming", identifiedAt, statusAt: identifiedAt } : null;
  const resistance = resistanceCandidate ? { label: "Resistance zone", low: resistanceCandidate.center - width, high: resistanceCandidate.center,
    color: "#ef7b7b", active: true, touches: resistanceCandidate.touches, lastTouch: resistanceCandidate.lastTouch,
    role: "resistance", status: "active", identifiedAt, statusAt: identifiedAt } : null;
  const targetZones = assessed.filter(cluster => cluster.touches >= MIN_ZONE_TOUCHES).map(cluster => {
    const halfWidth = Math.max(averageRange * 0.2, reference * 0.00025);
    const supportRole = cluster.role === "support";
    const active = supportRole ? cluster === supportCandidate : cluster === resistanceCandidate;
    const title = `${cluster.role[0].toUpperCase()}${cluster.role.slice(1)}`;
    const zone = { role: cluster.role, label: active ? `${title} zone` : `Previous ${cluster.role}`, low: supportRole ? cluster.center : cluster.center - halfWidth,
      high: supportRole ? cluster.center + halfWidth : cluster.center, touches: cluster.touches,
      identifiedAt: active ? identifiedAt : rows[Math.min(cluster.lastTouchIndex + SWING_RADIUS, rows.length - 1)].time,
      status: active ? "active" : "previous", active };
    const crossed = rows.some((row, index) => index > cluster.lastTouchIndex
      && (supportRole ? row.close < zone.low - breakBuffer : row.close > zone.high + breakBuffer));
    return crossed ? null : zone;
  }).filter(Boolean);
  return { support, formingSupport, resistance, buy: resistance ? resistance.high + breakBuffer : null,
    sell: support ? support.low - breakBuffer : null,
    breakBuffer, averageRange, atr, targets: targetZones };
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

function archiveChangedZones(history, current, next, time, candle) {
  const archived = [...history];
  for (const role of ["support", "resistance"]) {
    if (sameZone(current?.[role], next?.[role])) continue;
    const zone = current?.[role];
    if (!zone) continue;
    const duplicate = archived.some(item => item.role === role && sameZone(item, zone));
    if (!duplicate) {
      const broke = role === "support" ? candle.close < zone.low : candle.close > zone.high;
      const cleared = role === "support" ? candle.close < zone.low - current.breakBuffer : candle.close > zone.high + current.breakBuffer;
      const status = cleared ? "broken" : broke ? "invalidated" : "previous";
      const displayLabel = status === "broken" ? `Broken ${role}`
        : status === "invalidated" ? `Invalidated ${role}` : `Previous ${role}`;
      archived.push({ ...zone, id: `${role}-${time}-${zone.low.toFixed(4)}`, role,
        label: `Previous ${role}`, displayLabel, active: false, status, statusAt: time,
        statusReason: status === "previous" ? "Replaced by newer confirmed structure" : `Completed close ${cleared ? "cleared" : "crossed"} the zone`,
        color: role === "support" ? "#477f60" : "#8a4e4e", retiredAt: time });
    }
  }
  return archived.slice(-MAX_PREVIOUS_ZONES);
}

export function confirmZones(completed, config = DEFAULT_TECHNICAL_CONFIG) {
  let setup = null;
  let zones = null;
  let previousZones = [];
  let state = "Between zones";
  let confirmation = "None";
  const clears = (value, level, above) => above ? value > level + level * 1e-12 : value < level - level * 1e-12;
  for (let i = ZONE_LOOKBACK; i < completed.length; i++) {
    const candle = completed[i];
    if (!zones) zones = buildZones(completed.slice(0, i), config);
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
        if (invalid) {
          const role = supportBounce ? "support" : "resistance";
          zones = { ...zones, [role]: { ...zones[role], active: false, status: reactionBreak ? "broken" : "invalidated",
            displayLabel: `${reactionBreak ? "Broken" : "Invalidated"} ${role}`, statusAt: candle.time,
            statusReason: "Completed candle closed through the zone boundary" } };
        }
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
    // Preserve established trigger boundaries while refreshing only volatility
    // and known opposing targets from the historical prefix available now.
    // This lets risk filtering see already-known supply/demand without moving
    // the watched level or reading a later candle.
    const targetContext = buildZones(completed.slice(0, i), config);
    if (targetContext && zones) zones = { ...zones, targets: targetContext.targets, atr: targetContext.atr };
    const priorClose = completed[i - 1].close;
    const buy = zones.resistance && !clears(priorClose, zones.buy, true) && clears(candle.close, zones.buy, true);
    const sell = zones.support && !clears(priorClose, zones.sell, false) && clears(candle.close, zones.sell, false);
    if (buy || sell) {
      const brokenRole = buy ? "resistance" : "support";
      const brokenZone = zones[brokenRole];
      const markedZones = { ...zones, [brokenRole]: { ...brokenZone, active: false, status: "broken",
        displayLabel: `Broken ${brokenRole}`, statusAt: candle.time, statusReason: "Closed beyond the volatility-adjusted break trigger" } };
      setup = { direction: buy ? "buy" : "sell", index: i, time: candle.time, zones: markedZones, touchedIndex: null, touchedAt: null, confirmedAt: null, confirmedIndex: null };
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
        const nextZones = buildZones(completed.slice(0, i), config);
        // Keep an established two-sided range while price is still inside it.
        // Smaller internal swings are not evidence that its boundaries failed.
        const insideEstablishedRange = zones.support && zones.resistance
          && candle.close >= zones.support.low && candle.close <= zones.resistance.high;
        const changed = !nextZones || !sameZone(zones.support, nextZones.support)
          || !sameZone(zones.resistance, nextZones.resistance)
          || !sameZone(zones.formingSupport, nextZones.formingSupport);
        if (!insideEstablishedRange && changed) {
          previousZones = archiveChangedZones(previousZones, zones, nextZones, candle.time, candle);
          zones = nextZones;
          state = structureState(zones);
        }
      }
    }
  }
  let risk = null;
  if (config.enforceRisk && setup?.confirmedIndex !== null && setup?.confirmedIndex !== undefined && confirmation !== "None") {
    risk = assessTechnicalRisk({ setup, zones: setup.zones,
      entry: completed.at(-1)?.close, atr: setup.zones.atr, breakBuffer: setup.zones.breakBuffer, minRewardRisk: config.minRewardRisk });
    if (!risk.qualified) {
      confirmation = "None";
      state = risk.reason.includes("minimum") ? "Risk filter · reward below minimum" : "Risk filter · no structural target";
    }
  }
  const phase = risk && !risk.qualified ? "risk-rejected" : setup?.confirmedIndex !== null && setup?.confirmedIndex !== undefined ? "confirmed" : setup?.touchedIndex !== null && setup?.touchedIndex !== undefined ? "retest" : "waiting";
  const phaseLimit = phase === "confirmed" ? CONFIRMATION_LIFETIME : phase === "retest" ? RETEST_LIFETIME : SETUP_LIFETIME;
  return { zones, previousZones, state, confirmation, risk, marketStructure: analyzeMarketStructure(completed), setup: setup ? { type: setup.type ?? "break-retest", direction: setup.direction, breakTime: ["support-bounce", "resistance-rejection"].includes(setup.type) ? null : setup.time,
    startTime: setup.time, touchedAt: setup.touchedAt, confirmedAt: setup.confirmedAt,
    phase, barsRemaining: phaseLimit - (completed.length - 1 - (setup.confirmedIndex ?? setup.touchedIndex ?? setup.index)) } : null };
}
