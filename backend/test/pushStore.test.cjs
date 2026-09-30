const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPushStore } = require('../src/services/pushStore');
function memoryCollections() {
  const collections=new Map();
  function matches(row,query){return Object.entries(query).every(([key,value])=>{
    if(value && typeof value==='object' && !(value instanceof Date))return Object.entries(value).every(([op,bound])=>op==='$lt'?row[key]<bound:op==='$lte'?row[key]<=bound:op==='$gt'?row[key]>bound:false);
    return row[key]===value;
  });}
  return async name=>{
    if(!collections.has(name))collections.set(name,new Map());
    const rows=collections.get(name);
    return {
      async insertOne(row){if(rows.has(row._id))throw {code:11000};rows.set(row._id,structuredClone(row));},
      async updateOne(query,update,options={}){
        let row=[...rows.values()].find(item=>matches(item,query));
        if(!row && options.upsert){row={...query,...structuredClone(update.$setOnInsert)};rows.set(row._id,row);}
        if(row)Object.assign(row,structuredClone(update.$set||{}));
      },
      async findOneAndUpdate(query,update){
        const row=[...rows.values()].find(item=>matches(item,query));if(!row)return null;
        Object.assign(row,structuredClone(update.$set));
        for(const [key,value] of Object.entries(update.$inc||{}))row[key]+=value;
        return structuredClone(row);
      },
    };
  };
}
test('durable queue deduplicates across new store instances and leases one delivery', async()=>{
  const collections=memoryCollections(), first=createPushStore(collections), second=createPushStore(collections);
  const now=Date.now()+1000, device={_id:'phone'}, payload={id:'setup',expiresAt:new Date(now+300000).toISOString()};
  await Promise.all([first.enqueue(device,payload),second.enqueue(device,payload)]);
  const jobs=await Promise.all([first.claimDelivery(now),second.claimDelivery(now)]);
  assert.equal(jobs.filter(Boolean).length,1);
  const original=jobs.find(Boolean);
  const reclaimed=await second.claimDelivery(now+61000);assert.ok(reclaimed);assert.notEqual(original.leaseToken,reclaimed.leaseToken);
  await first.finish(original._id,'accepted',new Date(now),original.leaseToken);
  await second.finish(reclaimed._id,'pending',new Date(now+65000),reclaimed.leaseToken);
  const retry=await first.claimDelivery(now+65000);assert.equal(retry.attempts,3);
  await first.finish(retry._id,'accepted',undefined,retry.leaseToken);
  await second.enqueue(device,payload);
  assert.equal(await second.claimDelivery(now+130000),null);
  assert.equal(await first.claimSlot('slot',new Date(now+300000)),true);
  assert.equal(await second.claimSlot('slot',new Date(now+300000)),false);
});
