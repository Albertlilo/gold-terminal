const axios = require("axios");
const store = require("./candleStore");
const { createMarketSnapshotService, savedCandleQuote } = require("./marketSnapshotService");
const getMarketSnapshot = createMarketSnapshotService({
  async fetchPrice() {
    const { data } = await axios.get("https://api.twelvedata.com/price", {
      params: { symbol: "XAU/USD", apikey: process.env.TWELVE_DATA_API_KEY }, timeout: 15000,
    });
    if (data.status === "error") throw new Error("Gold quote unavailable");
    return Number(data.price);
  },
  async readSavedPrice() {
    const rows = await store.read("5min", undefined, 500);
    return savedCandleQuote(rows);
  },
});
module.exports = { getMarketSnapshot };
