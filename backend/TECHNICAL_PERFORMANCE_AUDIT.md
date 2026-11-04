# Trendline Insight performance, DSA and scalability audit

## Scope and limits

Work was done on branch `codex/technical-engine-performance-audit`. No deployment, merge, Atlas write, infrastructure change, or production load test was performed. The local Atlas connection timed out, so the June 2026-to-present candle archive, actual index definitions, and live query plans could not be inspected. Do not treat the synthetic benchmark below as a historical trading result.

## Why support/resistance can look inconsistent

The previous engine selected support and resistance mostly by side-of-price and price proximity after a minimum reaction count. It did not meaningfully rank candidates by reaction size or recency. Support also has a special recent two-touch path, while historical support uses a separate detector; this can make a newly visible floor appear later than the first price reaction. Resistance uses a different candidate path, so its behavior can differ from support. Swing pivots need two right-side candles before they are known, which intentionally delays a confirmed zone and prevents repainting.

## Changes on this branch

- Zone clustering now uses 0.35 × the local 14-candle ATR, with a small price-based floor.
- Each swing cluster records separated reaction count, average favorable excursion in ATR units, bars since last reaction, a 0–100 rule-quality score, and whether a later close broke it. The score is descriptive and is not a win probability.
- Historical reaction references use the same ATR-scaled merge tolerance and expose the same reaction-strength, recency, and quality fields.
- Candidate selection uses that quality score after the existing structural/location filters.
- Historical replay passes an explicit end-exclusive candle boundary into the zone builder, eliminating growing-prefix copies while retaining the as-of cutoff.
- Market-structure break detection now uses a price-indexed segment tree. Each confirmed swing is inserted and retired once; range queries find crossed levels without rescanning every prior swing for every candle.
- Saved-signal cache fingerprints are checked before analysis. Identical completed-candle input avoids recomputing the full replay in the same Node process; changed input still triggers recalculation and revision handling.
- Zone readouts include detection timeframe, boundaries, reaction count, quality, confirmation rule, and invalidation price. Daily and 1H structure are shown separately from the 5M setup check; this is a technical context view only and does not blend a score or read macro data.
- The backtest accepts separate round-trip spread, commission, and slippage costs, while retaining the existing `cost` option for compatibility.
- Rule version advanced to `zones-structure-risk-v19`; existing audit records remain untouched and new decisions use the new version key.

## Complexity review

| Path | Before / current behavior | Cost and bounded memory |
|---|---|---|
| Candle merge and sort | Map by timestamp, then sort | O(n log n) time, O(n) space |
| Session filtering | One pass with a bounded 20,000-entry session cache | O(n) time, O(1) bounded cache |
| Zone confirmation | Replay each candle; each zone build examines at most 120 structural candles and 500 historical-support candles | O(n × bounded-window work); O(620) temporary candle window, plus bounded clusters |
| Zone clustering | Price sort, then per-role last-cluster comparison | O(p log p), where p ≤ 240 pivots in the 120-candle window |
| Swing extraction | Fixed-radius neighborhood scan | O(n) time, O(p) swing storage |
| BOS/CHoCH crossing | Prior implementation scanned all available swing levels per candle: O(n × p), worst-case O(n²). New price-range segment tree: O((n+p) log p), O(p) tree/index space |
| Backtest | Replays `analyseCandles` on each candle prefix; max 2,000 completed candles | Approximately O(N² log N) worst-case due to repeated prefix scans/index construction, plus O(N) prefix-copy working memory. This is the clearest remaining CPU bottleneck; optimize incrementally only after profiling typical 500–2,000 candle runs |
| Mongo candle reads | One indexed read, 500 rows maximum; exact requests coalesce in-process | Index-backed O(log n + 500), assuming the existing compound index is present |

Frontend analysis is capped at 1,200 candles; backend history pages are 500; the backtest caps at 2,000. A million-candle structure benchmark is a stress test of the pure structure scanner, not a supported full-dashboard input.

## MongoDB index audit

`candleStore.js` creates a unique compound index `{ symbol: 1, interval: 1, time: 1 }`. Latest and older-page reads constrain `symbol` and `interval`, project OHLC fields, sort by `time: -1`, and cap at 500. With equality on the first two keys, MongoDB can scan the `time` portion in reverse for both latest and `$lt` older-page queries. The collection initialization creates the index once per process connection. Atlas `listIndexes` and `explain("executionStats")` were attempted read-only but could not connect from this workspace, so actual `IXSCAN`, keys examined, docs examined, and duplicate-data state remain unverified.

After network access is available, run `npm --prefix backend run audit:mongodb` from the repository root. It only lists candle indexes and explains the latest/older-page queries; it does not write data and suppresses connection details. Compare `totalDocsExamined` and `totalKeysExamined` to `nReturned` (up to 500). Do not remove or recreate indexes based only on the local source definition.

## Local synthetic benchmark

Command: `npm --prefix backend run benchmark:technical`

One local run (Node v24.11.0, Windows x64; deterministic synthetic prices):

