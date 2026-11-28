# The graph contract

What the canvas sends and the compiler reads. This is the interface between the
frontend and the backend; both sides validate against it.

## Shape

```json
{
  "nodes": [
    {
      "id": "1",
      "type": "sensor",
      "position": { "x": 0, "y": 120 },
      "data": { "label": "Turbine Sensor", "deviceId": "turbine-01" }
    }
  ],
  "edges": [{ "id": "e1", "source": "1", "target": "2" }]
}
```

`position` is React Flow's, and is ignored by the server — `serializeGraph` drops it
before sending, which is why a payload shrinks from ~816 to ~529 bytes.

## Node types

| `type` | Category | `data` fields the compiler reads |
| --- | --- | --- |
| `sensor` | source | `deviceId` |
| `average` | transform | `windowSize` (1–1000, default 5) |
| `threshold` | logic | `threshold` (number, default 80), `operator` (`greaterThan` \| `lessThan` \| `equal`) |
| `alert` | action | `label` (used in the message) |
| `sms` | action | `to` (E.164-ish), `template` with `{{deviceId}}` `{{metric}}` `{{value}}` `{{time}}` |
| `webhook` | action | `url` (http/https), `method` (`POST` \| `PUT` \| `PATCH`) |

## Rules the validator enforces

- at least one node, exactly **one** `sensor` — two would each read the same stream
  and silently double every reading
- every node type must be in the table above
- every edge must reference existing nodes; no self-loops
- the graph must be acyclic
- every non-source node needs an input; an unconnected node is an error, not a no-op
- action nodes may not have outputs

## Rules the compiler enforces, on top

- parameters are range-checked (`windowSize`, `threshold`, phone number, URL)
- `parse` and `execute` share that validation, so a graph cannot pass one and fail
  the other

## What a compiled rule looks like

`POST /api/compiler/parse` returns the plan without running anything:

```json
{
  "valid": true,
  "nodeCount": 4,
  "executionOrder": ["1", "2", "3", "4"],
  "branches": [],
  "plan": [
    { "id": "1", "type": "sensor", "inputs": [], "outputs": ["2"], "deviceId": "turbine-01" },
    { "id": "2", "type": "average", "inputs": ["1"], "outputs": ["3"], "windowSize": 3 },
    { "id": "3", "type": "threshold", "inputs": ["2"], "outputs": ["4"], "operator": "greaterThan", "threshold": 85 },
    { "id": "4", "type": "sms", "inputs": ["3"], "outputs": [], "to": "+919876543210", "template": "…" }
  ]
}
```

`branches` lists every node with more than one outgoing edge — the graphs that the
single-chain compiler could not have run.
