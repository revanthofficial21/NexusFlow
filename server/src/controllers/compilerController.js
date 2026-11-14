
const { of, lastValueFrom, toArray } = require("rxjs");
const { compileGraph } = require("../compiler/graphCompiler");

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
    // Graph problems are the caller's fault (400); anything else is ours (500).
    const isClientError = /^(Invalid graph|Graph must|Node |Threshold value|Unsupported|sensorData)/.test(
      error.message
    );

    if (!isClientError) {
      console.error("Compiler error:", error.message);
    }

    return res.status(isClientError ? 400 : 500).json({
      success: false,
      message: isClientError ? error.message : "Graph execution failed",
    });
  }
}

module.exports = { executeGraph };
