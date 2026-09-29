import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTradingPlan } from '../src/lib/technicalAnalysis.js';
const analysis = { ready: true, stale: false, state: 'Successful retest', confirmation: 'Buy Watch' };
test('WAIT explains a confirmed technical signal blocked by macro bias', () => {
  const plan = makeTradingPlan('Bearish', analysis, {isOpen:true});
  assert.equal(plan.signal,'Wait');
  assert.match(plan.reason,/Technical Buy Watch is confirmed/);
  assert.match(plan.reason,/requires Bullish macro/);
});
test('WAIT distinguishes retest, expiry, invalidation and data/session blocks', () => {
  for (const [state, pattern] of [['Breakout · awaiting retest',/not yet been touched/],['Pullback developing',/recovery close/],['Confirmation weakened',/watch is paused/],['Setup expired',/phase limit/],['Retest invalidated',/closed through/],['Between zones',/Crossing a price line alone/]]) {
    assert.match(makeTradingPlan('Bullish',{...analysis,state,confirmation:'None'},{isOpen:true}).reason,pattern);
  }
  assert.match(makeTradingPlan('Bullish',analysis,{isOpen:false}).reason,/Market closed/);
  assert.match(makeTradingPlan('Bullish',analysis,{isOpen:true,macroFresh:false}).reason,/Macro data is delayed/);
  assert.match(makeTradingPlan('Bullish',{...analysis,stale:true},{isOpen:true}).reason,/Candle data is delayed/);
  assert.equal(makeTradingPlan('Bullish',analysis,{isOpen:true}).signal,'Buy Watch');
});
