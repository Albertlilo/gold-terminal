const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const source = readFileSync(join(__dirname, '../frontend/public/push-sw.js'), 'utf8');
test('worker displays setup details, replaces duplicates and opens only its own chart', async () => {
  const handlers = {}, shown = []; let opened;
  const self = {addEventListener:(type,handler)=>{handlers[type]=handler;},location:{origin:'https://example.com'},
    registration:{showNotification:async(title,options)=>{shown.push({title,...options});}},
    clients:{matchAll:async()=>[],openWindow:async url=>{opened=url;}}};
  vm.runInNewContext(source, {self,URL,Date,Number});
  assert.equal(handlers.fetch,undefined);
  const payload={id:'unique',kind:'technical-retest-confirmed',title:'Buy Watch',body:'Confirmed',interval:'1h',
    expiresAt:new Date(Date.now()+60000).toISOString(),confirmationClose:4300,trigger:4299,
    invalidation:{condition:'completed-close-below',price:4280},confirmedAt:'2026-09-30T12:00:00Z'};
  let pending;
  handlers.push({data:{json:()=>payload},waitUntil:p=>{pending=p;}});await pending;
  assert.equal(shown[0].tag,'unique');assert.match(shown[0].body,/4300.00/);
  assert.match(shown[0].body,/completed close below 4280.00/);assert.equal(shown[0].renotify,false);
  handlers.notificationclick({notification:{close:()=>{},data:shown[0].data},waitUntil:p=>{pending=p;}});await pending;
  assert.equal(opened,'https://example.com/?page=technicals&interval=1h');
  handlers.notificationclick({notification:{close:()=>{},data:{url:'https://evil.com/'}},waitUntil:p=>{pending=p;}});await pending;
  assert.equal(opened,'https://example.com/?page=technicals');
  handlers.push({data:{json:()=>({...payload,expiresAt:new Date(0).toISOString()})},waitUntil:p=>{pending=p;}});await pending;
  assert.match(shown[1].title,/delayed/);assert.doesNotMatch(shown[1].body,/Confirmed/);
});
