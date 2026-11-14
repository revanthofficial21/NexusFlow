
const Pipeline = require("../models/Pipeline");

// CREATE: Save a new pipeline
const createPipeline = async (req, res) => {
  try {
    const { name, description, nodes, edges } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Pipeline name is required",
      });
    }

    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return res.status(400).json({
        success: false,
        message: "Nodes and edges must be arrays",
      });
    }

    const pipeline = await Pipeline.create({
      name: name.trim(),
      description: description || "",
      nodes,
      edges,
    });

    return res.status(201).json({
      success: true,
      message: "Pipeline saved successfully",
      pipeline,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// READ: Get all saved pipelines
const getPipelines = async (req, res) => {
  try {
    const pipelines = await Pipeline.find()
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: pipelines.length,
      pipelines,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// READ: Get one pipeline by ID
const getPipelineById = async (req, res) => {
  try {
    const pipeline = await Pipeline.findById(req.params.id);

    if (!pipeline) {
      return res.status(404).json({
        success: false,
        message: "Pipeline not found",
      });
    }

    return res.status(200).json({
      success: true,
      pipeline,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid pipeline ID",
    });
  }
};

// UPDATE: Update an existing pipeline
const updatePipeline = async (req, res) => {
  try {
    const { name, description, nodes, edges } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Pipeline name cannot be empty",
        });
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description;
    }

    if (nodes !== undefined) {
      if (!Array.isArray(nodes)) {
        return res.status(400).json({
          success: false,
          message: "Nodes must be an array",
        });
      }
      updates.nodes = nodes;
    }

    if (edges !== undefined) {
      if (!Array.isArray(edges)) {
        return res.status(400).json({
          success: false,
          message: "Edges must be an array",
        });
      }
      updates.edges = edges;
    }

    const pipeline = await Pipeline.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!pipeline) {
      return res.status(404).json({
        success: false,
        message: "Pipeline not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pipeline updated successfully",
      pipeline,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE: Delete a pipeline
const deletePipeline = async (req, res) => {
  try {
    const pipeline = await Pipeline.findByIdAndDelete(
      req.params.id
    );

    if (!pipeline) {
      return res.status(404).json({
        success: false,
        message: "Pipeline not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pipeline deleted successfully",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid pipeline ID",
    });
  }
};

module.exports = {
  createPipeline,
  getPipelines,
  getPipelineById,
  updatePipeline,
  deletePipeline,
};
