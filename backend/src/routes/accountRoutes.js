const express = require('express');
const account = require('../services/accountRuntime');
const router = express.Router();
router.use((req,res,next) => { res.set('Cache-Control','no-store'); next(); });
router.get('/config', (req,res) => res.json({ firebase: account.publicConfig() }));
router.get('/me', account.authenticate, async (req,res) => {
  try { res.json({ uid: req.account.uid, email: req.account.email, ...await account.entitlement(req.account.uid) }); }
  catch { res.status(503).json({ message: 'Subscription access could not be verified.' }); }
});
module.exports = router;
