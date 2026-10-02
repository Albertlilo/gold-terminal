const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAccountAccess}=require('../src/services/accountAccess');
const {createDelivery}=require('../src/services/pushDelivery');
function response(){return {code:200,status(code){this.code=code;return this;},set(){},json(body){this.body=body;}};}
function request(token){return {get:()=>token};}
test('only verified identities and unexpired server grants unlock premium',async()=>{
  let grant={status:'active',paidThrough:new Date(2000)};
  const access=createAccountAccess({verify:async token=>{if(token==='forged')throw Object.assign(Error(),{code:'auth/invalid-id-token'});return {uid:token,email_verified:token!=='unverified'};},readGrant:async()=>grant,now:()=>1000,owners:()=>['owner']});
  for(const [token,expected] of [['',401],['Bearer forged',401],['Bearer unverified',403],['Bearer member',200],['Bearer owner',200]]){
    const res=response();let passed=false;await access.requirePremium(request(token),res,()=>{passed=true;});
    // Middleware verification and grant lookup resolve on separate microtasks.
    await new Promise(setImmediate);assert.equal(res.code,expected);assert.equal(passed,expected===200);
  }
  for(const next of [{status:'cancelled',paidThrough:new Date(2000)},{status:'active',paidThrough:new Date(1000)},null,{status:'active',paidThrough:'bad'}]){
    grant=next;assert.equal((await access.entitlement('member')).premium,false);
  }
  assert.equal((await access.entitlement('owner')).premium,true);
});
test('missing configuration and grant-store failures deny access without leaking details',async()=>{
  const unavailable=createAccountAccess({verify:async()=>{throw {code:'auth/configuration-unavailable'};},readGrant:async()=>null});
  const res=response();await unavailable.authenticate(request('Bearer token'),res,()=>assert.fail());assert.equal(res.code,503);
  const failed=createAccountAccess({verify:async()=>({uid:'user',email_verified:true}),readGrant:async()=>{throw Error('database password');}});
  const denied=response();await failed.requirePremium(request('Bearer token'),denied,()=>assert.fail());await new Promise(setImmediate);
  assert.equal(denied.code,503);assert.doesNotMatch(JSON.stringify(denied.body),/password/);
});
test('delivery checks entitlement at send time and fails closed by default',async()=>{
  for(const canDeliver of [undefined,async()=>false,async()=>{throw Error('store unavailable');}]){
    let queued=true,sent=0,finish;
    const store={claimDelivery:async()=>{if(!queued)return null;queued=false;return {_id:'job',deviceId:'device',attempts:1,payload:{expiresAt:new Date(Date.now()+60000).toISOString(),kind:'test'}};},
      get:async()=>({ownerUid:'expired'}),finish:async(_,status)=>{finish=status;}};
    await createDelivery({store,send:async()=>{sent++;},...(canDeliver?{canDeliver}:{})})();
    assert.equal(sent,0);assert.ok(['access-denied','pending'].includes(finish));
  }
});
test('every existing premium route rejects anonymous requests before market or database work',async t=>{
  const express=require('express'),app=express();
  app.use('/api/fred',require('../src/routes/fredRoutes'));
  app.use('/api/market',require('../src/routes/marketRoutes'));
  app.use('/api/users',require('../src/routes/usersRoutes'));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  for(const path of ['/api/fred/dashboard','/api/fred/gold-score','/api/fred/2y','/api/market/gold/history?interval=1h','/api/market/gold/history?before=1000','/api/users']){
    const result=await fetch(`http://127.0.0.1:${server.address().port}${path}`);assert.equal(result.status,401,path);
  }
});
