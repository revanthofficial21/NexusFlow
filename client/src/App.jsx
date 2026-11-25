
import { useCallback, useEffect, useState } from "react";

import FlowCanvas from "./components/graph/FlowCanvas";
import { executeGraph } from "./services/compilerService";
import { serializeGraph } from "./services/graphService";
import { useAlerts } from "./hooks/useAlerts";
import TelemetryDashboard from "./components/telemetry/TelemetryDashboard";
import OverviewDashboard from "./components/dashboard/OverviewDashboard";
import DevicesView from "./components/DevicesView";
import AlertsView from "./components/AlertsView";
import { NODE_LIBRARY } from "./components/graph/nodeLibrary";
import { useTelemetry } from "./hooks/useTelemetry";
import { useEdgeActivity } from "./hooks/useEdgeActivity";
import TelemetryChart from "./components/TelemetryChart";
import DevicesPanel from "./components/DevicesPanel";

import {
  savePipeline,
  getPipelines,
  getPipelineById,
  updatePipeline,
  deletePipeline,
} from "./services/pipelineService";

import "./App.css";

const PAGE_TITLES = {
  builder: {
    tab: "Rule builder",
    title: "Visual Rule Builder",
    subtitle: "Build and manage your IoT data pipelines visually.",
  },
  dashboard: {
    tab: "Dashboard",
    title: "Telemetry Dashboard",
    subtitle: "Live readings from the selected device.",
  },
  devices: {
    tab: "Devices",
    title: "Devices",
    subtitle: "What is reporting, and when it was last heard from.",
  },
  alerts: {
    tab: "Alerts",
    title: "Alerts",
    subtitle: "Every rule match, with acknowledge.",
  },
  overview: {
    tab: "Overview",
    title: "Workspace Overview",
    subtitle: "Rules, devices, data and alerts at a glance.",
  },
};

