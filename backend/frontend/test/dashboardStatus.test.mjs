import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDashboardStatus } from '../src/lib/dashboardStatus.js';

test('initial load is never presented as successful data', () => {
  assert.equal(getDashboardStatus({ lastSuccessAt: null, busy: false, now: 0 }).label, 'Waiting for data');
  assert.equal(getDashboardStatus({ lastSuccessAt: null, busy: true, now: 0 }).label, 'Loading data');
});
test('failed refresh distinguishes retained values from a first-load failure', () => {
  assert.equal(getDashboardStatus({ lastSuccessAt: null, error: 'failed', now: 10 }).label, 'Data unavailable');
  assert.equal(getDashboardStatus({ lastSuccessAt: 0, error: 'failed', busy: true, now: 10 }).label, 'Update failed');
});
test('old values remain delayed while another request is pending', () => {
  assert.equal(getDashboardStatus({ lastSuccessAt: 0, busy: true, now: 90001 }).label, 'Update delayed');
  assert.equal(getDashboardStatus({ lastSuccessAt: 0, busy: false, now: 90000 }).label, 'Data received');
});
test('a subsequent successful receipt restores normal status', () => {
  assert.equal(getDashboardStatus({ lastSuccessAt: 100000, busy: false, error: '', now: 100010 }).label, 'Data received');
  assert.equal(getDashboardStatus({ lastSuccessAt: 100000, busy: true, error: '', now: 100010 }).label, 'Updating');
});
