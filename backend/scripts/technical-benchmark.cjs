const { performance } = require("node:perf_hooks");

async function main() {
  const { analyzeMarketStructure } = await import("../frontend/src/lib/marketStructure.js");
  const { analyseCandles } = await import("../frontend/src/lib/technicalAnalysis.js");
  const { DEFAULT_TECHNICAL_CONFIG } = await import("../frontend/src/lib/zoneConfirmation.js");
  const start = Date.parse("2026-01-01T00:00:00Z") / 1000;
  const makeRows = count => {
    const rows = new Array(count);
    for (let i = 0; i < count; i++) {
      const close = 4000 + 22 * Math.sin(i * 0.013) + 5 * Math.sin(i * 0.071);
      const wick = 0.2 + Math.abs(Math.sin(i * 0.037)) * 1.3;
      rows[i] = { time: start + i * 300, open: close - Math.sin(i * 0.11) * 0.2,
        high: close + wick, low: close - wick, close };
    }
    return rows;
  };
  console.log(`Node ${process.version}; ${process.platform}/${process.arch}; synthetic deterministic XAU/USD-like candles`);
  for (const count of [10_000, 100_000, 1_000_000]) {
    const rows = makeRows(count);
    analyzeMarketStructure(rows.slice(0, Math.min(5_000, count))); // JIT warm-up
    const before = process.memoryUsage().heapUsed;
    const startAt = performance.now();
    const read = analyzeMarketStructure(rows);
    const elapsedMs = performance.now() - startAt;
    const heapDeltaMb = (process.memoryUsage().heapUsed - before) / 1024 / 1024;
    console.log(JSON.stringify({ candles: count, marketStructureMs: +elapsedMs.toFixed(2), heapDeltaMb: +heapDeltaMb.toFixed(1),
      swingHighs: read.swingHighs.length, swingLows: read.swingLows.length, event: read.event }));
  }
  const bounded = makeRows(1_200);
  const startAt = performance.now();
  const analysis = analyseCandles(bounded, "5min", (bounded.at(-1).time + 300) * 1000,
    { ...DEFAULT_TECHNICAL_CONFIG, enforceRisk: false });
  console.log(JSON.stringify({ candles: bounded.length, fullTechnicalAnalysisMs: +(performance.now() - startAt).toFixed(2),
    state: analysis.state, zones: analysis.zones.length, maxSupportedFrontendWindow: 1_200 }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
