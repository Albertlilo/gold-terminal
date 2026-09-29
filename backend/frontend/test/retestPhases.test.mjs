import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseCandles, makeTradingPlan } from '../src/lib/technicalAnalysis.js';
const row=(i,close=100,low=99,high=101)=>({time:(i+1)*300,open:close,high,low,close});
const base=()=>Array.from({length:20},(_,i)=>row(i));
const analyse=rows=>analyseCandles(rows,'5min',(rows.at(-1).time+300)*1000);
test('buy retest can touch and recover on different completed candles',()=>{
  const rows=[...base(),row(20,102,100,103),row(21,100.8,100.7,101)];
  assert.equal(analyse(rows).state,'Pullback developing');
  assert.equal(analyse(rows).confirmation,'None');
  const result=analyse([...rows,row(22,101.5,101.2,102)]);
  assert.equal(result.confirmation,'Buy Watch'); assert.equal(result.setup.touchedAt,22*300);
});
test('sell retest can reject on a later candle without touching again',()=>{
  const rows=[...base(),row(20,98,97,100),row(21,99.2,99,99.3)];
  assert.equal(analyse(rows).state,'Pullback developing');
  assert.equal(analyse([...rows,row(22,98.5,98,98.8)]).confirmation,'Sell Watch');
});
test('late retest gets its own deadline and confirmation has a separate ten-bar window',()=>{
  const rows=[...base(),row(20,102,100,103)];
  for(let i=21;i<29;i++)rows.push(row(i,103,102,104));
  rows.push(row(29,100.8,100.7,101));
  rows.push(row(30,100.9,100.7,101));
  assert.equal(analyse(rows).state,'Pullback developing');
  rows.push(row(31,101.5,101.2,102));
  assert.equal(analyse(rows).setup.barsRemaining,10);
  for(let i=32;i<41;i++)rows.push(row(i,101.5,101.2,102));
  assert.equal(analyse(rows).confirmation,'Buy Watch');
  rows.push(row(41,101.5,101.2,102));
  assert.equal(analyse(rows).state,'Setup expired');
});
test('repeated touches cannot extend retest forever and structural invalidation remains',()=>{
  const rows=[...base(),row(20,102,100,103)];
  for(let i=21;i<=31;i++)rows.push(row(i,100.8,100.7,101));
  assert.equal(analyse(rows).state,'Setup expired');
  assert.equal(analyse([...base(),row(20,102,100,103),row(21,100.8,100.7,101),row(22,100.4,100,101)]).state,'Retest invalidated');
});
test('loss of recovery pauses a confirmed watch and macro still gates confirmation',()=>{
  const rows=[...base(),row(20,102,100,103),row(21,101.5,100.9,102)];
  assert.equal(makeTradingPlan('Bearish',analyse(rows),{isOpen:true}).signal,'Wait');
  const weakened=analyse([...rows,row(22,100.8,100.7,101)]);
  assert.equal(weakened.state,'Confirmation weakened'); assert.equal(weakened.confirmation,'None');
});
test('future and forming recovery candles cannot confirm a developing retest',()=>{
  const rows=[...base(),row(20,102,100,103),row(21,100.8,100.7,101)];
  const recovery=row(22,101.5,101.2,102);
  const result=analyseCandles([...rows,recovery],'5min',recovery.time*1000+1);
  assert.equal(result.state,'Pullback developing'); assert.equal(result.confirmation,'None');
});
