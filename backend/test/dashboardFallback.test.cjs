const { test } = require('node:test');
const assert = require('node:assert/strict');
const { markDashboardStale, buildPartialDashboard } = require('../src/services/dashboardFallback');

test('Atlas snapshot fallback visibly marks macro data and quote stale without mutating saved data', () => {
  const savedAt = new Date('2026-10-21T12:00:00.000Z');
  const input = {
    meta: { status: 'current', lastProviderSuccessAt: '2026-10-21T11:59:00.000Z' },
    gold: { score: { totalScore: -6, bias: 'Bearish' } },
    market: { xauusd: { price: 4189.01, receivedAt: '2026-10-21T11:58:00.000Z', stale: false } },
  };

  const result = markDashboardStale(input, savedAt, 'snapshot');
  assert.equal(result.meta.status, 'stale');
  assert.match(result.meta.warning, /last complete dashboard saved in Atlas/);
  assert.equal(result.meta.lastProviderSuccessAt, '2026-10-21T11:59:00.000Z');
  assert.equal(result.market.xauusd.stale, true);
  assert.equal(result.market.xauusd.priceSource, 'saved_dashboard_snapshot');
  assert.equal(result.gold.score.totalScore, -6);
  assert.equal(input.meta.status, 'current');
  assert.equal(input.market.xauusd.stale, false);
});

test('in-process FRED fallback warns only about cached economic readings', () => {
  const result = markDashboardStale({ meta: {}, market: { xauusd: { stale: false } } }, null, 'provider');
  assert.equal(result.meta.status, 'stale');
  assert.match(result.meta.warning, /FRED could not refresh/);
  assert.equal(result.market.xauusd.stale, false);
});

test('partial dashboard keeps the independent market quote while clearly withholding macro score', () => {
  const market = { xauusd: { price: 4189.01, stale: false } };
  const result = buildPartialDashboard(market, '2026-10-21T17:40:00.000Z');
  assert.equal(result.meta.status, 'partial');
  assert.equal(result.market, market);
  assert.equal(result.gold.score, null);
  assert.equal(result.gold.summary, 'Macro data unavailable');
  assert.match(result.meta.warning, /shown separately/);
});
