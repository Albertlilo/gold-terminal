const { getPushCollection } = require('./candleStore');
const { hash } = require('./pushConfig');
const { randomUUID } = require('node:crypto');
function createPushStore(collection = getPushCollection) {
const subscriptions = () => collection('push_subscriptions');
const deliveries = () => collection('push_deliveries');
const state = () => collection('push_state');
async function claimSlot(key, expiresAt) {
  try { await (await state()).insertOne({ _id: key, expiresAt }); return true; }
  catch (error) { if (error.code === 11000) return false; throw error; }
}
return {
  claimSlot,
  async subscribe(id, subscription, interval, ownerUid) {
    const collection = await subscriptions();
    const existing = await collection.findOne({ _id: id });
    if (!existing && await collection.countDocuments() >= 1000) throw new Error('Subscription capacity reached');
    if (!ownerUid) throw new Error('Device owner required');
    await collection.updateOne({ _id: id, $or: [{ ownerUid }, { ownerUid: { $exists: false } }] }, { $set: { subscription, endpointHash: hash(subscription.endpoint), interval, ownerUid,
      updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  },
  async get(id) { return (await subscriptions()).findOne({ _id: id }); },
  async remove(id) { await (await subscriptions()).deleteOne({ _id: id }); },
  async list(interval) { return (await subscriptions()).find(interval ? { interval } : {}).limit(1000).toArray(); },
  async enqueue(device, payload) {
    const id = hash(`${device._id}:${payload.id}`);
    try { await (await deliveries()).updateOne({ _id: id }, { $setOnInsert: {
      deviceId: device._id, payload, status: 'pending', attempts: 0, nextAttemptAt: new Date(),
      expiresAt: new Date(payload.expiresAt), leaseUntil: new Date(0),
    } }, { upsert: true }); } catch (error) { if (error.code !== 11000) throw error; }
  },
  async claimDelivery(now) {
    const leaseToken = randomUUID();
    return (await deliveries()).findOneAndUpdate({ status: 'pending', attempts: { $lt: 3 },
      expiresAt: { $gt: new Date(now) }, nextAttemptAt: { $lte: new Date(now) }, leaseUntil: { $lte: new Date(now) } },
    { $set: { leaseUntil: new Date(now + 60000), leaseToken }, $inc: { attempts: 1 } }, { returnDocument: 'after' });
  },
  async finish(id, status, nextAttemptAt = new Date(), leaseToken) {
    await (await deliveries()).updateOne({ _id: id, leaseToken }, { $set: { status, nextAttemptAt, leaseUntil: new Date(0) } });
  },
  async setStatus(value) { await (await state()).updateOne({ _id: 'checker-status' }, { $set: value }, { upsert: true }); },
  async status() { return (await state()).findOne({ _id: 'checker-status' }, { projection: { _id: 0 } }); },
};
}
module.exports = { ...createPushStore(), createPushStore };
