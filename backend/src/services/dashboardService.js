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
    tenYear
  ] = await Promise.all([
    buildSeriesResponse("DFF", "Federal Funds Effective Rate"),
    buildSeriesResponse("DGS2", "US 2Y Treasury Yield"),
    buildSeriesResponse("DGS10", "US 10Y Treasury Yield")
  ]);

  const yieldCurveSpread = Number(
  (tenYear.latest.value - twoYear.latest.value).toFixed(2)
);

  return {
    rates: {
      fedFunds: fedFunds.latest,
      twoYear: twoYear.latest,
      tenYear: tenYear.latest,
      yieldCurveSpread
    }
  };
};

module.exports = {
  getDashboardData
};