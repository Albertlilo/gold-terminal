import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMarketStructure } from '../src/lib/marketStructure.js';

const make = (i, close, high, low) => ({ time: (i + 1) * 3600, open: close, close, high, low });
const trend = [
  make(0,10,11,9), make(1,11,12,10), make(2,12,14,10), make(3,11,12,10),
  make(4,10,11,8), make(5,11,12,9), make(6,13,16,10), make(7,12,14,11),
  make(8,11,13,10), make(9,12,14,11), make(10,12,14,11), make(11,17,18,12),
  make(12,9,13,8),
];

test('confirmed swing sequences classify higher highs and higher lows with a BOS', () => {
  const result = analyzeMarketStructure(trend.slice(0,12));
  assert.equal(result.trend,'Higher highs + higher lows');
  assert.equal(result.event,'Recent BOS up');
  assert.equal(result.eventAt,trend[11].time);
});

test('a later break against the established trend is labelled CHoCH without rewriting the earlier read', () => {
  const before = analyzeMarketStructure(trend.slice(0,12));
  const after = analyzeMarketStructure(trend);
  assert.equal(before.event,'Recent BOS up');
  assert.equal(after.event,'Recent CHoCH down');
  assert.equal(after.trend,'Higher highs + higher lows');
});

test('flat candles do not manufacture swing sequences', () => {
  const rows = Array.from({length:20},(_,i)=>make(i,100,101,99));
  const result = analyzeMarketStructure(rows);
  assert.equal(result.trend,'Sideways / uncertain');
  assert.equal(result.event,'No confirmed structure break');
});
