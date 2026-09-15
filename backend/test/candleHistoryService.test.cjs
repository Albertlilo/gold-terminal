const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHistoryService, normalizeCandles } = require('../src/services/candleHistoryService');

const candle = (time, close = 100) => ({ time, open: 100, high: 102, low: 98, close });
function memoryStore() {
  const rows = new Map();
  return {
    rows,
    async read(interval, before, limit) {
      return [...rows.values()].filter(row => row.interval === interval && (before === undefined || row.time < before))
        .sort((a, b) => a.time - b.time).slice(-limit).map(({ interval: ignored, ...rest }) => rest);
    },
    async save(interval, candles) { for (const row of candles) rows.set(`${interval}:${row.time}`, { ...row, interval }); },
  };
}
test('provider data parses UTC, sorts, and deduplicates', () => {
  const raw = datetime => ({ datetime, open: '100', high: '102', low: '98', close: '101' });
  const rows = normalizeCandles([raw('2026-09-15 12:05:00'), raw('2026-09-15 12:00:00'), raw('2026-09-15 12:00:00')]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].time, Date.parse('2026-09-15T12:00:00Z') / 1000);
  assert.equal(normalizeCandles([raw('2026-09-15')])[0].time, Date.parse('2026-09-15T00:00:00Z') / 1000);
  for (const patch of [{ open: 'bad' }, { high: '90' }, { low: '105' }, { datetime: 'bad' }]) {
    assert.throws(() => normalizeCandles([{ ...raw('2026-09-15'), ...patch }]));
  }
});
test('concurrent refreshes share one request and repeated refreshes update the candle', async () => {
  const store = memoryStore(); let time = 1000000; let calls = 0;
  const history = createHistoryService({ store, now: () => time, fetchCandles: async () => { calls++; return [candle(100, 100 + calls)]; } });
  const [first, second] = await Promise.all([history(), history()]);
  assert.equal(calls, 1); assert.equal(first.saved, true); assert.deepEqual(first, second);
  await history(); assert.equal(calls, 1);
  time += 300001;
  await history();
  await new Promise(setImmediate);
  const next = await history();
  assert.equal(calls, 2); assert.equal(next.candles.length, 1); assert.equal(next.candles[0].close, 102);
});
test('new service instance loads persisted data when provider is unavailable', async () => {
  const store = memoryStore();
  await createHistoryService({ store, fetchCandles: async () => [candle(100)] })();
  const restarted = createHistoryService({ store, fetchCandles: async () => { throw new Error('quota'); } });
  const immediate = await restarted();
  assert.equal(immediate.candles.length, 1);
  await new Promise(setImmediate);
  const result = await restarted();
  assert.equal(result.candles.length, 1); assert.equal(result.saved, true); assert.match(result.warning, /saved history/);
});
test('older pages are exclusive and repeated page requests are cached', async () => {
  const store = memoryStore(); let calls = 0;
  await store.save('5min', [candle(100), candle(200), candle(300)]);
  const history = createHistoryService({ store, fetchCandles: async () => { calls++; return []; } });
  const older = await history('5min', 300);
  assert.deepEqual(older.candles.map(row => row.time), [100, 200]); assert.equal(calls, 1);
  await history('5min', 300); assert.equal(calls, 1);
  const oldest = await history('5min', 100);
  assert.equal(oldest.hasMore, false); assert.equal(calls, 2);
  await history('5min', 100); assert.equal(calls, 2);
});
test('intervals remain separate; invalid requests do not access storage or provider', async () => {
  const store = memoryStore();
  const history = createHistoryService({ store, fetchCandles: async interval => [candle(interval === '1h' ? 200 : 100)] });
  await history('5min'); const hour = await history('1h');
  assert.deepEqual(hour.candles.map(row => row.time), [200]);
  for (const [interval, before] of [['bad'], ['5min', -1], ['5min', Infinity], ['5min', 2.1], ['5min', Date.now()]]) {
    await assert.rejects(history(interval, before), error => error.status === 400);
  }
});
test('failed saves never report new candles as durable', async () => {
  const store = memoryStore(); store.save = async () => { throw new Error('quota exceeded'); };
  const history = createHistoryService({ store, fetchCandles: async () => [candle(100)] });
  await assert.rejects(history(), error => error.status === 503);
});
test('database read failure stops upstream requests', async () => {
  let calls = 0;
  const history = createHistoryService({ store: { read: async () => { throw new Error('database down'); } }, fetchCandles: async () => { calls++; return []; } });
  await assert.rejects(history()); assert.equal(calls, 0);
});
