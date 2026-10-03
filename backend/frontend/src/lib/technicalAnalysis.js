import { confirmZones } from "./zoneConfirmation.js";
import { mergeCandles } from "./candles.js";

export const TIMEFRAMES = { "5min": { label: "5 minutes", seconds: 300 }, "1h": { label: "1 hour", seconds: 3600 }, "1day": { label: "Daily", seconds: 86400 } };
export const NOISE_PERCENT = 0.1;

export function analyseCandles(rows, interval, now) {
  const duration = TIMEFRAMES[interval]?.seconds;
  const source = Array.isArray(rows) ? rows : [];
  const valid = mergeCandles([], source);
  const invalid = source.some(row => !mergeCandles([], [row]).length);
  const completed = valid.filter(row => row.time + duration <= now / 1000);
  const window = completed.slice(-20);
  const last = window.at(-1);
  const base = { count: window.length, interval, lastTime: last?.time ?? null, ready: false, state: invalid ? "Invalid price data" : "Collecting candles", levels: [], zones: [], confirmation: "None", move: null };
  if (!duration || invalid || completed.length < 21) return base;
  const anchor = window[0].close;
  const move = (last.close - anchor) / anchor * 100;
  const result = confirmZones(completed);
  const { support, resistance, buy, sell } = result.zones;
  return { ...base, ready: true, state: result.state, confirmation: result.confirmation, setup: result.setup, move, close: last.close,
    stale: now / 1000 - (last.time + duration) > Math.max(duration * 2, 900),
    support: support.low, resistance: resistance.high, zones: [support, resistance],
    average: window.reduce((sum, row) => sum + row.close, 0) / window.length,
    levels: [{ label: "Buy Watch trigger", price: buy, color: "#70d69c" }, { label: "Sell Watch trigger", price: sell, color: "#ef7b7b" }],
  };
}

export function makeTechnicalPlan(analysis, { isOpen }) {
  const signal = !isOpen || !analysis.ready || analysis.stale ? "Wait"
    : ["Buy Watch", "Sell Watch", "Support Bounce", "Resistance Rejection"].includes(analysis.confirmation) ? analysis.confirmation : "Wait";
  const direction = analysis.setup?.direction;
  const supportBounce = analysis.setup?.type === "support-bounce" || analysis.confirmation === "Support Bounce";
  const resistanceRejection = analysis.setup?.type === "resistance-rejection" || analysis.confirmation === "Resistance Rejection";
  const reason = !isOpen ? "Market closed. Wait for the next session."
    : !analysis.ready ? "At least 21 completed candles are needed: 20 to establish zones, then a potential break."
    : analysis.stale ? "Candle data is delayed. Wait for a fresh completed candle."
    : supportBounce && signal === "Support Bounce" ? "A completed candle touched support and closed bullishly back above the support zone. This is a technical support-bounce confirmation, separate from macro bias and breakout/retest watches."
    : supportBounce && analysis.state === "Support bounce developing" ? "Price has touched the support zone. Wait for a completed bullish close back above its upper edge; a touch alone is not confirmation."
    : supportBounce && analysis.state === "Support bounce invalidated" ? "A completed candle closed below the lower edge of the support zone. The support-bounce setup is invalidated."
    : resistanceRejection && signal === "Resistance Rejection" ? "A completed candle touched resistance and closed bearishly back below the resistance zone. This is a technical resistance-rejection confirmation, separate from macro bias and breakout/retest watches."
    : resistanceRejection && analysis.state === "Resistance rejection developing" ? "Price has touched the resistance zone. Wait for a completed bearish close back below its lower edge; a touch alone is not confirmation."
    : resistanceRejection && analysis.state === "Resistance rejection invalidated" ? "A completed candle closed above the upper edge of the resistance zone. The resistance-rejection setup is invalidated."
    : signal !== "Wait" ? "The completed-candle break and retest conditions are confirmed. A watch setup is not an executed trade."
    : analysis.state === "Retest invalidated" ? "The setup failed: a completed candle closed through the far edge of the retested zone. Wait for a new break and retest."
    : analysis.state === "Setup expired" ? "The setup reached its phase limit: 10 candles to touch, 10 candles from the first touch to recover, or 10 candles after confirmation. A new break and retest is required."
    : analysis.state === "Pullback developing" ? "The retest has touched the zone. Wait for a completed recovery close beyond the trigger; a zone touch alone does not confirm a watch."
    : analysis.state === "Confirmation weakened" ? "The latest completed close no longer holds beyond the trigger. The watch is paused; the far zone edge still defines invalidation."
    : analysis.state?.includes("awaiting retest") ? "A break is recorded, but the zone has not yet been touched by a later completed candle. Do not confuse the breakout with retest confirmation."
    : "No completed technical setup is confirmed on this timeframe. Crossing a price line alone does not confirm a breakout/retest watch; a support bounce also needs a completed bullish reclaim. Macro score does not trigger or filter technical setups.";
  return { signal, reason,
    preferred: signal === "Support Bounce" ? "Support-bounce buy confirmed" : signal === "Resistance Rejection" ? "Resistance-rejection sell confirmed" : signal === "Sell Watch" ? "Support-break sell confirmed" : signal === "Buy Watch" ? "Resistance-break buy confirmed" : supportBounce ? "Support-bounce buy developing" : resistanceRejection ? "Resistance-rejection sell developing" : direction === "sell" ? "Support-break sell developing" : direction === "buy" ? "Resistance-break buy developing" : "No active technical setup",
    confirmation: supportBounce ? "Support touch + bullish close above zone" : resistanceRejection ? "Resistance touch + bearish close below zone" : direction === "sell" ? "Support break + failed retest" : direction === "buy" ? "Resistance breakout + successful retest" : "Wait for a technical setup",
    invalidation: supportBounce ? "Completed close below the support zone" : resistanceRejection ? "Completed close above the resistance zone" : direction === "sell" ? "Completed close above the support zone" : direction === "buy" ? "Completed close below the resistance zone" : "No active technical setup",
  };
}
