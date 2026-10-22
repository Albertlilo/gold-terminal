import { getGoldSession } from "./goldSession.js";

const sessionOpenCache = new Map();

export function sessionCandles(rows, interval) {
  const duration = interval === "5min" ? 300 : interval === "1h" ? 3600 : null;
  if (!duration || !Array.isArray(rows)) return Array.isArray(rows) ? rows : [];
  return rows.filter(candle => {
    if (!Number.isFinite(candle.time)) return false;
    const key = candle.time + duration / 2;
    if (!sessionOpenCache.has(key)) {
      if (sessionOpenCache.size >= 20000) sessionOpenCache.clear();
      sessionOpenCache.set(key, getGoldSession(key * 1000).isOpen);
    }
    return sessionOpenCache.get(key);
  });
}

export function mergeCandles(existing, incoming) {
  const rows = new Map(existing.map(candle => [candle.time, candle]));
  for (const candle of incoming) {
    if (![candle.time, candle.open, candle.high, candle.low, candle.close]
      .every(value => Number.isFinite(value) && value > 0)
      || !Number.isInteger(candle.time)
      || candle.high < Math.max(candle.open, candle.close)
      || candle.low > Math.min(candle.open, candle.close)) continue;
    rows.set(candle.time, candle);
  }
  return [...rows.values()].sort((a, b) => a.time - b.time);
}

export function candleWindow(candles, count, endTime) {
  const end = endTime === null ? candles.length
    : candles.findLastIndex(candle => candle.time <= endTime) + 1;
  return candles.slice(Math.max(0, end - count), end);
}

export function candlePriceBounds(low, high, magnify = false) {
  const middle = (low + high) / 2;
  const observed = Math.max(0, high - low);
  const minimum = Math.max(middle * 0.001, 0.01);
  const span = magnify ? (observed || minimum) * 1.24 : Math.max(observed * 1.24, minimum);
  return { min: middle - span / 2, max: middle + span / 2, quiet: observed < minimum };
}
