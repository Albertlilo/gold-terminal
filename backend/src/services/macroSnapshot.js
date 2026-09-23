let snapshot = null;
module.exports = {
  remember(score, observedAt = new Date().toISOString()) {
    snapshot = { bias: score.bias, totalScore: score.totalScore, observedAt };
  },
  current() { return snapshot; },
};
