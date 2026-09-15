import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestHistory} from '../src/lib/historyRequest.js';

test('a stalled request times out even when transport ignores abort',async()=>{
  let transportSignal;
  await assert.rejects(requestHistory('/test',{timeoutMs:10,fetchImpl:async(_,options)=>{transportSignal=options.signal;return new Promise(()=>{});}}),/timed out/);
  assert.equal(transportSignal.aborted,true);
});
test('timeout includes a stalled response body',async()=>{
  await assert.rejects(requestHistory('/test',{timeoutMs:10,fetchImpl:async()=>({ok:true,json:()=>new Promise(()=>{})})}),/timed out/);
});
test('successful response preserves saved data and refresh status',async()=>{
  const data={candles:[{time:1}],saved:true,refreshing:true};
  assert.deepEqual(await requestHistory('/test',{fetchImpl:async()=>({ok:true,json:async()=>data})}),data);
});
test('HTML gateway failure gives a useful message',async()=>{
  await assert.rejects(requestHistory('/test',{fetchImpl:async()=>({ok:false,json:async()=>{throw new SyntaxError('HTML');}})}),/did not return candle data/);
});
test('network failure gives a retry message',async()=>{
  await assert.rejects(requestHistory('/test',{fetchImpl:async()=>{throw new TypeError('Failed to fetch');}}),/could not be reached/);
});
test('unmount cancellation reaches the transport',async()=>{
  const parent=new AbortController();
  const request=requestHistory('/test',{signal:parent.signal,fetchImpl:(_,options)=>new Promise((_,reject)=>{
    options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  })});
  parent.abort();
  await assert.rejects(request,error=>error.name==='AbortError');
});
