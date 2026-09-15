const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHistoryService} = require('../src/services/candleHistoryService');
const candle = {time:100,open:100,high:102,low:98,close:100};

test('saved candles return before a stalled provider completes', async () => {
  let release;
  let saved = [candle];
  const service = createHistoryService({
    store: {read:async()=>saved,save:async(_,rows)=>{saved=rows;}},
    fetchCandles:()=>new Promise(resolve=>{release=resolve;}),
  });
  const result = await service();
  assert.equal(result.refreshing,true);
  assert.deepEqual(result.candles,[candle]);
  release([{...candle,close:101}]);
  await new Promise(setImmediate);
  const updated = await service();
  assert.equal(updated.refreshing,false);
  assert.equal(updated.candles[0].close,101);
});

test('failed refresh can retry after 15 seconds rather than five minutes', async () => {
  let now=1000000; let calls=0;
  const service=createHistoryService({now:()=>now,store:{read:async()=>[],save:async()=>{}},fetchCandles:async()=>{calls++;throw new Error('temporary');}});
  await assert.rejects(service());
  now+=1000;
  await assert.rejects(service());assert.equal(calls,1);
  now+=15000;
  await assert.rejects(service());assert.equal(calls,2);
});

test('cached candles remain available when a background save fails', async () => {
  const service=createHistoryService({store:{read:async()=>[candle],save:async()=>{throw new Error('database down');}},fetchCandles:async()=>[{...candle,close:101}]});
  assert.deepEqual((await service()).candles,[candle]);
  await new Promise(setImmediate);
  const result=await service();
  assert.deepEqual(result.candles,[candle]);assert.match(result.warning,/Could not refresh/);
});
