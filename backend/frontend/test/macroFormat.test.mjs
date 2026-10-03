import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMacroObservation } from '../src/lib/macroFormat.mjs';
test('macro display formats transformed inflation and jobs instead of raw totals', () => {
  assert.equal(formatMacroObservation({value:130.455,display:{value:2.7,unit:'% YoY',decimals:2,signed:false}}),'2.70 % YoY');
  assert.equal(formatMacroObservation({value:159044,display:{value:29,unit:'K jobs',decimals:0,signed:true}}),'+29 K jobs');
  assert.equal(formatMacroObservation({value:132000000,display:{value:-12,unit:'K jobs',decimals:0,signed:true}}),'-12 K jobs');
});
test('missing transformed values never fall back to misleading raw index levels', () => {
  assert.equal(formatMacroObservation({value:130.455}),'Unavailable');
  assert.equal(formatMacroObservation({value:130.455,display:{value:null,unit:'% YoY',decimals:2}}),'Unavailable');
});
