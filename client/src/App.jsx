
import { useCallback, useEffect, useState } from "react";
import TelemetryDashboard from "./components/telemetry/TelemetryDashboard";
import FlowCanvas from "./components/graph/FlowCanvas";
import { executeGraph } from "./services/compilerService";
<<<<<<< HEAD
import { serializeGraph } from "./services/graphService";
import { useAlerts } from "./hooks/useAlerts";
import { useTelemetry } from "./hooks/useTelemetry";
import { useEdgeActivity } from "./hooks/useEdgeActivity";
import TelemetryChart from "./components/TelemetryChart";
import DevicesPanel from "./components/DevicesPanel";

=======
>>>>>>> 83fa7ae (feat: add telemetry dashboard)
import {
  savePipeline,
  getPipelines,
  getPipelineById,
  updatePipeline,
  deletePipeline,
} from "./services/pipelineService";
import "./App.css";

function App() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [canvasInitialGraph, setCanvasInitialGraph] = useState(null);
  const [canvasKey, setCanvasKey] = useState(0);

  const [pipelineName, setPipelineName] = useState(
    "Turbine Temperature Monitoring"
  );
  const [pipelineDescription, setPipelineDescription] = useState("");

  const [savedPipelines, setSavedPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineMessage, setPipelineMessage] = useState("");
  const [pipelineError, setPipelineError] = useState("");

  const [loading, setLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionError, setExecutionError] = useState("");
  const [backendConnected, setBackendConnected] = useState(false);

<<<<<<< HEAD
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
=======
  const [activePage, setActivePage] = useState("rule-builder");

  // Data Sources demo state
  const [dataSources, setDataSources] = useState([
    {
      id: 1,
      name: "Main MongoDB",
      type: "MongoDB",
      host: "localhost:27017",
      status: "Connected",
    },
    {
      id: 2,
      name: "IoT MQTT Broker",
      type: "MQTT",
      host: "mqtt.example.com",
      status: "Disconnected",
    },
  ]);

  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("MongoDB");
  const [sourceHost, setSourceHost] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [editingSourceId, setEditingSourceId] = useState(null);

