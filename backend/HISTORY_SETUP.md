# Gold candle history

This Technicals-page trial uses a custom React/SVG candlestick chart with zoom,
pan, crosshair, 5-minute/hourly/daily intervals and the existing watch-line toggle.
It is not TradingView's embedded widget or charting library. Markets and the
20-reading Technicals signal calculation retain their existing behavior.

## Configure

- Install backend dependencies with `npm install` in `backend`. This adds the
  MongoDB Node driver and updates `package-lock.json`; include that lockfile when
  committing the feature. No new frontend dependency is required.
- Set `MONGODB_URI` privately in the backend environment. Never put it in a
  frontend variable, source code or a commit.
- Optional: `MONGODB_DATABASE` (default `gold_terminal`).
- Keep the existing `TWELVE_DATA_API_KEY`. Its plan must allow `time_series` for
  `XAU/USD` at `5min`, `1h` and `1day`. Access has not yet been verified.
- The Atlas database user needs read/write access to `gold_terminal`. Configure
  Atlas network access for the backend's outbound IP ranges, and a separate
  local testing IP if needed. Do not disable TLS validation.

## Persistence and limits

The `candles` collection has a unique symbol/interval/time index. Upserts revise
the current candle without creating duplicate records. No expiry or automatic
deletion is configured. Existing databases and collections are not modified.

`GET /api/market/gold/history?interval=5min` loads the latest 500 candles.
Add `before=<UTC Unix seconds>` for older pages. Each requested page is cached
for five minutes per backend process to reduce provider requests. The database
stores fetched pages across browser refreshes and backend restarts/redeploys.

Only requested timeframes/pages are collected. No paid cron, worker, instance or
disk is created. The free backend can sleep; missed data is retrieved from the
provider when requested. A long absence may leave gaps until older pages are
loaded. Availability of older data is limited by the provider plan. This is a
growing archive, not a guarantee of complete historical coverage.

Monitor the Atlas free tier's shared 512 MB limit and provider API quota. If the
provider fails, saved history is shown with a warning. If Atlas is unavailable,
the chart reports the problem and the macro dashboard continues independently.
Storage durability does not replace backups.

## Checks

From the repository root:

```
node --test backend/test/*.test.cjs backend/frontend/test/*.test.mjs
npm --prefix backend/frontend run lint
npm --prefix backend/frontend run build
```

Tests use an in-memory store double, not the live Atlas cluster. The prepared
frontend also passed an interactive check against labelled synthetic candle data.
Live Atlas authentication, network access, writes and Twelve Data entitlement
must still be verified after installation/deployment.

Both Render services auto-deploy from main. Once code is pushed, check the
backend deployment and open Technicals. Confirm candles load without a warning,
then reload the page. Confirm that saved older candles can be loaded again. If
only the environment variable has been deployed, none of this feature is active.
