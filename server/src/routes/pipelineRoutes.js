
const express = require("express");

const router = express.Router();

const {
  createPipeline,
  getPipelines,
  getPipelineById,
  updatePipeline,
  deletePipeline,
} = require("../controllers/pipelineController");

// Save a new pipeline
router.post("/", createPipeline);

// Get all saved pipelines
router.get("/", getPipelines);

// Get a pipeline by ID
router.get("/:id", getPipelineById);

// Update a pipeline
router.put("/:id", updatePipeline);

// Delete a pipeline
router.delete("/:id", deletePipeline);

module.exports = router;
