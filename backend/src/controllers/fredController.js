const {
  calculateGoldScore
} = require("../services/goldScoringService");
const {getSeriesObservations} = require("../services/fredService");

const buildSeriesResponse = async (seriesId, seriesName, limit = 10, unit = "%") => {
  const rawObservations = await getSeriesObservations(seriesId, limit);

  const observations = rawObservations
    .filter((item) => item.value !== ".")
    .map((item) => ({
      date: item.date,
      value: Number(item.value)
    }));

  const latest = observations[0];
  const previous = observations[1];

  const change = Number(
    (latest.value - previous.value).toFixed(2)
  );

  const direction =
    change > 0 ? "up" :
    change < 0 ? "down" :
    "flat";

  return {
    series: seriesName,
    unit,
    latest,
    previous,
    change,
    direction,
    fetchedAt: new Date().toISOString(),
    observations
  };
};
const getTwoYearYield = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "DGS2",
      "US 2Y Treasury Yield"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getTenYearYield = async (req, res) => {
   try { const data = await buildSeriesResponse("DGS10",
    "US 10Y Treasury Yield"
   );
    res.status(200).json(data);
} catch (error) {
    res.status(500).send(error.message);
}
};

const getYieldCurve = async (req, res) => {
  try {
    const twoYear = await buildSeriesResponse(
      "DGS2", 
      "US 2Y Treasury Yield"
    );
    const tenYear = await buildSeriesResponse(
      "DGS10",
      "US 10Y Treasury Yield"
    );
    const spread = Number((tenYear.latest.value - twoYear.latest.value).toFixed(2));
    const status = spread < 0 ? "Inverted" : "Normal";
    res.status(200).json({
      twoYear: twoYear.latest.value,
      tenYear: tenYear.latest.value,
      spread,
      status,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).send(error.massage);
  }
}

const getFedFundsRate = async (req, res) => {
  try{
    const data = await buildSeriesResponse(
      "DFF",
      "Federal Funds Effective Rate"
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
}

const getCpi = async (req, res) => {
  try{
    const data = await buildSeriesResponse(
      "CPIAUCSL",
      "US Consumer Price Index",
      14,
      "index"
    );
    const latest = data.observations[0];
    const yearAgo = data.observations[12];
    const yearOverYearinflation = Number((((latest.value - yearAgo.value) / yearAgo.value) * 100) .toFixed(2)); 

    res.status(200).json({...data,
      yearOverYearinflation
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
}

const getUnemploymentRate = async (req, res) => {
  try{
    const data = await buildSeriesResponse(
      "UNRATE",
      "US Unemployment Rate"
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
}

const getRetailSales = async (req, res) => {
  try{
    const data = await buildSeriesResponse(
      "RSAFS",
      "US Retail Sales",
      10,
      "Millions of Dollars"
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
}

const getIndustrialProduction = async (req, res) => {
  try{
    const data = await buildSeriesResponse(
      "INDPRO",
      "US Industrial Production Index",
      10,
      "Index"
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
}

const getConsumerSentiment = async (req, res) => {
  try{
    const data = await buildSeriesResponse(
      "UMCSENT",
      "US Consumer Sentiment",
      10,
      "Index"
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
}

const getHousingStarts = async (req, res) => {
  try{
    const data = await buildSeriesResponse(
      "HOUST",
      "US Housing Starts",
      10,
      "Thousands of Units"
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
}

const getRealGdp = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "GDPC1",
      "US Real GDP",
      10,
      "Billions of Chained 2017 Dollars"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getInitialClaims = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "ICSA",
      "US Initial Jobless Claims",
      10,
      "Claims"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getDollarIndex = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "DTWEXBGS",
      "Broad US Dollar Index",
      10,
      "Index"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getM2MoneySupply = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "M2SL",
      "US M2 Money Supply",
      10,
      "Billions of Dollars"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getDashboardSummary = async (req, res) => {
  try {
    const [
      fedFunds,
      twoYear,
      tenYear,
      cpi,
      unemployment,
      retailSales,
      industrialProduction
    ] = await Promise.all([
      buildSeriesResponse("DFF", "Federal Funds Effective Rate"),
      buildSeriesResponse("DGS2", "US 2Y Treasury Yield"),
      buildSeriesResponse("DGS10", "US 10Y Treasury Yield"),
      buildSeriesResponse("CPIAUCSL", "US Consumer Price Index", 14, "Index"),
      buildSeriesResponse("UNRATE", "US Unemployment Rate"),
      buildSeriesResponse(
        "RSAFS",
        "US Retail Sales",
        10,
        "Millions of Dollars"
      ),
      buildSeriesResponse(
        "INDPRO",
        "US Industrial Production Index",
        10,
        "Index"
      )
    ]);

    const yieldCurveSpread = Number(
      (tenYear.latest.value - twoYear.latest.value).toFixed(2)
    );

    const cpiLatest = cpi.observations[0];
    const cpiYearAgo = cpi.observations[12];

    const yearOverYearInflation = Number(
      (
        ((cpiLatest.value - cpiYearAgo.value) /
          cpiYearAgo.value) *
        100
      ).toFixed(2)
    );

    res.status(200).json({
      rates: {
        fedFunds: fedFunds.latest,
        twoYear: twoYear.latest,
        tenYear: tenYear.latest,
        yieldCurveSpread
      },
      inflation: {
        cpiIndex: cpiLatest,
        yearOverYearInflation
      },
      economy: {
        unemployment: unemployment.latest,
        retailSales: retailSales.latest,
        industrialProduction: industrialProduction.latest
      },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getTenYearRealYield = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "DFII10",
      "US 10Y Real Yield",
      10,
      "%"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getFiveYearBreakevenInflation = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "T5YIE",
      "US 5Y Breakeven Inflation Rate",
      10,
      "%"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getTenYearBreakevenInflation = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "T10YIE",
      "US 10Y Breakeven Inflation Rate",
      10,
      "%"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getOilPrice = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "DCOILWTICO",
      "WTI Crude Oil Price",
      10,
      "Dollars per Barrel"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getFinancialStress = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "STLFSI4",
      "St. Louis Fed Financial Stress Index",
      10,
      "Index"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getVix = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "VIXCLS",
      "CBOE Volatility Index",
      10,
      "Index"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getHighYieldSpread = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "BAMLH0A0HYM2",
      "US High Yield Credit Spread",
      10,
      "%"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getReverseRepo = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "RRPONTSYD",
      "Overnight Reverse Repo Usage",
      10,
      "Billions of Dollars"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getTreasuryGeneralAccount = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "WDTGAL",
      "US Treasury General Account",
      10,
      "Millions of Dollars"
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getGoldScore = async (req, res) => {
  try {
    const [
      realYield,
      dollar,
      breakevenInflation,
      financialStress,
      vix,
      highYieldSpread,
      adp,
      nfp,
      corePce,
      ppi
    ] = await Promise.all([
      buildSeriesResponse("DFII10", "US 10Y Real Yield"),
      buildSeriesResponse("DTWEXBGS", "Broad US Dollar Index"),
      buildSeriesResponse("T10YIE", "US 10Y Breakeven Inflation Rate"),
      buildSeriesResponse("STLFSI4", "Financial Stress Index"),
      buildSeriesResponse("VIXCLS", "CBOE Volatility Index"),
      buildSeriesResponse("BAMLH0A0HYM2", "High Yield Credit Spread"),
      buildSeriesResponse("ADPMNUSNERSA", "ADP Private Payroll Employment"),
      buildSeriesResponse("PAYEMS", "US Nonfarm Payrolls"),
      buildSeriesResponse("PCEPILFE", "Core PCE Price Index", 14, "Index"),
      buildSeriesResponse("PPIFIS", "US Producer Price Index Final Demand", 14, "Index")
    ]);
    
    const adpPreviousChange =
    adp.observations[1].value - adp.observations[2].value;
    
    const nfpPreviousChange =
    nfp.observations[1].value - nfp.observations[2].value;

    const result = calculateGoldScore({
      realYieldChange: realYield.change,
      dollarChange: dollar.change,
      inflationExpectationChange: breakevenInflation.change,
      financialStressChange: financialStress.change,
      vixChange: vix.change,
      highYieldSpreadChange: highYieldSpread.change,
      adpMomentumChange: adp.change - adpPreviousChange,
      nfpMomentumChange: nfp.change - nfpPreviousChange,
      corePceChange: corePce.change,
      ppiChange: ppi.change
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getNonfarmPayrolls = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "PAYEMS",
      "US Nonfarm Payrolls",
      10,
      "Thousands of Persons"
    );

    const previousMonthlyChange =
  data.observations[1].value - data.observations[2].value;

const hiringMomentum =
  data.change > previousMonthlyChange
    ? "accelerating"
    : data.change < previousMonthlyChange
      ? "slowing"
      : "unchanged";

res.status(200).json({
  series: data.series,
  unit: data.unit,
  payrollLevel: data.latest,
  jobsAdded: data.change,
  previousJobsAdded: previousMonthlyChange,
  hiringMomentum,
  fetchedAt: data.fetchedAt,
  observations: data.observations
});
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getAdpEmployment = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "ADPMNUSNERSA",
      "ADP Private Payroll Employment",
      10,
      "Persons"
    );

    const previousMonthlyChange =
  data.observations[1].value - data.observations[2].value;

const hiringMomentum =
  data.change > previousMonthlyChange
    ? "accelerating"
    : data.change < previousMonthlyChange
      ? "slowing"
      : "unchanged";

res.status(200).json({
  series: data.series,
  unit: data.unit,
  employmentLevel: data.latest,
  jobsAdded: data.change,
  employmentDirection: data.direction,
  previousJobsAdded: previousMonthlyChange,
  hiringMomentum,
  fetchedAt: data.fetchedAt,
  observations: data.observations
});
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getCorePce = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "PCEPILFE",
      "Core PCE Price Index",
      14,
      "Index"
    );

    const latest = data.observations[0];
    const yearAgo = data.observations[12];

    const yearOverYearInflation = Number(
      (((latest.value - yearAgo.value) / yearAgo.value) * 100).toFixed(2)
    );

    res.status(200).json({
      ...data,
      yearOverYearInflation
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getPpi = async (req, res) => {
  try {
    const data = await buildSeriesResponse(
      "PPIFIS",
      "US Producer Price Index Final Demand",
      14,
      "Index"
    );

    const latest = data.observations[0];
    const yearAgo = data.observations[12];

    const yearOverYearInflation = Number(
      (((latest.value - yearAgo.value) / yearAgo.value) * 100).toFixed(2)
    );

    res.status(200).json({
      ...data,
      yearOverYearInflation
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports ={
    getTwoYearYield,
    getTenYearYield,
    getYieldCurve,
    getFedFundsRate,
    getCpi,
    getUnemploymentRate,
    getRetailSales,
    getIndustrialProduction,
    getConsumerSentiment,
    getHousingStarts,
    getRealGdp,
    getInitialClaims,
    getDollarIndex,
    getM2MoneySupply,
    getDashboardSummary,
    getTenYearRealYield,
    getFiveYearBreakevenInflation,
    getTenYearBreakevenInflation,
    getOilPrice, 
    getFinancialStress, 
    getVix,
    getHighYieldSpread,
    getReverseRepo,
    getTreasuryGeneralAccount,
    getGoldScore,
    getNonfarmPayrolls,
    getAdpEmployment,
    getCorePce,
    getPpi
};