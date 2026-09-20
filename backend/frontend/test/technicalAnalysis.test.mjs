import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseCandles, makeTradingPlan } from '../src/lib/technicalAnalysis.js';
import { getGoldSession } from '../src/lib/goldSession.js';
const candle = (time, close) => ({time,open:close,high:close+1,low:close-1,close});
test('inclusive noise boundaries remain between levels', () => {
  for(const price of [999,1000,1001]) {
    const a=analyseCandles([candle(300,1000),candle(600,1000),candle(900,price)],'5min',1200000);
    assert.equal(a.state,'Between Levels');
  }
});
test('forming candles cannot confirm a signal and timeframes remain separate', () => {
  const rows=[candle(300,1000),candle(600,1000),candle(900,1000),candle(1200,1050)];
  const a=analyseCandles(rows,'5min',1201000);
  assert.equal(a.count,3); assert.equal(a.state,'Between Levels');
  assert.equal(analyseCandles(rows,'1h',1201000).ready,false);
});
test('analysis needs three valid closes; invalid data does not generate a setup',()=>{
  assert.equal(analyseCandles([candle(300,1000),candle(600,1000)],'5min',1200000).ready,false);
  assert.equal(analyseCandles([candle(300,1000),candle(600,1000),candle(900,NaN)],'5min',1200000).ready,false);
});
test('macro direction, freshness and market closure gate confirmation',()=>{
  const a=analyseCandles([candle(300,1000),candle(600,999),candle(900,998)],'5min',1200000);
  assert.equal(makeTradingPlan('Bearish',a,{isOpen:true}).signal,'Sell Watch');
  assert.equal(makeTradingPlan('Bullish',a,{isOpen:true}).signal,'Wait');
  assert.equal(makeTradingPlan('High Conflict',a,{isOpen:true}).signal,'Wait');
  assert.equal(makeTradingPlan('Bearish',a,{isOpen:false}).signal,'Wait');
  assert.equal(makeTradingPlan('Bearish',a,{isOpen:true,macroFresh:false}).signal,'Wait');
  assert.equal(makeTradingPlan('Bearish',{...a,stale:true},{isOpen:true}).signal,'Wait');
});
test('daily and hourly analysis use their own completed windows',()=>{
  for(const [interval,seconds] of [['1h',3600],['1day',86400]]) {
    const a=analyseCandles([candle(seconds,1000),candle(seconds*2,1001),candle(seconds*3,1003)],interval,seconds*4000);
    assert.equal(a.state,'Above Buy Watch'); assert.equal(a.count,3);
    assert.equal(makeTradingPlan('Bullish',a,{isOpen:true}).signal,'Buy Watch');
  }
});
test('NY session handles weekends, daily break, and daylight saving',()=>{
  for(const stamp of ['2026-09-18T21:00:00Z','2026-09-19T14:00:00Z','2026-09-20T21:59:59Z','2026-09-21T21:30:00Z','2026-01-09T22:00:00Z']) assert.equal(getGoldSession(Date.parse(stamp)).isOpen,false,stamp);
  for(const stamp of ['2026-09-18T20:59:59Z','2026-09-20T22:00:00Z','2026-09-21T22:00:00Z','2026-01-11T23:00:00Z']) assert.equal(getGoldSession(Date.parse(stamp)).isOpen,true,stamp);
});
