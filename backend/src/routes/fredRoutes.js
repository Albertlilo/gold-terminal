const express = require("express");
const {getTwoYearYield, getTenYearYield, getYieldCurve, getFedFundsRate, getCpi, getUnemploymentRate, getRetailSales, getIndustrialProduction, getConsumerSentiment, getHousingStarts, getRealGdp,
    getInitialClaims,
    getDollarIndex,
    getM2MoneySupply, getDashboardSummary, getTenYearRealYield, getFiveYearBreakevenInflation, getTenYearBreakevenInflation, 
getOilPrice, getFinancialStress, getVix, getHighYieldSpread, getReverseRepo, getTreasuryGeneralAccount }  = require("../controllers/fredController");

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
router.get("/dashboard-summary", getDashboardSummary);
router.get("/10y-real-yield", getTenYearRealYield);
router.get("/5y-breakeven-inflation", getFiveYearBreakevenInflation);
router.get("/10y-breakeven-inflation", getTenYearBreakevenInflation);
router.get("/oil-price", getOilPrice);
router.get("/financial-stress", getFinancialStress);
router.get("/vix", getVix);
router.get("/high-yield-spread", getHighYieldSpread);
router.get("/reverse-repo", getReverseRepo);
router.get("/treasury-general-account", getTreasuryGeneralAccount);

module.exports = router;