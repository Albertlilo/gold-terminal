import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backtestCandles, riskReward } from '../src/lib/technicalBacktest.js';
import { analyseCandles } from '../src/lib/technicalAnalysis.js';

const start = Date.parse('2026-10-19T22:00:00Z') / 1000;
const row = (i, close=100, low=99, high=101, open=close) => ({time:start+(i+1)*300,open,close,low,high});
const base = () => {
  const candles = Array.from({length:50}, (_,i) => row(i));
  // Three completed, separated rejection wicks above the established range
  // create a known overhead target without moving the live trigger zone.
  for (const i of [23,29,35]) candles[i] = {...candles[i], high:110};
  return candles;
};
const setup = () => [...base(), row(50,102,100,103), row(51,101.5,100.9,102)];
const options = { now: 9999999999999, cost: 0.2 };
const session = () => ({isOpen:true});

test('replay uses next-bar entry, structural target, round-trip friction and conservative stop-first fills', () => {
  const rows = [...setup(), row(52,102,99,110,102)];
  const result = backtestCandles(rows,'5min',options,session);
  assert.equal(result.trades.length,1);
  const trade = result.trades[0];
  const signal = analyseCandles(setup(),'5min',(rows[rows.length-2].time+300)*1000);
  assert.equal(trade.entryTime,rows.at(-1).time);
  assert.equal(trade.signalTime,signal.setup.confirmedAt);
  assert.equal(trade.entry,102);
  assert.equal(trade.stop,signal.risk.stop);
  assert.equal(trade.target,signal.risk.target);
  assert.equal(trade.reason,'Stop (first if ambiguous)');
  assert.ok(Math.abs(trade.net-(trade.stop-trade.entry-options.cost))<1e-10);
  assert.equal(result.sampleSize,1);
  assert.equal(result.winRate,0);
  assert.ok(result.averageRewardRisk >= 1.5);
  assert.ok(result.expectancyR < 0);
  assert.ok(result.maxDrawdownR > 0);
});

test('future bars cannot rewrite earlier signals or finished trades', () => {
  const rows=[...setup(),row(52,102,99,110,102)];
  const prefix=backtestCandles(rows,'5min',options,session);
  const longer=backtestCandles([...rows,row(53,900,1,1000)],'5min',options,session);
  assert.deepEqual(longer.trades.slice(0,1),prefix.trades);
  assert.deepEqual(longer.signals.slice(0,1),prefix.signals);
  const candleForming=rows.at(-2);
  const asOf=analyseCandles(rows,'5min',candleForming.time*1000+1000);
  assert.equal(asOf.confirmation,'None');
});

test('forming bars and closed sessions cannot create entries', () => {
  const rows=[...setup(),row(52,102,101,103,102)];
  const beforeEntryClose=(rows.at(-2).time+300)*1000-1;
  assert.equal(backtestCandles(rows,'5min',{...options,now:beforeEntryClose},session).trades.length,0);
  assert.equal(backtestCandles(rows,'5min',options,()=>({isOpen:false})).trades.length,0);
});

test('gap through structural stop fills at the worse open and unfinished trades stay separate', () => {
  const rows=[...setup(),row(52,102,101,103,102)];
  const open=backtestCandles(rows,'5min',options,session);
  assert.ok(open.openTrade);
  const result=backtestCandles([...rows,row(53,99,98,100,99)],'5min',options,session);
  assert.equal(result.trades[0].exit,99);
  assert.equal(result.trades[0].reason,'Gap through stop');
  assert.equal(result.openTrade,null);
});

test('a narrow support reaction fails the minimum structural reward/risk gate', () => {
  const touch=row(50,99.3,99.2,100,99.6);
  const reclaim=row(51,99.8,99.3,100,99.4);
  const rows=[...Array.from({length:50},(_,i)=>row(i)),touch,reclaim];
  const result=analyseCandles(rows,'5min',(rows.at(-1).time+300)*1000);
  assert.equal(result.setup.type,'support-bounce');
  assert.equal(result.confirmation,'None');
  assert.equal(result.risk.qualified,false);
  assert.ok(result.risk.rewardRisk < result.risk.minRewardRisk);
});

test('risk reward rejects invalid directions and price ordering', () => {
  assert.equal(riskReward(100,99,102,'buy').ratio,2);
  assert.equal(riskReward(100,101,98,'sell').ratio,2);
  assert.equal(riskReward(100,101,102,'buy'),null);
  assert.equal(riskReward(0,99,102,'buy'),null);
});
