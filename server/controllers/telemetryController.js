const connectDB = require("../db");

async function receiveTelemetry(req, res) {
  try {
    const db = await connectDB();
    const { deviceId, deviceType, location, temperature, humidity } = req.body;

    if (!deviceId || !deviceType) {
      return res.status(400).json({
        success: false,
        message: "deviceId and deviceType are required",
      });
    }

    const sensorData = {
      timestamp: new Date(),
      metadata: {
        deviceId,
        deviceType,
        location: location || "Unknown",
      },
      readings: { temperature, humidity },
    };

    const result = await db.collection("telemetry").insertOne(sensorData);

    res.status(201).json({
      success: true,
      message: "Telemetry received successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Telemetry error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to save telemetry",
    });
  }
}

async function getDeviceSummary(req, res) {
  try {
    const db = await connectDB();
    const collection = db.collection("telemetry");

    const [totalReadings, devices] = await Promise.all([
      collection.countDocuments(),
      collection.aggregate([
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: "$metadata.deviceId",
            deviceType: { $first: "$metadata.deviceType" },
            location: { $first: "$metadata.location" },
            latestTimestamp: { $first: "$timestamp" },
            latestReadings: { $first: "$readings" },
          },
        },
        { $sort: { latestTimestamp: -1 } },
      ]).toArray(),
    ]);

    res.json({
      success: true,
      totalDevices: devices.length,
      totalReadings,
      devices,
    });
  } catch (error) {
    console.error("Device summary error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch device summary",
    });
  }
}


async function getDeviceAnalytics(req, res) {
  try {
    const { deviceId } = req.params;
    const { from, to } = req.query;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: "Device ID is required" });
    }

    const match = { "metadata.deviceId": deviceId };

    if (from || to) {
      match.timestamp = {};
      if (from) {
        const startDate = new Date(from);
        if (Number.isNaN(startDate.getTime())) {
          return res.status(400).json({ success: false, message: "Invalid from date" });
        }
        match.timestamp.$gte = startDate;
      }
      if (to) {
        const endDate = new Date(to);
        if (Number.isNaN(endDate.getTime())) {
          return res.status(400).json({ success: false, message: "Invalid to date" });
        }
        match.timestamp.$lte = endDate;
      }
      if (match.timestamp.$gte && match.timestamp.$lte &&
          match.timestamp.$gte > match.timestamp.$lte) {
        return res.status(400).json({ success: false, message: "From date must be before to date" });
      }
    }

    const db = await connectDB();
    const analytics = await db.collection("telemetry").aggregate([
      { $match: match },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: "$metadata.deviceId",
          totalReadings: { $sum: 1 },
          averageTemperature: { $avg: "$readings.temperature" },
          minimumTemperature: { $min: "$readings.temperature" },
          maximumTemperature: { $max: "$readings.temperature" },
          averageHumidity: { $avg: "$readings.humidity" },
          minimumHumidity: { $min: "$readings.humidity" },
          maximumHumidity: { $max: "$readings.humidity" },
          firstReading: { $first: "$timestamp" },
          latestReading: { $last: "$timestamp" }
        }
      }
    ]).toArray();

    if (!analytics.length) {
      return res.status(404).json({
        success: false,
        message: "No telemetry readings found for this device"
      });
    }

    return res.json({ success: true, analytics: analytics[0] });
  } catch (error) {
    console.error("Device analytics error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch device analytics"
    });
  }
}

module.exports = { receiveTelemetry, getDeviceSummary, getDeviceAnalytics };
