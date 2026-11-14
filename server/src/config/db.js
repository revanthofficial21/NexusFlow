
const mongoose = require("mongoose");

// Throws instead of calling process.exit: exiting from inside a library
// function makes the caller's error handling dead code and kills any test that
// imports it.
const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error("MONGODB_URI is missing in server/.env");
  }

  try {
    await mongoose.connect(mongoURI);
  } catch (error) {
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }

  console.log("MongoDB connected successfully!");
  console.log("Database:", mongoose.connection.name);

  return mongoose.connection;
};

module.exports = connectDB;
