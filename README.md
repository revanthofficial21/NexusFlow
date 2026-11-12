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

## Running the Application

The frontend currently runs independently using the Vite development server.

The backend and MongoDB integration will be configured in upcoming development phases.

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
