const express = require("express");
const axios = require("axios");
const store = require("../services/candleStore");
const { createHistoryService, normalizeCandles, PAGE_SIZE } = require("../services/candleHistoryService");
const router = express.Router();

const getHistory = createHistoryService({
  store,
  async fetchCandles(interval, before) {
    if (!process.env.TWELVE_DATA_API_KEY) throw new Error("Data configuration missing");
    const params = {
      symbol: "XAU/USD", interval, outputsize: PAGE_SIZE, timezone: "UTC",
      apikey: process.env.TWELVE_DATA_API_KEY,
    };
    if (before !== undefined) params.end_date = new Date((before - 1) * 1000).toISOString().slice(0, 19);
    const { data } = await axios.get("https://api.twelvedata.com/time_series", { params, timeout: 15000 });
    if (data.status === "error") throw new Error("Historical data request failed");
    return normalizeCandles(data.values).filter(candle => before === undefined || candle.time < before);
  },
});

router.get("/gold/history", async (req, res) => {
  try {
    const interval = req.query.interval ?? "5min";
    const before = req.query.before === undefined ? undefined : Number(req.query.before);
    const history = await getHistory(interval, before);
    res.set("Cache-Control", "no-store").json(history);
  } catch (error) {
    const category = error.code === 18 ? "authentication"
      : error.code === 13 ? "database_permissions"
      : error.name === "MongoServerSelectionError" ? "database_connection_timeout"
      : error.name === "MongoParseError" ? "database_uri_format"
      : error.code === 50 ? "database_query_timeout" : "history_unavailable";
    console.error("Candle history request failed:", category);
    // Never expose driver errors, credentials, connection URLs or provider request configs.
    const status = [400, 429, 503].includes(error.status) ? error.status : 503;
    res.status(status).json({ message: error.status ? error.message
      : "Saved history could not be reached on this attempt. Please retry; this does not mean your history was deleted." });
  }
});

module.exports = router;
