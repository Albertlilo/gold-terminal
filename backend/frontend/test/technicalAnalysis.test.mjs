import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseCandles, makeTradingPlan } from '../src/lib/technicalAnalysis.js';
import { getGoldSession } from '../src/lib/goldSession.js';
const row = (i, close=100, low=99, high=101, seconds=300) => ({time:(i+1)*seconds,open:close,close,low,high});
const base = (seconds=300) => Array.from({length:20},(_,i)=>row(i,100,99,101,seconds));
const analyse = (rows, interval='5min', seconds=300) => analyseCandles(rows,interval,(rows.at(-1).time+seconds)*1000);

test('price breakout alone, including a same-candle touch, cannot trigger Buy Watch',()=>{
  const a=analyse([...base(),row(20,102,100,103)]);
  assert.equal(a.state,'Breakout · awaiting retest');assert.equal(a.confirmation,'None');
  assert.equal(makeTradingPlan('Bullish',a,{isOpen:true}).signal,'Wait');
});
test('successful later resistance retest confirms Buy Watch',()=>{
  const a=analyse([...base(),row(20,102,100,103),row(21,101.5,100.9,102)]);
  assert.equal(a.confirmation,'Buy Watch');assert.equal(a.state,'Successful retest');
  assert.equal(makeTradingPlan('Bullish',a,{isOpen:true}).signal,'Buy Watch');
});
test('support break requires a failed retest before Sell Watch',()=>{
  const rows=[...base(),row(20,98,97,100)];
  assert.equal(analyse(rows).confirmation,'None');
  const a=analyse([...rows,row(21,98.5,98,99.2)]);
  assert.equal(a.confirmation,'Sell Watch');assert.equal(a.state,'Failed support retest');
  assert.equal(makeTradingPlan('Bearish',a,{isOpen:true}).signal,'Sell Watch');
});
test('retest without a close past trigger remains unconfirmed',()=>{
  const a=analyse([...base(),row(20,102,100,103),row(21,101.05,100.9,102)]);
  assert.equal(a.confirmation,'None');
});
test('noise boundary is inclusive and wicks alone cannot establish breaks',()=>{
  for(const close of [101*1.001,99*0.999,100]) {
    const a=analyse([...base(),row(20,close,97,103)]);
    assert.equal(a.state,'Between zones');assert.equal(a.confirmation,'None');
  }
});
test('zones freeze at break rather than incorporating new highs',()=>{
  const broken=[...base(),row(20,102,100,103)];
  const a=analyse([...broken,row(21,103,102,200),row(22,101.5,100.9,102)]);
  assert.deepEqual(a.zones,analyse(broken).zones);assert.equal(a.confirmation,'Buy Watch');
});
test('wrong-side close invalidates and a late retest cannot revive expired setup',()=>{
  assert.equal(analyse([...base(),row(20,102,100,103),row(21,100,99,102)]).state,'Retest invalidated');
  const rows=[...base(),row(20,102,100,103)];
  for(let i=21;i<30;i++) rows.push(row(i,103,102,104));
  rows.push(row(30,101.5,100.9,102));
  assert.equal(analyse(rows).state,'Setup expired');assert.equal(analyse(rows).confirmation,'None');
});
test('forming and future candles do not confirm, invalid data cannot signal',()=>{
  const broken=[...base(),row(20,102,100,103)];
  const rows=[...broken,row(21,101.5,100.9,102)];
  assert.equal(analyseCandles(rows,'5min',rows.at(-1).time*1000+1000).confirmation,'None');
  assert.equal(analyseCandles([...rows,{...row(22),close:NaN}],'5min',99999999).ready,false);
  assert.equal(analyse(base()).ready,false);
});
test('macro filter remains independent of technical confirmation',()=>{
  const a=analyse([...base(),row(20,98,97,100),row(21,98.5,98,99.2)]);
  for(const macro of ['Bullish','High Conflict','Unavailable']) assert.equal(makeTradingPlan(macro,a,{isOpen:true}).signal,'Wait');
  assert.equal(a.confirmation,'Sell Watch');
  assert.equal(makeTradingPlan('Bearish',a,{isOpen:false}).signal,'Wait');
  assert.equal(makeTradingPlan('Bearish',a,{isOpen:true,macroFresh:false}).signal,'Wait');
  assert.equal(makeTradingPlan('Bearish',{...a,stale:true},{isOpen:true}).signal,'Wait');
});
test('hourly and daily bars each require their own completed break and retest',()=>{
  for(const [interval,s] of [['1h',3600],['1day',86400]]){
    const a=analyse([...base(s),row(20,102,100,103,s),row(21,101.5,100.9,102,s)],interval,s);
    assert.equal(a.confirmation,'Buy Watch');
  }
});
test('standard session applies weekend and daylight-saving boundaries',()=>{
  assert.equal(getGoldSession(Date.parse('2026-09-20T21:59:00Z')).isOpen,false);
  assert.equal(getGoldSession(Date.parse('2026-09-20T22:00:00Z')).isOpen,true);
  assert.equal(getGoldSession(Date.parse('2026-01-11T22:59:00Z')).isOpen,false);
  assert.equal(getGoldSession(Date.parse('2026-01-11T23:00:00Z')).isOpen,true);
});
