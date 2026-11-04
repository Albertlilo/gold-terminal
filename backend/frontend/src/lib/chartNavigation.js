export const MIN_VISIBLE = 12;
export const MAX_VISIBLE = 1000;
export const clampCount = value => Math.max(MIN_VISIBLE, Math.min(MAX_VISIBLE, Math.round(value)));

export function panWindow(candles, count, endTime, amount, futureOffset = 0) {
  if (!candles.length) return { endTime: null, needsOlder: false };
  const lastIndex = candles.length - 1;
  const end = endTime === null ? lastIndex + futureOffset : candles.findLastIndex(row => row.time <= endTime);
  const firstFull = Math.min(count, candles.length) - 1;
  const requested = end + amount;
  if (requested > lastIndex || (requested === lastIndex && endTime !== null)) {
    const future = Math.max(0, requested - lastIndex);
    return { endTime: null, needsOlder: false, futureOffset: endTime !== null ? Math.max(10, future) : future };
  }
  const index = Math.max(firstFull, Math.min(lastIndex, requested));
  const olderBy = amount < 0 ? Math.max(0, firstFull - requested) : 0;
  // Keep an explicit anchor at the left boundary so prepending cannot move the view.
  const result = { endTime: index < lastIndex || (amount < 0 && requested < firstFull) ? candles[index].time : null,
    needsOlder: amount < 0 && requested < firstFull, futureOffset: 0 };
  if (olderBy > 0) result.olderBy = olderBy;
  return result;
}

export function olderPage(existing, incoming, before) {
  const known = new Set(existing.map(row => row.time));
  return incoming.filter(row => row.time < before && !known.has(row.time));
}
