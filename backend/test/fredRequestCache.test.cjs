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

test('retry-after is respected and expired values are not silently served', async () => {
  let time = 0, calls = 0;
  const cache = createFredRequestCache({ ttlMs: 10, now: () => time, sleep: async ms => { time += ms; }, log: () => {}, request: async () => {
    if (++calls === 1) return observations;
    throw { response: { status: 429, headers: { 'retry-after': '120' } } };
  } });
  await cache.load('DGS2'); time += 11;
  await assert.rejects(cache.load('DGS2'), error => error.retryAfter === 120);
  time += 61000;
  await assert.rejects(cache.load('DGS2'));
  assert.equal(calls, 2);
});

test('empty provider responses are not cached as successful data', async () => {
  const cache = createFredRequestCache({ request: async () => [], sleep: async () => {}, log: () => {} });
  await assert.rejects(cache.load('DGS2'), /temporarily unavailable/);
});