| Candles | Market-structure runtime | Approx. heap delta |
|---:|---:|---:|
| 10,000 | 4.24 ms | 1.5 MB |
| 100,000 | 18.30 ms | 5.0 MB |
| 1,000,000 | 161.48 ms | 18.7 MB |

The full technical analyzer processed the maximum frontend window (1,200 candles) in 35.06 ms in that run. These are single-run local timings, not service latency or a statistical benchmark. The 10k/100k/1M figures measure the pure market-structure scan only; the UI analyzer intentionally caps input at 1,200 rows. The deterministic market-structure parity test compared the optimized output to the prior chronological algorithm on 120 seeded histories; all matched.

## Backtest and signal reliability

The existing replay uses completed candles only, enters on the next candle, treats ambiguous OHLC stop/target bars conservatively (stop first), and records win rate, average planned R:R, expectancy, max drawdown, and sample count. Before this change it accepted only one aggregate friction number. Separate spread, commission, and slippage price-equivalent costs are now supported and reported in the result. No Atlas-period backtest was run because historical data could not be read. No win-rate improvement is claimed.

## API, concurrency, and infrastructure

- Mongo client pool is fixed at `maxPoolSize: 5`; do not raise it without Atlas connection-count and Render memory/CPU measurements.
- History refreshes coalesce identical in-process requests; signal audit insert is immutable and deduplicated in Mongo. The new pre-analysis fingerprint cache avoids repeated analysis only within one server process. It does not coordinate multiple Render instances.
- API latency, throughput, event-loop delay, and concurrent request behavior were not measured: the local service could not reach Atlas and production load testing was explicitly avoided. Read-only Render CPU/memory metrics were later obtained and are summarized in the 2026-11-04 update below.
- Next useful measurement is a staging load test against a read-only Atlas clone with 1, 5, 20, and 50 concurrent history requests, recording p50/p95, Mongo examined-to-returned ratios, event-loop delay, and connection-pool wait. Only then decide whether to add a shared cache, raise the pool, or precompute after candle close.
- At the time of the audit, no Redis, worker, or paid service was justified by available measurements. A later change in this branch uses the existing Twelve Data WebSocket entitlement for the live XAU/USD quote only; see the WebSocket update below. It does not replace saved-candle history or economic-data requests.

## Scalability audit update (2026-11-04)

### API and database findings

- The primary candle API is `GET /api/gold/history`. It reads one timeframe page, capped at 500 records, and the Mongo query projects only timestamp and OHLC fields. The compound index `{ symbol: 1, interval: 1, time: 1 }` matches the equality filters followed by the descending time sort, including the older-page `$lt` bound. This is a source-level index/query-shape review, not proof that Atlas selected the index.
- A latest-page response can wait for signal-audit processing for up to 2.5 seconds. An empty first page can also wait for the Twelve Data request, whose client timeout is 15 seconds. The saved-history path returns before a background refresh when saved rows are available. These are upper bounds from code paths, not observed latency percentiles.
- Identical history refreshes coalesce only within one Node process. Distinct `before` cursors are distinct cache keys, so a client paging many old ranges can trigger a provider refresh for each page while the market session is open. Consider refreshing only the latest page unless measured backfill gaps justify older-page refreshes.
- Candle writes use unordered bulk upserts, up to 500 rows per provider page. The unique compound index prevents duplicate `(symbol, interval, time)` keys if it exists in Atlas. `maxPoolSize` is 5 per backend process; with one Render instance this is a small pool, but every additional instance owns its own pool.
- The read-only Atlas audit script could not establish a connection from this environment. Consequently, actual collection counts, stored history coverage since June 2026, duplicate state, index list, query plans, examined/returned ratios, Atlas tier/connection limits, and database latency remain unverified. The script is `npm --prefix backend run audit:mongodb`; it prints index and explain statistics and does not write application data.

### Render observations

Read-only Render metrics were queried for the backend service `gold-terminal` over the week ending 2026-11-04, with hourly aggregation. The service is currently one Free-plan web instance (0.15 reported CPU units and 512 MiB memory limit). On the most recent 24 hours, sampled CPU peaked at 0.0021 of the 0.15 limit (about 1.4%); memory peaked at 102,486,020 bytes (about 97.7 MiB, 19.1% of the reported 512 MiB limit). This suggests substantial headroom in those hourly samples; it does not establish behavior during a traffic spike. Render returned no HTTP request-count or HTTP-latency samples for the requested period, so no live p50/p95 or throughput conclusion is possible. Hourly samples can miss brief spikes.

The Render workspace currently has the live backend and a static frontend, with no staging service listed. No load was sent to production. The static frontend does not execute the Node API workload and its resource use is not a proxy for backend capacity.

### Load tests and remaining verification

No API concurrency benchmark was run because there is no isolated staging service/Atlas clone available in this workspace, and production load was explicitly excluded. Do not treat the pure algorithm timings as HTTP endpoint throughput. A safe next test should use a staging service and read-only Atlas clone, with concurrency 1, 5, 20, and 50 against latest and older history pages. Record p50/p95/p99 latency, errors, response bytes, CPU, RSS, event-loop delay, Atlas active connections, query execution stats, and provider-call counts. Include cold-cache and warm-cache runs; stop if error rate or Atlas load rises sharply.

