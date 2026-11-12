
const assert = require("node:assert");
const { of } = require("rxjs");

const { compileGraph } = require("../src/compiler/graphCompiler");

const graph = {
  nodes: [
    {
      id: "1",
      type: "sensor",
      data: { label: "Turbine Sensor" },
    },
    {
      id: "2",
      type: "average",
      data: { windowSize: 3 },
    },
    {
      id: "3",
      type: "threshold",
      data: {
        threshold: 105,
        operator: "greaterThan",
      },
    },
    {
      id: "4",
      type: "alert",
      data: { label: "Manager Notification" },
    },
  ],
  edges: [
    { source: "1", target: "2" },
    { source: "2", target: "3" },
    { source: "3", target: "4" },
  ],
};

// Simulated temperature readings
const sensorData$ = of(90, 100, 110, 120);

const result = [];

const compiledStream = compileGraph(graph, sensorData$);

compiledStream.subscribe({
  next: (value) => result.push(value),
  error: (error) => console.error("Stream error:", error),
  complete: () => {
    try {
      assert.deepStrictEqual(result, [110]);

      console.log("Test passed: RxJS pipeline executed");
      console.log("Expected output: [110]");
      console.log("Actual output:", result);
      console.log("All compiler tests passed!");
    } catch (error) {
      console.error("Test failed:", error.message);
      process.exitCode = 1;
    }
  },
});
