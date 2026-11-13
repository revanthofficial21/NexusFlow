
const express = require("express");
require("dotenv").config();

const telemetryRoutes = require("./routes/telemetryRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "NexusFlow API is running!",
  });
});

app.use("/api/telemetry", telemetryRoutes);

app.listen(PORT, () => {
  console.log(`NexusFlow server running on port ${PORT}`);
});
