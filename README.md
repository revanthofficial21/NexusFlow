# NexusFlow – Visual IoT Telemetry & Rule Engine

**A visual, no-code platform for building IoT data pipelines and monitoring sensor telemetry.**

NexusFlow is a web-based IoT telemetry and dynamic rule-engine project designed to allow factory operators and developers to create data-processing workflows through a visual drag-and-drop interface.

Instead of hardcoding business rules, users will be able to connect sensor sources, processing operations, conditions, and alert actions through a visual node-based canvas.

The project is being developed using React, React Flow, Node.js, Express, MongoDB Time-Series, and RxJS.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Problem Statement](#problem-statement)
- [Project Objectives](#project-objectives)
- [Current Features](#current-features)
- [Technology Stack](#technology-stack)
- [Project Architecture](#project-architecture)
- [Project Structure](#project-structure)
- [Installation and Setup](#installation-and-setup)
- [Running the Application](#running-the-application)
- [Visual Rule Builder](#visual-rule-builder)
- [Example IoT Pipeline](#example-iot-pipeline)
- [Team Responsibilities](#team-responsibilities)
- [Development Roadmap](#development-roadmap)
- [Future Enhancements](#future-enhancements)

## Project Overview

NexusFlow aims to simplify IoT device monitoring and automation by providing a visual programming environment for creating dynamic data-processing pipelines.

Users will be able to:

- Connect IoT sensor data sources.
- Apply mathematical operations.
- Calculate moving averages.
- Define threshold conditions.
- Configure alert actions.
- Monitor incoming telemetry.
- Visualize rule execution in real time.

The goal is to provide a flexible rule engine in which business logic can be changed through a visual interface without modifying backend source code for every rule change.

## Problem Statement

Traditional IoT applications often require developers to hardcode business rules.

For example:

`If temperature > 80°C, send an alert.`

Whenever a business requirement changes, developers may need to modify and redeploy application code.

Additionally, high-frequency sensor telemetry creates challenges involving data ingestion, storage efficiency, and real-time rule evaluation.

NexusFlow addresses these challenges through a visual graph builder, optimized time-series storage, and a reactive stream-processing architecture.

## Project Objectives

1. Build a visual drag-and-drop IoT workflow editor.
2. Support reusable custom processing nodes.
3. Store high-frequency telemetry in MongoDB Time-Series collections.
4. Convert visual graph configurations into executable RxJS pipelines.
5. Process incoming telemetry continuously.
6. Evaluate user-defined business rules dynamically.
7. Generate alerts when configured conditions are satisfied.
8. Provide real-time monitoring dashboards.

## Current Features

The following features have been implemented in the initial frontend development.

### 1. NexusFlow Dashboard

- Dark-themed application interface.
- NexusFlow branding and system status indicator.
- Workspace navigation sidebar.
- Visual Rule Builder page.
- Pipeline information section.

### 2. React Flow Canvas

- Interactive node-based workflow canvas.
- Custom node components.
- Connected workflow visualization.
- Animated connections.
- Canvas background grid.
- Zoom and navigation controls.
- Minimap.
- Node movement and connection support through React Flow.

### 3. Initial Custom Node Library

| Node | Purpose |
|---|---|
| Data Source | Represents an IoT sensor input |
| Moving Average | Represents rolling-average processing |
| Threshold | Represents a condition check |
| SMS Alert | Represents an alert action |

### 4. Node Library Interface

- Dedicated node library panel.
- Buttons for adding different node types.
- Node descriptions and visual indicators.
- Dynamic node count.
- Connection count.
- Reset Canvas control.

**Note:** The current implementation is a frontend prototype. Backend execution, database persistence, live telemetry processing, and actual SMS delivery are planned development tasks.

## Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| React | Component-based user interface |
| Vite | Frontend development and build tooling |
| JavaScript | Application logic |
| @xyflow/react | Visual node-based graph editor |
| Axios | HTTP communication |
| Socket.IO Client | Real-time communication |
| Recharts | Data visualization |
| Lucide React | Interface icons |
| CSS | Styling and responsive layouts |

### Backend – Planned

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Express.js | API development |
| Socket.IO | Real-time telemetry communication |
| RxJS | Reactive stream processing |
| MongoDB | Database |
| MongoDB Time-Series | High-frequency telemetry storage |
| Mongoose | Database interaction |

## Project Architecture

The planned architecture consists of the following components:

```text
              FRONTEND
                 |
          React + Vite
                 |
           React Flow
                 |
          Graph JSON
                 |
                 v
          NODE.JS BACKEND
                 |
          Graph Validator
                 |
          Stream Compiler
                 |
            RxJS Engine
                 |
          Telemetry Stream
                 |
       MongoDB Time-Series
                 |
          Rule Evaluation
                 |
          Alert Generation
                 |
          WebSocket Updates
                 |
          React Dashboard
```

The frontend will serialize visual workflows into JSON. The backend will validate the graph and compile supported node types into executable reactive streams.

Incoming sensor telemetry will then pass through the configured pipeline.

## Project Structure

Current frontend structure:

```text
NexusFlow/
│
├── client/
│   ├── public/
│   │
│   ├── src/
│   │   ├── assets/
│   │   │
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── dashboard/
│   │   │   ├── graph/
│   │   │   │   └── FlowCanvas.jsx
│   │   │   │
│   │   │   └── nodes/
│   │   │
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   ├── styles/
│   │   ├── utils/
│   │   │
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── README.md
└── .gitignore
```

The backend, shared contracts, documentation, and testing directories will be added during subsequent development phases.

## Installation and Setup

### Prerequisites

- Node.js
- npm
- Git
- Visual Studio Code

### 1. Clone the repository

```bash
git clone https://github.com/revanthofficial21/NexusFlow.git
```

### 2. Navigate into the project

```bash
cd NexusFlow
```

### 3. Navigate into the frontend

```bash
cd client
```

### 4. Install dependencies

```bash
npm install
```

### 5. Start the development server

```bash
npm run dev
```

### 6. Open the application

```text
http://localhost:5173/
```

### 7. Set up the backend

In a second terminal:

```bash
cd server
cp .env.example .env      # set MONGODB_URI
npm install
npm run dev
```

The API listens on `http://localhost:5000`. On boot it connects to MongoDB and
creates the `telemetry` time-series collection if it does not exist, so there is no
manual database step.

Point the client at it by copying `client/.env.example` to `client/.env`.

## Running the Application

Two processes: the Vite dev server on port 5173 and the Express API on port 5000.

```bash
# terminal 1
cd server && npm run dev

# terminal 2
cd client && npm run dev
```

### API surface

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness plus MongoDB connection state |
| POST | `/api/telemetry/ingest` | Ingest a single reading |
| POST | `/api/telemetry/batch` | Ingest up to 2000 readings |
| GET | `/api/telemetry/latest` | Latest readings; filters: `deviceId`, `startDate`, `endDate`, `limit` |
| GET | `/api/telemetry/history` | Paginated readings: `page`, `limit`, `deviceId` |
| GET | `/api/telemetry/device-status` | Online/offline per device, its latest readings, and the total reading count: `minutes` window |
| GET | `/api/telemetry/export` | CSV download: `deviceId`, `startDate`, `endDate` |
| GET | `/api/telemetry/stats` | Per-device rollup: readings, avg/max temperature and humidity, last seen |
| POST | `/api/compiler/parse` | Validate a graph and report the execution plan, without running it |

Graphs are DAGs, not chains: one sensor can feed several branches (an average into
a threshold and a raw alert, say), and a node with several inputs merges them. The
parse endpoint reports `branches` - every node with more than one outgoing edge.
| POST | `/api/compiler/execute` | Compile and run a graph against sample readings |
| GET/POST/PUT/DELETE | `/api/pipelines` | Saved pipeline CRUD, each with a `running` flag |
| GET | `/api/alerts` | Alert history, newest first; filters: `limit`, `ruleId`, `acknowledged` |
| PATCH | `/api/alerts/:id/ack` | Acknowledge an alert |

`GET /api/health` returns `503` when MongoDB is disconnected, so it is safe to use
as a real health check.

### Tests

```bash
npm test              # from the repository root, or: cd server && npm test
```

Covers graph validation (including cycles), the RxJS operators, and telemetry
validation. CI runs the same suite plus a client build on every pull request.

### Ingestion benchmark

```bash
cd server && npm run bench        # 5,000 writes/sec for 10s
RATE=10000 DURATION=20 npm run bench
```

Reports achieved writes/sec and p50/p95 batch latency, and exits non-zero if the
target is missed. Read the storage footprint separately with `db.telemetry.stats()`
in mongosh.

### Live pipelines

Saving a pipeline compiles it immediately: ingestion publishes each stored point
onto one shared RxJS subject, and every saved rule subscribes to the readings for
its sensor node's `deviceId`. Rules are recompiled at boot from MongoDB, so they
survive a restart. `GET /api/pipelines` reports `running` per pipeline and
`suppressedAlerts` for each.

Pausing: `PUT /api/pipelines/:id` with `{"enabled": false}` stops a rule without
deleting it - it keeps its graph and its alert history but holds no subscription, so
it evaluates nothing until resumed. `GET /api/pipelines` reports `running`,
`enabled` and `suppressedAlerts` per rule, and the dashboard's Pause / Resume button
drives the same endpoint.

Alert throttling: a rule records at most one alert per `ALERT_COOLDOWN_MS`
(default 30s). Matches inside the window are counted, not silently dropped - the
count shows up as `suppressedAlerts` in the pipeline status. Without it, a stream
above the threshold would write an alert per point.

The dashboard shows a live chart for one device: the server broadcasts each stored
point into a `device:<id>` room and the client's `useTelemetry` hook joins it.

Edge activity: as a value crosses a node, the compiler reports the wire it left, so
the canvas can light that connection up. Events are capped at one per wire per
`EDGE_ACTIVITY_INTERVAL_MS` (default 100ms) - without the cap a 5,000 writes/sec
stream would emit 5,000 socket messages per second per wire.

### CI

Three jobs: server tests, client build, and an e2e job that starts a `mongo:7`
service container, boots the API against it, runs `scripts/smoke-test.js` and
records an ingestion benchmark at a reduced rate.

### Socket.IO

The API and the socket server share port 5000.

| Direction | Event | Payload |
| --- | --- | --- |
| client to server | `subscribe:device` | `{ deviceId }` |
| client to server | `unsubscribe:device` | `{ deviceId }` |
| server to client | `telemetry` | `{ deviceId, metric, value, timestamp }` for that device only |
| server to client | `alert` | the recorded alert document, broadcast to everyone |
| server to client | `edge:activity` | `{ ruleId, edgeId, nodeId }`, rate-limited per wire |

### Alerts

When a rule's alert node matches, the registry hands the alert to
`services/alertService`, which stores it in the `alerts` collection and broadcasts
it. `POST /api/compiler/execute` passes no alert handler, so a dry run never
writes an alert.

### Views

Three views share the same header: **Rule builder** (canvas, saved pipelines, live
chart, devices, alerts), **Dashboard** (a single device's live readings) and
**Overview** (rules, devices, readings and alerts at a glance, refreshed every 15s).

### Dashboard

The client shows three live views, all fed by what the API already exposes: a
telemetry chart for the selected device (Socket.IO `telemetry`), a device rollup
from `/api/telemetry/stats` where clicking a card switches the chart, and the alert
feed with an All / Unacknowledged filter and per-alert acknowledge.

### Ingest payload

```json
{
  "deviceId": "turbine-01",
  "deviceType": "temperature",
  "location": "Plant A",
  "temperature": 92.4,
  "humidity": 48,
  "pressure": 101.3,
  "timestamp": "2026-11-28T09:15:00Z"
}
```

`deviceId` and `deviceType` are required; at least one reading is required; every
reading must be a finite number. `timestamp` is optional — a device should send its
own, since the server clock is only a fallback, and a reading dated in the future is
rejected. Without it, every point in one batch shares the ingest millisecond, which
makes "the latest reading" ambiguous.

### Protecting the write path

`POST /api/telemetry/ingest` and `/batch` accept data from hardware, so they can be
locked with a shared key:

```bash
# server/.env
INGEST_API_KEY=some-long-random-string
```

Every write then needs `x-api-key: some-long-random-string`, compared in constant
time. Reads (`latest`, `history`, `stats`, `export`) stay open, so a dashboard can
poll without the secret. `npm run gen` sends the header automatically when
`INGEST_API_KEY` is in its environment. Left empty, writes are open and the server
prints a warning at boot.

### Environment variables

Numeric settings are parsed defensively: a typo falls back to the default and logs
which variable was ignored, rather than becoming `NaN`. That matters more than it
sounds - `NaN` makes every comparison false, so a mistyped `INGEST_BATCH_LIMIT` used
to remove the batch cap entirely instead of failing loudly.

| Variable | Default | Effect |
| --- | --- | --- |
| `PORT` | 5000 | HTTP + Socket.IO port |
| `MONGODB_URI` | - | required |
| `CLIENT_ORIGIN` | both loopback spellings | CORS allowlist, comma separated |
| `INGEST_API_KEY` | empty | when set, writes need `x-api-key` |
| `INGEST_BATCH_LIMIT` | 2000 | max points per `/batch` call |
| `EXPORT_MAX_ROWS` | 10000 | max rows in a CSV export |
| `TELEMETRY_RETENTION_DAYS` | 30 | time-series TTL, applied at creation and via `collMod` |
| `ALERT_COOLDOWN_MS` | 30000 | minimum gap between two alerts from one rule |
| `EDGE_ACTIVITY_INTERVAL_MS` | 100 | minimum gap between edge-activity events per wire |
| `SMS_PROVIDER` | `log` | `log` records, `fail` simulates an outage |

### Requirements

Node 20+ and MongoDB **5.2+** (the device-status rollup uses `$top`, added in 5.2).
The time-series collections themselves need 5.0+.

### Canvas warnings

The canvas flags a node that would fail validation while you build, instead of
letting you find out from a 400 on save: a node with no input, a source with nothing
downstream, an action node with an output, a webhook URL that is not http(s), a phone
number that is too short, a window size out of range. The toolbar shows how many need
attention, and the reason is the badge's tooltip.

The rules live in `client/src/services/graphWarnings.js` and mirror the server's
validator; `npm test` in `client/` covers them.

### Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - the two flows, module by module,
  and why the compiler builds a DAG
- [`docs/GRAPH_FORMAT.md`](docs/GRAPH_FORMAT.md) - the canvas/server contract: node
  types, their parameters, and the rules both sides enforce

### See it running

With MongoDB configured and the server started:

```bash
cd server
npm run seed     # creates the Turbine Temperature Monitoring rule
npm run gen      # posts readings at 5/sec, with an occasional spike
```

The generator is a mock sensor: a slow sine wave around 72°C with noise and a 2%
chance of a spike, so a threshold rule fires every so often instead of never. Knobs:
`RATE`, `DEVICE`, `DURATION` (0 = until Ctrl+C), `SPIKE`, `LOCATION`, `BASE_URL`.

Readings carry temperature, humidity and pressure; all three are charted, rolled up
per device by `/api/telemetry/stats` and included in the CSV export.

### End-to-end check

With MongoDB configured and the server running in another terminal:

```bash
cd server && node scripts/smoke-test.js
```

Exercises ingestion, batch ingest, latest readings and the full pipeline CRUD
cycle against the real database - the paths the unit tests deliberately avoid
because they never touch MongoDB. Exits non-zero on any failure.

## Visual Rule Builder

The initial pipeline demonstrates how different processing nodes can be connected.

### Available node types

**Data Source**

Represents an IoT device or sensor that provides telemetry.

Example: Turbine temperature sensor.

**Moving Average**

Represents a rolling-average operation over a configurable sample window.

**Threshold**

Represents a condition that compares an incoming value against a configured threshold.

**SMS Alert**

Represents a notification action that will be triggered when the configured condition is satisfied.

**Webhook**

POSTs (or PUTs/PATCHes) the matched value as JSON to a URL you configure. Delivery
never blocks the pipeline and has a 3 second timeout per attempt.

Transient failures are retried: network errors, 5xx and 429 get three attempts with
a 200ms then 500ms backoff. A 4xx is not retried - repeating a malformed request
just repeats the rejection. A successful delivery is silent; a failure after the
final attempt is recorded as a critical alert on the `webhook` channel, with the
status and attempt count, so a dead endpoint shows up in the alert history instead
of only in the server log.

**SMS**

Texts a phone number through `services/smsProvider.js`. The default provider logs
the message and reports success, so no account or credit is needed for the demo;
set `SMS_PROVIDER=fail` to exercise the failure path. Templates support
`{{deviceId}}`, `{{metric}}`, `{{value}}` and `{{time}}`. The delivery outcome is
recorded on the alert, so the history shows whether the text actually went out.

Outbound actions - webhook and SMS - only fire for a **live** pipeline. A dry run
through `/api/compiler/execute` reports the results without posting or texting
anybody.

## Example IoT Pipeline

A sample turbine temperature monitoring workflow:

```text
Turbine Sensor
      |
      v
Moving Average
      |
      v
Threshold Check
      |
      v
SMS Alert
```

Example configuration:

| Parameter | Value |
|---|---|
| Device | Turbine Sensor |
| Measurement | Temperature |
| Moving Average Window | 5 samples |
| Threshold | 80°C |
| Comparison | Greater than |
| Action | SMS Alert |

The intended behavior is to trigger an alert when the moving-average temperature exceeds the configured threshold.

## Team Responsibilities

| Team Member | Role | Responsibilities |
|---|---|---|
| Revanth | Project Lead & Backend Stream Compiler Developer | Architecture, RxJS compiler, dynamic rule execution, backend integration |
| Naseema | Database & IoT Backend Developer | MongoDB Time-Series, schemas, telemetry ingestion |
| Vivek | Frontend Developer & Visual Graph Builder | React, React Flow, canvas, graph serialization |
| Janakirani Venkatesan | Node Library & Dashboard Developer | Custom nodes, charts, alerts visualization |

## Development Roadmap

### Week 1 – Foundation

- [x] GitHub repository creation.
- [x] Git branch setup for project lead.
- [x] React + Vite initialization.
- [x] Frontend dependency installation.
- [x] Frontend folder structure creation.
- [x] NexusFlow dashboard foundation.
- [x] React Flow canvas implementation.
- [x] Initial custom nodes.
- [x] Interactive Node Library interface.

Remaining Week 1 tasks:

- [ ] MongoDB Time-Series collection setup.
- [ ] Express telemetry ingestion API.
- [ ] Sensor data generator.
- [ ] Frontend graph serialization.

### Week 2 – Logic Compiler

- [ ] Graph JSON validation.
- [ ] Node registry implementation.
- [ ] RxJS stream compiler.
- [ ] Moving-average operator.
- [ ] Threshold operator.
- [ ] Dynamic pipeline execution.
- [ ] Ingestion performance benchmark.

### Week 3 – Live Rule Execution

- [ ] Connect telemetry to RxJS pipelines.
- [ ] Implement continuous rule evaluation.
- [ ] Integrate WebSocket telemetry.
- [ ] Build live charts.
- [ ] Display pipeline execution status.

### Week 4 – Alerting and Final Integration

- [ ] Implement webhook actions.
- [ ] Integrate mock SMS notifications.
- [ ] Add visual execution feedback.
- [ ] Optimize stream processing.
- [ ] Complete integration testing.
- [ ] Prepare final project demonstration.

## Future Enhancements

- Advanced visual programming nodes.
- Multiple sensor and device integrations.
- Custom mathematical operations.
- Conditional branching.
- Multiple alert channels.
- Rule execution history.
- User authentication and role-based access.
- Workspace and pipeline management.
- Advanced telemetry analytics.
- Production deployment and monitoring.

---

## Project Information

**Project Name:** NexusFlow

**Category:** Full-Stack Development / IoT / Real-Time Data Processing

**Project Type:** Team-Based Development Project

**Repository:** https://github.com/revanthofficial21/NexusFlow

**Development Status:** Initial Frontend Implementation

**Primary Objective:** Building a visual IoT telemetry platform with a dynamic, user-defined rule engine.
