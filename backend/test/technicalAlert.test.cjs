const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildTechnicalAlert } = require('../src/services/technicalAlert');
const { RULE_VERSION } = require('../src/services/signalAuditService');
const time = 1800000000;
function fixture(direction = 'buy', interval = '1h') {
  return { status: 'saved', ruleVersion: RULE_VERSION, revisedInput: false,
    analysis: { ready: true, stale: false, interval, lastTime: time, close: direction === 'buy' ? 102 : 98,
      confirmation: direction === 'buy' ? 'Buy Watch' : 'Sell Watch',
      setup: { direction, phase: 'confirmed', breakTime: time - 7200, touchedAt: time - 3600, confirmedAt: time },
      levels: [{label: 'Buy Watch trigger', price: 101}, {label: 'Sell Watch trigger', price: 99}],
      zones: [{label: 'Resistance zone', low: 100, high: 101}, {label: 'Support zone', low: 99, high: 100}] } };
}
const options = { interval: '1h', isOpen: true, now: (time + 3600) * 1000 };
test('buy and sell confirmations include timeframe, trigger and technical invalidation', () => {
  for (const direction of ['buy', 'sell']) {
    const result = buildTechnicalAlert(fixture(direction), options);
    assert.equal(result.direction, direction);
    assert.equal(result.invalidation.price, 100);
    assert.equal(result.interval, '1h');
    assert.equal('macro' in result, false);
    assert.equal(result.confirmedAt, new Date(options.now).toISOString());
  }
});
test('confirmed support bounce alert uses support as trigger and invalidation zone', () => {
  const audit = fixture();
  audit.analysis.confirmation = 'Support Bounce';
  audit.analysis.close = 100.5;
  audit.analysis.setup.type = 'support-bounce';
  audit.analysis.setup.startTime = audit.analysis.setup.breakTime;
  audit.analysis.setup.touchedAt = audit.analysis.setup.startTime;
  audit.analysis.setup.breakTime = null;
  const result = buildTechnicalAlert(audit, options);
  assert.equal(result.kind, 'technical-support-bounce-confirmed');
  assert.equal(result.direction, 'buy');
  assert.equal(result.trigger, 100);
  assert.equal(result.invalidation.price, 99);
  assert.match(result.body, /bullish reclaim/i);
});
test('confirmed resistance rejection alert uses resistance as trigger and invalidation zone', () => {
  const audit = fixture('sell');
  audit.analysis.confirmation = 'Resistance Rejection';
  audit.analysis.close = 99.5;
  audit.analysis.setup.type = 'resistance-rejection';
  audit.analysis.setup.startTime = audit.analysis.setup.breakTime;
  audit.analysis.setup.touchedAt = audit.analysis.setup.startTime;
  audit.analysis.setup.breakTime = null;
  const result = buildTechnicalAlert(audit, options);
  assert.equal(result.kind, 'technical-resistance-rejection-confirmed');
  assert.equal(result.direction, 'sell');
  assert.equal(result.trigger, 100);
  assert.equal(result.invalidation.price, 101);
  assert.match(result.body, /bearish rejection/i);
});
test('refreshes have stable IDs; opposite macro inputs have no effect', () => {
  const audit = fixture();
  const first = buildTechnicalAlert(audit, options);
  audit.macro = { score: -20 }; audit.analysis.macro = { score: 20 };
  assert.deepEqual(buildTechnicalAlert(audit, {...options, now: options.now + 1000}), first);
});
test('unsafe, revised, provisional and unconfirmed inputs produce no alert', () => {
  const mutations = [a => a.status = 'unavailable', a => a.ruleVersion = 'old',
    a => a.revisedInput = true, a => delete a.revisedInput,
    a => a.analysis.ready = false, a => a.analysis.stale = true,
    a => a.analysis.confirmation = 'None', a => a.analysis.setup.phase = 'retest',
    a => a.analysis.setup.touchedAt = a.analysis.setup.breakTime,
    a => a.analysis.setup.confirmedAt -= 3600, a => a.analysis.lastTime += 3600,
    a => a.analysis.close = 100, a => a.analysis.levels = [],
    a => a.analysis.zones[0].low = NaN];
  for (const mutate of mutations) {
    const audit = fixture(); mutate(audit);
    assert.equal(buildTechnicalAlert(audit, options), null);
  }
});
test('closed sessions, forming candles and delayed confirmations are suppressed', () => {
  for (const extra of [{isOpen: false}, {interval: 'bad'}, {now: NaN},
    {now: options.now - 1}, {now: options.now + 900001}]) {
    assert.equal(buildTechnicalAlert(fixture(), {...options, ...extra}), null);
  }
  assert.equal(buildTechnicalAlert(null, options), null);
});
test('each supported timeframe requires its own completed candle', () => {
  for (const [interval, seconds] of [['5min',300], ['1h',3600], ['1day',86400]]) {
    const audit = fixture('buy', interval);
    const opts = {...options, interval, now: (time + seconds) * 1000};
    assert.ok(buildTechnicalAlert(audit, opts));
    assert.equal(buildTechnicalAlert(audit, {...opts, now: opts.now - 1}), null);
  }
});
