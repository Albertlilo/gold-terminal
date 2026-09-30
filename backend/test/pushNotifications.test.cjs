const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createECDH } = require('node:crypto');
const { getConfig, validateSubscription, hash } = require('../src/services/pushConfig');
const { createChecker, checkSlot } = require('../src/services/pushChecker');
const { createDelivery } = require('../src/services/pushDelivery');
const { RULE_VERSION } = require('../src/services/signalAuditService');
function subscription() {
  const ec = createECDH('prime256v1'); ec.generateKeys();
  return { endpoint: 'https://fcm.googleapis.com/fcm/send/test-device', keys: {
    p256dh: ec.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
}
test('configuration fails closed and accepts only matching valid VAPID keys', () => {
  const keys = require('web-push').generateVAPIDKeys();
  const env = { PUSH_ENABLED: 'true', PUSH_ALLOWED_ORIGINS: 'https://example.com', VAPID_SUBJECT: 'https://example.com',
    VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, PUSH_ENROLLMENT_CODE: 'x'.repeat(32) };
  assert.equal(getConfig(env).enabled, true);
  assert.equal(getConfig({}).enabled, false);
  assert.equal(getConfig({...env, VAPID_PRIVATE_KEY: require('web-push').generateVAPIDKeys().privateKey}).enabled, false);
  assert.equal(getConfig({...env, PUSH_ALLOWED_ORIGINS: '*'}).enabled, false);
});
test('subscriptions reject local/arbitrary targets, misleading hosts and malformed keys', () => {
  const value = subscription();
  assert.deepEqual(validateSubscription(value), value);
  for (const endpoint of ['http://fcm.googleapis.com/send/a', 'https://127.0.0.1/a', 'https://fcm.googleapis.com.evil.com/a',
    'https://web.push.apple.com@evil.com/a', 'https://fcm.googleapis.com:8443/a', 'https://evil.com/a']) {
    assert.equal(validateSubscription({...value, endpoint}), null);
  }
  assert.equal(validateSubscription({...value, keys: {p256dh: 'bad', auth: 'bad'}}), null);
});
const close = 1800000000; // Divisible by one hour.
const clock = (close + 65) * 1000;
function audit() {
  return { status: 'saved', revisedInput: false, ruleVersion: RULE_VERSION, analysis: {
    ready: true, stale: false, interval: '1h', lastTime: close - 3600, close: 102, confirmation: 'Buy Watch',
    setup: {direction: 'buy', phase: 'confirmed', breakTime: close - 10800, touchedAt: close - 7200, confirmedAt: close - 3600},
    levels: [{label: 'Buy Watch trigger', price: 101}], zones: [{label: 'Resistance zone', low: 100, high: 101}],
  } };
}
test('checker slots are bounded near candle close for all supported timeframes', () => {
  assert.equal(checkSlot('1h', close * 1000), null);
  assert.ok(checkSlot('1h', clock));
  assert.equal(checkSlot('1h', (close + 900) * 1000), null);
  assert.equal(checkSlot('1day', (close + 3600) * 1000), null);
  assert.equal(checkSlot('bad', clock), null);
  assert.notEqual(checkSlot('1h', clock).key, checkSlot('1h', (close + 365) * 1000).key);
});
test('scheduler shares one request, deduplicates across restarts and does not call history when closed', async () => {
  const slots = new Set(), queued = new Map(); let reads = 0;
  const device = {_id: 'a', interval: '1h', createdAt: new Date((close - 86400) * 1000)};
  const store = { list: async () => [device], claimSlot: async key => { if (slots.has(key)) return false; slots.add(key); return true; },
    enqueue: async (d,p) => queued.set(`${d._id}:${p.id}`, p), setStatus: async () => {} };
  const deps = { store, now: () => clock, session: () => ({isOpen:true}), deliver: async () => ({accepted:0}),
    getHistory: async (_, before, options) => { reads++; assert.equal(before, undefined); assert.equal(options.waitForRefresh, true); return {saved:true,candles:[]}; },
    auditHistory: async () => audit() };
  const check = createChecker(deps);
  await Promise.all([check(),check()]);
  await createChecker(deps)();
  assert.equal(reads, 1); assert.equal(queued.size, 1);
  slots.clear(); await createChecker({...deps,session:()=>({isOpen:false})})(); assert.equal(reads,1);
});
test('checker does not enqueue delayed, revised or previously confirmed history', async () => {
  for (const mode of ['warning','revised','old','new-device']) {
    let enqueued = 0;
    const saved = audit();
    if (mode === 'revised') saved.revisedInput = true;
    if (mode === 'old') saved.analysis.setup.confirmedAt -= 3600;
    const checker = createChecker({now:()=>clock,session:()=>({isOpen:true}),deliver:async()=>({}),
      store:{list:async()=>[{_id:'a',interval:'1h',createdAt:new Date(mode === 'new-device' ? clock : 0)}],claimSlot:async()=>true,
        enqueue:async()=>{enqueued++;},setStatus:async()=>{}},
      getHistory:async()=>({saved:true,candles:[],warning:mode==='warning'?'delayed':null}),auditHistory:async()=>saved});
    await checker(); assert.equal(enqueued,0,mode);
  }
});
test('delivery handles accepted, revoked, deleted, transient and permanent outcomes', async () => {
  for (const code of [null,410,404,429,503,400,'deleted','expired']) {
    let called = 0, removed = false, result;
    const job = {_id:'job',deviceId:'phone',attempts:1,payload:{kind:'test',expiresAt:new Date(clock+(code==='expired'?-1:120000)).toISOString()}};
    let available = true;
    const store = {claimDelivery:async()=>{if(!available)return null;available=false;return job;},
      get:async()=>code==='deleted'?null:{subscription:subscription()},remove:async()=>{removed=true;},
      finish:async(_,status)=>{result=status;}};
    await createDelivery({store,now:()=>clock,send:async()=>{called++;if(code)throw {statusCode:code};}})();
    assert.equal(result, code===null?'accepted':[404,410].includes(code)?'expired-subscription':code==='deleted'?'cancelled':code==='expired'?'expired':[429,503].includes(code)?'pending':'failed');
    assert.equal(removed,[404,410].includes(code));
    if(['deleted','expired'].includes(code))assert.equal(called,0);
  }
});
test('push routes require allowed origin, private enrollment and device ownership', async t => {
  const express = require('express');
  const {createPushRouter} = require('../src/routes/pushRoutes');
  const devices = new Map(); let sends=0, checks=0;
  const cfg={enabled:true,origins:['https://example.com'],vapid:{publicKey:'public'},enrollmentCode:'x'.repeat(32),schedulerSecret:'s'.repeat(32)};
  const storage={get:async id=>devices.get(id),status:async()=>null,
    subscribe:async(id,sub,interval)=>devices.set(id,{_id:id,subscription:sub,interval}),
    remove:async id=>devices.delete(id),claimSlot:async()=>true,enqueue:async()=>{sends++;}};
  const app=express();app.use(express.json());app.use('/api/push',createPushRouter({storage,config:()=>cfg,jobs:{check:async()=>{checks++;return{};},deliver:async()=>{}},now:()=>clock}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/api/push`;
  const token=randomBytes(32).toString('base64url');
  const call=(path,method='GET',body,extra={})=>fetch(base+path,{method,headers:{Origin:'https://example.com',Authorization:`Bearer ${token}`,'Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await call('/status','GET',null,{Origin:'https://evil.com'})).status,403);
  assert.equal((await call('/status','GET',null,{Authorization:''})).status,401);
  const payload={subscription:subscription(),interval:'1h'};
  assert.equal((await call('/subscription','POST',payload)).status,403);
  assert.equal((await call('/subscription','POST',{...payload,enrollmentCode:cfg.enrollmentCode})).status,200);
  assert.ok(devices.has(hash(token)));
  assert.equal((await call('/test','POST')).status,200);assert.equal(sends,1);
  assert.equal((await call('/test','POST',null,{Authorization:`Bearer ${randomBytes(32).toString('base64url')}`})).status,404);
  assert.equal((await call('/run','POST')).status,403);
  assert.equal((await call('/run','POST',null,{Authorization:`Bearer ${cfg.schedulerSecret}`})).status,200);assert.equal(checks,1);
  assert.equal((await call('/subscription','DELETE')).status,200);assert.equal(devices.size,0);
});
