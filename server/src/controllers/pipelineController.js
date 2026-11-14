
const Pipeline = require("../models/Pipeline");
const { validateGraph } = require("../compiler/validateGraph");

/**
 * Mongoose validation and cast failures are the caller's fault (400). Everything
 * else is ours (500) and must not leak internal messages to the client.
 */
function handleError(res, error, fallbackMessage) {
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error(`${fallbackMessage}:`, error.message);

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
}

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

    // Saving an unvalidated graph only defers the failure to /api/compiler/execute.
    const validation = validateGraph({ nodes, edges });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid pipeline graph",
        errors: validation.errors,
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
    return handleError(res, error, "Unable to save pipeline");
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
    return handleError(res, error, "Unable to retrieve pipelines");
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
    // Only a malformed ObjectId is the caller's fault; a dropped connection is not.
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid pipeline ID",
      });
    }

    return handleError(res, error, "Unable to retrieve pipeline");
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

    if (updates.nodes || updates.edges) {
      const validation = validateGraph({
        nodes: updates.nodes ?? [],
        edges: updates.edges ?? [],
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: "Invalid pipeline graph",
          errors: validation.errors,
        });
      }
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
    return handleError(res, error, "Unable to update pipeline");
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
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid pipeline ID",
      });
    }

    return handleError(res, error, "Unable to delete pipeline");
  }
};

module.exports = {
  createPipeline,
  getPipelines,
  getPipelineById,
  updatePipeline,
  deletePipeline,
};
