import { confirmZones, DEFAULT_TECHNICAL_CONFIG } from "./zoneConfirmation.js";
import { mergeCandles, sessionCandles } from "./candles.js";

export const TIMEFRAMES = { "5min": { label: "5 minutes", seconds: 300 }, "1h": { label: "1 hour", seconds: 3600 }, "1day": { label: "Daily", seconds: 86400 } };
export const NOISE_PERCENT = 0.1;

export function analyseCandles(rows, interval, now, config = DEFAULT_TECHNICAL_CONFIG) {
  const duration = TIMEFRAMES[interval]?.seconds;
  const source = Array.isArray(rows) ? rows : [];
  const valid = sessionCandles(mergeCandles([], source), interval);
  const invalid = source.some(row => !mergeCandles([], [row]).length);
  const completed = valid.filter(row => row.time + duration <= now / 1000);
  const window = completed.slice(-20);
  const last = window.at(-1);
  const base = { count: window.length, interval, lastTime: last?.time ?? null, ready: false, state: invalid ? "Invalid price data" : "Collecting candles", levels: [], zones: [], confirmation: "None", move: null, marketStructure: null, risk: null };
  if (!duration || invalid || completed.length < 21) return base;
  const anchor = window[0].close;
  const move = (last.close - anchor) / anchor * 100;
  const result = confirmZones(completed, config);
  if (!result.zones) return { ...base, state: result.state, move, close: last.close, marketStructure: result.marketStructure };
  const { support, formingSupport, resistance, buy, sell } = result.zones;
  return { ...base, ready: true, state: result.state, confirmation: result.confirmation, setup: result.setup, risk: result.risk,
    marketStructure: result.marketStructure, move, close: last.close,
    stale: now / 1000 - (last.time + duration) > Math.max(duration * 2, 900),
    support: support?.low ?? null, resistance: resistance?.high ?? null,
    // Retired levels remain available to the audit/backtest result, but the
    // live chart only receives the current validated structure. Showing old
    // levels beside active ones makes the technical read look contradictory.
    zones: [support, formingSupport, resistance].filter(Boolean),
    previousZones: result.previousZones,
    structure: { supportTouches: support?.touches ?? null, resistanceTouches: resistance?.touches ?? null,
      breakBuffer: result.zones.breakBuffer, atr: result.zones.atr, historyCount: result.previousZones.length },
    average: window.reduce((sum, row) => sum + row.close, 0) / window.length,
    levels: [resistance && { label: "Buy Watch trigger", price: buy, color: "#70d69c" },
      support && { label: "Sell Watch trigger", price: sell, color: "#ef7b7b" }].filter(Boolean),
  };
}

