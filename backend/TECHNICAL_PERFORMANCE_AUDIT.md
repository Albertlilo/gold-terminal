# Technical engine and performance audit

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
| Backtest | Replays `analyseCandles` on each candle prefix; max 2,000 completed candles | Worst-case quadratic replay in N, with each replay bounded by its lookback work. This is the clearest remaining CPU bottleneck; optimize incrementally only after profiling typical 500–2,000 candle runs |
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
| 10,000 | 3.56 ms | 2.1 MB |
| 100,000 | 11.12 ms | 2.2 MB |
| 1,000,000 | 154.98 ms | 31.9 MB |

The full technical analyzer processed the maximum frontend window (1,200 candles) in 30.40 ms in that run. These are single-run local timings, not service latency or a statistical benchmark. The deterministic market-structure parity test compared the optimized output to the prior chronological algorithm on 120 seeded histories; all matched.

## Backtest and signal reliability

The existing replay uses completed candles only, enters on the next candle, treats ambiguous OHLC stop/target bars conservatively (stop first), and records win rate, average planned R:R, expectancy, max drawdown, and sample count. Before this change it accepted only one aggregate friction number. Separate spread, commission, and slippage price-equivalent costs are now supported and reported in the result. No Atlas-period backtest was run because historical data could not be read. No win-rate improvement is claimed.

## API, concurrency, and infrastructure

- Mongo client pool is fixed at `maxPoolSize: 5`; do not raise it without Atlas connection-count and Render memory/CPU measurements.
- History refreshes coalesce identical in-process requests; signal audit insert is immutable and deduplicated in Mongo. The new pre-analysis fingerprint cache avoids repeated analysis only within one server process. It does not coordinate multiple Render instances.
- API latency, throughput, event-loop delay, Render resource usage, and concurrent request behavior were not measured: the local service could not reach Atlas and production load testing was explicitly avoided.
- Next useful measurement is a staging load test against a read-only Atlas clone with 1, 5, 20, and 50 concurrent history requests, recording p50/p95, Mongo examined-to-returned ratios, event-loop delay, and connection-pool wait. Only then decide whether to add a shared cache, raise the pool, or precompute after candle close.
- No Redis, WebSocket, worker, or paid service is justified by the available measurements.

## Tests and UI evidence

The full existing backend/frontend suite and frontend production build/lint are run for this branch. Coverage includes duplicates and invalid candles, missing timestamps, no-lookahead replay, wick-only false breakouts, support-to-resistance and resistance-to-support retests, invalidations, three timeframes, risk/friction accounting, macro separation, and identical-signal cache behavior. A live dashboard screenshot was not captured because the local application could not load its Atlas-backed history; a synthetic screenshot would misrepresent live zones.
