/* No fetch handler: this worker never caches dashboard or market API responses. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Show a safe fallback. */ }
  const expired = !Number.isFinite(Date.parse(payload.expiresAt)) || Date.parse(payload.expiresAt) <= Date.now();
  const interval = ['5min', '1h', '1day'].includes(payload.interval) ? payload.interval : '1h';
  const price = value => Number.isFinite(value) ? value.toFixed(2) : '—';
  const details = payload.kind === 'technical-retest-confirmed'
    ? ` Close ${price(payload.confirmationClose)} · trigger ${price(payload.trigger)}. Invalidation: ${payload.invalidation?.condition === 'completed-close-below' ? 'completed close below' : 'completed close above'} ${price(payload.invalidation?.price)}. Confirmed ${payload.confirmedAt}.`
    : '';
  event.waitUntil(self.registration.showNotification(expired ? 'Trendline Insight · delayed notification' : (payload.title || 'Trendline Insight'), {
    body: expired ? 'This notification arrived after its validity window. Open the chart for the current status; do not treat it as a fresh setup.' : `${payload.body || 'Open Trendline Insight to review.'}${details}`,
    tag: payload.id || 'gold-terminal-update', renotify: false,
    icon: '/notification-icon.png', badge: '/notification-icon.png',
    data: { url: `/?page=technicals&interval=${interval}` },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const requested = new URL(event.notification.data?.url || '/?page=technicals', self.location.origin);
  const url = requested.origin === self.location.origin ? requested.href : `${self.location.origin}/?page=technicals`;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        const navigated = await client.navigate(url);
        if (navigated) return navigated.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
