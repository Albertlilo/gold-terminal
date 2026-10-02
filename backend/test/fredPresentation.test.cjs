const test = require('node:test');
const assert = require('node:assert/strict');

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
