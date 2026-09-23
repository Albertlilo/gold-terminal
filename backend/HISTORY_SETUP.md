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

# Reliability and signal review

No new API credentials are needed for this update. Deploy both backend and frontend.

## Quote fallback
Live quote failures retain the last valid quote and its original receipt time. On a cold start, the service tries the last saved completed five-minute candle. These are labelled stale/reference fallbacks, not a second live provider. If neither is available, the gold price is explicitly unavailable without rejecting the macro dashboard response. Existing 30-second quote coalescing and closed-session restrictions remain. FRED polling is unchanged.

## Signal audit
The existing latest-history request computes analysis on the server with the same pure engine as the frontend. Atlas gains a `signal_audit` collection using the existing database credentials. No public client-write endpoint is added. The first observed record for each rule version, timeframe and completed candle is insert-only, including technical analysis, frozen zones, combined decision, observation time, available macro context and estimated session.

The record includes a SHA-256 hash of the completed input history and a bounded last-31-candle input sample. That sample is supporting context, not a complete archive of every input used. Refreshes return the original recorded calculation; changed input hashes are visibly flagged. Loading older chart pages does not replace the recorded latest analysis. Frontend staleness is always recalculated against the current clock.

Identical concurrent requests coalesce; repeated requests for the same input reuse the result. Audit failures do not discard candles and are labelled unavailable. Before a saved record is available, frontend calculations are provisional. Records are captured only when the timeframe is requested, not continuously while the service sleeps. Macro context is observed at request time, not asserted to be known at a historic candle close. Later macro changes do not rewrite the first observation. The current combined card can change with current macro/session conditions while the recorded decision stays fixed.

Audit records have no automatic expiry. They consume Atlas storage; monitor the existing free cluster's capacity. No unrelated collections are modified. Completed market data can be corrected by its provider: immutable observed decisions do not imply the feed itself is immutable or that reconstructions from a different historical window must match.

## Offline replay and risk calculator
Replay is user-triggered and uses only already-loaded candles, with a 2,000-candle limit. Each signal receives only the completed prefix available before entry. Entries use the following contiguous candle's open, within the estimated session. The experimental execution model uses a hard stop at the opposite edge of the retested zone, a 2R target, and a 10-bar holding limit. These are explicit simulation assumptions, distinct from the watch setup's close-based invalidation rule. One trade at a time, stop-first for ambiguous OHLC bars, worse opening fill for gap-through stops, fixed user-entered round-trip costs per ounce. Open trades are excluded from closed-trade statistics. There are no provider requests when running the replay.

This is technical-only testing, not a macro strategy performance claim. Macro-filtered backtests require historical point-in-time releases/vintages and publication timestamps; today's macro score must never be applied retrospectively. The calculator uses manually supplied entry, stop and target prices and excludes costs. Neither tool places orders.

## Coming next
Economic calendar alerts, dedicated DXY coverage and source-linked geopolitical headlines are explicitly pending provider selection. News risk is unknown, not low. No placeholder events, fabricated DXY values, notifications or news-driven score changes are enabled. Confirm licensing, symbol coverage, timestamps, historical vintages and rate limits before selecting a paid provider.

## Verification
Run the Node test files under `backend/test` and `backend/frontend/test`, frontend ESLint, and the Vite build. Tests cover quote fallback/recovery, concurrent request coalescing, audit immutability and failures, future-data exclusion, execution timing, costs, session gating, ambiguous fills and gaps. Live provider/Atlas integration still needs checking after deployment; offline tests use injected stores and providers.
