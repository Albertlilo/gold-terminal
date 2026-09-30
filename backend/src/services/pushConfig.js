const { createHash, timingSafeEqual, ECDH } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
const equalSecret = (a, b) => typeof a === 'string' && typeof b === 'string' && Boolean(b)
  && timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
function getConfig(env = process.env) {
  const origins = (env.PUSH_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  let valid = false;
  try {
    require('web-push').getVapidHeaders('https://fcm.googleapis.com', vapid.subject, vapid.publicKey, vapid.privateKey, 'aes128gcm');
    const key = require('node:crypto').createECDH('prime256v1');
    key.setPrivateKey(Buffer.from(vapid.privateKey, 'base64url'));
    valid = key.getPublicKey().equals(Buffer.from(vapid.publicKey, 'base64url'));
  } catch { /* Missing configuration keeps the feature off. */ }
  const enabled = env.PUSH_ENABLED === 'true' && valid && origins.length > 0
    && origins.every(origin => { try { const u = new URL(origin); return u.origin === origin && (u.protocol === 'https:' || ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin)); } catch { return false; } })
    && (env.PUSH_ENROLLMENT_CODE || '').length >= 32;
  return { enabled, origins, vapid, enrollmentCode: env.PUSH_ENROLLMENT_CODE,
    schedulerSecret: (env.PUSH_SCHEDULER_SECRET || '').length >= 32 ? env.PUSH_SCHEDULER_SECRET : null,
    internalScheduler: env.PUSH_RUN_SCHEDULER === 'true' };
}
function validateSubscription(value) {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 2048) return null;
  try {
    const url = new URL(value.endpoint);
    const host = url.hostname;
    const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
      || host.endsWith('.push.services.mozilla.com') || host === 'web.push.apple.com'
      || host.endsWith('.push.apple.com') || host.endsWith('.notify.windows.com');
    if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return null;
    const { p256dh, auth } = value.keys || {};
    if (typeof p256dh !== 'string' || !/^[\w-]{87}=?$/.test(p256dh)
      || typeof auth !== 'string' || !/^[\w-]{22}={0,2}$/.test(auth)) return null;
    const publicKey = Buffer.from(p256dh, 'base64url');
    if (publicKey.length !== 65 || publicKey[0] !== 4 || Buffer.from(auth, 'base64url').length !== 16) return null;
    ECDH.convertKey(publicKey, 'prime256v1');
    return { endpoint: url.href, keys: { p256dh, auth } };
  } catch { return null; }
}
module.exports = { getConfig, hash, equalSecret, validateSubscription };
