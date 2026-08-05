const express = require("express");
const {getTwoYearYield, getTenYearYield, getYieldCurve, getFedFundsRate, getCpi, getUnemploymentRate, getRetailSales, getIndustrialProduction, getConsumerSentiment, getHousingStarts, getRealGdp,
    getInitialClaims,
    getDollarIndex,
    getM2MoneySupply } = require("../controllers/fredController");

const router = express.Router();

router.get("/2y", getTwoYearYield);
router.get("/10y", getTenYearYield);
router.get("/yield-curve", getYieldCurve);
router.get("/fed-funds", getFedFundsRate);
router.get("/cpi", getCpi);
router.get("/unemployment", getUnemploymentRate);
router.get("/retail-sales", getRetailSales);
router.get("/industrial-production", getIndustrialProduction);
router.get("/consumer-sentiment", getConsumerSentiment);
router.get("/housing-starts", getHousingStarts);
router.get("/real-gdp", getRealGdp);
router.get("/initial-claims", getInitialClaims);
router.get("/dollar-index", getDollarIndex);
router.get("/m2-money-supply", getM2MoneySupply);


module.exports = router;