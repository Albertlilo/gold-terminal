const test = require('node:test');
const assert = require('node:assert/strict');

test('FRED observations can be parsed from a JSON text response', () => {
  const { readFredPayload } = require('../src/services/fredService');
  const observations = [{ date: '2026-10-20', value: '4.5' }];
  assert.deepEqual(readFredPayload({ status: 200, headers: { 'content-type': 'text/plain' }, data: JSON.stringify({ observations }) }), observations);
});

test('FRED HTML response is classified without logging its contents', () => {
  const { readFredPayload } = require('../src/services/fredService');
  assert.throws(
    () => readFredPayload({ status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' }, data: '<html>secret response details</html>' }),
    error => error.code === 'FRED_INVALID_RESPONSE' && error.payloadKind === 'html'
      && error.contentType === 'text/html' && !JSON.stringify(error).includes('secret response details'),
  );
});

test('FRED maintenance page is identified without exposing its contents', () => {
  const { readFredPayload } = require('../src/services/fredService');
  assert.throws(
    () => readFredPayload({ status: 200, headers: { 'content-type': 'text/html' }, data: '<html>We will be back soon. This web site is currently undergoing proactive maintenance.</html>' }),
    error => error.code === 'FRED_MAINTENANCE' && error.payloadKind === 'html',
  );
});

test('backend retains raw scoring inputs and caches source-check time without another HTTP request', async () => {
  const axios = require('axios');
  const original = axios.get;
  const originalKey = process.env.FRED_API_KEY;
  process.env.FRED_API_KEY = 'offline-test-key';
  let calls = 0;
  axios.get = async () => {
    calls++;
    return { data: { observations: [
      { date: '2026-09-01', value: '159044' },
      { date: '2026-08-01', value: '159015' },
      { date: '2026-07-01', value: '158882' }
    ] } };
  };
  try {
    const { buildSeriesResponse } = require('../src/services/fredService');
    const first = await buildSeriesResponse('PAYEMS', 'Nonfarm Payrolls');
    await new Promise(resolve => setTimeout(resolve, 5));
    const second = await buildSeriesResponse('PAYEMS', 'Nonfarm Payrolls');
    assert.equal(calls, 1);
    assert.equal(first.latest.value, 159044);
    assert.equal(first.change, 29);
    assert.equal(first.unit, 'Thousands of persons');
    assert.equal(first.latest.display.value, 29);
    assert.equal(second.fetchedAt, first.fetchedAt);
    assert.equal(second.latest.display.checkedAt, first.fetchedAt);
  } finally {
    axios.get = original;
    if (originalKey === undefined) delete process.env.FRED_API_KEY;
    else process.env.FRED_API_KEY = originalKey;
  }
});
