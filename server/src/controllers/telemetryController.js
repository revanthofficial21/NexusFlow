const Telemetry = require("../models/Telemetry");
const { publishTelemetry } = require("../streams/telemetryBus");
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

    // Stored first, then published: a rule should not fire for a point that
    // never made it into the database.
    publishTelemetry(point);

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

    documents.forEach(publishTelemetry);

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

/**
 * Parses an optional ISO date. Returns { value } or { error } so the caller can
 * answer 400 instead of letting an Invalid Date reach the query.
 */
function parseDateParam(raw, name) {
  if (raw === undefined || raw === "") return { value: null };

  const value = new Date(raw);

  if (Number.isNaN(value.getTime())) {
    return { error: `${name} is not a valid date` };
  }

  return { value };
}

async function getLatestTelemetry(req, res) {
  // A negative or fractional limit used to reach the driver, which rejected it
  // and turned a bad query into a 500.
  const requested = Number(req.query.limit);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), 500)
    : 50;

  const deviceId = req.query.deviceId;

  // Date range filtering, as the dashboard needs for "last hour" style views.
  const start = parseDateParam(req.query.startDate, "startDate");
  const end = parseDateParam(req.query.endDate, "endDate");

  if (start.error || end.error) {
    return res.status(400).json({
      success: false,
      message: start.error || end.error,
    });
  }

  if (start.value && end.value && start.value > end.value) {
    return res.status(400).json({
      success: false,
      message: "startDate must be before endDate",
    });
  }

  try {
    const query = {};

    if (deviceId) query["metadata.deviceId"] = deviceId;

    if (start.value || end.value) {
      query.timestamp = {
        ...(start.value ? { $gte: start.value } : {}),
        ...(end.value ? { $lte: end.value } : {}),
      };
    }

    const records = await Telemetry.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: records.length,
      filters: {
        deviceId: deviceId || null,
        startDate: start.value,
        endDate: end.value,
        limit,
      },
      records,
    });
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

/**
 * Per-device rollup: reading counts, average and peak readings, last seen.
 * Backs the device cards on the dashboard.
 */
async function getTelemetryStats(req, res) {
  try {
    const devices = await Telemetry.aggregate([
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$metadata.deviceId",
          deviceType: { $first: "$metadata.deviceType" },
          location: { $first: "$metadata.location" },
          totalReadings: { $sum: 1 },
          avgTemperature: { $avg: "$readings.temperature" },
          maxTemperature: { $max: "$readings.temperature" },
          avgHumidity: { $avg: "$readings.humidity" },
          maxHumidity: { $max: "$readings.humidity" },
          latestTimestamp: { $first: "$timestamp" },
        },
      },
      { $sort: { latestTimestamp: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      deviceCount: devices.length,
      devices,
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) return respondDatabaseUnavailable(res);

    console.error("Telemetry statistics error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch telemetry statistics",
    });
  }
}

module.exports = {
  receiveTelemetry,
  receiveTelemetryBatch,
  getLatestTelemetry,
  getTelemetryStats,
  validatePoint,
};
