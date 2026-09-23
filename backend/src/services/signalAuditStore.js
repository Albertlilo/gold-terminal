const { getAuditCollection } = require("./candleStore");
module.exports = {
  async insertOnce(event) {
    const collection = await getAuditCollection();
    // The key is unique. Refreshes cannot overwrite the first observed record.
    try { await collection.updateOne({ _id: event.key }, { $setOnInsert: event }, { upsert: true }); }
    catch (error) { if (error.code !== 11000) throw error; }
    return collection.findOne({ _id: event.key });
  },
  async recent(interval, limit) {
    const collection = await getAuditCollection();
    return collection.find({ interval }, { projection: { inputWindow: 0, _id: 0 }, maxTimeMS: 3000 })
      .sort({ candleTime: -1 }).limit(limit).toArray();
  },
};
