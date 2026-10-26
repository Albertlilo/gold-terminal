import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessTechnicalRisk, estimatePositionSize } from '../src/lib/technicalRisk.js';

const setup = { type:'support-bounce', direction:'buy' };
const zones = { support:{role:'support',label:'Support zone',low:90,high:91,status:'active'},
  resistance:{role:'resistance',label:'Resistance zone',low:110,high:111,status:'active'},
  targets:[{role:'resistance',label:'Resistance zone',low:110,high:111,status:'active'}] };

test('a structural target with adequate R:R qualifies and exposes ATR, entry, stop and target', () => {
  const risk = assessTechnicalRisk({setup,zones,entry:92,atr:1,breakBuffer:0.5});
  assert.equal(risk.qualified,true);
  assert.ok(risk.rewardRisk >= 1.5);
  assert.equal(risk.entryArea.low,92);
  assert.equal(risk.stop,89.5);
  assert.equal(risk.target,110);
  assert.equal(risk.atr,1);
});

test('missing or too-close structural targets are rejected', () => {
  const missing = assessTechnicalRisk({setup,zones:{...zones,targets:[]},entry:92,atr:1,breakBuffer:0.5});
  const close = assessTechnicalRisk({setup,zones:{...zones,targets:[{role:'resistance',label:'Near resistance',low:94,high:95,status:'active'}]},entry:92,atr:1,breakBuffer:0.5});
  assert.equal(missing.qualified,false);
  assert.equal(close.qualified,false);
  assert.ok(close.rewardRisk < 1.5);
});

test('position size estimate follows the supplied account risk and stop distance', () => {
  assert.deepEqual(estimatePositionSize({balance:10000,riskPercent:1,stopDistance:2}),{riskBudget:100,estimatedOunces:50});
  assert.equal(estimatePositionSize({balance:10000,riskPercent:0,stopDistance:2}),null);
});
