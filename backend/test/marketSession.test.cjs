const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createMarketSnapshotService}=require('../src/services/marketSnapshotService');
const {createHistoryService}=require('../src/services/candleHistoryService');
test('saved weekend candles remain usable as a labelled reference, not a live quote',async()=>{
  const {savedCandleQuote}=require('../src/services/marketSnapshotService');
  const now=Date.parse('2026-09-20T20:20:00Z');
  const rows=[{time:now/1000-600,close:4380.13},{time:now/1000,close:9999},{time:now/1000-900,close:NaN}];
  const saved=savedCandleQuote(rows,now);
  assert.equal(saved.price,4380.13);
  const get=createMarketSnapshotService({now:()=>now,session:()=>({isOpen:false,label:'Weekend closure'}),fetchPrice:()=>{throw Error('No live requests');},readSavedPrice:async()=>saved});
  const first=(await get()).xauusd;const second=(await get()).xauusd;
  assert.equal(first.priceSource,'saved_candle');assert.equal(first.price,second.price);assert.equal(first.marketClosed,true);
  assert.equal(savedCandleQuote([],now),null);
});
test('concurrent closed visitors share one saved-price read and all receive it',async()=>{
  let reads=0,resolve;
  const get=createMarketSnapshotService({session:()=>({isOpen:false,label:'Closed'}),fetchPrice:()=>{throw Error('Must not request');},readSavedPrice:()=>{reads++;return new Promise(r=>{resolve=r;});}});
  const first=get(),second=get();resolve({price:4300,time:'2026-09-18T20:55:00Z'});
  const values=await Promise.all([first,second]);
  assert.equal(reads,1);assert.deepEqual(values.map(value=>value.xauusd.price),[4300,4300]);
});
test('closed sessions read saved price once and make no provider calls',async()=>{
  let reads=0;
  const get=createMarketSnapshotService({session:()=>({isOpen:false,label:'Closed'}),fetchPrice:()=>{throw Error('Must not request');},readSavedPrice:async()=>{reads++;return {price:4300,time:'2026-09-18T20:55:00Z'};}});
  assert.equal((await get()).xauusd.price,4300); assert.equal((await get()).xauusd.marketClosed,true);assert.equal(reads,1);
});
test('concurrent open quotes coalesce, freeze on close, refresh on reopen',async()=>{
  let open=true,calls=0,time=0;
  const get=createMarketSnapshotService({now:()=>time,session:()=>({isOpen:open,label:'session'}),fetchPrice:async()=>4300+ ++calls,readSavedPrice:async()=>null});
  await Promise.all([get(),get(),get()]);assert.equal(calls,1);
  open=false;time=40000;assert.equal((await get()).xauusd.price,4301);assert.equal(calls,1);
  open=true;assert.equal((await get()).xauusd.price,4302);
});
test('late provider response cannot move a closed quote',async()=>{
  let open=true,resolve;
  const get=createMarketSnapshotService({session:()=>({isOpen:open,label:'session'}),fetchPrice:()=>new Promise(r=>{resolve=r;}),readSavedPrice:async()=>null});
  const pending=get();open=false;resolve(9999);
  assert.equal((await pending).xauusd.price,null);
});
test('closed history can be read and paged without upstream requests or writes',async()=>{
  const get=createHistoryService({canRefresh:()=>false,store:{read:async()=>[{time:300,close:4300}],save:()=>{throw Error('Must not save');}},fetchCandles:()=>{throw Error('Must not fetch');}});
  for(const before of [undefined,600]){const data=await get('5min',before);assert.equal(data.candles.length,1);assert.equal(data.refreshing,false);assert.match(data.warning,/Market closed/);}
});
