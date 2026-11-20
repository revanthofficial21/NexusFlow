/**
 * The SMS action node and its mock provider.
 */
const assert = require("node:assert");
const { of } = require("rxjs");
const { compileGraph, describeGraph } = require("../src/compiler/graphCompiler");
const { validateGraph } = require("../src/compiler/validateGraph");
const {
  renderTemplate,
  isValidPhoneNumber,
} = require("../src/services/smsProvider");

const graph = (smsData) => ({
  nodes: [
    { id: "1", type: "sensor", data: { deviceId: "turbine-01" } },
    { id: "2", type: "threshold", data: { threshold: 80, operator: "greaterThan" } },
    { id: "3", type: "sms", data: smsData },
  ],
  edges: [
    { id: "a", source: "1", target: "2" },
    { id: "b", source: "2", target: "3" },
  ],
});

const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // 1. The validator accepts the type.
  assert.strictEqual(validateGraph(graph({ to: "+919876543210" })).valid, true);
  console.log("Test 1 passed: the validator accepts an sms node");

  // 2. Phone validation, both directly and through the plan.
  assert.strictEqual(isValidPhoneNumber("+919876543210"), true);
  assert.strictEqual(isValidPhoneNumber("+91 98765 43210"), true);
  assert.strictEqual(isValidPhoneNumber("call-me"), false);

  assert.throws(
    () => describeGraph(graph({ to: "call-me" })),
    /needs a valid phone number/,
    "parse must reject a bad phone number"
  );
  assert.throws(
    () => compileGraph(graph({ to: "call-me" }), of(1)),
    /needs a valid phone number/
  );
  console.log("Test 2 passed: an invalid phone number is rejected by parse and execute");

  // 3. The plan reports what will be sent.
  const plan = describeGraph(graph({ to: "+919876543210", template: "Hot {{deviceId}}: {{value}}" }));
  assert.strictEqual(plan.plan[2].to, "+919876543210");
  assert.strictEqual(plan.plan[2].template, "Hot {{deviceId}}: {{value}}");
  console.log("Test 3 passed: the plan reports the recipient and template");

  // 4. Template rendering.
  assert.strictEqual(
    renderTemplate("Hot {{deviceId}} ({{metric}}): {{value}}", {
      deviceId: "turbine-01",
      metric: "temperature",
      value: 92.5,
    }),
    "Hot turbine-01 (temperature): 92.5"
  );
  console.log("Test 4 passed: templates render deviceId, metric and value");

  // 5. A live pipeline sends and reports the delivery outcome.
  const live = [];
  compileGraph(graph({ to: "+919876543210", template: "Hot {{deviceId}}: {{value}}" }), of(70, 92), {
    live: true,
    onAlert: (alert) => live.push(alert),
  }).subscribe();

  await wait();

  assert.strictEqual(live.length, 1);
  assert.strictEqual(live[0].channel, "sms");
  assert.strictEqual(live[0].message, "Hot turbine-01: 92");
  assert.strictEqual(live[0].delivery.delivered, true);
  assert.strictEqual(live[0].delivery.provider, "log");
  console.log("Test 5 passed: a live rule sends the SMS and reports delivery");

  // 6. A dry run must never send anything.
  const dry = [];
  compileGraph(graph({ to: "+919876543210" }), of(70, 92), {
    onAlert: (alert) => dry.push(alert),
  }).subscribe();

  await wait();

  assert.deepStrictEqual(dry, []);
  console.log("Test 6 passed: a dry run sends no SMS and reports nothing");

  console.log("\nAll SMS tests passed!");
}

main().catch((error) => {
  console.error("SMS test failed:", error.message);
  process.exitCode = 1;
});
