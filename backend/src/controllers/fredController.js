const {getSeriesObservations} = require("../services/fredService");

const buildSeriesResponse = async (seriesId, seriesName) => {
  const rawObservations = await getSeriesObservations(seriesId);

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

module.exports ={
    getTwoYearYield,
    getTenYearYield,
    getYieldCurve
};