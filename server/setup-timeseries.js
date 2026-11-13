
const connectDB = require("./db");

async function setupTimeSeries() {
  try {
    const db = await connectDB();

    const exists = await db
      .listCollections({ name: "telemetry" })
      .hasNext();

    if (exists) {
      console.log("Telemetry collection already exists!");
    } else {
      await db.createCollection("telemetry", {
        timeseries: {
          timeField: "timestamp",
          metaField: "metadata",
          granularity: "seconds",
        },
      });

      console.log("Telemetry Time-Series collection created!");
    }
  } catch (error) {
    console.error("Setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

setupTimeSeries();
