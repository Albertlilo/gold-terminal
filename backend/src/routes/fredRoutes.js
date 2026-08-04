const express = require("express");
const {getTwoYearYield, getTenYearYield, getYieldCurve } = require("../controllers/fredController");

const router = express.Router();

router.get("/2y", getTwoYearYield);
router.get("/10y", getTenYearYield);
router.get("/yield-curve", getYieldCurve);


module.exports = router;