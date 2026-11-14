const mongoose = require("mongoose");

const RETENTION_SECONDS = Number(
  process.env.TELEMETRY_RETENTION_DAYS || 30
) * 24 * 60 * 60;

/**
 * Append-only sensor data.
 *
 * Field names (timestamp / metadata / readings) match what the ingest API and the
 * existing collection already use, so no migration is needed.
 * metaField is `metadata`, which makes Mongo bucket points per device and keeps
 * storage small at high ingest rates.
 */
const telemetrySchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    metadata: {
      deviceId: { type: String, required: true },
      deviceType: { type: String, required: true },
      location: { type: String, default: "Unknown" },
    },
    readings: {
      temperature: { type: Number, default: null },
      humidity: { type: Number, default: null },
    },
  },
  {
    timeseries: {
      timeField: "timestamp",
      metaField: "metadata",
      granularity: "seconds",
    },
    expireAfterSeconds: RETENTION_SECONDS,
    versionKey: false,
  }
);

const Telemetry = mongoose.model("Telemetry", telemetrySchema, "telemetry");

module.exports = Telemetry;
