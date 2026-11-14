
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
      readings: {
        temperature,
        humidity,
      },
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

module.exports = { receiveTelemetry };
