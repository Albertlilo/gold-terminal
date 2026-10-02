const axios = require("axios");
const FRED_BASE_URL = "https://api.stlouisfed.org/fred";
const { macroPresentation, cleanObservations, rawUnits } = require('./macroPresentation');
const retrievalTimes = new WeakMap();

const { createFredRequestCache } = require("./fredRequestCache");
const fredRequests = createFredRequestCache({
  request: async (seriesId, limit) => {
    if (!process.env.FRED_API_KEY?.trim()) throw new Error("FRED API key is missing");
    const response = await axios.get(FRED_BASE_URL + "/series/observations", {
      timeout: 15000,
      params: { series_id: seriesId, api_key: process.env.FRED_API_KEY.trim(), file_type: "json", sort_order: "desc", limit }
    });
    const observations = response.data.observations;
    if (Array.isArray(observations)) retrievalTimes.set(observations, new Date().toISOString());
    return observations;
  }
});
const getSeriesObservations = (seriesId, limit = 10) => fredRequests.load(seriesId, limit);

const buildSeriesResponse = async (seriesId, seriesName, limit = 10, unit = rawUnits[seriesId] ?? "%") => {
  const rawObservations = await getSeriesObservations(seriesId,
    ['PCEPILFE', 'PPIACO'].includes(seriesId) ? Math.max(limit, 26) : limit);

  const observations = cleanObservations(rawObservations);
  if (!observations.length) throw new Error(`No valid observations for ${seriesId}`);
  const fetchedAt = retrievalTimes.get(rawObservations) ?? null;

  const latest = { ...observations[0], display: macroPresentation(seriesId, observations, fetchedAt) };
  const previous = observations[1];

  const change = Number(
    (previous ? latest.value - previous.value : NaN).toFixed(2)
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
    fetchedAt,
    observations
  };
};

module.exports = {
    getSeriesObservations,
    buildSeriesResponse
};
