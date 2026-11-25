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
    // No leading $sort: sorting the whole collection before grouping was a full
    // pass over every reading. $max gives the same "last seen" value for free, and
    // deviceType/location are constant per device, so $first is safe without it.
    const devices = await Telemetry.aggregate([
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
          latestTimestamp: { $max: "$timestamp" },
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


/**
 * Paginated history for a data table.
 *
 * `latest` caps at 500 and has no total, which is fine for a chart but not for
 * paging through readings.
 */
async function getTelemetryHistory(req, res) {
  const page = Math.max(Math.trunc(Number(req.query.page)) || 1, 1);
  const requestedLimit = Math.trunc(Number(req.query.limit));
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 20;

  const deviceId = req.query.deviceId;

  try {
    const query = {};

    if (deviceId) query["metadata.deviceId"] = deviceId;

    const [records, totalRecords] = await Promise.all([
      Telemetry.find(query)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Telemetry.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.max(Math.ceil(totalRecords / limit), 1),
      },
      records,
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return respondDatabaseUnavailable(res);
    }

    console.error("Telemetry history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to read telemetry history",
    });
  }
}

/**
 * Which devices are reporting, judged by when they were last heard from.
 * `minutes` is how long a gap may be before a device counts as offline.
 */
async function getDeviceStatus(req, res) {
  const requested = Number(req.query.minutes);
  const minutes = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), 1440)
    : 5;

  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  try {
    // $max rather than a leading $sort: same answer, one pass instead of two.
    const devices = await Telemetry.aggregate([
      {
        $group: {
          _id: "$metadata.deviceId",
          deviceType: { $first: "$metadata.deviceType" },
          location: { $first: "$metadata.location" },
          lastSeen: { $max: "$timestamp" },
          totalReadings: { $sum: 1 },
        },
      },
      { $sort: { lastSeen: -1 } },
    ]);

    const data = devices.map((device) => ({
      ...device,
      status: device.lastSeen >= cutoff ? "online" : "offline",
    }));

    return res.status(200).json({
      success: true,
      windowMinutes: minutes,
      onlineCount: data.filter((device) => device.status === "online").length,
      offlineCount: data.filter((device) => device.status === "offline").length,
      devices: data,
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return respondDatabaseUnavailable(res);
    }

    console.error("Device status error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to read device status",
    });
  }
}

/** Quotes a CSV field, doubling any quotes inside it. */
function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * CSV download of readings, for a spreadsheet or a report.
 *
 * A spreadsheet is where this data goes next, so the export is capped rather than
 * unbounded: EXPORT_MAX_ROWS readings per request.
 */
async function exportTelemetryCSV(req, res) {
  const deviceId = req.query.deviceId;
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

  const maxRows = Number(process.env.EXPORT_MAX_ROWS || 10000);

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
      .limit(maxRows)
      .lean();

    const header = [
      "timestamp",
      "deviceId",
      "deviceType",
      "location",
      "temperature",
      "humidity",
    ].join(",");

    const rows = records.map((record) =>
      [
        record.timestamp?.toISOString(),
        record.metadata?.deviceId,
        record.metadata?.deviceType,
        record.metadata?.location,
        record.readings?.temperature,
        record.readings?.humidity,
      ]
        .map(csvCell)
        .join(",")
    );

    const csv = [header, ...rows].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="telemetry-export.csv"'
    );
    res.setHeader("X-Row-Count", String(records.length));

    return res.status(200).send(csv);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return respondDatabaseUnavailable(res);
    }

    console.error("Telemetry export error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to export telemetry",
    });
  }
}

module.exports = {
  receiveTelemetry,
  receiveTelemetryBatch,
  getLatestTelemetry,
  getTelemetryStats,
  getTelemetryHistory,
  getDeviceStatus,
  exportTelemetryCSV,
  validatePoint,
};