function App() {
  // Graph state
  const [graph, setGraph] = useState({
    nodes: [],
    edges: [],
  });

  const [canvasInitialGraph, setCanvasInitialGraph] = useState(null);
  const [canvasKey, setCanvasKey] = useState(0);

  // Pipeline information
  const [pipelineName, setPipelineName] = useState(
    "Turbine Temperature Monitoring"
  );

  const [pipelineDescription, setPipelineDescription] = useState("");

  // MongoDB pipeline state
  const [savedPipelines, setSavedPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [sensorDataInput, setSensorDataInput] = useState("90, 100, 110, 120");

  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineMessage, setPipelineMessage] = useState("");
  const [pipelineError, setPipelineError] = useState("");

  // Backend and execution state
  const [loading, setLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionError, setExecutionError] = useState("");
  const [backendConnected, setBackendConnected] = useState(false);

  // Two views: the rule builder, and the telemetry dashboard that arrived from
  // Vivek's branch.
  const [view, setView] = useState("builder");

  // Live rule matches, pushed over Socket.IO. "" = every alert, "false" = only
  // the ones nobody has acknowledged yet.
  const [alertFilter, setAlertFilter] = useState("");
  const {
    alerts: liveAlerts,
    connected: alertsConnected,
    acknowledge: acknowledgeAlert,
  } = useAlerts({ acknowledged: alertFilter || undefined });

  // Live chart: one device, fed by the telemetry socket room.
  const [chartDevice, setChartDevice] = useState("turbine-01");
  const { points: livePoints, connected: telemetryConnected } = useTelemetry({
    deviceId: chartDevice,
  });

  // Which wires are carrying data, for the canvas glow.
  const { activeEdges } = useEdgeActivity();

  // Receive graph updates from FlowCanvas
  const handleGraphChange = useCallback((nodes, edges) => {
    setGraph({ nodes, edges });
    setExecutionResult(null);
    setExecutionError("");
  }, []);

  // Fetch pipelines from MongoDB
  const fetchSavedPipelines = useCallback(async () => {
    const result = await getPipelines();

    setSavedPipelines(result.pipelines || []);
    setBackendConnected(true);

    return result;
  }, []);

  // Load saved pipelines
  const loadSavedPipelines = useCallback(async () => {
    try {
      setPipelineLoading(true);
      setPipelineError("");
      setPipelineMessage("");

      await fetchSavedPipelines();
    } catch (error) {
      setBackendConnected(false);

      setPipelineError(
        error.response?.data?.message ||
          error.message ||
          "Unable to retrieve saved pipelines."
      );
    } finally {
      setPipelineLoading(false);
    }
  }, [fetchSavedPipelines]);

  // Fetch the saved pipelines once on mount. State is set after the await, not
  // synchronously in the effect body, which would cascade renders.
  useEffect(() => {
    let cancelled = false;

    const loadOnMount = async () => {
      try {
        const result = await getPipelines();

        if (cancelled) return;

        setSavedPipelines(result.pipelines || []);
        setBackendConnected(true);
      } catch (error) {
        if (cancelled) return;

        setBackendConnected(false);
        setPipelineError(
          error.response?.data?.message ||
            error.message ||
            "Unable to retrieve saved pipelines."
        );
      }
    };

    loadOnMount();

    return () => {
      cancelled = true;
    };
  }, []);

  // Save a new pipeline
  const handleSavePipeline = async () => {
    if (!pipelineName.trim()) {
      setPipelineError("Please enter a pipeline name.");
      return;
    }

    if (graph.nodes.length === 0) {
      setPipelineError("Add nodes before saving the pipeline.");
      return;
    }

    try {
      setPipelineLoading(true);
      setPipelineError("");
      setPipelineMessage("");

      // Strip React Flow bookkeeping before it reaches the database.
      const serialized = serializeGraph(graph.nodes, graph.edges);

      const result = await savePipeline({
        name: pipelineName.trim(),
        description: pipelineDescription,
        nodes: serialized.nodes,
        edges: serialized.edges,
      });

      setPipelineMessage("Pipeline saved successfully!");

      if (result.pipeline?._id) {
        setSelectedPipelineId(result.pipeline._id);
      }

      await fetchSavedPipelines();
    } catch (error) {
      setPipelineError(
        error.response?.data?.message ||
          error.message ||
          "Unable to save pipeline."
      );
    } finally {
      setPipelineLoading(false);
    }
  };

  // Load a selected pipeline from MongoDB
  const handleLoadPipeline = async () => {
    if (!selectedPipelineId) {
      setPipelineError("Select a pipeline to load.");
      return;
    }

    try {
      setPipelineLoading(true);
      setPipelineError("");
      setPipelineMessage("");

      const result = await getPipelineById(selectedPipelineId);
      const pipeline = result.pipeline;

      if (!pipeline) {
        throw new Error("Pipeline data not found.");
      }

      const restoredGraph = {
        nodes: pipeline.nodes || [],
        edges: pipeline.edges || [],
      };

      setSelectedPipeline(pipeline);
      setPipelineName(pipeline.name);
      setPipelineDescription(pipeline.description || "");

      setCanvasInitialGraph(restoredGraph);
      setGraph(restoredGraph);

      // Remount React Flow with the loaded graph
      setCanvasKey((current) => current + 1);

      setExecutionResult(null);
      setExecutionError("");

      setPipelineMessage("Pipeline loaded successfully!");
      setBackendConnected(true);
    } catch (error) {
      setPipelineError(
        error.response?.data?.message ||
          error.message ||
          "Unable to load pipeline."
      );
    } finally {
      setPipelineLoading(false);
    }
  };

  // Update an existing pipeline
  const handleUpdatePipeline = async () => {
    if (!selectedPipelineId) {
      setPipelineError("Select a pipeline to update.");
      return;
    }

    if (!pipelineName.trim()) {
      setPipelineError("Pipeline name is required.");
      return;
    }

    if (graph.nodes.length === 0) {
      setPipelineError("Add nodes before updating the pipeline.");
      return;
    }

    try {
      setPipelineLoading(true);
      setPipelineError("");
      setPipelineMessage("");

      const serialized = serializeGraph(graph.nodes, graph.edges);

      await updatePipeline(selectedPipelineId, {
        name: pipelineName.trim(),
        description: pipelineDescription,
        nodes: serialized.nodes,
        edges: serialized.edges,
      });

      setPipelineMessage("Pipeline updated successfully!");

      await fetchSavedPipelines();
    } catch (error) {
      setPipelineError(
        error.response?.data?.message ||
          error.message ||
          "Unable to update pipeline."
      );
    } finally {
      setPipelineLoading(false);
    }
  };

  // Pause or resume the selected rule. A paused rule keeps its history and its
  // graph but holds no subscription, so it evaluates nothing until resumed.
  const handleToggleEnabled = async () => {
    if (!selectedPipelineId) return;

    const nextEnabled = selectedPipeline?.enabled === false;

    try {
      setPipelineLoading(true);
      setPipelineError("");
      setPipelineMessage("");

      const result = await updatePipeline(selectedPipelineId, {
        enabled: nextEnabled,
      });

      setPipelineMessage(
        nextEnabled ? "Rule resumed." : "Rule paused."
      );
      await fetchSavedPipelines();
      setSelectedPipeline(result.pipeline || null);
    } catch (error) {
      setPipelineError(
        error.response?.data?.message ||
          error.message ||
          "Unable to change the rule state."
      );
    } finally {
      setPipelineLoading(false);
    }
  };

  // Delete a pipeline
  const handleDeletePipeline = async () => {
    if (!selectedPipelineId) {
      setPipelineError("Select a pipeline to delete.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this pipeline?"
    );

    if (!confirmed) return;

    try {
      setPipelineLoading(true);
      setPipelineError("");
      setPipelineMessage("");

      await deletePipeline(selectedPipelineId);

      // The canvas still showed the deleted pipeline, and the next save silently
      // created a new one from that stale graph.
      setSelectedPipelineId("");
      setCanvasInitialGraph(null);
      setCanvasKey((current) => current + 1);
      setGraph({ nodes: [], edges: [] });
      setExecutionResult(null);
      setPipelineMessage("Pipeline deleted successfully!");

      await fetchSavedPipelines();
    } catch (error) {
      setPipelineError(
        error.response?.data?.message ||
          error.message ||
          "Unable to delete pipeline."
      );
    } finally {
      setPipelineLoading(false);
    }
  };

  // Execute the graph through the backend compiler
  const handleExecute = async () => {
    if (graph.nodes.length === 0) {
      setExecutionError("No graph nodes available.");
      return;
    }

    // The readings the rule is tested against. They used to be hardcoded to a
    // sample array, so a rule could only ever be tried on the same four numbers.
    const sensorData = sensorDataInput
      .split(/[,\s]+/)
      .filter((part) => part !== "")
      .map(Number);

    if (sensorData.length === 0 || sensorData.some((value) => !Number.isFinite(value))) {
      setExecutionError(
        "Readings must be numbers separated by commas, for example 90, 100, 110"
      );
      return;
    }

    setLoading(true);
    setExecutionResult(null);
    setExecutionError("");

    try {
      const serialized = serializeGraph(graph.nodes, graph.edges);

      const result = await executeGraph(
        serialized.nodes,
        serialized.edges,
        sensorData
      );

      setExecutionResult(result);
      setBackendConnected(true);
    } catch (error) {
      setBackendConnected(false);

      setExecutionError(
        error.response?.data?.message ||
          error.message ||
          "Pipeline execution failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">

      {/* Header */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">N</span>

          <div>
            <h2>NexusFlow</h2>
            <p>Visual IoT Telemetry & Rule Engine</p>
          </div>
        </div>

        <div className="header-status">
          <span className="status-dot"></span>
          Pipeline Workspace
        </div>
      </header>

      <div className="workspace">

        {/* Sidebar */}
        <aside className="sidebar">
          <h3>WORKSPACE</h3>

          {[
            { id: "builder", label: "⌘ Rule Builder" },
            { id: "dashboard", label: "▦ Dashboard" },
            { id: "devices", label: "◉ Devices" },
            { id: "alerts", label: "♧ Alerts" },
            { id: "overview", label: "▤ Overview" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${view === item.id ? " active" : ""}`}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              {item.label}
            </button>
          ))}

          <div className="alert-panel">
            <h3>
              LIVE ALERTS
              <span className={alertsConnected ? "dot-on" : "dot-off"} />
            </h3>

            <div className="alert-filters">
              <button
                className={alertFilter === "" ? "active" : ""}
                onClick={() => setAlertFilter("")}
              >
                All
              </button>
              <button
                className={alertFilter === "false" ? "active" : ""}
                onClick={() => setAlertFilter("false")}
              >
                Unacknowledged
              </button>
            </div>

            {liveAlerts.length === 0 ? (
              <p className="muted">No alerts yet.</p>
            ) : (
              <ul>
                {liveAlerts.map((alert, index) => (
                  <li key={alert._id || index}>
                    <strong>{alert.ruleName || "Rule"}</strong>
                    <span>{alert.message}</span>
                    <small>
                      {new Date(alert.at).toLocaleTimeString()}
                      {alert.acknowledged ? " · acknowledged" : ""}
                    </small>
                    {!alert.acknowledged && (
                      <button
                        className="ack-button"
                        onClick={() => acknowledgeAlert(alert)}
                      >
                        Acknowledge
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="sidebar-bottom">
            <span className="status-dot"></span>
            {backendConnected
              ? "Backend connected"
              : "Backend not yet verified"}
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">

          {/* Page Heading */}
          <div className="page-heading">
            <div>
              <h1>{PAGE_TITLES[view]?.title || "NexusFlow"}</h1>
              <p>{PAGE_TITLES[view]?.subtitle || ""}</p>
            </div>

            <div className="view-switch">
              {Object.entries(PAGE_TITLES).map(([id, page]) => (
                <button
                  key={id}
                  className={view === id ? "active" : ""}
                  onClick={() => setView(id)}
                >
                  {page.tab}
                </button>
              ))}
            </div>
          </div>

          {view === "dashboard" && <TelemetryDashboard deviceId={chartDevice} />}

          {view === "devices" && <DevicesView onSelect={setChartDevice} />}

          {view === "alerts" && <AlertsView />}

          {view === "overview" && <OverviewDashboard nodeTypes={NODE_LIBRARY} />}

          <div style={{ display: view === "builder" ? "block" : "none" }}>

          {/* Live telemetry */}
          <section className="live-panel">
            <div className="live-panel__head">
              <h3>LIVE TELEMETRY</h3>

              <div className="live-panel__controls">
                <span className={telemetryConnected ? "dot-on" : "dot-off"} />
                <input
                  type="text"
                  value={chartDevice}
                  onChange={(event) => setChartDevice(event.target.value)}
                  placeholder="device id"
                  aria-label="device id"
                />
                <span className="muted">{livePoints.length} points</span>

                <a
                  className="export-link"
                  href={`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/telemetry/export?deviceId=${encodeURIComponent(chartDevice)}`}
                  title="Download this device's readings as CSV"
                >
                  Export CSV
                </a>
              </div>
            </div>

            <TelemetryChart points={livePoints} />
          </section>

          {/* Devices */}
          <section className="live-panel">
            <div className="live-panel__head">
              <h3>DEVICES</h3>
              <span className="muted">pick one to chart it above</span>
            </div>

            <DevicesPanel onSelect={setChartDevice} />
          </section>

          {/* Pipeline Management */}
          <section className="pipeline-manager">
            <h3>PIPELINE MANAGEMENT</h3>

            <div className="pipeline-form">

              <label>Pipeline Name</label>

              <input
                type="text"
                value={pipelineName}
                onChange={(event) =>
                  setPipelineName(event.target.value)
                }
                placeholder="Enter pipeline name"
              />

              <label>Description</label>

              <input
                type="text"
                value={pipelineDescription}
                onChange={(event) =>
                  setPipelineDescription(event.target.value)
                }
                placeholder="Enter pipeline description"
              />

              <label>Saved Pipelines</label>

              <select
                value={selectedPipelineId}
                onChange={(event) => {
                  const id = event.target.value;

                  setSelectedPipelineId(id);
                  setSelectedPipeline(
                    savedPipelines.find((item) => item._id === id) || null
                  );
                  setPipelineError("");
                  setPipelineMessage("");
                }}
              >
                <option value="">
                  Select a saved pipeline
                </option>

                {savedPipelines.map((pipeline) => (
                  <option
                    key={pipeline._id}
                    value={pipeline._id}
                  >
                    {pipeline.name}
                  </option>
                ))}
              </select>

              {/* CRUD Actions */}
              <div className="pipeline-actions">

                <button
                  onClick={handleSavePipeline}
                  disabled={pipelineLoading}
                >
                  💾 Save New
                </button>

                <button
                  onClick={handleLoadPipeline}
                  disabled={
                    pipelineLoading || !selectedPipelineId
                  }
                >
                  📂 Load
                </button>

                <button
                  onClick={handleUpdatePipeline}
                  disabled={
                    pipelineLoading || !selectedPipelineId
                  }
                >
                  ✏️ Update
                </button>

                <button
                  onClick={handleToggleEnabled}
                  disabled={
                    pipelineLoading || !selectedPipelineId
                  }
                  title="A paused rule stays saved but evaluates nothing"
                >
                  {selectedPipeline?.enabled === false ? "▶️ Resume" : "⏸️ Pause"}
                </button>

                <button
                  onClick={handleDeletePipeline}
                  disabled={
                    pipelineLoading || !selectedPipelineId
                  }
                >
                  🗑️ Delete
                </button>

                <button
                  onClick={loadSavedPipelines}
                  disabled={pipelineLoading}
                >
                  ↻ Refresh
                </button>

              </div>

              {pipelineLoading && (
                <p>Processing pipeline request...</p>
              )}

              {pipelineMessage && (
                <p className="pipeline-success">
                  ✓ {pipelineMessage}
                </p>
              )}

              {pipelineError && (
                <p className="pipeline-error">
                  {pipelineError}
                </p>
              )}

              <p className="pipeline-count">
                {savedPipelines.length}{" "}
                {savedPipelines.length === 1 ? "pipeline" : "pipelines"} saved in
                MongoDB
              </p>

            </div>
          </section>

          {/* Pipeline Information */}
          <div className="pipeline-info">
            <div>
              <span className="label">PIPELINE NAME</span>
              <h3>{pipelineName}</h3>
            </div>

            <div className="pipeline-status">
              <span className="status-dot"></span>
              Draft Pipeline
            </div>
          </div>

          {/* Canvas Heading */}
          <div className="canvas-heading">
            <div>
              <h3>Pipeline Canvas</h3>
              <span>Drag nodes and connect them</span>
            </div>

            <label className="readings-input">
              <span>Test readings</span>
              <input
                type="text"
                value={sensorDataInput}
                onChange={(event) => setSensorDataInput(event.target.value)}
                placeholder="90, 100, 110"
                aria-label="test readings"
              />
            </label>

            <button
              className="primary-button"
              onClick={handleExecute}
              disabled={loading || graph.nodes.length === 0}
            >
              {loading
                ? "Executing..."
                : "▶ Execute Pipeline"}
            </button>
          </div>

          {/* React Flow */}
          <section className="canvas-container">
            <FlowCanvas
              key={canvasKey}
              initialGraph={canvasInitialGraph}
              onGraphChange={handleGraphChange}
              activeEdges={activeEdges}
            />
          </section>

          {/* Graph Statistics */}
          <div className="bottom-info">
            <div>
              <strong>{graph.nodes.length}</strong>
              <span>Nodes</span>
            </div>

            <div>
              <strong>{graph.edges.length}</strong>
              <span>Connections</span>
            </div>

            <div>
              <strong>
                {backendConnected ? "Connected" : "Not verified"}
              </strong>
              <span>Backend</span>
            </div>
          </div>

          {/* Execution Results */}
          <section
            style={{
              marginTop: "24px",
              padding: "20px",
              background: "#111827",
              border: "1px solid #334155",
              borderRadius: "12px",
              color: "#fff",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              Pipeline Execution Results
            </h3>

            {!executionResult &&
              !executionError &&
              !loading && (
                <p style={{ color: "#94a3b8" }}>
                  Click Execute Pipeline to run your graph.
                </p>
              )}

            {loading && (
              <p style={{ color: "#fbbf24" }}>
                Executing your IoT pipeline...
              </p>
            )}

            {executionError && (
              <div style={{ color: "#f87171" }}>
                <strong>Execution Failed</strong>
                <p>{executionError}</p>
              </div>
            )}

            {executionResult && (
              <div>
                <p style={{ color: "#4ade80" }}>
                  ✓ {executionResult.message}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "30px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>
                      {executionResult.inputCount}
                    </strong>
                    <p>Input readings</p>
                  </div>

                  <div>
                    <strong>
                      {executionResult.outputCount}
                    </strong>
                    <p>Output readings</p>
                  </div>
                </div>

                <h4>Processed Sensor Values</h4>

                <pre
                  style={{
                    background: "#020617",
                    padding: "14px",
                    borderRadius: "8px",
                    overflowX: "auto",
                    color: "#4ade80",
                  }}
                >
                  {JSON.stringify(
                    executionResult.results,
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
          </section>

          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
