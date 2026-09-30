import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTechnicalPlan } from '../src/lib/technicalAnalysis.js';
const analysis = { ready: true, stale: false, state: 'Successful retest', confirmation: 'Buy Watch' };
test('technical Buy Watch ignores opposing or unavailable macro input', () => {
  for(const macro of ['Bearish','Unavailable','Bullish']) {
    const plan = makeTechnicalPlan(analysis, {isOpen:true,macro,macroFresh:false});
    assert.equal(plan.signal,'Buy Watch');
    assert.doesNotMatch(plan.reason,/macro/i);
  }
});
test('WAIT distinguishes retest, expiry, invalidation and data/session blocks', () => {
  for (const [state, pattern] of [['Breakout · awaiting retest',/not yet been touched/],['Pullback developing',/recovery close/],['Confirmation weakened',/watch is paused/],['Setup expired',/phase limit/],['Retest invalidated',/closed through/],['Between zones',/Crossing a price line alone/]]) {
    assert.match(makeTechnicalPlan({...analysis,state,confirmation:'None'},{isOpen:true}).reason,pattern);
  }
  assert.match(makeTechnicalPlan(analysis,{isOpen:false}).reason,/Market closed/);
  assert.equal(makeTechnicalPlan(analysis,{isOpen:true,macroFresh:false}).signal,'Buy Watch');
  assert.match(makeTechnicalPlan({...analysis,stale:true},{isOpen:true}).reason,/Candle data is delayed/);
  assert.equal(makeTechnicalPlan(analysis,{isOpen:true}).signal,'Buy Watch');
});
