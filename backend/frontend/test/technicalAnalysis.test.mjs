import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseCandles, makeTechnicalPlan } from '../src/lib/technicalAnalysis.js';
import { getGoldSession } from '../src/lib/goldSession.js';
const row = (i, close=100, low=99, high=101, seconds=300) => ({time:(i+1)*seconds,open:close,close,low,high});
const base = (seconds=300) => Array.from({length:20},(_,i)=>row(i,100,99,101,seconds));
const analyse = (rows, interval='5min', seconds=300) => analyseCandles(rows,interval,(rows.at(-1).time+seconds)*1000);

test('price breakout alone, including a same-candle touch, cannot trigger Buy Watch',()=>{
  const a=analyse([...base(),row(20,102,100,103)]);
  assert.equal(a.state,'Breakout · awaiting retest');assert.equal(a.confirmation,'None');
  assert.equal(makeTechnicalPlan(a,{isOpen:true}).signal,'Wait');
});
test('successful later resistance retest confirms Buy Watch',()=>{
  const a=analyse([...base(),row(20,102,100,103),row(21,101.5,100.9,102)]);
  assert.equal(a.confirmation,'Buy Watch');assert.equal(a.state,'Successful retest');
  assert.equal(makeTechnicalPlan(a,{isOpen:true}).signal,'Buy Watch');
});
test('support break requires a failed retest before Sell Watch',()=>{
  const rows=[...base(),row(20,98,97,100)];
  assert.equal(analyse(rows).confirmation,'None');
  const a=analyse([...rows,row(21,98.5,98,99.2)]);
  assert.equal(a.confirmation,'Sell Watch');assert.equal(a.state,'Failed support retest');
  assert.equal(makeTechnicalPlan(a,{isOpen:true}).signal,'Sell Watch');
});
test('support approach starts a separate buy setup and bullish reclaim confirms Support Bounce',()=>{
  const touch = { ...row(20,99.3,99.2,100), open:99.6 };
  const developing = analyse([...base(),touch]);
  assert.equal(developing.state,'Support bounce developing');
  assert.equal(developing.setup.type,'support-bounce');
  assert.equal(developing.confirmation,'None');
  const reclaimed = { ...row(21,99.8,99.3,100), open:99.4 };
  const confirmed = analyse([...base(),touch,reclaimed]);
  assert.equal(confirmed.confirmation,'Support Bounce');
  assert.equal(confirmed.state,'Support bounce confirmed');
  assert.equal(makeTechnicalPlan(confirmed,{isOpen:true}).signal,'Support Bounce');
  assert.equal(makeTechnicalPlan(confirmed,{isOpen:true}).preferred,'Support-bounce buy confirmed');
  assert.match(makeTechnicalPlan(confirmed,{isOpen:true}).invalidation,/support zone/i);
  const bearishHold=analyse([...base(),touch,reclaimed,{...row(22,99.7,99.6,100.2),open:100}]);
  assert.equal(bearishHold.confirmation,'Support Bounce');
  assert.equal(bearishHold.state,'Support bounce confirmed');
  assert.equal(makeTechnicalPlan(confirmed,{isOpen:false}).signal,'Wait');
});
test('support bounce waits for a bullish completed reclaim and invalidates below support',()=>{
  const touch={...row(20,99.3,99.2,100),open:99.6};
  const bearishReclaim={...row(21,99.8,99.3,100),open:100};
  const developing=analyse([...base(),touch,bearishReclaim]);
  assert.equal(developing.confirmation,'None');
  assert.equal(makeTechnicalPlan(developing,{isOpen:true}).signal,'Wait');
  assert.match(makeTechnicalPlan(developing,{isOpen:true}).preferred,/developing/i);
  const invalid=analyse([...base(),touch,row(21,98.5,98,99)]);
  assert.equal(invalid.state,'Support bounce invalidated');
  assert.equal(invalid.confirmation,'None');
  const closeThroughSupport=analyse([...base(),{...row(20,98.95,98.9,99.1),open:99.2}]);
  assert.notEqual(closeThroughSupport.setup?.type,'support-bounce');
  assert.equal(closeThroughSupport.confirmation,'None');
});
test('retest without a close past trigger remains unconfirmed',()=>{
  const a=analyse([...base(),row(20,102,100,103),row(21,101.05,100.9,102)]);
  assert.equal(a.confirmation,'None');
});
test('noise boundary is inclusive and wicks alone cannot establish breaks',()=>{
  for(const close of [101*1.001,99*0.999,100]) {
    const a=analyse([...base(),row(20,close,97,103)]);
    assert.equal(a.confirmation,'None');
    assert.equal(makeTechnicalPlan(a,{isOpen:true}).signal,'Wait');
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
test('technical watch remains independent of macro context',()=>{
  const a=analyse([...base(),row(20,98,97,100),row(21,98.5,98,99.2)]);
  for(const macro of ['Bullish','Bearish','High Conflict','Unavailable']) assert.equal(makeTechnicalPlan(a,{isOpen:true,macro,macroFresh:false}).signal,'Sell Watch');
  assert.equal(a.confirmation,'Sell Watch');
  assert.equal(makeTechnicalPlan(a,{isOpen:false}).signal,'Wait');
  assert.equal(makeTechnicalPlan(a,{isOpen:true,macroFresh:false}).signal,'Sell Watch');
  assert.equal(makeTechnicalPlan({...a,stale:true},{isOpen:true}).signal,'Wait');
});
test('support bounce remains independent of macro context',()=>{
  const touch={...row(20,99.3,99.2,100),open:99.6};
  const reclaim={...row(21,99.8,99.3,100),open:99.4};
  const a=analyse([...base(),touch,reclaim]);
  for(const macro of ['Bullish','Bearish','High Conflict','Unavailable']) assert.equal(makeTechnicalPlan(a,{isOpen:true,macro}).signal,'Support Bounce');
});
test('resistance approach starts a separate sell setup and bearish rejection confirms',()=>{
  const touch={...row(20,100.7,100.2,100.9),open:100.4};
  const developing=analyse([...base(),touch]);
  assert.equal(developing.state,'Resistance rejection developing');
  assert.equal(developing.setup.type,'resistance-rejection');
  assert.equal(developing.confirmation,'None');
  const rejected={...row(21,100.4,100.3,100.8),open:100.6};
  const confirmed=analyse([...base(),touch,rejected]);
  assert.equal(confirmed.confirmation,'Resistance Rejection');
  assert.equal(confirmed.state,'Resistance rejection confirmed');
  assert.equal(makeTechnicalPlan(confirmed,{isOpen:true}).signal,'Resistance Rejection');
  assert.equal(makeTechnicalPlan(confirmed,{isOpen:true}).preferred,'Resistance-rejection sell confirmed');
  assert.match(makeTechnicalPlan(confirmed,{isOpen:true}).invalidation,/resistance zone/i);
  const bearishHold=analyse([...base(),touch,rejected,{...row(22,100.4,100.2,100.9),open:100.7}]);
  assert.equal(bearishHold.confirmation,'Resistance Rejection');
  assert.equal(bearishHold.state,'Resistance rejection confirmed');
});
test('resistance rejection waits for a bearish completed close and invalidates above resistance',()=>{
  const touch={...row(20,100.7,100.2,100.9),open:100.4};
  const bullishReclaim={...row(21,100.4,100.1,100.8),open:100.2};
  const developing=analyse([...base(),touch,bullishReclaim]);
  assert.equal(developing.confirmation,'None');
  assert.equal(makeTechnicalPlan(developing,{isOpen:true}).signal,'Wait');
  assert.match(makeTechnicalPlan(developing,{isOpen:true}).preferred,/developing/i);
  const invalid=analyse([...base(),touch,row(21,101.2,100.8,101.3)]);
  assert.equal(invalid.state,'Resistance rejection invalidated');
  assert.equal(invalid.confirmation,'None');
});
test('resistance rejection remains independent of macro context',()=>{
  const touch={...row(20,100.7,100.2,100.9),open:100.4};
  const rejected={...row(21,100.4,100.3,100.8),open:100.6};
  const analysis=analyse([...base(),touch,rejected]);
  for(const macro of ['Bullish','Bearish','High Conflict','Unavailable']) assert.equal(makeTechnicalPlan(analysis,{isOpen:true,macro}).signal,'Resistance Rejection');
});
test('a confirmed support bounce supersedes an older active resistance rejection',()=>{
  const resistanceTouch={...row(20,100.7,100.2,100.9),open:100.4};
  const supportBounce={...row(21,99.8,99.2,100),open:99.4};
  const a=analyse([...base(),resistanceTouch,supportBounce]);
  assert.equal(a.setup.type,'support-bounce');
  assert.equal(a.state,'Support bounce confirmed');
  assert.equal(a.confirmation,'Support Bounce');
  assert.equal(makeTechnicalPlan(a,{isOpen:true}).signal,'Support Bounce');
});
test('a resistance rejection supersedes an older active support bounce',()=>{
  const supportTouch={...row(20,99.3,99.2,100),open:99.6};
  const supportHold={...row(21,99.4,99.2,100),open:99.6};
  const resistanceReject={...row(22,100.4,100.2,100.9),open:100.6};
  const a=analyse([...base(),supportTouch,supportHold,resistanceReject]);
  assert.equal(a.setup.type,'resistance-rejection');
  assert.equal(a.state,'Resistance rejection confirmed');
  assert.equal(a.confirmation,'Resistance Rejection');
  assert.equal(makeTechnicalPlan(a,{isOpen:true}).signal,'Resistance Rejection');
});
test('a wide candle touching both zones stays neutral instead of choosing a side',()=>{
  const wide={...row(20,100,99.2,100.8),open:99.8};
  const analysis=analyse([...base(),wide]);
  assert.equal(analysis.state,'Conflicting zone touches · wait');
  assert.equal(analysis.confirmation,'None');
  assert.equal(analysis.setup,null);
  assert.equal(makeTechnicalPlan(analysis,{isOpen:true}).signal,'Wait');
  assert.match(makeTechnicalPlan(analysis,{isOpen:true}).reason,/spanned both support and resistance/i);
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
