import { analyseCandles, TIMEFRAMES } from "./technicalAnalysis.js";
import { mergeCandles, sessionCandles } from "./candles.js";
import { getGoldSession } from "./goldSession.js";

export function riskReward(entry, stop, target, direction) {
  if (![entry, stop, target].every(value => Number.isFinite(value) && value > 0)) return null;
  const sign = direction === "buy" ? 1 : direction === "sell" ? -1 : 0;
  const risk = (entry - stop) * sign, reward = (target - entry) * sign;
  return sign && risk > 0 && reward > 0 ? { risk, reward, ratio: reward / risk } : null;
}

// Technical-only replay: signals use only the prefix known before the entry bar.
export function backtestCandles(rows, interval, { now, cost, maxBars = 10 }, session = getGoldSession) {
  const seconds = TIMEFRAMES[interval]?.seconds;
  if (!seconds || !Number.isFinite(now) || !Number.isFinite(cost) || cost < 0 || !Number.isInteger(maxBars) || maxBars < 1) throw Error("Enter valid replay assumptions.");
  const valid = mergeCandles([], rows);
  if (valid.length !== rows.length) throw Error("Replay needs valid, unique candles.");
  const candles = sessionCandles(valid, interval).filter(row => (row.time + seconds) * 1000 <= now);
  if (candles.length > 2000) throw Error("Replay supports up to 2,000 loaded candles. Reload the timeframe to use a smaller window.");
  if (candles.length < 22) throw Error("Load at least 22 completed candles to replay an entry.");
  const trades = [], signals = [], used = new Set();
  let position = null;
  for (let i = 21; i < candles.length; i++) {
    const candle = candles[i];
    if (!position && session(candle.time * 1000).isOpen) {
      const prior = analyseCandles(candles.slice(0, i), interval, candle.time * 1000);
      const stamp = prior.setup?.confirmedAt;
      if (stamp === candles[i - 1].time && candle.time === stamp + seconds && !used.has(stamp) && prior.confirmation !== "None" && prior.risk?.qualified) {
        used.add(stamp);
        const sign = ["Buy Watch", "Support Bounce"].includes(prior.confirmation) ? 1 : -1;
        const stop = prior.risk.stop;
        const target = prior.risk.target;
        const risk = (candle.open - stop) * sign;
        const reward = (target - candle.open) * sign;
        const plannedRewardRisk = risk > 0 && reward > 0 ? reward / risk : null;
        // The configured round-trip cost is deducted once from the result.
        // Skip gaps that erase the minimum structural R:R before entry.
        if (plannedRewardRisk !== null && plannedRewardRisk >= prior.risk.minRewardRisk) {
          position = { entryTime: candle.time, signalTime: stamp, direction: sign === 1 ? "buy" : "sell", entry: candle.open, stop,
            target, risk, plannedRewardRisk, sign, index: i };
          signals.push({ signalTime: stamp, direction: position.direction, entryTime: candle.time });
        }
      }
    }
    if (!position) continue;
    const { sign, stop, target } = position;
    let exit = null, reason = null;
    // Conservative OHLC fills: gap stops at the open, ambiguous bars stop first.
    if ((candle.open - stop) * sign <= 0) { exit = candle.open; reason = "Gap through stop"; }
    else if (sign === 1 ? candle.low <= stop : candle.high >= stop) { exit = stop; reason = "Stop (first if ambiguous)"; }
    else if (sign === 1 ? candle.high >= target : candle.low <= target) { exit = target; reason = "Target"; }
    else if (i - position.index + 1 >= maxBars) { exit = candle.close; reason = "Holding limit"; }
    if (exit !== null) {
      const net = (exit - position.entry) * sign - cost;
      trades.push({ ...position, exit, exitTime: candle.time, reason, net, netR: net / position.risk });
      position = null;
    }
  }
  let equityR = 0, peakR = 0, maxDrawdownR = 0;
  for (const trade of trades) {
    equityR += trade.netR;
    peakR = Math.max(peakR, equityR);
    maxDrawdownR = Math.max(maxDrawdownR, peakR - equityR);
  }
  const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return { trades, signals, openTrade: position, candleCount: candles.length,
    netR: trades.reduce((sum, trade) => sum + trade.netR, 0),
    winRate: trades.length ? trades.filter(trade => trade.net > 0).length / trades.length * 100 : null,
    averageRewardRisk: average(trades.map(trade => trade.plannedRewardRisk)),
    expectancyR: average(trades.map(trade => trade.netR)), maxDrawdownR,
    sampleSize: trades.length };
}
