import { useEffect, useState } from 'react';
import { accountFetch } from '../lib/accountClient';

const API = import.meta.env.VITE_API_BASE_URL || 'https://gold-terminal-ufv4.onrender.com';
const TOKEN_KEY = 'gold-terminal-push-device';
const supported = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function deviceToken(create = false) {
  let value = localStorage.getItem(TOKEN_KEY);
  if (!value && create) {
    value = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    localStorage.setItem(TOKEN_KEY, value);
  }
  return value;
}
async function request(path, method = 'GET', body) {
  const token = deviceToken();
  const response = await accountFetch(`${API}/api/push/${path}`, {
    method, signal: AbortSignal.timeout(30000),
    headers: { ...(token ? { 'X-Device-Token': token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Notification request failed.');
  return data;
}
function publicKeyBytes(value) {
  const text = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(text, character => character.charCodeAt(0));
}
export default function PushNotifications({ now }) {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [interval, setInterval] = useState('1h');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const needsHomeScreen = /iPad|iPhone|iPod/.test(navigator.userAgent)
    && !window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone;
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await request('config');
        if (!alive) return;
        setConfig(cfg);
        const registration = supported() ? await navigator.serviceWorker.getRegistration('/') : null;
        const local = await registration?.pushManager.getSubscription();
        if (deviceToken()) {
          const current = await request('status');
          if (alive) {
            setStatus({ ...current, local: Boolean(local) });
            if (current.interval) setInterval(current.interval);
          }
        } else if (alive) setStatus({ subscribed: false, local: Boolean(local) });
      } catch { if (alive) setMessage('Could not check notification settings. Use Refresh status to retry.'); }
    })();
    return () => { alive = false; };
  }, [reload]);
  async function enable() {
    setBusy(true); setMessage('');
    try {
      // Request permission directly in the click handler (required on iPhone).
      if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser or phone settings, then retry.');
      deviceToken(true);
      await navigator.serviceWorker.register('/push-sw.js');
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKeyBytes(config.publicKey) });
      await request('subscription', 'POST', { subscription: subscription.toJSON(), interval });
      setMessage('This device is registered to your Pro account. Send a test and check the scheduler status below.');
      setReload(value => value + 1);
    } catch (error) { setMessage(error.message || 'Could not enable phone notifications.'); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setMessage('');
    try {
      // Browser opt-out first still stops visible messages if the backend is down.
      const registration = supported() ? await navigator.serviceWorker.getRegistration('/') : null;
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription && !await subscription.unsubscribe()) throw new Error('Browser could not unsubscribe. Block notification permission in settings and retry.');
      if (deviceToken()) await request('subscription', 'DELETE');
      setStatus({ subscribed: false, local: false }); setMessage('Phone notifications disabled on this device.');
    } catch (error) { setMessage(`${error.message} You can also block this website’s notifications in phone settings.`); }
    finally { setBusy(false); }
  }
  async function test() {
    setBusy(true);
    try { const result = await request('test', 'POST'); setMessage(result.message); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  const checkedAt = status?.checker?.checkedAt;
  const recent = checkedAt && now - Date.parse(checkedAt) < 180000;
  return <section className="terminal-card phone-alerts" aria-labelledby="phone-alert-title">
    <div className="terminal-panel-title"><h2 id="phone-alert-title">Phone alerts</h2><span>TECHNICAL ONLY</span></div>
    <p>Get a notification after a completed candle confirms a breakout and successful retest, or a support break and failed retest. No trades are placed.</p>
    {needsHomeScreen && <p className="coverage-status">On iPhone or iPad, add this website to your Home Screen in Safari, open it from its icon, then enable notifications.</p>}
    {!supported() && <p className="coverage-status">Web push is unavailable in this browser. Use a supported browser over HTTPS (or localhost for development).</p>}
    {config && !config.enabled && <p className="coverage-status">Server setup is pending. Phone alerts are not active yet.</p>}
    <p><strong>Device:</strong> {status?.subscribed && status.local ? 'Registered' : status?.subscribed ? 'Browser subscription missing — enable again' : 'Not registered'}</p>
    <div className="phone-alert-fields">
      <label>Alert timeframe<select value={interval} onChange={event => setInterval(event.target.value)} disabled={busy}><option value="5min">5 minutes</option><option value="1h">1 hour</option><option value="1day">Daily</option></select></label>
    </div>
    <div className="phone-alert-actions">
      <button onClick={enable} disabled={busy || !config?.enabled || !supported() || needsHomeScreen}>{status?.subscribed ? 'Save / reconnect' : 'Enable phone alerts'}</button>
      <button onClick={test} disabled={busy || !config?.enabled || !status?.subscribed || !status?.local}>Send test</button>
      <button onClick={disable} disabled={busy || (!status?.subscribed && !status?.local)}>Disable</button>
      <button onClick={() => { setMessage(''); setReload(value => value + 1); }} disabled={busy}>Refresh status</button>
    </div>
    <p role="status" aria-live="polite">{busy ? 'Updating notification settings…' : message}</p>
    <p className="analysis-method">Background checker: {recent ? `recent check · ${status.checker.result}` : 'not verified recently'}. Last check: {checkedAt ? new Date(checkedAt).toLocaleString() : 'not recorded'}.</p>
    <p className="analysis-method">{config?.schedulerMode === 'not-configured' ? 'Background scheduling is not configured.' : config?.schedulerMode === 'in-process' ? 'Checks run while the backend is awake. A sleeping free server may miss alerts.' : 'An external schedule must call the protected check endpoint.'} The selected alert timeframe is independent of the chart. Confirm delivery with a test; phone settings, connectivity and provider delays can delay or prevent alerts.</p>
  </section>;
}
