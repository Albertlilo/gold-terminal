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

export function makeTradingPlan(macro, analysis, { isOpen, macroFresh = true }) {
  const bearish = macro === "Bearish", bullish = macro === "Bullish";
  const signal = !isOpen || !macroFresh || !analysis.ready || analysis.stale ? "Wait"
    : bearish && analysis.confirmation === "Sell Watch" ? "Sell Watch"
    : bullish && analysis.confirmation === "Buy Watch" ? "Buy Watch" : "Wait";
  const reason = !isOpen ? "Market closed. Wait for the next session."
    : !macroFresh ? "Macro data is delayed or unavailable. Wait for an update."
    : !analysis.ready ? "At least 21 completed candles are needed: 20 to establish zones, then a potential break."
    : analysis.stale ? "Candle data is delayed. Wait for a fresh completed candle."
    : signal !== "Wait" ? "Macro bias and the break/retest confirmation agree. A watch setup is not an executed trade."
    : analysis.state === "Retest invalidated" ? "The setup failed: a completed candle closed through the far edge of the retested zone. Wait for a new break and retest."
    : analysis.state === "Setup expired" ? "The setup reached its 10-candle limit from the original break. A new break and retest is required."
    : analysis.state?.includes("awaiting retest") ? "A break is recorded, but no later completed candle has both touched the zone and closed beyond the trigger."
    : analysis.confirmation === "Buy Watch" && !bullish ? `Technical Buy Watch is confirmed, but macro bias is ${macro || "Unavailable"}. The combined signal requires Bullish macro.`
    : analysis.confirmation === "Sell Watch" && !bearish ? `Technical Sell Watch is confirmed, but macro bias is ${macro || "Unavailable"}. The combined signal requires Bearish macro.`
    : !bearish && !bullish ? `Macro bias is ${macro || "Unavailable"}; there is no directional macro agreement or confirmed matching retest.`
    : "No completed break-and-retest confirmation on this timeframe. Crossing a price line alone does not confirm a setup.";
  return { signal, reason,
    preferred: bearish ? "Sell setups only" : bullish ? "Buy setups only" : "No directional preference",
    confirmation: bearish ? "Support break + failed retest" : bullish ? "Resistance breakout + successful retest" : "Wait for a directional macro bias",
    invalidation: bearish ? "Completed close above the support zone" : bullish ? "Completed close below the resistance zone" : "No active directional setup",
  };
}
