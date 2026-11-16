
const express = require("express");
const router = express.Router();

const {
  executeGraph,
  parseGraphRequest,
} = require("../controllers/compilerController");

// Parse a visual graph without executing it
router.post("/parse", parseGraphRequest);

// Execute a visual graph
router.post("/execute", executeGraph);

module.exports = router;
