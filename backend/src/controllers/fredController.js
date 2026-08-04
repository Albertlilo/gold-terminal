const {getSeriesObservations} = require("../services/fredService");

const buildSeriesResponse = async (seriesId, seriesName, limit = 10) => {
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
    unit: "%",
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
      14
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

module.exports ={
    getTwoYearYield,
    getTenYearYield,
    getYieldCurve,
    getFedFundsRate,
    getCpi
};