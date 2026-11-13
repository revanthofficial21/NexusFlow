
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

    const sensorData$ = of(...sensorData);

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
      inputCount: sensorData.length,
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
