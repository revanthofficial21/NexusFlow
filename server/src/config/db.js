const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error("MONGODB_URI is missing in server/.env");
    }

    await mongoose.connect(mongoURI);

    console.log("MongoDB connected successfully!");
    console.log("Database:", mongoose.connection.name);

    const db = mongoose.connection.db;
    const exists = await db.listCollections({ name: "telemetry" }).hasNext();

    if (!exists) {
      await db.createCollection("telemetry", {
        timeseries: {
          timeField: "timestamp",
          metaField: "metadata",
          granularity: "seconds",
        },
      });
      console.log("Telemetry Time-Series collection created!");
    } else {
      console.log("Telemetry collection already exists!");
    }
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
