const axios = require("axios");
const store = require("./candleStore");
const { createMarketSnapshotService } = require("./marketSnapshotService");
const { getGoldSession } = require("./goldSession");
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
    const last = rows.filter(row => row.time + 300 <= Date.now() / 1000 && getGoldSession(row.time * 1000).isOpen).at(-1);
    return last ? { price: last.close, time: new Date((last.time + 300) * 1000).toISOString() } : null;
  },
});
module.exports = { getMarketSnapshot };
