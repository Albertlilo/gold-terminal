const {
  buildSeriesResponse
} = require("./fredService");

const {
  calculateGoldScore
} = require("./goldScoringService");

const getDashboardData = async () => {
  const [
    fedFunds,
    twoYear,
    tenYear,
    fiveYearBreakeven,
    tenYearBreakeven,
    dollarIndex,
    tenYearRealYield,
    financialStress,
    vix,
    highYieldSpread,
    nonfarmPayrolls,
    adpEmployment,
    m2MoneySupply,
    reverseRepo,
    treasuryGeneralAccount,
    corePce,
    ppi
  ] = await Promise.all([
    buildSeriesResponse("DFF", "Federal Funds Effective Rate"),
    buildSeriesResponse("DGS2", "US 2Y Treasury Yield"),
    buildSeriesResponse("DGS10", "US 10Y Treasury Yield"),
    buildSeriesResponse("T5YIE", "5Y Breakeven Inflation"),
    buildSeriesResponse("T10YIE", "10Y Breakeven Inflation"),
    buildSeriesResponse("DTWEXBGS", "US Dollar Index"),
    buildSeriesResponse("DFII10", "10Y Real Yield"),
    buildSeriesResponse("STLFSI4", "Financial Stress"),
    buildSeriesResponse("VIXCLS", "VIX"),
    buildSeriesResponse("BAMLH0A0HYM2", "High Yield Spread"),
    buildSeriesResponse("PAYEMS", "Nonfarm Payrolls"),
    buildSeriesResponse("ADPMNUSNERSA", "ADP Employment"),
    buildSeriesResponse("M2SL", "M2 Money Supply"),
    buildSeriesResponse("RRPONTSYD", "Reverse Repo"),
    buildSeriesResponse("WTREGEN", "Treasury General Account"),
    buildSeriesResponse("PCEPILFE", "Core PCE"),
    buildSeriesResponse("PPIACO", "PPI")
  ]);

  const yieldCurveSpread = Number(
  (tenYear.latest.value - twoYear.latest.value).toFixed(2)
);

const goldScore = calculateGoldScore({
  realYield: tenYearRealYield,
  dollar: dollarIndex,
  inflationExpectations: tenYearBreakeven,
  financialStress,
  vix,
  highYieldSpread,
  adpEmployment,
  nonfarmPayrolls,
  corePce,
  ppi
});

  return {
    rates: {
      fedFunds: fedFunds.latest,
      twoYear: twoYear.latest,
      tenYear: tenYear.latest,
      yieldCurveSpread
    },
    inflation: {
      fiveYearBreakeven: fiveYearBreakeven.latest,
      tenYearBreakeven: tenYearBreakeven.latest
    },
    currency: {
      dollarIndex: dollarIndex.latest
    },
    realYields: {
      tenYearRealYield: tenYearRealYield.latest
    },
    risk: {
      financialStress: financialStress.latest,
      vix: vix.latest,
      highYieldSpread: highYieldSpread.latest
    },
    labour: {
      nonfarmPayrolls: nonfarmPayrolls.latest,
      adpEmployment: adpEmployment.latest
    },
    liquidity: {
     m2MoneySupply: m2MoneySupply.latest,
     reverseRepo: reverseRepo.latest,
     treasuryGeneralAccount: treasuryGeneralAccount.latest
    },
    gold: {
     score: goldScore
    },

  };
};

module.exports = {
  getDashboardData
};