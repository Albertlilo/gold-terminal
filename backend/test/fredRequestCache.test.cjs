const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFredRequestCache } = require('../src/services/fredRequestCache');
const observations = [{ date: '2026-09-14', value: '4.65' }];

test('simultaneous visitors share requests and cached macro data expires', async () => {
  let time = 0, calls = 0;
  const cache = createFredRequestCache({ now: () => time, sleep: async ms => { time += ms; }, request: async () => { calls++; return observations; } });
  await Promise.all(Array.from({ length: 10 }, () => cache.load('DGS2')));
  assert.equal(calls, 1);
  await cache.load('DGS2');
  assert.equal(calls, 1);
  time += 600001;
  await cache.load('DGS2');
  assert.equal(calls, 2);
});

test('different series requests have paced start times', async () => {
  let time = 0;
  const starts = [];
  const cache = createFredRequestCache({ now: () => time, sleep: async ms => { time += ms; }, request: async () => { starts.push(time); return observations; } });
  // Sequential callers still share the global start budget.
  await cache.load('DGS2'); await cache.load('DGS10'); await cache.load('DFF');
  assert.deepEqual(starts, [0, 700, 1400]);
});

test('403 triggers shared cooldown without exposing response secrets', async () => {
  let time = 0, calls = 0;
  const logs = [];
  const cache = createFredRequestCache({ now: () => time, sleep: async ms => { time += ms; }, log: (...args) => logs.push(args), request: async () => {
    calls++; throw { response: { status: 403, data: 'secret-key', headers: {} } };
  } });
  await assert.rejects(cache.load('DGS2'), /FRED refused/);
  await assert.rejects(cache.load('DGS10'), /FRED refused/);
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(logs).includes('secret-key'));
  time += 900001;
  await assert.rejects(cache.load('DGS2'));
  assert.equal(calls, 2);
});

test('retry-after is respected and expired cached values are explicitly marked stale', async () => {
  let time = 0, calls = 0;
  const cache = createFredRequestCache({ ttlMs: 10, staleTtlMs: 300000, now: () => time, sleep: async ms => { time += ms; }, log: () => {}, request: async () => {
    const call = ++calls;
    if (call === 1 || call === 3) return observations.map(item => ({ ...item }));
    throw { response: { status: 429, headers: { 'retry-after': '120' } } };
  } });
  const first = await cache.load('DGS2'); time += 11;
  const stale = await cache.load('DGS2');
  assert.deepEqual(stale, first);
  assert.equal(cache.wasStale(stale), true);
  time += 61000;
  const stillStale = await cache.load('DGS2');
  assert.equal(cache.wasStale(stillStale), true);
  assert.equal(calls, 2, 'the retry-after delay must still block an upstream request');
  time += 60000;
  const recovered = await cache.load('DGS2');
  assert.equal(cache.wasStale(recovered), false);
  assert.equal(calls, 3);
});

test('cold provider outage without cached observations still fails explicitly', async () => {
  const cache = createFredRequestCache({ request: async () => { throw { code: 'ETIMEDOUT' }; }, sleep: async () => {}, log: () => {} });
  await assert.rejects(cache.load('DFF'), /temporarily unavailable/);
});

test('missing FRED key is identified as server configuration, not an upstream HTTP response', async () => {
  const logs = [];
  const cache = createFredRequestCache({ request: async () => { throw Object.assign(new Error('missing'), { code: 'FRED_API_KEY_MISSING' }); }, sleep: async () => {}, log: (...args) => logs.push(args) });
  await assert.rejects(cache.load('DFF'), /FRED API key is not configured/);
  assert.equal(logs[0][1].category, 'configuration_missing');
});

test('empty provider responses are not cached as successful data', async () => {
  const cache = createFredRequestCache({ request: async () => [], sleep: async () => {}, log: () => {} });
  await assert.rejects(cache.load('DGS2'), /temporarily unavailable/);
});
