const mongoose = require("mongoose");

const { envInt } = require("./env");

const RETENTION_DAYS = envInt("TELEMETRY_RETENTION_DAYS", 30, { min: 1, max: 3650 });
const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;

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
    // The TTL is fixed at creation time, so changing TELEMETRY_RETENTION_DAYS used
    // to be silently ignored on every later boot.
    const current = existing[0].options?.expireAfterSeconds;

    if (current !== RETENTION_SECONDS) {
      await db.command({
        collMod: "telemetry",
        expireAfterSeconds: RETENTION_SECONDS,
      });

      console.log(
        `[db] retention updated ${current} -> ${RETENTION_SECONDS}s`
      );

      return { created: false, retentionUpdated: true };
    }

    return { created: false, retentionUpdated: false };
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
