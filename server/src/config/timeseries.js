const mongoose = require("mongoose");

const RETENTION_SECONDS = Number(
  process.env.TELEMETRY_RETENTION_DAYS || 30
) * 24 * 60 * 60;

/**
 * Mongo will not infer a time-series collection from a schema, so it is created
 * explicitly. Runs on every boot and is a no-op once the collection exists -
 * this replaces the manual setup-timeseries.js script.
 */
async function ensureTelemetryCollection() {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("ensureTelemetryCollection called before connectDB()");
  }

  const existing = await db
    .listCollections({ name: "telemetry" })
    .toArray();

  if (existing.length > 0) {
    return { created: false };
  }

  await db.createCollection("telemetry", {
    timeseries: {
      timeField: "timestamp",
      metaField: "metadata",
      granularity: "seconds",
    },
    expireAfterSeconds: RETENTION_SECONDS,
  });

  console.log("[db] created time-series collection: telemetry");
  return { created: true };
}

module.exports = { ensureTelemetryCollection, RETENTION_SECONDS };
