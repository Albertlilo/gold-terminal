// Completed-candle reactions shared by chart references and the older-floor
// fallback. The caller decides whether a level is still valid near price.
export function historicalSupports(candles, minTouches = 3) {
  if (candles.length < 15) return [];
  const clusters = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const candle = candles[i];
    const neighbours = candles.slice(i - 2, i + 3);
    if (!neighbours.every(row => candle.low <= row.low)) continue;
    const context = candles.slice(Math.max(0, i - 10), Math.min(candles.length, i + 11));
    const floor = Math.min(...context.map(row => row.low));
    const ceiling = Math.max(...context.map(row => row.high));
    if (candle.low > floor + (ceiling - floor) * 0.35) continue;
    const range = context.reduce((sum, row) => sum + row.high - row.low, 0) / context.length;
    const departure = Math.max(range * 0.25, candle.low * 0.0001);
    if (!candles.slice(i + 1, i + 3).some(row => row.close >= candle.low + departure)) continue;
    const mergeDistance = Math.max(range * 0.35, candle.low * 0.0004);
    let cluster = clusters.find(item => Math.abs(item.price - candle.low) <= mergeDistance);
    if (!cluster) {
      cluster = { price: candle.low, points: [], width: Math.max(range * 0.2, candle.low * 0.00025) };
      clusters.push(cluster);
    }
    if (cluster.points.length && i - cluster.points.at(-1).index < 4) continue;
    cluster.points.push({ index: i, time: candle.time, price: candle.low });
    cluster.price = cluster.points.reduce((sum, point) => sum + point.price, 0) / cluster.points.length;
  }
  return clusters.filter(item => item.points.length >= minTouches).map(item => ({
    id: `past-support-${item.points[0].time}`,
    label: "Past support · reference",
    low: item.price,
    high: item.price + item.width,
    firstTime: item.points[0].time,
    lastTime: item.points.at(-1).time,
    touches: item.points.length,
  }));
}
