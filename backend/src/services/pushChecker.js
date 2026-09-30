const { buildTechnicalAlert } = require('./technicalAlert');
const SECONDS = { '5min': 300, '1h': 3600, '1day': 86400 };
function checkSlot(interval, now) {
  const duration = SECONDS[interval];
  if (!duration) return null;
  const seconds = Math.floor(now / 1000);
  const close = Math.floor(seconds / duration) * duration;
  const age = seconds - close;
  // 60 seconds lets the provider publish the completed candle. Subsequent
  // five-minute slots allow bounded catch-up without continuous price polling.
  if (age < 60 || age >= Math.min(duration, 900)) return null;
  return { key: `push-check:${interval}:${close}:${Math.floor((age - 60) / 300)}`,
    expiresAt: new Date((close + duration + 86400) * 1000) };
}
function createChecker({ store, getHistory, auditHistory, deliver, session, now = Date.now }) {
  let pending;
  return function check() {
    if (pending) return pending;
    pending = (async () => {
      const startedAt = now();
      let result = 'ok';
      let candidates = 0;
      if (session(startedAt).isOpen) {
        const devices = await store.list();
        for (const interval of new Set(devices.map(device => device.interval))) {
          const slot = checkSlot(interval, startedAt);
          if (!slot || !await store.claimSlot(slot.key, slot.expiresAt)) continue;
          try {
            const history = await getHistory(interval, undefined, { waitForRefresh: true });
            if (!history.saved || history.refreshing || history.warning) { result = 'data-delayed'; continue; }
            const audit = await auditHistory(interval, history.candles);
            if (audit.status !== 'saved' || audit.revisedInput || !audit.analysis?.ready) { result = 'signal-unverified'; continue; }
            if (audit.analysis.stale) { result = 'data-delayed'; continue; }
            const candidate = buildTechnicalAlert(audit, { interval, isOpen: session(now()).isOpen, now: now() });
            if (candidate) {
              for (const device of devices.filter(item => item.interval === interval)) {
                // Do not notify a newly subscribed phone about an earlier signal.
                if (new Date(device.createdAt).getTime() <= Date.parse(candidate.confirmedAt)) await store.enqueue(device, candidate);
              }
              candidates++;
            }
          } catch { result = 'data-unavailable'; }
        }
      }
      // On a session close, discard pending technical messages through delivery's
      // session-aware sender; test messages can still be delivered.
      const delivery = await deliver();
      await store.setStatus({ checkedAt: new Date(now()).toISOString(), result });
      return { result, candidates, ...delivery };
    })().finally(() => { pending = null; });
    return pending;
  };
}
module.exports = { createChecker, checkSlot };
