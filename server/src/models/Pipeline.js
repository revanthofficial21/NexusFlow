
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

    nodes: {
      type: [mongoose.Schema.Types.Mixed],
      required: true,
      default: [],
    },

    edges: {
      type: [mongoose.Schema.Types.Mixed],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Pipeline = mongoose.model("Pipeline", pipelineSchema);

module.exports = Pipeline;
