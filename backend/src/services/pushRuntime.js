const { getConfig, validateSubscription } = require('./pushConfig');
const store = require('./pushStore');
const { getGoldSession } = require('./goldSession');
const { createDelivery } = require('./pushDelivery');
const { createChecker } = require('./pushChecker');
const { getHistory, auditHistory } = require('../routes/marketRoutes');
const { canReceive } = require('./accountRuntime');
const deliver = createDelivery({ store, canDeliver: canReceive, async send(subscription, payload, ttl) {
  const config = getConfig();
  if (!config.enabled || !validateSubscription(subscription) || (payload.kind !== 'test' && !getGoldSession().isOpen)) {
    const error = new Error('Delivery disabled'); error.statusCode = 400; throw error;
  }
  return require('web-push').sendNotification(subscription, JSON.stringify(payload), {
    vapidDetails: config.vapid, TTL: ttl, urgency: 'high', timeout: 10000,
  });
} });
const eligibleStore = { ...store, async list() {
  const eligible = [];
  for (const device of await store.list()) if (await canReceive(device)) eligible.push(device);
  return eligible;
} };
const check = createChecker({ store: eligibleStore, getHistory, auditHistory, deliver, session: getGoldSession });
function startScheduler() {
  const config = getConfig();
  if (!config.enabled || !config.internalScheduler) return () => {};
  const tick = () => check().catch(() => console.error('Technical notification check unavailable'));
  const timer = setInterval(tick, 60000);
  timer.unref();
  // No immediate provider request during deployment. First check is in one minute.
  return () => clearInterval(timer);
}
module.exports = { check, deliver, startScheduler };
