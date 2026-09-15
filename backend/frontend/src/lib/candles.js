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
