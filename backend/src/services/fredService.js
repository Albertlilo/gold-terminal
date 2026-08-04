const axios = require("axios");
const FRED_BASE_URL = "https://api.stlouisfed.org/fred";

const getSeriesObservations = async (seriesId) => {
    const response = await axios.get(`${FRED_BASE_URL}/series/observations`, {
        params: {
            series_id: seriesId,
            api_key: process.env.FRED_API_KEY,
            file_type: "json",
            sort_order: "desc",
            limit: 10
        }
    }
);
    return response.data.observations;
};

module.exports = {
    getSeriesObservations
};