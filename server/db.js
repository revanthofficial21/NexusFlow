const { MongoClient } = require("mongodb");
require("dotenv").config();

// Resolve the database from the connection string instead of hardcoding it, so
// pointing MONGODB_URI at another database actually works.
function databaseName(uri) {
  try {
    const name = new URL(uri).pathname.replace(/^\//, "");
    return name || "nexusflow";
  } catch {
    return "nexusflow";
  }
}

let client = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  // Constructed lazily: doing this at module load threw an unreadable
  // "Cannot read properties of undefined" when the env var was missing.
  if (!uri) {
    const error = new Error("MONGODB_URI is missing in server/.env");
    console.error(error.message);
    throw error;
  }

  try {
    if (!client) client = new MongoClient(uri);
    await client.connect();
    console.log("MongoDB connected successfully!");

    return client.db(databaseName(uri));
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
}

module.exports = connectDB;