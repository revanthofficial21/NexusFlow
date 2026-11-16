
const { of, lastValueFrom, toArray } = require("rxjs");
const { compileGraph, describeGraph } = require("../compiler/graphCompiler");

// Guards against one request pinning the event loop.
const MAX_SENSOR_DATA = 10000;

async function executeGraph(req, res) {
  try {
    const { graph, sensorData } = req.body;

    if (!graph || !Array.isArray(sensorData)) {
      return res.status(400).json({
        success: false,
        message: "Graph and sensorData array are required",
      });
    }

    if (sensorData.length > MAX_SENSOR_DATA) {
      return res.status(413).json({
        success: false,
        message: `sensorData exceeds the limit of ${MAX_SENSOR_DATA} readings`,
      });
    }

    // Non numeric readings used to flow into the pipeline and produce NaN, which
    // every threshold comparison silently rejects.
    const readings = sensorData.map(Number);
    const invalidIndex = readings.findIndex((value) => !Number.isFinite(value));

    if (invalidIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: `sensorData[${invalidIndex}] is not a finite number`,
      });
    }

    const sensorData$ = of(...readings);

    const compiledStream = compileGraph(
      graph,
      sensorData$
    );

    const results = await lastValueFrom(
      compiledStream.pipe(toArray())
    );

    return res.status(200).json({
      success: true,
      message: "Graph executed successfully",
      inputCount: readings.length,
      outputCount: results.length,
      results,
    });
  } catch (error) {
    // The compiler tags graph problems with status 400; anything untagged is ours.
    const status = error.status || 500;

    if (status >= 500) {
      console.error("Compiler error:", error.message);
    }

    return res.status(status).json({
      success: false,
      message: status >= 500 ? "Graph execution failed" : error.message,
    });
  }
}

/**
 * Parse-only: validates the graph and reports the execution plan without running
 * anything. Lets the mid-project review show parsing as its own step.
 */
function parseGraphRequest(req, res) {
  const graph = req.body?.graph ?? req.body;

  try {
    const description = describeGraph(graph);
    return res.status(200).json({ success: true, ...description });
  } catch (error) {
    const status = error.status || 500;

    if (status >= 500) {
      console.error("Graph parse error:", error.message);
    }

    return res.status(status).json({
      success: false,
      message: status >= 500 ? "Graph could not be parsed" : error.message,
    });
  }
}

module.exports = { executeGraph, parseGraphRequest };
