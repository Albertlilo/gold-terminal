const { RULE_VERSION } = require('./signalAuditService');
const INTERVAL_SECONDS = { '5min': 300, '1h': 3600, '1day': 86400 };

// Produces a candidate only. Delivery must persist its ID per subscription
// before retrying, and must never use a chart's provisional calculation.
function buildTechnicalAlert(audit, { interval, isOpen, now = Date.now() } = {}) {
  const duration = INTERVAL_SECONDS[interval];
  const analysis = audit?.analysis;
  const setup = analysis?.setup;
  if (!duration || !Number.isFinite(now) || isOpen !== true
    || audit?.status !== 'saved' || audit.ruleVersion !== RULE_VERSION
    || audit.revisedInput !== false || analysis?.ready !== true
    || analysis.stale !== false || analysis.interval !== interval
    || setup?.phase !== 'confirmed') return null;

  const direction = setup.direction;
  const supportBounce = setup.type === 'support-bounce';
  const resistanceRejection = setup.type === 'resistance-rejection';
  const zoneReaction = supportBounce || resistanceRejection;
  const expected = supportBounce ? 'Support Bounce' : resistanceRejection ? 'Resistance Rejection' : direction === 'buy' ? 'Buy Watch' : direction === 'sell' ? 'Sell Watch' : null;
  if (!expected || analysis.confirmation !== expected) return null;
  const startTime = setup.startTime ?? setup.breakTime;
  const times = [startTime, setup.touchedAt, setup.confirmedAt, analysis.lastTime];
  if (!times.every(value => Number.isSafeInteger(value) && value > 0)
    || (!zoneReaction && setup.touchedAt <= startTime) || setup.confirmedAt < setup.touchedAt
    || setup.confirmedAt !== analysis.lastTime) return null;
  const closedAt = (analysis.lastTime + duration) * 1000;
  // Never send an old setup after a restart, nor an unfinished candle.
  if (now < closedAt || now - closedAt > Math.min(duration, 900) * 1000) return null;
  const trigger = supportBounce ? analysis.zones?.find(item => item.label === 'Support zone')?.high
    : resistanceRejection ? analysis.zones?.find(item => item.label === 'Resistance zone')?.low
      : analysis.levels?.find(level => level.label === `${expected} trigger`)?.price;
  const zone = analysis.zones?.find(item => item.label === (supportBounce || direction === 'sell' && !resistanceRejection ? 'Support zone' : 'Resistance zone'));
  if (![analysis.close, trigger, zone?.low, zone?.high].every(value => Number.isFinite(value) && value > 0)
    || zone.low > zone.high || (direction === 'buy' ? analysis.close <= trigger : analysis.close >= trigger)) return null;

  return {
    id: `${RULE_VERSION}:XAUUSD:${interval}:${zoneReaction ? setup.type : direction}:${startTime}:${setup.confirmedAt}`,
    kind: supportBounce ? 'technical-support-bounce-confirmed' : resistanceRejection ? 'technical-resistance-rejection-confirmed' : 'technical-retest-confirmed', symbol: 'XAUUSD', interval, direction,
    ruleVersion: RULE_VERSION, confirmedCandleTime: setup.confirmedAt,
    confirmedAt: new Date(closedAt).toISOString(),
    expiresAt: new Date(closedAt + Math.min(duration, 900) * 1000).toISOString(),
    trigger, confirmationClose: analysis.close,
    invalidation: { condition: direction === 'buy' ? 'completed-close-below' : 'completed-close-above',
      price: direction === 'buy' ? zone.low : zone.high },
    title: `XAUUSD · ${interval} · ${expected}`,
    body: `${supportBounce ? 'Support touch and bullish reclaim' : resistanceRejection ? 'Resistance touch and bearish rejection' : direction === 'buy' ? 'Resistance breakout and successful retest' : 'Support break and failed retest'} confirmed on a completed candle. Review the chart; no trade has been placed.`,
  };
}

module.exports = { buildTechnicalAlert };
