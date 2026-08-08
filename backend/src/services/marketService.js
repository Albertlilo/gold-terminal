const axios = require("axios");

const getMarketSnapshot = async () => {
  const goldResponse = await axios.get(
    "https://api.twelvedata.com/price",
    {
      params: {
        symbol: "XAU/USD",
        apikey: process.env.TWELVE_DATA_API_KEY
      }
    }
  );

  return {
    xauusd: {
      symbol: "XAU/USD",
      price: Number(goldResponse.data.price)
    },
    dxy: null
  };
};

module.exports = {
  getMarketSnapshot
};