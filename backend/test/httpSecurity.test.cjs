const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { installHttpSecurity, safeErrors } = require('../src/services/httpSecurity');
async function server(t, options={}) {
 const app=express(); installHttpSecurity(app,{env:{NODE_ENV:'production'},...options});
 app.use(express.json({limit:'16kb'}));
 app.get('/api/check',(req,res)=>res.json({ok:true}));
 app.post('/api/check',(req,res)=>res.json({ok:true}));
 app.post('/api/push/run',(req,res)=>res.status(403).json({message:'Scheduled check not authorized.'}));
 app.get('/api/failure',()=>{throw new Error('secret-internal-value');});
 app.use(safeErrors);
 const http=app.listen(0,'127.0.0.1'); await new Promise(resolve=>http.once('listening',resolve));
 t.after(()=>{http.closeAllConnections();http.close();});
 return 'http://127.0.0.1:'+http.address().port;
}
test('allowed frontend can access API; unapproved origins are rejected with no wildcard',async t=>{
 const url=await server(t);
 const good=await fetch(url+'/api/check',{headers:{Origin:'https://gold-terminal-1.onrender.com'}});
 assert.equal(good.status,200); assert.equal(good.headers.get('access-control-allow-origin'),'https://gold-terminal-1.onrender.com');
 assert.equal(good.headers.get('x-content-type-options'),'nosniff'); assert.equal(good.headers.get('x-powered-by'),null);
 const bad=await fetch(url+'/api/check',{headers:{Origin:'https://attacker.example'}}); assert.equal(bad.status,403);
 const options=await fetch(url+'/api/check',{method:'OPTIONS',headers:{Origin:'https://gold-terminal-1.onrender.com','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,x-device-token'}}); assert.equal(options.status,204);
});
test('malformed, oversized and unexpected errors never disclose internals',async t=>{
 const url=await server(t);
 for(const [body,status] of [['{',400],[JSON.stringify({x:'a'.repeat(17000)}),413]]){
 const r=await fetch(url+'/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(r.status,status);assert.doesNotMatch(await r.text(),/SyntaxError|stack|node_modules/);
 }
 const r=await fetch(url+'/api/failure');assert.equal(r.status,500);assert.doesNotMatch(await r.text(),/secret-internal-value/);
});
test('forwarded IP spoofing cannot bypass limits; scheduler retains its separate authentication',async t=>{
 const url=await server(t,{limit:2});
 for(let i=0;i<2;i++)assert.equal((await fetch(url+'/api/check',{headers:{'X-Forwarded-For':'1.1.1.'+i}})).status,200);
 const r=await fetch(url+'/api/check',{headers:{'X-Forwarded-For':'9.9.9.9'}});assert.equal(r.status,429);assert.ok(r.headers.get('retry-after'));
 assert.equal((await fetch(url+'/api/push/run',{method:'POST'})).status,403);
});
