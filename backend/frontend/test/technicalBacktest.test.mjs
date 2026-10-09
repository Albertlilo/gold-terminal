import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backtestCandles, riskReward } from '../src/lib/technicalBacktest.js';
import { analyseCandles } from '../src/lib/technicalAnalysis.js';
const row = (i, close=100, low=99, high=101, open=close) => ({time:(i+1)*300,open,close,low,high});
const base = () => [...Array.from({length:20},(_,i)=>row(i)),row(20,102,100,103),row(21,101.5,100.9,102)];
const options = { now: 99999999, cost: 0.2 };
const session = () => ({isOpen:true});
test('replay enters after confirmation, deducts costs and resolves ambiguous bar to stop', () => {
  const result = backtestCandles([...base(),row(22,102,99,110,102)],'5min',options,session);
  assert.equal(result.trades.length,1);
  const trade = result.trades[0];
  const expectedStop=analyseCandles(base(),'5min',23*300*1000).zones.find(zone=>zone.label==='Resistance zone').low;
  assert.equal(trade.entryTime,23*300); assert.equal(trade.signalTime,22*300);
  assert.equal(trade.entry,102); assert.equal(trade.exit,expectedStop);
  assert.ok(Math.abs(trade.net-(expectedStop-102-options.cost))<1e-10);
});
test('future bars cannot change earlier signals or completed trades', () => {
  const rows=[...base(),row(22,102,99,110,102)];
  const prefix=backtestCandles(rows,'5min',options,session);
  const longer=backtestCandles([...rows,row(23,900,1,1000)],'5min',options,session);
  assert.deepEqual(longer.trades.slice(0,1),prefix.trades);
  assert.deepEqual(longer.signals.slice(0,1),prefix.signals);
  const known=analyseCandles(base(),'5min',23*300*1000);
  const withFuture=analyseCandles([...base(),row(50,900,1,1000)],'5min',23*300*1000);
  assert.deepEqual(withFuture,known);
});
test('forming bars and closed session cannot be used for entries', () => {
  const rows=[...base(),row(22,102,99,110,102)];
  assert.equal(backtestCandles(rows,'5min',{...options,now:23*300*1000},session).trades.length,0);
  assert.equal(backtestCandles(rows,'5min',options,()=>({isOpen:false})).trades.length,0);
});
test('gap stop fills at worse opening price, unfinished trades stay separate', () => {
  const rows=[...base(),row(22,102,101,103,102)];
  assert.ok(backtestCandles(rows,'5min',options,session).openTrade);
  const result=backtestCandles([...rows,row(23,99,98,100,99)],'5min',options,session);
  assert.equal(result.trades[0].exit,99); assert.equal(result.openTrade,null);
});
test('support-bounce replay uses the support zone edge for invalidation', () => {
  const touch=row(20,99.3,99.2,100,99.6);
  const reclaim=row(21,99.8,99.3,100,99.4);
  const result=backtestCandles([...Array.from({length:20},(_,i)=>row(i)),touch,reclaim,row(22,100,99.5,101,100)],'5min',options,session);
  assert.equal(result.openTrade.direction,'buy');
  assert.equal(result.openTrade.stop,99);
  assert.equal(result.openTrade.signalTime,22*300);
});
test('resistance-rejection replay uses the resistance zone edge for invalidation', () => {
  const touch=row(20,100.7,100.2,100.9,100.4);
  const reject=row(21,100.4,100.3,100.8,100.6);
  const result=backtestCandles([...Array.from({length:20},(_,i)=>row(i)),touch,reject,row(22,100.5,100.2,100.7,100.5)],'5min',options,session);
  assert.equal(result.openTrade.direction,'sell');
  assert.equal(result.openTrade.stop,101);
  assert.equal(result.openTrade.signalTime,22*300);
});
test('replay handles a support setup before resistance has qualified', () => {
  const supportOnly=Array.from({length:20},(_,i)=>row(i,100,90,101+i*0.1));
  const touch=row(20,91.5,91,93,92);
  const reclaim=row(21,93,91,94,91.5);
  const result=backtestCandles([...supportOnly,touch,reclaim,row(22,94,93,95,94)],'5min',options,session);
  assert.equal(result.openTrade.direction,'buy');
  assert.equal(result.openTrade.stop,90);
});
test('replay handles a resistance setup before support has qualified', () => {
  const resistanceOnly=Array.from({length:20},(_,i)=>row(i,100,99-i*0.1,110));
  const touch=row(20,108.5,106,109,108);
  const reject=row(21,107,106,109,109);
  const result=backtestCandles([...resistanceOnly,touch,reject,row(22,106,105,107,106)],'5min',options,session);
  assert.equal(result.openTrade.direction,'sell');
  assert.equal(result.openTrade.stop,110);
});
test('risk reward rejects invalid directions and price ordering', () => {
  assert.equal(riskReward(100,99,102,'buy').ratio,2);
  assert.equal(riskReward(100,101,98,'sell').ratio,2);
  assert.equal(riskReward(100,101,102,'buy'),null);
  assert.equal(riskReward(0,99,102,'buy'),null);
});
