const {test} = require('node:test');
const assert = require('node:assert/strict');
const {calculateGoldScore, scoreChange} = require('../src/services/goldScoringService');

test('2Y yields contribute their actual direction and weight', () => {
  for (const [change, expected] of [[-0.1, 2], [0.1, -2], [0, 0]]) {
    const result = calculateGoldScore({twoYearYield: {change}});
    assert.equal(result.scores.twoYearYield, expected);
    assert.equal(result.totalScore, expected);
  }
});

test('missing and invalid observations never invent directional points', () => {
  for (const change of [undefined, null, NaN, Infinity, -Infinity, '0.1']) {
    for (const direction of ['up', 'down']) assert.equal(scoreChange(change, direction, 2), 0);
    assert.equal(calculateGoldScore({twoYearYield: {change}}).totalScore, 0);
  }
  assert.equal(calculateGoldScore({}).totalScore, 0);
  assert.equal(calculateGoldScore({}).drivers.length, 0);
});

const conflictInputs = {
  realYield: {change: 1}, twoYearYield: {change: -1}, dollar: {change: 1},
  inflationExpectations: {change: 1}, corePce: {change: 1}, ppi: {change: 1},
  financialStress: {change: 1}, vix: {change: -1}, highYieldSpread: {change: -1},
  adpEmployment: {change: 1}, nonfarmPayrolls: {change: 1},
};

test('9 bullish versus 11 bearish is 10% direction, not 100% confidence', () => {
  const result = calculateGoldScore(conflictInputs);
  assert.equal(result.bullishPoints, 9);
  assert.equal(result.bearishPoints, 11);
  assert.equal(result.totalScore, -2);
  assert.equal(result.bias, 'High Conflict');
  assert.equal(result.lean, 'Balanced Battle');
  assert.equal(result.confidence, 10);
  assert.equal(result.directionalConfidence, 10);
  assert.equal(result.activityLevel, 100);
  assert.deepEqual(calculateGoldScore(conflictInputs), result);
});

test('balanced, empty, and unanimous inputs preserve confidence semantics', () => {
  const balanced = calculateGoldScore({...conflictInputs, vix: {change: 1}});
  assert.equal(balanced.totalScore, 0);
  assert.equal(balanced.confidence, 0);
  assert.equal(balanced.activityLevel, 100);
  assert.equal(calculateGoldScore({}).confidence, 0);
  for (const sign of [-1, 1]) {
    const down = new Set(['realYield', 'twoYearYield', 'dollar', 'adpEmployment', 'nonfarmPayrolls']);
    const inputs = Object.fromEntries(Object.keys(conflictInputs).map(key => [key, {change: down.has(key) ? -sign : sign}]));
    const result = calculateGoldScore(inputs);
    assert.equal(result.totalScore, 20 * sign);
    assert.equal(result.confidence, 100);
    assert.equal(result.bias, sign === 1 ? 'Bullish' : 'Bearish');
  }
});
