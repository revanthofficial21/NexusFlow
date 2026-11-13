const connectDB = require("./db");

async function testConnection() {
  try {
    const db = await connectDB();

    console.log("Database name:", db.databaseName);
    console.log("NexusFlow database connection test successful!");
  } catch (error) {
    console.error("Test failed:", error.message);
  } finally {
    process.exit();
  }
}

testConnection();