
const mongoose = require("mongoose");

const pipelineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      default: "",
      maxlength: 500,
    },

    // `required: true` on an array with a default can never fail, so it was
    // misleading. Shape validation happens in the controller via validateGraph.
    nodes: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    edges: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Every list endpoint sorts by updatedAt.
pipelineSchema.index({ updatedAt: -1 });

const Pipeline = mongoose.model("Pipeline", pipelineSchema);

module.exports = Pipeline;
