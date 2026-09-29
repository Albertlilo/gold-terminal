import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampCount, panWindow, olderPage } from '../src/lib/chartNavigation.js';
import { candleWindow, mergeCandles, candlePriceBounds } from '../src/lib/candles.js';
const rows = Array.from({length:100},(_,i)=>({time:(i+100)*300,open:100,close:101,low:99,high:102}));
test('pan hits older boundary with an anchored view, then reaches newly loaded history', () => {
  const boundary = panWindow(rows,40,null,-200);
  assert.equal(boundary.needsOlder,true);
  const before = candleWindow(rows,40,boundary.endTime);
  const older = rows.map(row=>({...row,time:row.time-30000})).filter(row=>row.time>0);
  const merged = mergeCandles(older,rows);
  assert.deepEqual(candleWindow(merged,40,boundary.endTime),before);
  const next = panWindow(merged,40,boundary.endTime,-20);
  assert.ok(next.endTime<boundary.endTime);
  assert.equal(next.needsOlder,false);
});
test('short history remains anchored when more data arrives; later returns to latest', () => {
  const short=rows.slice(-10);
  const pan=panWindow(short,40,null,-1);
  assert.equal(pan.endTime,short.at(-1).time);
  assert.equal(pan.needsOlder,true);
  assert.equal(panWindow(rows,40,rows[50].time,500).endTime,null);
  assert.deepEqual(panWindow([],40,null,-1),{endTime:null,needsOlder:false});
});
test('paging rejects duplicate and non-older rows, zoom supports wide overview', () => {
  const incoming=[rows[0],{...rows[0],time:15000},{...rows[0],time:90000}];
  assert.deepEqual(olderPage(rows,incoming,rows[0].time).map(row=>row.time),[15000]);
  assert.equal(clampCount(1),12);assert.equal(clampCount(2000),1000);
  assert.equal(clampCount(500),500);
});
test('automatic fit makes a tiny price range readable without changing candles', () => {
  const bounds=candlePriceBounds(4380,4380.1,true);
  assert.ok(bounds.max-bounds.min<0.2);
  assert.ok(bounds.min<4380 && bounds.max>4380.1);
});
