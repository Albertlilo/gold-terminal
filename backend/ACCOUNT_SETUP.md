# Account protection — configure before deploying

This change protects premium APIs and delivery by default. It has no switch that
silently exposes premium data when Firebase is missing. Do not push/deploy until
Firebase and your owner UID are ready: otherwise the public preview works, but
premium pages and all old shared-code notifications stop being accessible.

`.gitignore` only prevents designated local files from being committed. It cannot
restrict HTTP requests, check who paid, remove already tracked secrets or protect
API responses. Authentication and server-side authorization now do that work.

## Configure Firebase

1. Create/select a Firebase project. Add a web app in project settings.
2. Enable Authentication → Email/Password and, if wanted, Google sign-in. Configure
   the Google provider's support email. Enable email-enumeration protection and a
   password policy. Add the production frontend hostname to Authorized domains.
   Use a separate development project/domain for local testing where practical.
3. In Authentication → Users, create your own owner account (or sign up in a
   development deployment). Copy its **UID**, not its email. Your email must be
   verified before protected APIs accept it; signing in with Google or following
   Firebase's verification email establishes that. Keep at least one tested owner.
4. Obtain an appropriate Firebase Admin service account for this project. Keep its
   JSON private, outside Git. Never put the private key in frontend settings.
5. Add these to the **Render backend** environment, preserving existing variables:

| Variable | Source |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Web app configuration `projectId` |
| `FIREBASE_WEB_API_KEY` | Web app configuration `apiKey` (public client identifier) |
| `FIREBASE_AUTH_DOMAIN` | Web app configuration `authDomain` |
| `FIREBASE_WEB_APP_ID` | Web app configuration `appId` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full private Admin service-account JSON, same project |
| `OWNER_FIREBASE_UIDS` | Your verified owner UID; comma-separated for multiple owners |

The frontend obtains only public web-app configuration from `/api/account/config`.
Keep your existing `VITE_API_BASE_URL`. Google hosting migration is unnecessary;
Render and Atlas remain in use. Do not paste service-account JSON in chat.

## Deploy and reconnect your phone

Deploy both frontend and backend after configuration. Sign in as the owner and
confirm Owner access. On your iPhone Home Screen app, sign in to the same account,
open Technicals → Phone alerts and choose Enable / Save / reconnect. This links
your existing device token and subscription to your UID. Only an owner can claim
a legacy shared-code device, and it must possess the existing device token.
If browser storage was cleared, reset the browser push subscription and reconnect.

`PUSH_ENROLLMENT_CODE` no longer grants access. Its old environment value may stay
temporarily but is unused. `PUSH_SCHEDULER_SECRET`, cron-job.org's Bearer header,
and `PUSH_RUN_SCHEDULER=false` retain their existing meanings. The scheduler has
no authority to subscribe a device or access the premium HTTP endpoints.

## What is protected

- `/api/fred/*` (including dashboard/score/individual indicator routes) and
  `/api/market/*` require a verified email, valid Firebase ID token, and Pro access.
- Tokens are verified by Firebase Admin with revocation checking. Wrong-project,
  expired, forged, revoked and disabled-account tokens cannot authenticate.
- `/api/users/*` additionally requires the owner role.
- `/api/preview` exposes only up to 30 saved daily closes and the last in-memory
  headline macro snapshot/time. It never fetches FRED or exposes indicator
  breakdowns, complete candles, technical audits or user details. On a cold start
  the macro headline is unavailable until a premium request refreshes it.
- The phone device token is sent as `X-Device-Token`, with a Firebase ID token in
  Authorization. Device ownership is checked for status, changes, tests and removal.
- Subscriber/owner access is required to register or test push. An expired member
  may still remove their own device. Sign-out attempts browser and server cleanup.
- Scheduling filters eligible accounts; delivery checks access again immediately
  before sending. Disabled/deleted accounts, missing owners and expired grants
  receive no alerts. On verification outages it fails closed and retries within
  the existing bounded delivery policy. Already accepted push messages cannot be
  recalled from a phone's notification centre after access is removed.
- The frontend shows the preview until access is verified and rechecks each minute.
  The backend enforces access on every request regardless of what UI is visible.

## Subscription records — billing is not live

Atlas collection `account_access` uses Firebase UID as `_id`. Only a server-side
process with database permissions may write it. No client grant/update endpoint
exists. The owner UID allowlist gives you access without paying yourself.

Future verified billing webhooks must maintain records like:

```json
{"_id":"FIREBASE_UID","status":"active","paidThrough":"2026-11-01T00:00:00.000Z"}
```

Access requires `status === active` and a future valid `paidThrough`. Cancellation
at period end should retain active access until paidThrough; immediate cancellation
or revocation should change status. This is an access foundation, not a Stripe
integration: no checkout, customer portal, webhook reconciliation or real charging
is enabled. Never sell subscriptions until payment lifecycle tests are complete.

## Verification

Offline tests check premium route rejection before data fetches, entitlement expiry,
invalid identities, owner-only permissions, cross-account device protection and
send-time checks. No market requests or production writes are needed for these.
Frontend lint/build also run. Live Firebase sign-in, owner bootstrap, verified-email
flows and iPhone reconnection still need testing after Firebase setup.

Sources: https://firebase.google.com/docs/auth/admin/verify-id-tokens
and https://firebase.google.com/docs/auth/admin/manage-sessions
