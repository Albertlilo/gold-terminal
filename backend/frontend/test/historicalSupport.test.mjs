import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historicalSupports, historicalResistances, historicalReactions } from '../src/lib/historicalSupport.js';

const row = (i, low, close = 105) => ({ time: i * 3600, open: close, high: 110, low, close });

test('repeated older floor reactions become chart references', () => {
  const candles = Array.from({ length: 36 }, (_, i) => row(i, [4, 10, 16].includes(i) ? 95 : 100));
  const zones = historicalSupports(candles);
  const floor = zones.find(zone => zone.low === 95);
  assert.ok(floor);
  assert.equal(floor.touches, 3);
  assert.equal(floor.firstTime, candles[18].time, 'the historical zone starts when the third swing is confirmed');
  assert.equal(floor.lastTime, candles[16].time);
  assert.equal(floor.lastTime, candles[16].time);
});

test('an isolated deeper wick is not promoted to historical support', () => {
  const candles = Array.from({ length: 36 }, (_, i) => row(i, i === 10 ? 95 : 100));
  assert.equal(historicalSupports(candles).some(zone => zone.low === 95), false);
});

const upperRow = (i, high, close = 100, low = 98) => ({ time: i * 3600, open: close - 0.2, high, low, close });

test('repeated confirmed swing highs become historical resistance references', () => {
  const candles = Array.from({ length: 36 }, (_, i) => upperRow(i, [4, 10, 16].includes(i) ? 106 : 103,
    [5, 11, 17].includes(i) ? 104 : 100));
  const zone = historicalResistances(candles).find(item => item.high === 106);
  assert.ok(zone);
  assert.equal(zone.touches, 3);
  assert.equal(zone.role, 'resistance');
  assert.equal(zone.color, '#ef7b7b');
  assert.equal(zone.firstTime, candles[18].time, 'the zone begins when the third reaction is confirmed');
});

test('one recent confirmed swing high can be shown as provisional resistance without becoming an active zone', () => {
  const candles = Array.from({ length: 36 }, (_, i) => upperRow(i, i === 28 ? 106 : 103,
    i === 29 ? 104 : 100));
  assert.equal(historicalResistances(candles).some(zone => zone.high === 106), false);
  const developing = historicalResistances(candles, 1, candles.at(-1).time, true).find(zone => zone.high === 106);
  assert.equal(developing?.touches, 1);
  assert.equal(developing?.status, 'forming');
  assert.equal(developing?.active, false);
});

test('a broken resistance only becomes support after a completed retest holds', () => {
  const candles = Array.from({ length: 20 }, (_, i) => upperRow(i, [4, 10, 16].includes(i) ? 106 : 103,
    [5, 11, 17].includes(i) ? 104 : 100));
  candles.push(upperRow(20, 108, 107, 105)); // confirmed close above resistance
  candles.push(upperRow(21, 107, 106.5, 104)); // later touch and bullish close above
  const zone = historicalReactions(candles, 'resistance').find(item => item.high === 106);
  assert.equal(zone?.status, 'role-reversed');
  assert.equal(zone?.reversal?.state, 'confirmed');
  assert.match(zone?.reversal?.label || '', /Resistance → Support \(Confirmed\)/);
});

test('a later completed close back through invalidates a confirmed resistance-to-support reversal', () => {
  const candles = Array.from({ length: 20 }, (_, i) => upperRow(i, [4, 10, 16].includes(i) ? 106 : 103,
    [5, 11, 17].includes(i) ? 104 : 100));
  candles.push(upperRow(20, 108, 107, 105));
  candles.push(upperRow(21, 107, 106.5, 104));
  candles.push(upperRow(22, 105, 103, 102));
  const zone = historicalResistances(candles).find(item => item.high === 106);
  assert.equal(zone?.status, 'invalidated');
  assert.equal(zone?.reversal?.state, 'invalidated');
});

test('broken resistance remains pending until a later retest and is invalidated by a close back through', () => {
  const base = Array.from({ length: 20 }, (_, i) => upperRow(i, [4, 10, 16].includes(i) ? 106 : 103,
    [5, 11, 17].includes(i) ? 104 : 100));
  const pendingCandles = [...base, upperRow(20, 108, 107, 105)];
  const pending = historicalResistances(pendingCandles).find(item => item.high === 106);
  assert.equal(pending?.status, 'broken');
  assert.equal(pending?.reversal?.state, 'pending');
  const invalidated = historicalResistances([...pendingCandles, upperRow(21, 105, 103, 102)])
    .find(item => item.high === 106);
  assert.equal(invalidated?.status, 'invalidated');
  assert.equal(invalidated?.reversal?.state, 'invalidated');
});

test('support becomes resistance only after a confirmed break and failed retest', () => {
  const candles = Array.from({ length: 20 }, (_, i) => row(i, [4, 10, 16].includes(i) ? 95 : 100,
    [5, 11, 17].includes(i) ? 96 : 105));
  candles.push({ time: 20 * 3600, open: 94, high: 96, low: 92, close: 93 });
  candles.push({ time: 21 * 3600, open: 94, high: 96, low: 92, close: 93 });
  const zone = historicalReactions(candles, 'support').find(item => item.low === 95);
  assert.equal(zone?.status, 'role-reversed');
  assert.equal(zone?.reversal?.state, 'confirmed');
  assert.match(zone?.reversal?.label || '', /Support → Resistance \(Confirmed\)/);
});

test('confirmed swing resistance is available consistently on 5M, 1H, and Daily candle spacing', () => {
  for (const seconds of [300, 3600, 86400]) {
    const candles = Array.from({ length: 36 }, (_, i) => ({
      ...upperRow(i, [4, 10, 16].includes(i) ? 106 : 103, [5, 11, 17].includes(i) ? 104 : 100),
      time: i * seconds,
    }));
    assert.ok(historicalResistances(candles).some(zone => zone.touches >= 3), `${seconds}s candles should produce the confirmed zone`);
  }
});

test('a swing is not exposed before its two right-side candles complete', () => {
  const candles = Array.from({ length: 36 }, (_, i) => upperRow(i, [4, 10, 16].includes(i) ? 106 : 103,
    [5, 11, 17].includes(i) ? 104 : 100));
  const cutoff = candles[17].time;
  assert.equal(historicalResistances(candles, 3, cutoff).length, 0);
});
