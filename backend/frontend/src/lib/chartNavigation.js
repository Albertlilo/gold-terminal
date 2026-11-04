export const MIN_VISIBLE = 12;
export const MAX_VISIBLE = 1000;
export const clampCount = value => Math.max(MIN_VISIBLE, Math.min(MAX_VISIBLE, Math.round(value)));

export function panWindow(candles, count, endTime, amount) {
  if (!candles.length) return { endTime: null, needsOlder: false };
  const end = endTime === null ? candles.length - 1 : candles.findLastIndex(row => row.time <= endTime);
  const firstFull = Math.min(count, candles.length) - 1;
  const requested = end + amount;
  const index = Math.max(firstFull, Math.min(candles.length - 1, requested));
  const olderBy = amount < 0 ? Math.max(0, firstFull - requested) : 0;
  // Keep an explicit anchor at the left boundary so prepending cannot move the view.
  const result = { endTime: amount < 0 || index < candles.length - 1 ? candles[index].time : null,
    needsOlder: amount < 0 && requested < firstFull };
  // Preserve drag distance that extends beyond loaded data. The chart can
  // apply it after the next older page arrives instead of dropping the pan.
  if (olderBy > 0) result.olderBy = olderBy;
  return result;
}

export function olderPage(existing, incoming, before) {
  const known = new Set(existing.map(row => row.time));
  return incoming.filter(row => row.time < before && !known.has(row.time));
}
