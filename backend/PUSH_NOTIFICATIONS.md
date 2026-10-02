# Technical phone notifications

**Account migration:** [ACCOUNT_SETUP.md](ACCOUNT_SETUP.md) supersedes the shared
enrollment instructions below. New code requires a verified Pro/owner account;
`PUSH_ENROLLMENT_CODE` is no longer used. Configure Firebase and owner access before
deploying, then reconnect existing devices. The scheduler configuration is unchanged.

Implemented locally: opt-in controls, service worker, install manifest, private
device subscriptions in Atlas, delivery queue, retries, scheduled checker and
offline tests. Production delivery still needs deployment, environment settings,
a running schedule and phone permission. No trades are placed. Macro is separate.

## Activate

1. From the repository root run `npm --prefix backend run push:setup`.
   It creates **backend/.env.push.local**, excluded from Git. It never prints
   secrets or overwrites existing keys. Keep it private; the app does not load it
   automatically.
2. In Render, open the **backend web service** (gold-terminal), Environment.
   Add/import those variables, preserving existing Atlas and provider settings.
   Never put them in the frontend or use a `VITE_` prefix. Check the frontend
   address in `PUSH_ALLOWED_ORIGINS` (exact origin, no trailing slash). Save/redeploy.
3. Configure one scheduling option below. A scheduler secret alone does not create
   a schedule. The UI remains “not verified recently” until a check runs.
4. Deploy frontend and backend. Open Technicals → Phone alerts. Default: **1 hour**,
   independent of the chart timeframe. Enter the private `PUSH_ENROLLMENT_CODE`,
   enable and allow notifications. This code restricts registration on the personal
   dashboard; it is not a general account system. Do not publish it.
5. Send a test and confirm phone receipt. Then verify a genuine new setup arrives
   with the website closed and the schedule running. “Registered” or an HTTP success
   does not establish receipt. Test Disable too. Save / reconnect applies a changed
   timeframe. Each device controls only its own subscription.

On iPhone/iPad (iOS/iPadOS 16.4+), add the website to the Home Screen in Safari,
then open its icon to enable notifications. Supported desktop/Android browsers can
request permission directly. Production requires HTTPS. After clearing browser
storage or changing VAPID keys, reset notification permission and reconnect.
Do not rotate VAPID keys routinely; existing subscriptions depend on them.

## Scheduling and request budget

**Always-running backend:** set `PUSH_RUN_SCHEDULER=true`. Checks run once per minute
while the process is alive. No additional service is created automatically.

**External schedule:** keep `PUSH_RUN_SCHEDULER=false`. Configure a scheduler with
private HTTP headers to call every minute:

```text
POST https://gold-terminal-ufv4.onrender.com/api/push/run
Authorization: Bearer <PUSH_SCHEDULER_SECRET>
```

No request body is needed. Keep the secret in scheduler secret settings, never in
a URL or public workflow. Allow for cold starts. No paid service has been created.

Render Free sleeps after 15 minutes without inbound traffic; an internal timer
does not prevent this. Sleep, cold starts, exhausted instance hours and provider
failures can cause missed alerts. External checks consume hosting usage when they
wake the service. Instant delivery is not guaranteed on any plan.

No FRED calls are made by this feature. No price reads occur without subscribers
or during the estimated session closure. Checks begin 60 seconds after candle close:

| Timeframe | Maximum checker refresh opportunities during open sessions |
| --- | --- |
| 5 minutes | 1 per candle, up to 12/hour |
| 1 hour | 3 per hourly close, within 15 minutes |
| Daily | 3 near UTC daily close |

Shared five-minute chart caching can reduce provider requests further. The checker
waits for any pending refresh before analysing saved results. Multiple devices
share checks; Atlas slot records prevent duplicate scheduled checks across
processes. Charts retain their existing refresh behaviour. Daily timing assumes
UTC boundaries, matching current analysis. Session hours are an estimate, not a
broker holiday calendar.

## Signal and delivery rules

- Saved, current-version, unrevised audits only. Fresh completed candles, an open
  session and the existing break-and-retest rules are required.
- Only initial confirmation qualifies; continuing or recovered confirmations are
  not new alerts. No historical alerts on enrollment.
- Includes timeframe, confirmation time/close, trigger and structural invalidation.
  The latter is not a recommended broker stop loss.
- Expires one candle interval after confirmation, capped at 15 minutes. Expired
  jobs are not sent; a late phone delivery is labelled delayed instead of fresh.
- Atlas stores subscriptions, jobs and slots. Stable device/setup IDs, atomic
  leases and notification tags suppress duplicates. Maximum three delivery attempts,
  at least 60 seconds between transient retries; Retry-After is respected. This
  cannot guarantee exactly-once delivery after an ambiguous network failure.
- Provider 404/410 removes an expired subscription. Opt-out unsubscribes the
  browser and removes its server record; queued jobs are skipped.
- Jobs/slots use TTL cleanup; devices remain until opt-out/provider expiry.
  Endpoints are restricted to recognised HTTPS push hosts with valid encryption
  keys. VAPID private keys and database access stay server-side.
- Random device bearer tokens are held locally; only their hashes identify devices
  server-side. Writes require an allowed Origin and device authorization; new
  devices also require private enrollment. No subscription listing is exposed.
- API limit: 60 requests/minute per observed IP per process. Proxies may group
  clients; forwarded headers are not blindly trusted. Capacity: 1000 devices,
  20 deliveries/invocation. This is intended for the personal dashboard.
- The worker does not intercept fetches or cache market responses.

## Validation

```powershell
node --test backend/test/*.test.cjs backend/frontend/test/*.test.mjs
npm --prefix backend/frontend run lint
npm --prefix backend/frontend run build
```

Offline tests cover rules, shared caching, restarts, leases, endpoint validation,
authorization, retries, stale data, expiry and worker navigation. They do not
verify actual Atlas indexes, phone permission UI or real push-provider receipt.
Complete the phone check after deployment.

Sources: [WebKit phone web push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/),
[Render Free limitations](https://render.com/docs/free),
[web-push library](https://github.com/web-push-libs/web-push).

## Files in this notification update

Paths below are relative to the repository root. Includes the first chunk.

```text
backend/.gitignore
backend/package.json
backend/package-lock.json
backend/PUSH_NOTIFICATIONS.md
backend/scripts/setup-push.cjs
backend/src/server.js
backend/src/routes/marketRoutes.js
backend/src/routes/pushRoutes.js
backend/src/services/candleHistoryService.js
backend/src/services/candleStore.js
backend/src/services/technicalAlert.js
backend/src/services/pushChecker.js
backend/src/services/pushConfig.js
backend/src/services/pushDelivery.js
backend/src/services/pushRuntime.js
backend/src/services/pushStore.js
backend/frontend/index.html
backend/frontend/public/manifest.webmanifest
backend/frontend/public/notification-icon.png
backend/frontend/public/notification-icon-512.png
backend/frontend/public/push-sw.js
backend/frontend/src/App.jsx
backend/frontend/src/index.css
backend/frontend/src/pages/TechnicalsPage.jsx
backend/frontend/src/components/PushNotifications.jsx
backend/test/historyRecovery.test.cjs
backend/test/technicalAlert.test.cjs
backend/test/pushNotifications.test.cjs
backend/test/pushStore.test.cjs
backend/test/pushWorker.test.cjs
```

The generated **backend/.env.push.local** is private and excluded from Git.
Local verification completed: 89 tests, frontend ESLint and Vite production build.
No real market-data requests, phone pushes, production writes or deployment were
performed during verification. Actual mobile delivery remains an activation check.
