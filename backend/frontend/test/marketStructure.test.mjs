import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMarketStructure } from '../src/lib/marketStructure.js';

const make = (i, close, high, low) => ({ time: (i + 1) * 3600, open: close, close, high, low });
const trend = [
  make(0,10,11,9), make(1,11,12,10), make(2,12,14,10), make(3,11,12,10),
  make(4,10,11,8), make(5,11,12,9), make(6,13,16,10), make(7,12,14,11),
  make(8,11,13,10), make(9,12,14,11), make(10,12,14,11), make(11,17,18,12),
  make(12,9,13,8),
];

function legacyMarketStructure(rows) {
  const radius = 2;
  const highs = [], lows = [];
  for (let index = radius; index < rows.length - radius; index++) {
    const pivot = rows[index];
    const neighbours = rows.slice(index - radius, index + radius + 1);
    const availableAt = rows[index + radius].time;
    if (pivot.high > rows[index - 1].high && neighbours.every(row => pivot.high >= row.high)) highs.push({ price: pivot.high, time: pivot.time, availableAt, index });
    if (pivot.low < rows[index - 1].low && neighbours.every(row => pivot.low <= row.low)) lows.push({ price: pivot.low, time: pivot.time, availableAt, index });
  }
  const classify = (hs, ls) => {
    const ph=hs.at(-2), lh=hs.at(-1), pl=ls.at(-2), ll=ls.at(-1);
    if (!ph || !lh || !pl || !ll) return 'Sideways / uncertain';
    if (lh.price>ph.price && ll.price>pl.price) return 'Higher highs + higher lows';
    if (lh.price<ph.price && ll.price<pl.price) return 'Lower highs + lower lows';
    return 'Sideways / uncertain';
  };
  if(rows.length<9) return {trend:'Sideways / uncertain',event:'No confirmed structure break',eventAt:null,swingHighs:[],swingLows:[]};
  const activeHighs=[], activeLows=[], highPoints=[], lowPoints=[];
  let hi=0,li=0,latest=null;
  for(let index=0;index<rows.length;index++) {
    while(hi<highs.length&&highs[hi].availableAt<=rows[index].time) { const p=highs[hi++]; activeHighs.push(p);highPoints.push({...p,eligibleIndex:p.index+radius+1,crossed:false}); }
    while(li<lows.length&&lows[li].availableAt<=rows[index].time) { const p=lows[li++]; activeLows.push(p);lowPoints.push({...p,eligibleIndex:p.index+radius+1,crossed:false}); }
    if(!index) continue;
    const prior=rows[index-1].close,close=rows[index].close;
    for(const p of highPoints) if(!p.crossed&&p.eligibleIndex<=index&&prior<=p.price&&close>p.price) {
      const reversal=classify(activeHighs,activeLows)==='Lower highs + lower lows';
      latest={kind:'up',time:rows[index].time,price:p.price,label:reversal?'CHoCH':'BOS'};p.crossed=true;
    }
    for(const p of lowPoints) if(!p.crossed&&p.eligibleIndex<=index&&prior>=p.price&&close<p.price) {
      const reversal=classify(activeHighs,activeLows)==='Higher highs + higher lows';
      latest={kind:'down',time:rows[index].time,price:p.price,label:reversal?'CHoCH':'BOS'};p.crossed=true;
    }
  }
  const recent=latest&&rows.at(-1).time-latest.time<=20*(rows.at(-1).time-rows.at(-2).time);
  return {trend:classify(highs,lows),event:latest?`${recent?'Recent ':'Last '}${latest.label} ${latest.kind==='up'?'up':'down'}`:'No confirmed structure break',eventAt:latest?.time??null,
    swingHighs:highs.slice(-2).map(({price,time,availableAt})=>({price,time,availableAt})),swingLows:lows.slice(-2).map(({price,time,availableAt})=>({price,time,availableAt}))};
}

test('confirmed swing sequences classify higher highs and higher lows with a BOS', () => {
  const result = analyzeMarketStructure(trend.slice(0,12));
  assert.equal(result.trend,'Higher highs + higher lows');
  assert.equal(result.event,'Recent BOS up');
  assert.equal(result.eventAt,trend[11].time);
});

test('a later break against the established trend is labelled CHoCH without rewriting the earlier read', () => {
  const before = analyzeMarketStructure(trend.slice(0,12));
  const after = analyzeMarketStructure(trend);
  assert.equal(before.event,'Recent BOS up');
  assert.equal(after.event,'Recent CHoCH down');
  assert.equal(after.trend,'Higher highs + higher lows');
});

test('flat candles do not manufacture swing sequences', () => {
  const rows = Array.from({length:20},(_,i)=>make(i,100,101,99));
  const result = analyzeMarketStructure(rows);
  assert.equal(result.trend,'Sideways / uncertain');
  assert.equal(result.event,'No confirmed structure break');
});

test('optimized structure scan matches the prior chronological algorithm across seeded histories', () => {
  let seed=0x12345678;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/0x100000000;};
  for(let sample=0;sample<120;sample++) {
    const rows=[];let close=100;
    const length=9+Math.floor(random()*240);
    for(let i=0;i<length;i++) {
      close += (random()-0.5)*5;
      const spread=0.2+random()*2;
      rows.push({time:(i+1)*300,open:close+(random()-0.5),close,high:close+spread,low:close-spread});
    }
    assert.deepEqual(analyzeMarketStructure(rows),legacyMarketStructure(rows),`seeded sample ${sample}`);
  }
});

test('missing timestamps do not create synthetic candles or premature swing confirmation', () => {
  const rows=trend.map((item,index)=>({...item,time:item.time+(index>=4?3*3600:0)}));
  const partial=analyzeMarketStructure(rows.slice(0,4));
  const completed=analyzeMarketStructure(rows.slice(0,9));
  assert.equal(partial.swingHighs.length,0);
  assert.ok(completed.swingHighs.some(point=>point.time===rows[2].time));
  assert.deepEqual(completed,legacyMarketStructure(rows.slice(0,9)));
});
