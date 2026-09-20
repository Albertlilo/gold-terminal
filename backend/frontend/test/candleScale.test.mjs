import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candlePriceBounds } from '../src/lib/candles.js';
test('tiny gold ranges do not fill the chart unless magnification is enabled',()=>{
  const normal=candlePriceBounds(4379.94,4380.28);
  assert.equal(normal.quiet,true);
  assert.ok(normal.max-normal.min>=4.38);
  const magnified=candlePriceBounds(4379.94,4380.28,true);
  assert.ok(magnified.max-magnified.min<0.5);
});
test('normal ranges fit all prices and flat candles have a nonzero scale',()=>{
  const bounds=candlePriceBounds(4300,4400);
  assert.equal(bounds.quiet,false);
  assert.ok(bounds.min<4300&&bounds.max>4400);
  for(const magnify of [true,false]) {const flat=candlePriceBounds(4380,4380,magnify);assert.ok(flat.max>flat.min);}
});
