const PIVOT_RADIUS = 2;
const RECENT_EVENT_BARS = 20;

function swingsAt(rows) {
  const highs = [];
  const lows = [];
  for (let index = PIVOT_RADIUS; index < rows.length - PIVOT_RADIUS; index++) {
    const pivot = rows[index];
    const neighbours = rows.slice(index - PIVOT_RADIUS, index + PIVOT_RADIUS + 1);
    const availableAt = rows[index + PIVOT_RADIUS].time;
    // Require a turn from the left so a flat plateau is recorded once instead
    // of being mistaken for a sequence of separate swing points.
    if (pivot.high > rows[index - 1].high && neighbours.every(row => pivot.high >= row.high)) highs.push({ price: pivot.high, time: pivot.time, availableAt, index });
    if (pivot.low < rows[index - 1].low && neighbours.every(row => pivot.low <= row.low)) lows.push({ price: pivot.low, time: pivot.time, availableAt, index });
  }
  return { highs, lows };
}

function classify(highs, lows) {
  const previousHigh = highs.at(-2), latestHigh = highs.at(-1);
  const previousLow = lows.at(-2), latestLow = lows.at(-1);
  if (!previousHigh || !latestHigh || !previousLow || !latestLow) return "Sideways / uncertain";
  if (latestHigh.price > previousHigh.price && latestLow.price > previousLow.price) return "Higher highs + higher lows";
  if (latestHigh.price < previousHigh.price && latestLow.price < previousLow.price) return "Lower highs + lower lows";
  return "Sideways / uncertain";
}

// A pivot is usable only once its two right-hand candles have closed.
// Callers pass an as-of candle prefix, so later bars cannot rewrite an old read.
export function analyzeMarketStructure(rows = []) {
  if (rows.length < PIVOT_RADIUS * 2 + 5) {
    return { trend: "Sideways / uncertain", event: "No confirmed structure break", eventAt: null, swingHighs: [], swingLows: [] };
  }
  const { highs, lows } = swingsAt(rows);
  const trend = classify(highs, lows);
  // Process candles once. The previous implementation rescanned the whole
  // remaining series for every pivot and re-filtered every swing at each
  // crossing; long mobile histories made that work grow quadratically.
  const availableHighs = [], availableLows = [];
  const breakableHighs = [], breakableLows = [];
  let highIndex = 0, lowIndex = 0, latest = null;
  for (let index = 0; index < rows.length; index++) {
    while (highIndex < highs.length && highs[highIndex].availableAt <= rows[index].time) {
      const point = highs[highIndex++];
      availableHighs.push(point);
      breakableHighs.push({ ...point, eligibleIndex: point.index + PIVOT_RADIUS + 1, crossed: false });
    }
    while (lowIndex < lows.length && lows[lowIndex].availableAt <= rows[index].time) {
      const point = lows[lowIndex++];
      availableLows.push(point);
      breakableLows.push({ ...point, eligibleIndex: point.index + PIVOT_RADIUS + 1, crossed: false });
    }
    if (index === 0) continue;
    const prior = rows[index - 1].close, close = rows[index].close;
    for (const point of breakableHighs) {
      if (point.crossed || point.eligibleIndex > index) continue;
      if (prior <= point.price && close > point.price) {
        const priorTrend = classify(availableHighs, availableLows);
        const reversal = priorTrend === "Lower highs + lower lows";
        latest = { kind: "up", time: rows[index].time, price: point.price, label: reversal ? "CHoCH" : "BOS" };
        point.crossed = true;
      }
    }
    for (const point of breakableLows) {
      if (point.crossed || point.eligibleIndex > index) continue;
      if (prior >= point.price && close < point.price) {
        const priorTrend = classify(availableHighs, availableLows);
        const reversal = priorTrend === "Higher highs + higher lows";
        latest = { kind: "down", time: rows[index].time, price: point.price, label: reversal ? "CHoCH" : "BOS" };
        point.crossed = true;
      }
    }
  }
  const recent = latest && rows.at(-1).time - latest.time <= RECENT_EVENT_BARS * (rows.at(-1).time - rows.at(-2).time);
  return {
    trend,
    event: latest ? `${recent ? "Recent " : "Last "}${latest.label} ${latest.kind === "up" ? "up" : "down"}` : "No confirmed structure break",
    eventAt: latest?.time ?? null,
    swingHighs: highs.slice(-2).map(({ price, time, availableAt }) => ({ price, time, availableAt })),
    swingLows: lows.slice(-2).map(({ price, time, availableAt }) => ({ price, time, availableAt })),
  };
}
