const axios = require("axios");
const FRED_BASE_URL = "https://api.stlouisfed.org/fred";

const getSeriesObservations = async (seriesId, limit = 10) => {
    const response = await axios.get(`${FRED_BASE_URL}/series/observations`, {
        params: {
            series_id: seriesId,
            api_key: process.env.FRED_API_KEY,
            file_type: "json",
            sort_order: "desc",
            limit
        }
    }
);
    return response.data.observations;
};

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

module.exports = {
    getSeriesObservations,
    buildSeriesResponse
};