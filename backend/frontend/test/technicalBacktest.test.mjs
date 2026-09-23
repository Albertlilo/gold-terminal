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
  assert.equal(trade.entryTime,23*300); assert.equal(trade.signalTime,22*300);
  assert.equal(trade.entry,102); assert.equal(trade.exit,100.5);
  assert.ok(Math.abs(trade.net + 1.7) < 1e-10);
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
test('risk reward rejects invalid directions and price ordering', () => {
  assert.equal(riskReward(100,99,102,'buy').ratio,2);
  assert.equal(riskReward(100,101,98,'sell').ratio,2);
  assert.equal(riskReward(100,101,102,'buy'),null);
  assert.equal(riskReward(0,99,102,'buy'),null);
});
