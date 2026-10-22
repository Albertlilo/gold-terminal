import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCandles, candleWindow, sessionCandles } from '../src/lib/candles.js';
const row = (time, close = 10) => ({ time, open: 10, high: 12, low: 9, close });
test('refresh merges candles without erasing older loaded history', () => {
  const result = mergeCandles([row(1), row(2)], [row(2, 11), row(3)]);
  assert.deepEqual(result.map(c => c.time), [1, 2, 3]); assert.equal(result[1].close, 11);
});
test('invalid price data is excluded', () => {
  assert.deepEqual(mergeCandles([], [row(1, NaN), { ...row(2), low: 20 }, row(3)]), [row(3)]);
});
test('view anchored in history stays put when new candles arrive', () => {
  const rows = [1, 2, 3, 4, 5].map(time => row(time));
  assert.deepEqual(candleWindow(rows, 2, 3).map(c => c.time), [2, 3]);
  assert.deepEqual(candleWindow([...rows, row(6)], 2, 3).map(c => c.time), [2, 3]);
  assert.deepEqual(candleWindow(rows, 2, null).map(c => c.time), [4, 5]);
});

test('intraday display omits scheduled closed hours without changing saved rows', () => {
  const rows = [
    row(Date.parse('2026-10-16T20:00:00Z') / 1000), // Friday 16:00 New York, open
    row(Date.parse('2026-10-17T12:00:00Z') / 1000), // weekend
    row(Date.parse('2026-10-18T22:00:00Z') / 1000), // Sunday 18:00 New York, open
    row(Date.parse('2026-10-22T21:00:00Z') / 1000), // daily 17:00 maintenance break
    row(Date.parse('2026-10-22T22:00:00Z') / 1000), // daily 18:00 reopen
  ];
  const visible = sessionCandles(rows, '1h');
  assert.deepEqual(visible.map(item => item.time), [rows[0].time, rows[2].time, rows[4].time]);
  assert.equal(rows.length, 5);
  assert.equal(sessionCandles(rows, '1day'), rows);
});