### Remaining CPU and memory profile

- The ordinary chart path is bounded to 1,200 candles in the frontend; historical API pages are 500 candles. The structure scanner benchmark scaled near-linearly over the tested synthetic sizes. Its 1M-candle result is a scanner stress test, not a supported end-to-end API or chart workload.
- Backtest loops through candles and calls the full analyzer on each prefix (`candles.slice(0, i)`). Each prefix does an O(i log i) structure scan plus O(i) zone replay, making the full replay approximately O(N² log N) time, with O(N) prefix-copy working memory at each step. The 2,000-candle cap bounds this cost but does not remove it; the backtest is the leading identified CPU hotspot. A stateful chronological replay can reduce repeated work, but should be validated for exact output parity before replacing it.
- For normal page retrieval, query work should be approximately O(log D + 500) when the compound index is used, where D is collection size. Candle normalization/deduplication/sort is O(500 log 500) per fetched provider page. The signal input fingerprint is O(500) per latest request; identical input then avoids replay in that process. The in-memory cache is not shared between instances.
- The principal scalability risk is repeated calculation/provider work across multiple processes, not the 1M-row market-structure scan. Today’s one-instance metrics do not justify adding Redis, a worker, or a larger Render plan.

### Live quote WebSocket update

- The backend now maintains one Twelve Data WebSocket connection for XAU/USD and fans fresh ticks to authenticated browser clients through a Server-Sent Events endpoint. This uses one provider connection regardless of the number of viewers, up to a local cap of 100 SSE clients.
- When a fresh stream quote exists, dashboard snapshots use it and skip the REST quote request. If the stream is disabled, unavailable, stale, or rejected by the account’s symbol entitlement, the existing REST quote path remains the fallback. The screenshots show zero WebSocket usage and a one-connection allowance, but do not establish that XAU/USD is included in the Basic-plan trial symbols; production logs/UI must confirm subscription acceptance.
- This does not remove the need for Twelve Data: the stream provides live price ticks, while `/api/gold/history` still uses the Twelve Data REST time-series endpoint for OHLC candles and backfill. FRED and other macro readings remain on their existing data paths. The ordinary O(N² log N) backtest remains capped at 2,000 candles and is not run for each dashboard view.
- Local development does not open a provider socket by default, avoiding competition with the account’s single production connection. Node.js 22.15 or later is required for the built-in WebSocket client; no extra runtime package was added. Browser quote updates are throttled to at most once per second, while the macro dashboard refresh interval remains unchanged.

### Prioritized recommendations and sizing

1. **Verify Atlas first:** run the read-only index/explain script from an environment with working Atlas network access. Confirm the compound candle index is `IXSCAN`, and `totalDocsExamined` stays close to `nReturned` (maximum 500 for this route). Record collection size, time coverage, Atlas tier and connection limit. Do not create duplicate indexes until this is known.
2. **Benchmark staging before scaling:** create or use a non-production service and read-only clone; perform the staged 1/5/20/50 concurrency test above. Current Render hourly usage is low, but there are no request-latency samples, so capacity is unknown.
3. **If duplicate computation shows up:** calculate each timeframe once when its candle closes, persist the signal snapshot keyed by `(ruleVersion, interval, candleTime, inputHash)`, and have web requests read it. If more than one web instance is needed, move deduplication to a shared cache/lease only after the benchmark proves it necessary.
4. **If backtest is slow:** replace prefix replay with an incremental chronological state machine and compare all metrics/signals with the current implementation on fixed datasets before rollout.
5. **Render sizing:** keep the current single 0.15-CPU/512-MiB backend while staged p95 remains within the product’s chosen target and observed CPU/memory remain comfortably below limits. For a first higher-traffic trial, test a paid 1-vCPU/2-GiB instance or equivalent against staging, then add a second instance only if concurrency/availability needs it; budget Mongo pools per instance (`5 × instances`) against Atlas limits. These are conservative test starting points, not a capacity guarantee or a claim that an upgrade is currently needed. Do not change production infrastructure from this report alone.

### Verification run for this audit

- Backend/frontend automated tests: **176 passed, 0 failed** (including four WebSocket stream/fallback tests).
- Frontend ESLint: passed.
- Frontend production build: passed (Vite 8.2.1; 61 modules transformed).
- Synthetic benchmark rerun: 10k/100k/1M market-structure scan and 1,200-candle full analyzer as tabulated above.
- Atlas explain audit: unable to connect from this workspace; no index or production data was modified.
- API concurrency test: not run; no staging environment was available and production load was not permitted.
- Production infrastructure: unchanged; no deployment performed.

## Tests and UI evidence

The full existing backend/frontend suite and frontend production build/lint are run for this branch. Coverage includes duplicates and invalid candles, missing timestamps, no-lookahead replay, wick-only false breakouts, support-to-resistance and resistance-to-support retests, invalidations, three timeframes, risk/friction accounting, macro separation, and identical-signal cache behavior. A live dashboard screenshot was not captured because the local application could not load its Atlas-backed history; a synthetic screenshot would misrepresent live zones.
