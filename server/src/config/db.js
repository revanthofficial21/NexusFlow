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

  // Collection creation and retention live in config/timeseries.js: one owner for
  // the time-series options, reading TELEMETRY_RETENTION_DAYS. This function used to
  // do the same job with a hardcoded 90 days, so two paths raced to create the same
  // collection and the env var was honoured by only one of them.
};

module.exports = connectDB;
