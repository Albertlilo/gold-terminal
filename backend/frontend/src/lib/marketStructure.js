const PIVOT_RADIUS = 2;
const RECENT_EVENT_BARS = 20;

function swingsAt(rows) {
  const highs = [];
  const lows = [];
  for (let index = PIVOT_RADIUS; index < rows.length - PIVOT_RADIUS; index++) {
    const pivot = rows[index];
    let isHigh = pivot.high > rows[index - 1].high;
    let isLow = pivot.low < rows[index - 1].low;
    for (let offset = index - PIVOT_RADIUS; offset <= index + PIVOT_RADIUS; offset++) {
      if (pivot.high < rows[offset].high) isHigh = false;
      if (pivot.low > rows[offset].low) isLow = false;
    }
    const availableAt = rows[index + PIVOT_RADIUS].time;
    if (isHigh) highs.push({ price: pivot.high, time: pivot.time, availableAt, index });
    if (isLow) lows.push({ price: pivot.low, time: pivot.time, availableAt, index });
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

// A compact max-index segment tree lets the replay find the newest unbroken
// swing price crossed by a candle, then retire it permanently. Each swing is
// inserted and removed once, instead of rescanning all prior swings per bar.
function makeRangeIndex(points) {
  const sorted = [...points].sort((a, b) => a.price - b.price || a.index - b.index);
  let size = 1;
  while (size < sorted.length) size <<= 1;
  const tree = new Int32Array(size * 2);
  tree.fill(-1);
  const positions = new Map();
  for (let i = 0; i < sorted.length; i++) positions.set(sorted[i], i);

  const set = (point, value) => {
    let cursor = size + positions.get(point);
    tree[cursor] = value;
    for (cursor >>= 1; cursor > 0; cursor >>= 1) tree[cursor] = Math.max(tree[cursor * 2], tree[cursor * 2 + 1]);
  };
  const query = (start, end) => {
    let left = Math.max(0, Math.min(sorted.length, start)) + size;
    let right = Math.max(0, Math.min(sorted.length, end)) + size;
    let best = -1;
    while (left < right) {
      if (left & 1) best = Math.max(best, tree[left++]);
      if (right & 1) best = Math.max(best, tree[--right]);
      left >>= 1; right >>= 1;
    }
    return best;
  };
  const lowerBound = value => {
    let low = 0, high = sorted.length;
    while (low < high) { const mid = (low + high) >>> 1; if (sorted[mid].price < value) low = mid + 1; else high = mid; }
    return low;
  };
  const upperBound = value => {
    let low = 0, high = sorted.length;
    while (low < high) { const mid = (low + high) >>> 1; if (sorted[mid].price <= value) low = mid + 1; else high = mid; }
    return low;
  };
  return { sorted, set, query, lowerBound, upperBound };
}

// A pivot is usable only after its two right-hand candles have closed and one
// additional candle has begun. Every event is calculated from candles known
// at that point, so later bars cannot rewrite an earlier event.
export function analyzeMarketStructure(rows = []) {
  if (rows.length < PIVOT_RADIUS * 2 + 5) {
    return { trend: "Sideways / uncertain", event: "No confirmed structure break", eventAt: null, swingHighs: [], swingLows: [] };
  }
  const { highs, lows } = swingsAt(rows);
  const trend = classify(highs, lows);
  const highIndex = makeRangeIndex(highs);
  const lowIndex = makeRangeIndex(lows);
  const highByIndex = new Map(highs.map(point => [point.index, point]));
  const lowByIndex = new Map(lows.map(point => [point.index, point]));
  let highCursor = 0, lowCursor = 0, highActivationCursor = 0, lowActivationCursor = 0;
  const availableHighs = [], availableLows = [];
  let latest = null;

  for (let index = 0; index < rows.length; index++) {
    while (highCursor < highs.length && highs[highCursor].availableAt <= rows[index].time) {
      const point = highs[highCursor++];
      availableHighs.push(point);
      if (point.index + PIVOT_RADIUS + 1 <= index) highIndex.set(point, point.index);
    }
    while (lowCursor < lows.length && lows[lowCursor].availableAt <= rows[index].time) {
      const point = lows[lowCursor++];
      availableLows.push(point);
    }
    while (highActivationCursor < highs.length && highs[highActivationCursor].index + PIVOT_RADIUS + 1 <= index) {
      const point = highs[highActivationCursor++];
      if (point.availableAt <= rows[index].time) highIndex.set(point, point.index);
    }
    while (lowActivationCursor < lows.length && lows[lowActivationCursor].index + PIVOT_RADIUS + 1 <= index) {
      const point = lows[lowActivationCursor++];
      if (point.availableAt <= rows[index].time) lowIndex.set(point, point.index);
    }
    if (index === 0) continue;

    const prior = rows[index - 1].close, close = rows[index].close;
    // Original rule: prior <= swing < close. Repeatedly consume crossed
    // pivots; the max index reproduces the old loop's latest-pivot event.
    let position = highIndex.query(highIndex.lowerBound(prior), highIndex.lowerBound(close));
    let newestUp = -1;
    while (position >= 0) {
      newestUp = Math.max(newestUp, position);
      const point = highByIndex.get(position);
      highIndex.set(point, -1);
      position = highIndex.query(highIndex.lowerBound(prior), highIndex.lowerBound(close));
    }
    if (newestUp >= 0) {
      const point = highByIndex.get(newestUp);
      const reversal = classify(availableHighs, availableLows) === "Lower highs + lower lows";
      latest = { kind: "up", time: rows[index].time, price: point.price, label: reversal ? "CHoCH" : "BOS" };
    }

    // Original rule: close < swing <= prior.
    position = lowIndex.query(lowIndex.upperBound(close), lowIndex.upperBound(prior));
    let newestDown = -1;
    while (position >= 0) {
      newestDown = Math.max(newestDown, position);
      const point = lowByIndex.get(position);
      lowIndex.set(point, -1);
      position = lowIndex.query(lowIndex.upperBound(close), lowIndex.upperBound(prior));
    }
    if (newestDown >= 0) {
      const point = lowByIndex.get(newestDown);
      const reversal = classify(availableHighs, availableLows) === "Higher highs + higher lows";
      latest = { kind: "down", time: rows[index].time, price: point.price, label: reversal ? "CHoCH" : "BOS" };
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
