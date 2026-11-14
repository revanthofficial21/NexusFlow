
const express = require("express");
const router = express.Router();

const {
  executeGraph,
} = require("../controllers/compilerController");

// Execute a visual graph
router.post("/execute", executeGraph);

module.exports = router;
