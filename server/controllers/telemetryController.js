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

module.exports = { receiveTelemetry, getDeviceSummary };
