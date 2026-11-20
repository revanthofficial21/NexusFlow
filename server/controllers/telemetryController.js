
const mongoose = require("mongoose");

// 1. Receive and store sensor telemetry
async function receiveTelemetry(req, res) {
  try {
    const { deviceId, deviceType, location, temperature, humidity } = req.body;

    if (
      typeof deviceId !== "string" || !deviceId.trim() ||
      typeof deviceType !== "string" || !deviceType.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid deviceId and deviceType are required",
      });
    }

    if (
      (temperature !== undefined &&
        (typeof temperature !== "number" || !Number.isFinite(temperature))) ||
      (humidity !== undefined &&
        (typeof humidity !== "number" || !Number.isFinite(humidity)))
    ) {
      return res.status(400).json({
        success: false,
        message: "Temperature and humidity must be valid numbers",
      });
    }

    if (temperature === undefined && humidity === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one sensor reading is required",
      });
    }

    const db = mongoose.connection.db;

    const sensorData = {
      timestamp: new Date(),
      metadata: {
        deviceId: deviceId.trim(),
        deviceType: deviceType.trim(),
        location: location || "Unknown",
      },
      readings: { temperature, humidity },
    };

    const result = await db.collection("telemetry").insertOne(sensorData);

    return res.status(201).json({
      success: true,
      message: "Telemetry received successfully",
      insertedId: result.insertedId,
      data: sensorData,
    });
  } catch (error) {
    console.error("Telemetry error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to save telemetry",
    });
  }
}

// 2. Fetch latest telemetry with device and date filters
async function getLatestTelemetry(req, res) {
  try {
    const db = mongoose.connection.db;
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100
    );

    const filter = {};
    const { deviceId, startDate, endDate } = req.query;

    if (deviceId) {
      filter["metadata.deviceId"] = deviceId;
    }

    if (startDate || endDate) {
      filter.timestamp = {};

      if (startDate) {
        const start = new Date(startDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid startDate",
          });
        }

        filter.timestamp.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate",
          });
        }

        filter.timestamp.$lte = end;
      }

      if (
        startDate &&
        endDate &&
        new Date(startDate) > new Date(endDate)
      ) {
        return res.status(400).json({
          success: false,
          message: "startDate must be before endDate",
        });
      }
    }

    const records = await db.collection("telemetry")
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return res.status(200).json({
      success: true,
      count: records.length,
      filters: {
        deviceId: deviceId || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
      data: records,
    });
  } catch (error) {
    console.error("Telemetry read error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch telemetry",
    });
  }
}

// 3. Get device-wise telemetry statistics
async function getTelemetryStats(req, res) {
  try {
    const db = mongoose.connection.db;

    const stats = await db.collection("telemetry").aggregate([
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
    ]).toArray();

    return res.status(200).json({
      success: true,
      deviceCount: stats.length,
      data: stats,
    });
  } catch (error) {
    console.error("Telemetry statistics error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch telemetry statistics",
    });
  }
}

module.exports = {
  receiveTelemetry,
  getLatestTelemetry,
  getTelemetryStats,
  bulkReceiveTelemetry,
  getTelemetryHistory
};


// 4. Bulk telemetry ingestion
async function bulkReceiveTelemetry(req, res) {
  try {
    const { readings } = req.body;

    if (!Array.isArray(readings) || readings.length === 0 || readings.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Provide between 1 and 100 telemetry readings",
      });
    }

    const documents = [];

    for (const item of readings) {
      const { deviceId, deviceType, location, temperature, humidity } = item;

      if (
        typeof deviceId !== "string" || !deviceId.trim() ||
        typeof deviceType !== "string" || !deviceType.trim() ||
        (temperature === undefined && humidity === undefined) ||
        (temperature !== undefined && (typeof temperature !== "number" || !Number.isFinite(temperature))) ||
        (humidity !== undefined && (typeof humidity !== "number" || !Number.isFinite(humidity)))
      ) {
        return res.status(400).json({
          success: false,
          message: "Each reading must contain valid device details and at least one valid sensor value",
        });
      }

      documents.push({
        timestamp: new Date(),
        metadata: {
          deviceId: deviceId.trim(),
          deviceType: deviceType.trim(),
          location: location || "Unknown",
        },
        readings: { temperature, humidity },
      });
    }

    const result = await mongoose.connection.db
      .collection("telemetry")
      .insertMany(documents);

    return res.status(201).json({
      success: true,
      message: "Bulk telemetry saved successfully",
      insertedCount: result.insertedCount,
    });
  } catch (error) {
    console.error("Bulk telemetry error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to save bulk telemetry",
    });
  }
}



// 5. Paginated telemetry history
async function getTelemetryHistory(req, res) {
  try {
    const db = mongoose.connection.db;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.deviceId) {
      filter["metadata.deviceId"] = req.query.deviceId;
    }

    const collection = db.collection("telemetry");
    const [records, totalRecords] = await Promise.all([
      collection.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      pagination: {
        currentPage: page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },
      data: records,
    });
  } catch (error) {
    console.error("Telemetry history error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch telemetry history",
    });
  }
}



async function getDeviceStatus(req, res) {
  try {
    const minutes = Math.min(Math.max(Number(req.query.minutes) || 5, 1), 1440);
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);

    const devices = await mongoose.connection.db.collection("telemetry").aggregate([
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$metadata.deviceId",
          deviceType: { $first: "$metadata.deviceType" },
          location: { $first: "$metadata.location" },
          lastSeen: { $first: "$timestamp" }
        }
      },
      { $sort: { lastSeen: -1 } }
    ]).toArray();

    const data = devices.map(device => ({
      ...device,
      status: device.lastSeen >= cutoff ? "online" : "offline"
    }));

    res.status(200).json({
      success: true,
      onlineCount: data.filter(d => d.status === "online").length,
      offlineCount: data.filter(d => d.status === "offline").length,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch device status"
    });
  }
}




module.exports.getDeviceStatus = getDeviceStatus;


async function getTelemetryAlerts(req, res) {
  try {
    const temperatureLimit = Number(req.query.temperatureLimit) || 40;
    const humidityLimit = Number(req.query.humidityLimit) || 80;

    const alerts = await mongoose.connection.db.collection("telemetry")
      .find({
        $or: [
          { "readings.temperature": { $gt: temperatureLimit } },
          { "readings.humidity": { $gt: humidityLimit } }
        ]
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    res.status(200).json({
      success: true,
      alertCount: alerts.length,
      thresholds: { temperatureLimit, humidityLimit },
      data: alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch telemetry alerts"
    });
  }
}

module.exports.getTelemetryAlerts = getTelemetryAlerts;
