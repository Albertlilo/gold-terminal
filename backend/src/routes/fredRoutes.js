const express = require("express");
const {getTwoYearYield, getTenYearYield, getYieldCurve, getFedFundsRate, getCpi } = require("../controllers/fredController");

const router = express.Router();

router.get("/2y", getTwoYearYield);
router.get("/10y", getTenYearYield);
router.get("/yield-curve", getYieldCurve);
router.get("/fed-funds", getFedFundsRate);
router.get("/cpi", getCpi);


module.exports = router;