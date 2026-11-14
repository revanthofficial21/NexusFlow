
const connectDB = require("./db");

async function readTelemetry() {
  try {
    const db = await connectDB();

    const telemetry = db.collection("telemetry");

    const records = await telemetry
      .find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    console.log("Latest Telemetry Records:");
    console.log(JSON.stringify(records, null, 2));
  } catch (error) {
    console.error("Read failed:", error.message);
  } finally {
    process.exit();
  }
}

readTelemetry();
