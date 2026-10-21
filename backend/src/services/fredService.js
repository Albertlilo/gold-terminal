const axios = require("axios");
const FRED_BASE_URL = "https://api.stlouisfed.org/fred";
const { macroPresentation, cleanObservations, rawUnits } = require('./macroPresentation');
const retrievalTimes = new WeakMap();

function readFredPayload(response) {
  let payload = response.data;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload.replace(/^\uFEFF/, "")); }
    catch { /* Keep the original body for format classification only. */ }
  }
  const observations = payload?.observations;
  if (Array.isArray(observations) && observations.length) return observations;

  const error = new Error("FRED returned an invalid observations payload");
  error.code = "FRED_INVALID_RESPONSE";
  error.upstreamStatus = response.status;
  error.payloadType = Array.isArray(payload) ? "array" : typeof payload;
  error.payloadKeys = payload && typeof payload === "object" && !Array.isArray(payload)
    ? Object.keys(payload).filter(key => /^[A-Za-z0-9_-]{1,40}$/.test(key)).slice(0, 12)
    : [];
  if (typeof payload === "string") {
    const start = payload.trimStart().slice(0, 100).toLowerCase();
    error.payloadKind = /^<!doctype html|^<html\b/.test(start) ? "html"
      : /^<\?xml\b|^<error\b/.test(start) ? "xml"
      : /^[\[{]/.test(start) ? "malformed_json" : "plain_text";
  }
  const contentType = response.headers?.["content-type"];
  error.contentType = typeof contentType === "string"
    ? contentType.split(";")[0].trim().toLowerCase().match(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/)?.[0]
    : undefined;
  throw error;
}

const { createFredRequestCache } = require("./fredRequestCache");
const fredRequests = createFredRequestCache({
  request: async (seriesId, limit) => {
    if (!process.env.FRED_API_KEY?.trim()) {
      const error = new Error("FRED API key is missing");
      error.code = "FRED_API_KEY_MISSING";
      throw error;
    }
    const response = await axios.get(FRED_BASE_URL + "/series/observations", {
      timeout: 15000,
      params: { series_id: seriesId, api_key: process.env.FRED_API_KEY.trim(), file_type: "json", sort_order: "desc", limit }
    });
    const observations = await readFredPayload(response);
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
  const stale = fredRequests.wasStale(rawObservations);

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
    stale,
    observations
  };
};

module.exports = {
    getSeriesObservations,
    buildSeriesResponse,
    readFredPayload
};