>>>>>>> 83fa7ae (feat: add telemetry dashboard)
  const handleGraphChange = useCallback((nodes, edges) => {
    setGraph({ nodes, edges });
    setExecutionResult(null);
    setExecutionError("");
  }, []);

  const fetchSavedPipelines = useCallback(async () => {
    const result = await getPipelines();
    setSavedPipelines(result.pipelines || []);
    setBackendConnected(true);
    return result;
  }, []);

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

  useEffect(() => {
    loadSavedPipelines();
  }, [loadSavedPipelines]);

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

      if (!pipeline) throw new Error("Pipeline data not found.");

      const restoredGraph = {
        nodes: pipeline.nodes || [],
        edges: pipeline.edges || [],
      };

      setPipelineName(pipeline.name);
      setPipelineDescription(pipeline.description || "");
      setCanvasInitialGraph(restoredGraph);
      setGraph(restoredGraph);
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

  const handleExecute = async () => {
    if (graph.nodes.length === 0) {
      setExecutionError("No graph nodes available.");
      return;
    }

    setLoading(true);
    setExecutionResult(null);
    setExecutionError("");

    const sensorData = [90, 100, 110, 120];

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

  // Data Sources are currently frontend demo data.
  // They are not persisted to MongoDB.
  const handleAddSource = () => {
    if (!sourceName.trim() || !sourceHost.trim()) {
      alert("Please enter source name and host.");
      return;
    }

    if (editingSourceId) {
      setDataSources((sources) =>
        sources.map((source) =>
          source.id === editingSourceId
            ? {
                ...source,
                name: sourceName.trim(),
                type: sourceType,
                host: sourceHost.trim(),
                status: "Disconnected",
              }
            : source
        )
      );

      setEditingSourceId(null);
    } else {
      setDataSources((sources) => [
        ...sources,
        {
          id: Date.now(),
          name: sourceName.trim(),
          type: sourceType,
          host: sourceHost.trim(),
          status: "Disconnected",
        },
      ]);
    }

    setSourceName("");
    setSourceHost("");
    setSourceType("MongoDB");
  };

  const handleEditSource = (source) => {
    setEditingSourceId(source.id);
    setSourceName(source.name);
    setSourceType(source.type);
    setSourceHost(source.host);
  };

  const handleDeleteSource = (id) => {
    if (window.confirm("Delete this data source?")) {
      setDataSources((sources) =>
        sources.filter((source) => source.id !== id)
      );

      if (editingSourceId === id) {
        setEditingSourceId(null);
        setSourceName("");
        setSourceHost("");
        setSourceType("MongoDB");
      }
    }
  };

  // Demo only: this changes the displayed status.
  // It does not contact a real device.
  const handleTestConnection = (id) => {
    setDataSources((sources) =>
      sources.map((source) =>
        source.id === id
          ? { ...source, status: "Connected" }
          : source
      )
    );
  };

  const filteredDataSources = dataSources.filter((source) =>
    `${source.name} ${source.type} ${source.host}`
      .toLowerCase()
      .includes(sourceSearch.toLowerCase())
  );

  return (
    <div className="app">
      {/* Header */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">N</span>

          <div>
            <h2>NexusFlow</h2>
            <p>Visual IoT Telemetry &amp; Rule Engine</p>
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

          <button
            className={`nav-item ${
              activePage === "rule-builder" ? "active" : ""
            }`}
            onClick={() => setActivePage("rule-builder")}
          >
            ⌘ Rule Builder
          </button>

          <button
            className={`nav-item ${
              activePage === "data-sources" ? "active" : ""
            }`}
            onClick={() => setActivePage("data-sources")}
          >
            ▦ Data Sources
          </button>

          <div className="nav-item">▦ Dashboard</div>
          <div className="nav-item">◉ Devices</div>

          <button
            className={`nav-item ${
              activePage === "telemetry" ? "active" : ""
            }`}
            onClick={() => setActivePage("telemetry")}
          >
            ⚡ Telemetry
          </button>

          <div className="nav-item">♧ Alerts</div>

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
          {activePage === "telemetry" ? (
            <TelemetryDashboard />
          ) : activePage === "data-sources" ? (
            <section className="data-sources-page">
              <div className="page-heading">
                <div>
                  <h1>Data Sources</h1>
                  <p>
                    Manage and monitor your connected data sources.
                  </p>
                </div>
              </div>

              <div className="pipeline-manager">
                <h3>
                  {editingSourceId
                    ? "EDIT DATA SOURCE"
                    : "ADD DATA SOURCE"}
                </h3>

<<<<<<< HEAD
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
=======
                <div className="pipeline-form">
                  <label>Source Name</label>
>>>>>>> 83fa7ae (feat: add telemetry dashboard)

                  <input
                    type="text"
                    placeholder="Enter source name"
                    value={sourceName}
                    onChange={(event) =>
                      setSourceName(event.target.value)
                    }
                  />

                  <label>Source Type</label>

                  <select
                    value={sourceType}
                    onChange={(event) =>
                      setSourceType(event.target.value)
                    }
                  >
                    <option>MongoDB</option>
                    <option>MQTT</option>
                    <option>HTTP/REST</option>
                  </select>

                  <label>Host / URL</label>

                  <input
                    type="text"
                    placeholder="Enter host or URL"
                    value={sourceHost}
                    onChange={(event) =>
                      setSourceHost(event.target.value)
                    }
                  />

                  <div className="pipeline-actions">
                    <button onClick={handleAddSource}>
                      {editingSourceId
                        ? "Update Source"
                        : "Add Source"}
                    </button>

<<<<<<< HEAD
                <button
                  onClick={handleUpdatePipeline}
                  disabled={
                    pipelineLoading || !selectedPipelineId
                  }
                >
                  ✏️ Update
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
                {savedPipelines.length} pipelines saved in MongoDB
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
=======
                    {editingSourceId && (
                      <button
                        onClick={() => {
                          setEditingSourceId(null);
                          setSourceName("");
                          setSourceHost("");
                          setSourceType("MongoDB");
                        }}
                      >
                        Cancel
                      </button>
                    )}
>>>>>>> 83fa7ae (feat: add telemetry dashboard)
                  </div>
                </div>
              </div>

              <input
                className="source-search"
                placeholder="Search data sources..."
                value={sourceSearch}
                onChange={(event) =>
                  setSourceSearch(event.target.value)
                }
              />

              <div className="source-grid">
                {filteredDataSources.map((source) => (
                  <article
                    className="source-card"
                    key={source.id}
                  >
                    <h3>{source.name}</h3>
                    <p>{source.type}</p>
                    <p>{source.host}</p>

                    <span
                      className={`source-status ${source.status.toLowerCase()}`}
                    >
                      {source.status}
                    </span>

                    <div className="source-actions">
                      <button
                        onClick={() =>
                          handleTestConnection(source.id)
                        }
                      >
                        Test Connection
                      </button>

                      <button
                        onClick={() => handleEditSource(source)}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          handleDeleteSource(source.id)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}

                {filteredDataSources.length === 0 && (
                  <p>No data sources found.</p>
                )}
              </div>
            </section>
          ) : (
            <>
              {/* Rule Builder Page */}
              <div className="page-heading">
                <div>
                  <h1>Visual Rule Builder</h1>
                  <p>
                    Build and manage your IoT data pipelines visually.
                  </p>
                </div>
              </div>

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
                      setSelectedPipelineId(event.target.value);
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
                    {savedPipelines.length} pipelines saved in MongoDB
                  </p>
                </div>
              </section>

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

              <div className="canvas-heading">
                <div>
                  <h3>Pipeline Canvas</h3>
                  <span>Drag nodes and connect them</span>
                </div>

                <button
                  className="primary-button"
                  onClick={handleExecute}
                  disabled={
                    loading || graph.nodes.length === 0
                  }
                >
                  {loading
                    ? "Executing..."
                    : "▶ Execute Pipeline"}
                </button>
              </div>

              <section className="canvas-container">
                <FlowCanvas
                  key={canvasKey}
                  initialGraph={canvasInitialGraph}
                  onGraphChange={handleGraphChange}
                />
              </section>

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
                    {backendConnected
                      ? "Connected"
                      : "Not verified"}
                  </strong>
                  <span>Backend</span>
                </div>
              </div>

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
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
