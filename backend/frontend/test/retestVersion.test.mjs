import { test } from 'node:test';
import assert from 'node:assert/strict';
import auditModule from '../../src/services/signalAuditService.js';
import { RULE_VERSION } from '../src/lib/zoneConfirmation.js';
test('new rules use a new audit key and leave original decisions unchanged',async()=>{
  assert.equal(auditModule.RULE_VERSION,RULE_VERSION);
  const old={key:'zones-retest-v1:1h:3600',analysis:{confirmation:'None'}};
  const saved=new Map([[old.key,old]]);
  const record=auditModule.createSignalAuditService({analyse:()=>({ready:true,lastTime:3600,confirmation:'Buy Watch'}),
    session:()=>({isOpen:true}),store:{async insertOnce(event){if(!saved.has(event.key))saved.set(event.key,event);return saved.get(event.key);},async recent(){return [...saved.values()];}}});
  const result=await record('1h',[{time:3600,close:101}]);
  assert.equal(result.ruleVersion,RULE_VERSION); assert.equal(result.analysis.confirmation,'Buy Watch');
  assert.equal(saved.size,2); assert.equal(saved.get(old.key),old);
});
