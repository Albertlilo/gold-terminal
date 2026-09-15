let connection;

async function getCollection() {
  if (!process.env.MONGODB_URI) throw new Error("Atlas configuration missing");
  if (!connection) {
    connection = (async () => {
      const { MongoClient } = require("mongodb");
      const client = new MongoClient(process.env.MONGODB_URI, {
        maxPoolSize: 5, serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000,
        socketTimeoutMS: 10000,
      });
      try {
        await client.connect();
        const collection = client.db(process.env.MONGODB_DATABASE || "gold_terminal").collection("candles");
        await collection.createIndex({ symbol: 1, interval: 1, time: 1 }, { unique: true });
        return collection;
      } catch (error) {
        await client.close();
        throw error;
      }
    })().catch(error => { connection = null; throw error; });
  }
  return connection;
}

module.exports = {
  async read(interval, before, limit) {
    const collection = await getCollection();
    const query = { symbol: "XAU/USD", interval };
    if (before !== undefined) query.time = { $lt: before };
    const rows = await collection.find(query, {
      projection: { _id: 0, time: 1, open: 1, high: 1, low: 1, close: 1 },
      maxTimeMS: 5000,
    }).sort({ time: -1 }).limit(limit).toArray();
    return rows.reverse();
  },
  async save(interval, candles) {
    const collection = await getCollection();
    await collection.bulkWrite(candles.map(candle => ({ updateOne: {
      filter: { symbol: "XAU/USD", interval, time: candle.time },
      update: { $set: { ...candle, symbol: "XAU/USD", interval } },
      upsert: true,
    } })), { ordered: false });
  },
};
