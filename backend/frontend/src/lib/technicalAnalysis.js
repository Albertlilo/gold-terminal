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
  const base = { count: window.length, interval, lastTime: last?.time ?? null, ready: false, state: invalid ? "Invalid price data" : "Collecting candles", levels: [], move: null };
  if (!duration || invalid || window.length < 3) return base;
  const anchor = window[0].close;
  const move = (last.close - anchor) / anchor * 100;
  const state = Math.abs(move) <= NOISE_PERCENT + 1e-10 ? "Between Levels" : move > 0 ? "Above Buy Watch" : "Below Sell Watch";
  return { ...base, ready: true, state, move, close: last.close,
    stale: now / 1000 - (last.time + duration) > Math.max(duration * 2, 900),
    support: Math.min(...window.map(row => row.low)), resistance: Math.max(...window.map(row => row.high)),
    average: window.reduce((sum, row) => sum + row.close, 0) / window.length,
    levels: [ { label: "Buy Watch", price: anchor * 1.001, color: "#70d69c" }, { label: "Sell Watch", price: anchor * 0.999, color: "#ef7b7b" } ],
  };
}

export function makeTradingPlan(macro, analysis, { isOpen, macroFresh = true }) {
  const bearish = macro === "Bearish", bullish = macro === "Bullish";
  const signal = !isOpen || !macroFresh || !analysis.ready || analysis.stale ? "Wait"
    : bearish && analysis.state === "Below Sell Watch" ? "Sell Watch"
    : bullish && analysis.state === "Above Buy Watch" ? "Buy Watch" : "Wait";
  const reason = !isOpen ? "Market closed. Wait for the next session."
    : !macroFresh ? "Macro data is delayed or unavailable. Wait for an update."
    : !analysis.ready ? "At least three valid completed candles are needed."
    : analysis.stale ? "Candle data is delayed. Wait for a fresh completed candle."
    : signal !== "Wait" ? "Macro and completed-candle momentum agree. A watch setup is not an executed trade."
    : "No aligned confirmation yet. Be patient and wait for confirmation.";
  return { signal, reason,
    preferred: bearish ? "Sell setups only" : bullish ? "Buy setups only" : "No directional preference",
    confirmation: bearish ? "Below Sell Watch" : bullish ? "Above Buy Watch" : "Wait for a directional macro bias",
    invalidation: bearish ? "Above Buy Watch" : bullish ? "Below Sell Watch" : "No active directional setup",
  };
}