export function makeTechnicalPlan(analysis, { isOpen }) {
  const signal = !isOpen || !analysis.ready || analysis.stale ? "Wait"
    : ["Buy Watch", "Sell Watch", "Support Bounce", "Resistance Rejection"].includes(analysis.confirmation) ? analysis.confirmation : "Wait";
  const direction = analysis.setup?.direction;
  const supportBounce = analysis.setup?.type === "support-bounce" || analysis.confirmation === "Support Bounce";
  const resistanceRejection = analysis.setup?.type === "resistance-rejection" || analysis.confirmation === "Resistance Rejection";
  const reason = !isOpen ? "Market closed. Wait for the next session."
    : !analysis.ready ? "The chart is collecting enough completed candles and price reactions to confirm its structure."
    : analysis.stale ? "Candle data is delayed. Wait for a fresh completed candle."
    : analysis.state?.endsWith("invalidated") && analysis.setup?.type === "break-retest" && analysis.setup?.phase === "waiting"
      ? "The reaction failed and price closed through the zone's break trigger. A new break is recorded; confirmation requires a later retest."
    : supportBounce && signal === "Support Bounce" ? "A completed candle touched support and closed bullishly back above the support zone. This is a technical support-bounce confirmation, separate from macro bias and breakout/retest watches."
    : supportBounce && analysis.state === "Support bounce developing" ? "Price has touched the support zone. Wait for a completed bullish close back above its upper edge; a touch alone is not confirmation."
    : supportBounce && analysis.state === "Support bounce invalidated" ? "A completed candle closed below the lower edge of the support zone. The support-bounce setup is invalidated."
    : resistanceRejection && signal === "Resistance Rejection" ? "A completed candle touched resistance and closed bearishly back below the resistance zone. This is a technical resistance-rejection confirmation, separate from macro bias and breakout/retest watches."
    : resistanceRejection && analysis.state === "Resistance rejection developing" ? "Price has touched the resistance zone. Wait for a completed bearish close back below its lower edge; a touch alone is not confirmation."
    : resistanceRejection && analysis.state === "Resistance rejection invalidated" ? "A completed candle closed above the upper edge of the resistance zone. The resistance-rejection setup is invalidated."
    : analysis.state === "Conflicting zone touches · wait" ? "One completed candle spanned both support and resistance zones. The reaction is ambiguous, so no directional setup is assigned; wait for clearer price action."
    : signal !== "Wait" ? "The completed-candle break and retest conditions are confirmed. A watch setup is not an executed trade."
    : analysis.state === "Retest invalidated" ? "The setup failed: a completed candle closed through the far edge of the retested zone. Wait for a new break and retest."
    : analysis.state === "Setup expired" ? "The setup reached its phase limit: 10 candles to touch, 10 candles from the first touch to recover, or 10 candles after confirmation. A new break and retest is required."
    : analysis.state === "Pullback developing" ? "The retest has touched the zone. Wait for a completed recovery close beyond the trigger; a zone touch alone does not confirm a watch."
    : analysis.state === "Confirmation weakened" ? "The latest completed close no longer holds beyond the trigger. The watch is paused; the far zone edge still defines invalidation."
    : analysis.state?.startsWith("Risk filter") ? analysis.risk?.reason || "The technical pattern occurred, but the structural risk filter did not qualify it."
    : analysis.state?.includes("awaiting retest") ? "A break is recorded, but the zone has not yet been touched by a later completed candle. Do not confuse the breakout with retest confirmation."
    : analysis.state === "Support confirmed · finding resistance" ? "Confirmed support is visible and can form a support-bounce or support-break setup. Resistance is still collecting three separated reactions."
    : analysis.state === "Resistance confirmed · finding support" ? "Confirmed resistance is visible and can form a rejection or resistance-break setup. A potential support marker is only a reference until its reactions confirm an active support zone."
    : "No completed technical setup is confirmed on this timeframe. Crossing a price line alone does not confirm a breakout/retest watch; a support bounce also needs a completed bullish reclaim. Macro score does not trigger or filter technical setups.";
  return { signal, reason,
    preferred: signal === "Support Bounce" ? "Support-bounce buy confirmed" : signal === "Resistance Rejection" ? "Resistance-rejection sell confirmed" : signal === "Sell Watch" ? "Support-break sell confirmed" : signal === "Buy Watch" ? "Resistance-break buy confirmed" : supportBounce ? "Support-bounce buy developing" : resistanceRejection ? "Resistance-rejection sell developing" : direction === "sell" ? "Support-break sell developing" : direction === "buy" ? "Resistance-break buy developing" : "No active technical setup",
    confirmation: supportBounce ? "Support touch + bullish close above zone" : resistanceRejection ? "Resistance touch + bearish close below zone" : direction === "sell" ? "Support break + failed retest" : direction === "buy" ? "Resistance breakout + successful retest" : "Wait for a technical setup",
    invalidation: supportBounce ? "Completed close below the support zone" : resistanceRejection ? "Completed close above the resistance zone" : direction === "sell" ? "Completed close above the support zone" : direction === "buy" ? "Completed close below the resistance zone" : "No active technical setup",
  };
}

export function getSetupStage(analysis) {
  const direction = analysis.setup?.direction;
  if (direction !== "buy" && direction !== "sell") {
    return { label: "Waiting for setup", detail: "No active buy or sell pattern on this timeframe.", tone: "neutral" };
  }
  const side = direction === "buy" ? "Buy" : "Sell";
  const confirmed = analysis.confirmation !== "None" && analysis.setup?.confirmedAt != null;
  const detail = analysis.setup?.phase === "risk-rejected" ? analysis.risk?.reason || "Pattern conditions occurred, but the risk filter rejected the setup."
    : confirmed ? "Completed-candle conditions met; review invalidation before acting."
    : analysis.setup?.phase === "waiting" ? "Break recorded; a later retest is still needed."
    : "The pattern is developing; wait for a completed confirming candle.";
  return { label: `${side} setup ${confirmed ? "confirmed" : "forming"}`, detail, tone: direction === "buy" ? "up" : "down" };
}
