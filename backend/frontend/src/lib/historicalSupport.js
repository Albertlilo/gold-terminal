// Historical swing reactions are confirmed with completed candles only. A
// pivot at i is not knowable until i + 2; identifiedAt records that point.
const ROLE_STYLES = {
  support: { color: "#70d69c", muted: "#477f60", label: "Past support" },
  resistance: { color: "#ef7b7b", muted: "#8a4e4e", label: "Past resistance" },
};

function classifyRoleReversal(candles, zone, role, fromIndex, width) {
  let status = "active";
  let reversal = null;
  const buffer = Math.max(width * 0.25, zone.price * 0.0001);
  for (let i = fromIndex; i < candles.length; i++) {
    const candle = candles[i];
    if (!reversal) {
      const broken = role === "resistance" ? candle.close > zone.high + buffer : candle.close < zone.low - buffer;
      if (broken) {
        reversal = { state: "pending", breakTime: candle.time,
          label: role === "resistance" ? "Role Reversal Pending · Resistance → Support" : "Role Reversal Pending · Support → Resistance" };
        status = "broken";
      }
      continue;
    }
    if (reversal.state === "confirmed") {
      const reversedThrough = role === "resistance" ? candle.close < zone.low - buffer : candle.close > zone.high + buffer;
      if (reversedThrough) {
        reversal = { ...reversal, state: "invalidated", statusAt: candle.time,
          label: `Role Reversal Invalidated · ${role === "resistance" ? "Resistance → Support" : "Support → Resistance"}` };
        status = "invalidated";
      }
      continue;
    }
    if (reversal.state !== "pending") continue;
    const failedBackThrough = role === "resistance" ? candle.close < zone.low - buffer : candle.close > zone.high + buffer;
    if (failedBackThrough) {
      reversal = { ...reversal, state: "invalidated", statusAt: candle.time,
        label: `Role Reversal Invalidated · ${role === "resistance" ? "Resistance → Support" : "Support → Resistance"}` };
      status = "invalidated";
      continue;
    }
    const retested = candle.low <= zone.high && candle.high >= zone.low;
    const held = role === "resistance" ? candle.close > zone.high && candle.close > candle.open
      : candle.close < zone.low && candle.close < candle.open;
    if (retested && held) {
      reversal = { ...reversal, state: "confirmed", statusAt: candle.time,
        label: `${role === "resistance" ? "Resistance → Support" : "Support → Resistance"} (Confirmed)` };
      status = "role-reversed";
    }
  }
  return { status, reversal };
}

export function historicalReactions(candles, role, minTouches = 3, asOfTime = candles?.at(-1)?.time ?? Infinity) {
  if (!Array.isArray(candles) || candles.length < 15 || !ROLE_STYLES[role]) return [];
  const completed = candles.filter(candle => candle.time <= asOfTime);
  if (completed.length < 15) return [];
  const isSupport = role === "support";
  const clusters = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const candle = candles[i];
    if (candle.time > asOfTime) break;
    if (candles[i + 2].time > asOfTime) continue;
    const neighbors = candles.slice(i - 2, i + 3);
    const price = isSupport ? candle.low : candle.high;
    const isSwing = neighbors.every(row => isSupport ? candle.low <= row.low : candle.high >= row.high);
    if (!isSwing) continue;

    // Range and locality are measured only through the pivot candle. Later
    // candles can confirm the turn, but cannot move the zone's price/width.
    const context = candles.slice(Math.max(0, i - 10), i + 1);
    const floor = Math.min(...context.map(row => row.low));
    const ceiling = Math.max(...context.map(row => row.high));
    if (isSupport ? price > floor + (ceiling - floor) * 0.35 : price < ceiling - (ceiling - floor) * 0.35) continue;
    const range = context.reduce((sum, row) => sum + row.high - row.low, 0) / context.length;
    const departure = Math.max(range * 0.25, price * 0.0001);
    const confirmingBar = candles.slice(i + 1, i + 3).findIndex(row => row.time <= asOfTime && (isSupport
      ? row.close >= price + departure : row.close <= price - departure));
    if (confirmingBar < 0) continue;

    const mergeDistance = Math.max(range * 0.35, price * 0.0004);
    let cluster = clusters.find(item => Math.abs(item.price - price) <= Math.max(item.mergeDistance, mergeDistance));
    if (!cluster) {
      cluster = { price, points: [], width: Math.max(range * 0.2, price * 0.00025), mergeDistance };
      clusters.push(cluster);
    }
    if (cluster.points.length && i - cluster.points.at(-1).index < 4) continue;
    // Keep the first confirmed price fixed: later reactions count toward the
    // zone but never retroactively shift its plotted level.
    cluster.points.push({ index: i, time: candle.time, confirmedIndex: i + 2,
      confirmedAt: candles[i + 2].time });
  }

  return clusters.filter(item => item.points.length >= minTouches).map(item => {
    const first = item.points[0];
    const identified = item.points[minTouches - 1];
    const low = isSupport ? item.price : item.price - item.width;
    const high = isSupport ? item.price + item.width : item.price;
    const zone = { price: item.price, low, high };
    const latest = item.points.at(-1);
    const lifecycle = classifyRoleReversal(completed, zone, role, identified.confirmedIndex + 1, item.width);
    const age = completed.length - 1 - latest.confirmedIndex;
    const status = lifecycle.status === "active" && age > Math.max(30, candles.length * 0.2) ? "inactive" : lifecycle.status;
    const style = ROLE_STYLES[role];
    return {
      id: `past-${role}-${first.time}`,
      role,
      label: `${style.label} · ${status}`,
      displayLabel: `${style.label} · ${status}`,
      low, high,
      // Do not draw a confirmed zone back into candles before the reaction
      // count was reached. The earlier swings support the count, but the
      // zone itself only becomes knowable at this completed candle.
      firstTime: identified.confirmedAt,
      identifiedAt: identified.confirmedAt,
      lastTime: latest.time,
      touches: item.points.length,
      status,
      active: status === "active",
      color: status === "active" ? style.color : style.muted,
      reversal: lifecycle.reversal,
      mergeDistance: item.mergeDistance,
    };
  });
}

export function historicalSupports(candles, minTouches = 3, asOfTime) {
  return historicalReactions(candles, "support", minTouches, asOfTime).map(zone => ({
    ...zone,
    label: "Past support · reference",
  }));
}

export function historicalResistances(candles, minTouches = 3, asOfTime) {
  return historicalReactions(candles, "resistance", minTouches, asOfTime);
}
