const express = require('express');
const { randomUUID } = require('node:crypto');
const { getConfig, equalSecret, hash, validateSubscription } = require('../services/pushConfig');
const store = require('../services/pushStore');
const runtime = require('../services/pushRuntime');

function createPushRouter({ storage = store, jobs = runtime, config = getConfig, now = Date.now } = {}) {
  const router = express.Router();
  const attempts = new Map();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Ignore forwarded IP headers unless the application explicitly trusts its proxy.
    const minute = Math.floor(now() / 60000);
    for (const [key, value] of attempts) if (value.minute !== minute) attempts.delete(key);
    const key = req.ip || 'unknown';
    const entry = attempts.get(key) || { minute, count: 0 };
    if (attempts.size >= 1000 && !attempts.has(key)) return res.status(429).json({ message: 'Please try again in a minute.' });
    attempts.set(key, entry);
    if (++entry.count > 60) return res.status(429).json({ message: 'Please try again in a minute.' });
    next();
  });
  router.get('/config', (req, res) => {
    const cfg = config();
    res.json({ enabled: cfg.enabled, publicKey: cfg.enabled ? cfg.vapid.publicKey : null,
      schedulerMode: cfg.internalScheduler ? 'in-process' : cfg.schedulerSecret ? 'external' : 'not-configured' });
  });
  router.post('/run', async (req, res) => {
    const cfg = config();
    if (!cfg.enabled || !equalSecret(req.get('Authorization'), `Bearer ${cfg.schedulerSecret || ''}`) || !cfg.schedulerSecret)
      return res.status(403).json({ message: 'Scheduled check not authorized.' });
    try { res.json(await jobs.check()); }
    catch { res.status(503).json({ message: 'Scheduled check unavailable.' }); }
  });
  router.use((req, res, next) => {
    const origin = req.get('Origin');
    if (!config().origins.includes(origin)) return res.status(403).json({ message: 'Website origin not allowed.' });
    res.set('Access-Control-Allow-Origin', origin); res.vary('Origin');
    next();
  });
  router.use((req, res, next) => {
    const token = req.get('Authorization')?.replace(/^Bearer /, '');
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(401).json({ message: 'Device authorization required.' });
    req.deviceId = hash(token); next();
  });
  router.get('/status', async (req, res) => {
    try {
      const device = await storage.get(req.deviceId);
      const status = await storage.status();
      res.json({ subscribed: Boolean(device), interval: device?.interval, checker: status });
    } catch { res.status(503).json({ message: 'Notification storage unavailable.' }); }
  });
  router.post('/subscription', async (req, res) => {
    const cfg = config();
    if (!cfg.enabled) return res.status(503).json({ message: 'Phone notifications need server configuration.' });
    const subscription = validateSubscription(req.body?.subscription);
    const interval = req.body?.interval;
    if (!subscription || !['5min', '1h', '1day'].includes(interval)) return res.status(400).json({ message: 'Unsupported subscription or timeframe.' });
    try {
      if (!await storage.get(req.deviceId) && !equalSecret(req.body.enrollmentCode, cfg.enrollmentCode))
        return res.status(403).json({ message: 'The notification access code is incorrect.' });
      await storage.subscribe(req.deviceId, subscription, interval);
      res.json({ subscribed: true, interval });
    } catch { res.status(503).json({ message: 'Could not save this device. If browser storage was cleared, reset its notification permission and try again.' }); }
  });
  router.delete('/subscription', async (req, res) => {
    try { await storage.remove(req.deviceId); res.json({ subscribed: false }); }
    catch { res.status(503).json({ message: 'Could not disable server delivery. Please retry.' }); }
  });
  router.post('/test', async (req, res) => {
    if (!config().enabled) return res.status(503).json({ message: 'Phone notifications are not configured.' });
    try {
      const device = await storage.get(req.deviceId);
      if (!device) return res.status(404).json({ message: 'Enable notifications on this device first.' });
      const key = `test:${req.deviceId}:${Math.floor(now() / 60000)}`;
      if (!await storage.claimSlot(key, new Date(now() + 120000))) return res.status(429).json({ message: 'One test per minute is allowed.' });
      await storage.enqueue(device, { id: `test:${randomUUID()}`, kind: 'test', interval: device.interval,
        title: 'Gold Terminal · test notification', body: 'Phone delivery test. This is not a trading signal.',
        expiresAt: new Date(now() + 300000).toISOString() });
      await jobs.deliver();
      res.json({ message: 'Test submitted. Confirm that it appears on your phone; delivery is not guaranteed.' });
    } catch { res.status(503).json({ message: 'Could not submit the notification test.' }); }
  });
  return router;
}
module.exports = { createPushRouter };
