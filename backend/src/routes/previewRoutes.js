const express = require('express');
const router = express.Router();
let snapshot, expires = 0, pending;
router.get('/', async (req,res) => {
  res.set('Cache-Control','no-store');
  if (!snapshot || Date.now() >= expires) {
    if (!pending) pending = (async () => {
      try {
        const rows = await require('../services/candleStore').read('1day', undefined, 30);
        const score = require('../services/macroSnapshot').current();
        // Explicit allowlist: never return indicator breakdowns, OHLC or audits.
        snapshot = { score: score ? { totalScore: score.totalScore, bias: score.bias, observedAt: score.observedAt } : null,
          prices: rows.map(row => ({ time: row.time, close: row.close })) };
      } catch { snapshot = { score: null, prices: [], message: 'Saved preview is currently unavailable.' }; }
      expires = Date.now() + 60000;
    })().finally(() => { pending = null; });
    await pending;
  }
  res.json(snapshot);
});
module.exports = router;
