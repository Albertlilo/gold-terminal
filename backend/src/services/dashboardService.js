const {
  getMarketSnapshot
} = require("./marketService");

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
    ppi,
    realGdp,
    industrialProduction,
    retailSales,
    consumerSentiment,
    housingStarts,
    initialClaims,
    unemploymentRate,
    targetUpperResult,
    targetLowerResult,
    wageGrowthResult
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
    buildSeriesResponse("PPIACO", "PPI"),
    buildSeriesResponse("GDPC1", "Real GDP"),
    buildSeriesResponse("INDPRO", "Industrial Production"),
    buildSeriesResponse("RSAFS", "Retail Sales"),
    buildSeriesResponse("UMCSENT", "Consumer Sentiment"),
    buildSeriesResponse("HOUST", "Housing Starts"),
    buildSeriesResponse("ICSA", "Initial Claims"),
    buildSeriesResponse("UNRATE", "Unemployment Rate"),
    buildOptionalSeriesResponse("DFEDTARU", "Federal Funds Target Range · Upper Limit"),
    buildOptionalSeriesResponse("DFEDTARL", "Federal Funds Target Range · Lower Limit"),
    buildOptionalSeriesResponse("CES0500000003", "Average Hourly Earnings · Private Sector", 10)
  ]);

  const targetUpper = targetUpperResult.data;
  const targetLower = targetLowerResult.data;
  const wageGrowth = wageGrowthResult.data;

  const marketSnapshot = await getMarketSnapshot();

  const yieldCurveSpread = Number(
  (tenYear.latest.value - twoYear.latest.value).toFixed(2)
);

const goldScore = calculateGoldScore({
  realYield: tenYearRealYield,
  twoYearYield: twoYear,
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

const seriesResponses = [fedFunds, twoYear, tenYear, fiveYearBreakeven, tenYearBreakeven,
  dollarIndex, tenYearRealYield, financialStress, vix, highYieldSpread, nonfarmPayrolls,
  adpEmployment, m2MoneySupply, reverseRepo, treasuryGeneralAccount, corePce, ppi, realGdp,
  industrialProduction, retailSales, consumerSentiment, housingStarts, initialClaims, unemploymentRate,
  targetUpper, targetLower, wageGrowth].filter(Boolean);
const staleResponses = seriesResponses.filter(series => series.stale);
const unavailableOptionalSeries = [targetUpperResult, targetLowerResult, wageGrowthResult]
  .filter(result => !result.data).map(result => result.seriesId);
const providerSuccessTimes = seriesResponses.map(series => Date.parse(series.fetchedAt)).filter(Number.isFinite);
const lastProviderSuccessAt = providerSuccessTimes.length
  ? new Date(Math.min(...providerSuccessTimes)).toISOString()
  : null;

const bullishDrivers = goldScore.drivers
  .filter(driver => driver.points > 0)
  .slice(0, 3);

const bearishDrivers = goldScore.drivers
  .filter(driver => driver.points < 0)
  .slice(0, 3);

if (!staleResponses.length) require("./macroSnapshot").remember(goldScore);

  const goldSummary =
  goldScore.bias === "Neutral"
    ? "Balanced Macro Forces"
    : `${goldScore.bias} Macro Bias`;

  return {
    meta: {
    generatedAt: new Date().toISOString(),
    source: "FRED",
    status: staleResponses.length ? "stale" : "current",
    lastProviderSuccessAt,
    staleSeries: staleResponses.map(series => series.series),
    unavailableOptionalSeries,
    ...(staleResponses.length ? {
      warning: "FRED could not refresh. Showing cached economic readings from the last successful provider response; check their observation dates before relying on the macro score."
    } : {})
    },
    rates: {
      fedFunds: fedFunds.latest,
      fedPolicy: {
        targetLower: targetLower?.latest ?? null,
        targetUpper: targetUpper?.latest ?? null,
        effectiveRate: fedFunds.latest,
        sourceCheckedAt: [targetLower, targetUpper, fedFunds].map(item => item?.fetchedAt)
          .filter(Boolean).sort().at(-1) ?? null,
        explanation: "The Federal Reserve sets a target range. The effective federal funds rate measures actual overnight federal funds transactions and may differ from the target range's upper bound."
      },
      twoYear: twoYear.latest,
      tenYear: tenYear.latest,
      yieldCurveSpread
    },
    inflation: {
      fiveYearBreakeven: fiveYearBreakeven.latest,
      tenYearBreakeven: tenYearBreakeven.latest,
      corePce: corePce.latest,
      ppi: ppi.latest
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
      unemploymentRate: unemploymentRate.latest,
      nonfarmPayrolls: nonfarmPayrolls.latest,
      adpEmployment: adpEmployment.latest
    },
    liquidity: {
     m2MoneySupply: m2MoneySupply.latest,
     reverseRepo: reverseRepo.latest,
     treasuryGeneralAccount: treasuryGeneralAccount.latest
    },
    gold: {
     summary: goldSummary,
     score: goldScore,
     topBullishDrivers: bullishDrivers,
     topBearishDrivers: bearishDrivers
    },
    market: marketSnapshot,
    growth: {
    realGdp: realGdp.latest,
    industrialProduction: industrialProduction.latest,
    retailSales: retailSales.latest
    },
    consumerHousing: {
    consumerSentiment: consumerSentiment.latest,
    housingStarts: housingStarts.latest,
      initialClaims: initialClaims.latest
    },
    wages: { averageHourlyEarnings: wageGrowth?.latest ?? null },
    policy: {
    fedFunds: fedFunds.latest
    },
  };
};

async function buildOptionalSeriesResponse(seriesId, seriesName, limit = 10) {
  try {
    return { seriesId, data: await buildSeriesResponse(seriesId, seriesName, limit) };
  } catch {
    return { seriesId, data: null };
  }
}

module.exports = {
  getDashboardData
};
