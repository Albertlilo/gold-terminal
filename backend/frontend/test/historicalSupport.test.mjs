import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historicalSupports } from '../src/lib/historicalSupport.js';

const row = (i, low, close = 105) => ({ time: i * 3600, open: close, high: 110, low, close });

test('repeated older floor reactions become chart references', () => {
  const candles = Array.from({ length: 36 }, (_, i) => row(i, [4, 10, 16].includes(i) ? 95 : 100));
  const zones = historicalSupports(candles);
  const floor = zones.find(zone => zone.low === 95);
  assert.ok(floor);
  assert.equal(floor.touches, 3);
  assert.equal(floor.firstTime, candles[4].time);
  assert.equal(floor.lastTime, candles[16].time);
});

test('an isolated deeper wick is not promoted to historical support', () => {
  const candles = Array.from({ length: 36 }, (_, i) => row(i, i === 10 ? 95 : 100));
  assert.equal(historicalSupports(candles).some(zone => zone.low === 95), false);
});
