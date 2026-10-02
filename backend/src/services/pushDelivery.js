function createDelivery({ store, send, canDeliver = async () => false, now = Date.now }) {
  return async function deliver() {
    let accepted = 0;
    for (let i = 0; i < 20; i++) {
      const job = await store.claimDelivery(now());
      if (!job) break;
      const finish = (status, next) => store.finish(job._id, status, next, job.leaseToken);
      const device = await store.get(job.deviceId);
      if (!device || (job.payload.kind !== 'test' && device.interval !== job.payload.interval)) {
        await finish('cancelled'); continue;
      }
      try {
        if (!await canDeliver(device)) { await finish('access-denied'); continue; }
        const ttl = Math.floor((Date.parse(job.payload.expiresAt) - now()) / 1000);
        if (ttl <= 0) { await finish('expired'); continue; }
        await send(device.subscription, job.payload, ttl);
        await finish('accepted'); accepted++;
      } catch (error) {
        const code = error.statusCode;
        if ([404, 410].includes(code)) {
          await store.remove(device._id); await finish('expired-subscription');
        } else {
          const retry = (!code || code === 429 || code >= 500) && job.attempts < 3;
          // Bounded retries; an ambiguous network failure may have been accepted.
          const retryHeader = error.headers?.['retry-after'];
          const seconds = Number(retryHeader);
          const requested = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryHeader) - now();
          const delay = Math.max(60000 * job.attempts, Number.isFinite(requested) ? requested : 0);
          await finish(retry ? 'pending' : 'failed', new Date(now() + delay));
        }
      }
    }
    return { accepted };
  };
}
module.exports = { createDelivery };
