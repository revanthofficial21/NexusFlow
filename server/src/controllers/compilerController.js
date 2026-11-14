
const { of, lastValueFrom, toArray } = require("rxjs");
const { compileGraph } = require("../compiler/graphCompiler");

async function executeGraph(req, res) {
  try {
    const { graph, sensorData } = req.body;

    if (!graph || !Array.isArray(sensorData)) {
      return res.status(400).json({
        success: false,
        message: "Graph and sensorData array are required",
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
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = { executeGraph };
