/**
 * The canvas flags nodes that the server would reject. These are the rules.
 *
 * Run with: npm test   (node --test tests/)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { findNodeWarnings } from "../src/services/graphWarnings.js";

const sensor = { id: "1", type: "sensor", data: {} };
const average = { id: "2", type: "average", data: { windowSize: 3 } };
const threshold = { id: "3", type: "threshold", data: { threshold: 85 } };
const sms = { id: "4", type: "sms", data: { to: "+919876543210" } };
const chain = [
  { id: "e1", source: "1", target: "2" },
  { id: "e2", source: "2", target: "3" },
  { id: "e3", source: "3", target: "4" },
];

test("a valid graph has no warnings", () => {
  assert.deepEqual(findNodeWarnings([sensor, average, threshold, sms], chain), {});
});

test("a node with no input is flagged", () => {
  const warnings = findNodeWarnings([threshold], []);
  assert.match(warnings["3"], /needs an input/);
});

test("a source with nothing downstream is flagged", () => {
  const warnings = findNodeWarnings([sensor], []);
  assert.match(warnings["1"], /Connect this source/);
});

test("an action node with an output is flagged", () => {
  const warnings = findNodeWarnings(
    [sensor, { id: "5", type: "alert", data: {} }, { id: "6", type: "alert", data: {} }],
    [
      { id: "e1", source: "1", target: "5" },
      { id: "e2", source: "5", target: "6" },
    ]
  );
  assert.match(warnings["5"], /cannot have an output/);
});

test("a webhook without http(s) is flagged", () => {
  const warnings = findNodeWarnings(
    [sensor, { id: "7", type: "webhook", data: { url: "ftp://nope" } }],
    [{ id: "e1", source: "1", target: "7" }]
  );
  assert.match(warnings["7"], /http/);
});

test("a phone number that is too short is flagged", () => {
  const warnings = findNodeWarnings(
    [sensor, { id: "8", type: "sms", data: { to: "123" } }],
    [{ id: "e1", source: "1", target: "8" }]
  );
  assert.match(warnings["8"], /Phone number/);
});

test("a window size out of range is flagged", () => {
  const warnings = findNodeWarnings(
    [sensor, { id: "9", type: "average", data: { windowSize: 5000 } }],
    [{ id: "e1", source: "1", target: "9" }]
  );
  assert.match(warnings["9"], /Window size/);
});
