const { getGoldSession } = require("../services/goldSession");
const express = require("express");
const axios = require("axios");
const store = require("../services/candleStore");
const { getMarketSnapshot, priceStream } = require("../services/marketService");
const { createHistoryService, normalizeCandles, PAGE_SIZE } = require("../services/candleHistoryService");
const router = express.Router();
router.use(require('../services/accountRuntime').requirePremium);
const quoteClients = new Set();
const MAX_QUOTE_STREAM_CLIENTS = 100;
const { createSignalAuditService } = require("../services/signalAuditService");
let auditService;
let auditSessionCandles;
async function auditHistory(interval, candles) {
  if (!auditService) {
    const { analyseCandles, makeTechnicalPlan } = await import("../../frontend/src/lib/technicalAnalysis.js");
    auditSessionCandles = (await import("../../frontend/src/lib/candles.js")).sessionCandles;
    auditService = createSignalAuditService({ analyse: analyseCandles, plan: makeTechnicalPlan,
      store: require("../services/signalAuditStore"),
      session: getGoldSession });
  }
  return auditService(interval, auditSessionCandles(candles, interval));
}
async function boundedAudit(interval, candles) {
  let timer;
  try {
    return await Promise.race([auditHistory(interval, candles), new Promise(resolve => {
      timer = setTimeout(() => resolve({ status: "unavailable", warning: "Signal audit is taking longer than expected. Candles remain available; this calculation is provisional." }), 2500);
    })]);
  } finally { clearTimeout(timer); }
}

const getHistory = createHistoryService({
  store,
  canRefresh: () => getGoldSession().isOpen,
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
    if (before === undefined && req.query.structureOnly !== "1") {
      try { history.signalAudit = await boundedAudit(interval, history.candles); }
      catch { history.signalAudit = { status: "unavailable", warning: "Signal audit unavailable; saved candles remain available." }; }
    }
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

router.get("/gold/stream", (req, res) => {
  if (quoteClients.size >= MAX_QUOTE_STREAM_CLIENTS) {
    return res.status(503).json({ message: "Live price stream is at capacity. Please retry shortly." });
  }

  res.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  quoteClients.add(res);

  const send = (event, data) => {
    if (res.writableEnded || res.destroyed) return;
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
    catch { /* Connection close handler releases the stream slot. */ }
  };
  const sendStatus = () => send("status", priceStream.status());
  const unsubscribe = priceStream.subscribe(message => {
    if (message.type === "status") sendStatus();
    else if (message.type === "quote") send("quote", message.quote);
  });
  sendStatus();
  const latest = priceStream.readLatest();
  if (latest) send("quote", latest);
  else getMarketSnapshot().then(snapshot => {
    const quote = snapshot?.xauusd;
    if (Number.isFinite(quote?.price)) send("quote", {
      price: quote.price,
      receivedAt: quote.receivedAt,
      priceSource: quote.priceSource,
    });
  }).catch(() => {});

  const heartbeat = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) {
      res.write(": keep-alive\n\n");
      sendStatus();
    }
  }, 15000);
  heartbeat.unref?.();

  res.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    quoteClients.delete(res);
  });
});

module.exports = router;
// Shared by the background checker: same cache and request coalescing as charts.
module.exports.getHistory = getHistory;
module.exports.auditHistory = auditHistory;
