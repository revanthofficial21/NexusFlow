const Telemetry = require("../models/Telemetry");
const {
  isDatabaseUnavailable,
  respondDatabaseUnavailable,
} = require("../utils/dbError");

const MAX_BATCH = Number(process.env.INGEST_BATCH_LIMIT || 2000);

/**
 * Readings used to be accepted as anything and stored as-is, so a string
 * temperature broke every later aggregation. Validation happens here, before the
 * write, and reports which field is wrong.
 */
function validatePoint(input) {
  const errors = [];

  if (!input || typeof input !== "object") {
    return { errors: ["point must be an object"], point: null };
  }

  const { deviceId, deviceType, location, temperature, humidity } = input;

  if (!deviceId || typeof deviceId !== "string") {
    errors.push("deviceId is required and must be a string");
  }

  if (!deviceType || typeof deviceType !== "string") {
    errors.push("deviceType is required and must be a string");
  }

  if (location !== undefined && location !== null && typeof location !== "string") {
    errors.push("location must be a string");
  }

  const readings = {};

  for (const [field, value] of Object.entries({ temperature, humidity })) {
    if (value === undefined || value === null || value === "") continue;

    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      errors.push(`${field} must be a finite number`);
      continue;
    }

    readings[field] = numeric;
  }

  if (errors.length === 0 && Object.keys(readings).length === 0) {
    errors.push("at least one of temperature or humidity is required");
  }

  if (errors.length > 0) {
    return { errors, point: null };
  }

  return {
    errors: [],
    point: {
      timestamp: new Date(),
      metadata: {
        deviceId,
        deviceType,
        location: location || "Unknown",
      },
      readings: {
        temperature: readings.temperature ?? null,
        humidity: readings.humidity ?? null,
      },
    },
  };
}

async function receiveTelemetry(req, res) {
  const { errors, point } = validatePoint(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  try {
    const saved = await Telemetry.create(point);

    return res.status(201).json({
      success: true,
      message: "Telemetry received successfully",
      insertedId: saved._id,
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return respondDatabaseUnavailable(res);
    }

    console.error("Telemetry error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to save telemetry",
    });
  }
}

async function receiveTelemetryBatch(req, res) {
  const points = Array.isArray(req.body) ? req.body : req.body?.points;

  if (!Array.isArray(points) || points.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Expected a non-empty array of telemetry points",
    });
  }

  if (points.length > MAX_BATCH) {
    return res.status(413).json({
      success: false,
      message: `Batch exceeds the limit of ${MAX_BATCH} points`,
    });
  }

  const documents = [];
  const errors = [];

  points.forEach((input, index) => {
    const result = validatePoint(input);

    if (result.errors.length > 0) {
      errors.push({ index, errors: result.errors });
      return;
    }

    documents.push(result.point);
  });

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Invalid telemetry at ${errors.length} index(es)`,
      errors: errors.slice(0, 10),
    });
  }

  try {
    // ordered:false so one bad document cannot stall the batch.
    const result = await Telemetry.collection.insertMany(documents, {
      ordered: false,
    });

    return res.status(201).json({
      success: true,
      message: "Telemetry batch received successfully",
      insertedCount: result.insertedCount,
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return respondDatabaseUnavailable(res);
    }

    console.error("Telemetry batch error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to save telemetry batch",
    });
  }
}

async function getLatestTelemetry(req, res) {
  // A negative or fractional limit used to reach the driver, which rejected it
  // and turned a bad query into a 500.
  const requested = Number(req.query.limit);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), 500)
    : 50;

  const deviceId = req.query.deviceId;

  try {
    const query = deviceId ? { "metadata.deviceId": deviceId } : {};
    const records = await Telemetry.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ success: true, count: records.length, records });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return respondDatabaseUnavailable(res);
    }

    console.error("Telemetry read error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to read telemetry",
    });
  }
}

module.exports = {
  receiveTelemetry,
  receiveTelemetryBatch,
  getLatestTelemetry,
  validatePoint,
};
