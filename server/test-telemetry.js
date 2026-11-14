
const connectDB = require("./db");

async function insertTelemetry() {
  try {
    const db = await connectDB();

    const telemetry = db.collection("telemetry");

    const sensorData = {
      timestamp: new Date(),
      metadata: {
        deviceId: "sensor-001",
        deviceType: "temperature",
        location: "Room-1",
      },
      readings: {
        temperature: 28.5,
        humidity: 65,
      },
    };

    const result = await telemetry.insertOne(sensorData);

    console.log("Telemetry data inserted successfully!");
    console.log("Inserted ID:", result.insertedId);
  } catch (error) {
    console.error("Insert failed:", error.message);
  } finally {
    process.exit();
  }
}

insertTelemetry();
