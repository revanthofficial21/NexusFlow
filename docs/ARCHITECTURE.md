# NexusFlow architecture

## The shape of it

```
┌──────────────┐   graph JSON   ┌───────────────┐   compiled    ┌──────────────┐
│ React canvas │ ─────────────► │ Node compiler │ ────────────► │ RxJS streams │
│ (React Flow) │                │  (validate)   │               │  (live)      │
└──────────────┘                └───────────────┘               └──────┬───────┘
                                                                       │ match
┌──────────────┐   readings     ┌───────────────┐    publish          ▼
│ Sensor /     │ ─────────────► │ Express       │ ──────────► ┌──────────────┐
│ generator    │   (HTTP)       │ ingest API    │             │ alert + SMS  │
└──────────────┘                └───────┬───────┘             │ + webhook    │
                                        │ store               └──────┬───────┘
                                        ▼                            │ Socket.IO
                                 ┌───────────────┐                   ▼
                                 │ MongoDB       │            ┌──────────────┐
                                 │ time-series   │            │ dashboard    │
                                 └───────────────┘            └──────────────┘
```

Two flows meet in the compiler. The canvas produces a **rule** (a graph of nodes),
the sensor produces **data**; the compiler is the only component that sees both, and
it turns a saved graph into a running pipeline.

## Server modules

| Path | Responsibility |
| --- | --- |
| `src/index.js` | Boot: connect Mongo, create the time-series collection, start HTTP + Socket.IO, compile saved rules |
| `src/app.js` | Express app: CORS, body limits, routes, the JSON error envelope (malformed body → 400 JSON, oversized → 413). Exported without a listener so tests can mount it |
| `src/config/db.js` | Connection, with `bufferCommands: false` so a dead database fails in milliseconds instead of ten seconds |
| `src/config/timeseries.js` | Creates the `telemetry` collection (`timeField: timestamp`, `metaField: metadata`), applies retention with `collMod` when it changes |
| `src/models/` | `Telemetry` (time-series), `Pipeline` (a saved graph), `Alert` (a rule match) |
| `src/compiler/` | `validateGraph` (structure, cycles, node types), `graphCompiler` (graph → RxJS), `describeGraph` (the plan, without running) |
| `src/streams/telemetryBus.js` | One shared `Subject`; ingest publishes, every rule subscribes |
| `src/streams/ruleRegistry.js` | Which rules are live. Compiles on save, recompiles on update, stops on delete/pause, recompiles everything at boot |
| `src/streams/alertThrottle.js` | One alert per rule per cooldown window, counting what it suppressed |
| `src/streams/activityGate.js` | Rate-limits edge-activity events, per rule and wire |
| `src/realtime/socket.js` | Broadcasts `telemetry` into `device:<id>` rooms and `alert` / `edge:activity` to everyone |
| `src/services/` | `alertService` (persist + broadcast), `smsProvider` (mock SMS behind one function) |
| `src/middleware/requireIngestKey.js` | x-api-key on the two write routes, compared in constant time |
| `src/utils/dbError.js` | Recognises the shapes Mongoose uses for "cannot reach the database" so controllers answer 503 |

## Why the compiler builds a DAG, not a chain

`analyseGraph` does a Kahn topological sort and returns the incoming/outgoing edges
per node. `compileGraph` then builds **one Observable per node**, memoised by id. A
node with several outgoing edges is read by several downstream nodes, each through
its own subscription — deliberately without `share()`, because the input may be a
cold `of(...)` (sharing would starve the second branch) or the live bus (a Subject,
which multicasts anyway).

The returned stream is the merge of the graph's leaves, so a caller can still treat
it as "the output of the pipeline".

## Live versus dry run

`POST /api/compiler/execute` compiles the graph and runs it against the readings in
the request body. It passes no `onAlert` and no `live: true`, so it reports values
and touches nothing outside the process — no webhook POST, no SMS, no alert row.
The registry is the only caller that sets `live`.

## Failure behaviour

| Failure | What happens |
| --- | --- |
| Mongo unreachable | 503 in milliseconds; `/api/health` reports `degraded` |
| Bad graph | 400 with every validation error, from `/parse` and `/execute` alike |
| Failed webhook | Three attempts (200ms, 500ms backoff) on network errors, 5xx and 429; a 4xx is not retried. Final failure is recorded as a critical alert |
| Failed SMS | Recorded on the alert with the provider's error |
| Alert storm | Throttled to one per rule per `ALERT_COOLDOWN_MS`; the rest are counted |
| Rule crash | The subscription error is logged; the rule is marked as not running and the others are unaffected |

## Frontend modules

| Path | Responsibility |
| --- | --- |
| `src/App.jsx` | Shell, pipeline CRUD, canvas wiring, views |
| `src/components/graph/FlowCanvas.jsx` | React Flow canvas, node components, property editor |
| `src/components/graph/nodeLibrary.js` | The palette, shared with the overview so they cannot drift |
| `src/services/graphService.js` | `serializeGraph`: strips React Flow fields, keeps what the compiler reads |
| `src/hooks/` | `useAlerts`, `useTelemetry`, `useEdgeActivity` — Socket.IO subscriptions |
| `src/components/` | `DevicesView`, `AlertsView`, `DevicesPanel`, `TelemetryChart`, `OverviewDashboard` |

`src/components/telemetry/TelemetryDashboard.jsx` is legacy: it was the standalone
dashboard view, and its live-readings panel duplicates the workspace chart. It is
kept rather than deleted, and nothing renders it.
