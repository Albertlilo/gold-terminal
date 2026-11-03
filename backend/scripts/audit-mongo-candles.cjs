require("dotenv").config();
const { MongoClient } = require("mongodb");

function stages(node, result = []) {
  if (!node || typeof node !== "object") return result;
  if (node.stage) result.push(node.stage);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => stages(child, result));
    else if (value && typeof value === "object") stages(value, result);
  }
  return result;
}

function indexNames(node, result = []) {
  if (!node || typeof node !== "object") return result;
  if (node.indexName) result.push(node.indexName);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => indexNames(child, result));
    else if (value && typeof value === "object") indexNames(value, result);
  }
  return result;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured; no connection was attempted.");
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 7000, connectTimeoutMS: 7000,
    maxPoolSize: 1, appName: "trendline-insight-readonly-index-audit" });
  try {
    await client.connect();
    const collection = client.db(process.env.MONGODB_DATABASE || "gold_terminal").collection("candles");
    const indexes = await collection.listIndexes().toArray();
    console.log("Candle indexes:", JSON.stringify(indexes.map(index => ({ name: index.name, key: index.key, unique: Boolean(index.unique) }))));
    for (const query of [
      { symbol: "XAU/USD", interval: "1h" },
      { symbol: "XAU/USD", interval: "1h", time: { $lt: Math.floor(Date.now() / 1000) } },
    ]) {
      const explanation = await collection.find(query, { projection: { _id: 0, time: 1, open: 1, high: 1, low: 1, close: 1 }, maxTimeMS: 5000 })
        .sort({ time: -1 }).limit(500).explain("executionStats");
      console.log(JSON.stringify({ query: Object.hasOwn(query, "time") ? "older-page" : "latest-page",
        stages: [...new Set(stages(explanation.queryPlanner?.winningPlan))],
        indexNames: [...new Set(indexNames(explanation.queryPlanner?.winningPlan))],
        nReturned: explanation.executionStats?.nReturned,
        totalKeysExamined: explanation.executionStats?.totalKeysExamined,
        totalDocsExamined: explanation.executionStats?.totalDocsExamined,
        executionTimeMillis: explanation.executionStats?.executionTimeMillis }));
    }
  } finally {
    await client.close();
  }
}

main().catch(error => {
  // Do not print connection strings, driver options, or server descriptions.
  console.error(`Read-only Mongo audit unavailable: ${error.name || "database error"}`);
  process.exitCode = 1;
});
