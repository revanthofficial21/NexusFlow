
const assert = require("node:assert");
const { validateGraph } = require("../src/compiler/validateGraph");

// Test 1: Valid graph
const validGraph = {
  nodes: [
    { id: "1", type: "sensor" },
    { id: "2", type: "average" },
    { id: "3", type: "threshold" },
    { id: "4", type: "alert" },
  ],
  edges: [
    { source: "1", target: "2" },
    { source: "2", target: "3" },
    { source: "3", target: "4" },
  ],
};

const validResult = validateGraph(validGraph);

assert.strictEqual(validResult.valid, true);
console.log("Test 1 passed: Valid graph accepted");

// Test 2: Unsupported node type
const invalidGraph = {
  nodes: [{ id: "1", type: "unknown" }],
  edges: [],
};

const invalidResult = validateGraph(invalidGraph);

assert.strictEqual(invalidResult.valid, false);
console.log("Test 2 passed: Unsupported node rejected");

// Test 3: Missing connection target
const brokenGraph = {
  nodes: [{ id: "1", type: "sensor" }],
  edges: [{ source: "1", target: "99" }],
};

const brokenResult = validateGraph(brokenGraph);

assert.strictEqual(brokenResult.valid, false);
console.log("Test 3 passed: Missing target rejected");

console.log("\nAll validator tests passed!");
