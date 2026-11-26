
const mongoose = require("mongoose");

const RETENTION_SECONDS = 90 * 24 * 60 * 60;

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error("MONGODB_URI is missing from environment configuration");
    }

    await mongoose.connect(mongoURI);

    console.log("MongoDB connected successfully!");
    console.log("Database:", mongoose.connection.name);

    const db = mongoose.connection.db;
    const collection = await db
      .listCollections({ name: "telemetry" })
      .next();

    if (!collection) {
      await db.createCollection("telemetry", {
        timeseries: {
          timeField: "timestamp",
          metaField: "metadata",
          granularity: "seconds"
        },
        expireAfterSeconds: RETENTION_SECONDS
      });

      console.log("Telemetry Time-Series collection created with 90-day retention!");
    } else if (
      collection.options.expireAfterSeconds !== RETENTION_SECONDS
    ) {
      await db.command({
        collMod: "telemetry",
        expireAfterSeconds: RETENTION_SECONDS
      });

      console.log("Telemetry 90-day retention enabled!");
    } else {
      console.log("Telemetry 90-day retention already enabled!");
    }
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
