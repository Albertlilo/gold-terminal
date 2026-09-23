import { analyseCandles, TIMEFRAMES } from "./technicalAnalysis.js";
import { mergeCandles } from "./candles.js";
import { getGoldSession } from "./goldSession.js";

export function riskReward(entry, stop, target, direction) {
  if (![entry, stop, target].every(value => Number.isFinite(value) && value > 0)) return null;
  const sign = direction === "buy" ? 1 : direction === "sell" ? -1 : 0;
  const risk = (entry - stop) * sign, reward = (target - entry) * sign;
  return sign && risk > 0 && reward > 0 ? { risk, reward, ratio: reward / risk } : null;
}

// Technical-only replay: signals use only the prefix known before the entry bar.
export function backtestCandles(rows, interval, { now, cost, rewardMultiple = 2, maxBars = 10 }, session = getGoldSession) {
  const seconds = TIMEFRAMES[interval]?.seconds;
  if (!seconds || !Number.isFinite(now) || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(rewardMultiple) || rewardMultiple <= 0 || !Number.isInteger(maxBars) || maxBars < 1) throw Error("Enter valid replay assumptions.");
  const valid = mergeCandles([], rows);
  if (valid.length !== rows.length) throw Error("Replay needs valid, unique candles.");
  const candles = valid.filter(row => (row.time + seconds) * 1000 <= now);
  if (candles.length > 2000) throw Error("Replay supports up to 2,000 loaded candles. Reload the timeframe to use a smaller window.");
  if (candles.length < 22) throw Error("Load at least 22 completed candles to replay an entry.");
  const trades = [], signals = [], used = new Set();
  let position = null;
  for (let i = 21; i < candles.length; i++) {
    const candle = candles[i];
    if (!position && session(candle.time * 1000).isOpen) {
      const prior = analyseCandles(candles.slice(0, i), interval, candle.time * 1000);
      const stamp = prior.setup?.confirmedAt;
      if (stamp === candles[i - 1].time && candle.time === stamp + seconds && !used.has(stamp) && prior.confirmation !== "None") {
        used.add(stamp);
        const sign = prior.confirmation === "Buy Watch" ? 1 : -1;
        const stop = sign === 1 ? prior.zones[1].low : prior.zones[0].high;
        const risk = (candle.open - stop) * sign;
        if (risk > 0) {
          position = { entryTime: candle.time, signalTime: stamp, direction: sign === 1 ? "buy" : "sell", entry: candle.open, stop,
            target: candle.open + sign * risk * rewardMultiple, risk, sign, index: i };
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
  return { trades, signals, openTrade: position, candleCount: candles.length,
    netR: trades.reduce((sum, trade) => sum + trade.netR, 0),
    winRate: trades.length ? trades.filter(trade => trade.net > 0).length / trades.length * 100 : null };
}
