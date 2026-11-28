const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error("MONGODB_URI is missing in server/.env");
  }

  try {
    await mongoose.connect(mongoURI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }

  console.log("MongoDB connected successfully!");
  console.log("Database:", mongoose.connection.name);

  const retentionSeconds = 7776000;
  const db = mongoose.connection.db;

  const telemetryCollection = await db
    .listCollections({ name: "telemetry" })
    .next();

  if (!telemetryCollection) {
    await db.createCollection("telemetry", {
      timeseries: {
        timeField: "timestamp",
        metaField: "metadata",
      },
      expireAfterSeconds: retentionSeconds,
    });
    console.log("Telemetry 90-day retention enabled!");
  } else if (
    telemetryCollection.options.expireAfterSeconds !== retentionSeconds
  ) {
    await db.command({
      collMod: "telemetry",
      expireAfterSeconds: retentionSeconds,
    });
    console.log("Telemetry 90-day retention updated!");
  } else {
    console.log("Telemetry 90-day retention already enabled!");
  }

  return mongoose.connection;
};

module.exports = connectDB;
