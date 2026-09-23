const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSignalAuditService } = require('../src/services/signalAuditService');
const { createMarketSnapshotService } = require('../src/services/marketSnapshotService');
const session = () => ({ isOpen: true, label: 'Open' });

test('quote failure preserves last quote and timestamp, shares retries, recovers', async () => {
  let time = 100000, calls = 0, fail = false;
  const get = createMarketSnapshotService({ now: () => time, session, fetchPrice: async () => { calls++; if (fail) throw Error('secret'); return 4300; }, readSavedPrice: async () => null });
  const first = await get(); time += 31000; fail = true;
  const values = await Promise.all([get(), get(), get()]);
  assert.equal(calls, 2); assert.equal(values[0].xauusd.price, 4300);
  assert.equal(values[0].xauusd.receivedAt, first.xauusd.receivedAt);
  assert.equal(values[0].xauusd.stale, true); assert.equal(values[0].xauusd.status, 'fallback');
  time += 31000; fail = false; assert.equal((await get()).xauusd.status, 'live');
});
test('cold quote outage falls back to saved data, total failure stays explicit', async () => {
  for (const saved of [null, {price: 4200, time: '2026-09-20T12:00:00Z'}]) {
    const get = createMarketSnapshotService({ session, fetchPrice: async () => { throw Error('secret'); }, readSavedPrice: async () => saved });
    const data = (await get()).xauusd;
    assert.equal(data.price, saved?.price ?? null); assert.equal(data.status, saved ? 'fallback' : 'unavailable');
    assert.equal(data.stale, true); assert.ok(!JSON.stringify(data).includes('secret'));
  }
});
test('first observed signal survives revised inputs and process restart; concurrent requests coalesce', async () => {
  const records = new Map(); let writes = 0;
  const store = { async insertOnce(event) { writes++; if (!records.has(event.key)) records.set(event.key, structuredClone(event)); return records.get(event.key); }, async recent() { return [...records.values()]; } };
  const analyse = rows => ({ ready: true, lastTime: 300, confirmation: rows[0].close > 100 ? 'Buy Watch' : 'None' });
  const options = { analyse, store, session, now: () => 700000 };
  const record = createSignalAuditService(options);
  const first = await Promise.all([record('5min', [{time:300,close:101}]), record('5min', [{time:300,close:101}])]);
  assert.equal(writes, 1); assert.equal(first[0].analysis.confirmation, 'Buy Watch');
  const revised = await createSignalAuditService(options)('5min', [{time:300,close:99}]);
  assert.equal(revised.analysis.confirmation, 'Buy Watch'); assert.equal(revised.revisedInput, true);
  assert.equal(records.size, 1);
});
test('audit failure is not reported as saved, stale macro is not copied into records', async () => {
  let captured;
  const record = createSignalAuditService({ analyse: () => ({ready:true,lastTime:300}), session, now: () => 900000,
    macro: () => ({bias:'Bullish',observedAt:new Date(0).toISOString()}),
    store: { async insertOnce(event) { captured = event; throw Error('secret'); } } });
  const result = await record('5min', [{time:300,close:100}]);
  assert.equal(result.status, 'unavailable'); assert.equal(captured.macro, null);
  assert.ok(!JSON.stringify(result).includes('secret'));
});
