
import { useCallback, useEffect, useState } from "react";

import FlowCanvas from "./components/graph/FlowCanvas";
import { executeGraph } from "./services/compilerService";

import {
  savePipeline,
  getPipelines,
  getPipelineById,
  updatePipeline,
  deletePipeline,
} from "./services/pipelineService";

import "./App.css";

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

  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineMessage, setPipelineMessage] = useState("");
  const [pipelineError, setPipelineError] = useState("");

  // Backend and execution state
  const [loading, setLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionError, setExecutionError] = useState("");
  const [backendConnected, setBackendConnected] = useState(false);

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

  // Automatically fetch pipelines when dashboard opens
  useEffect(() => {
    loadSavedPipelines();
  }, [loadSavedPipelines]);

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

      const result = await savePipeline({
        name: pipelineName.trim(),
        description: pipelineDescription,
        nodes: graph.nodes,
        edges: graph.edges,
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

      await updatePipeline(selectedPipelineId, {
        name: pipelineName.trim(),
        description: pipelineDescription,
        nodes: graph.nodes,
        edges: graph.edges,
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

      setSelectedPipelineId("");
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

    setLoading(true);
    setExecutionResult(null);
    setExecutionError("");

    // Temporary sample sensor readings
    const sensorData = [90, 100, 110, 120];

    try {
      const result = await executeGraph(
        graph.nodes,
        graph.edges,
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

          <div className="nav-item active">
            ⌘ Rule Builder
          </div>

          <div className="nav-item">▦ Dashboard</div>
          <div className="nav-item">◉ Devices</div>
          <div className="nav-item">⚡ Telemetry</div>
          <div className="nav-item">♧ Alerts</div>

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
              <h1>Visual Rule Builder</h1>
              <p>
                Build and manage your IoT data pipelines visually.
              </p>
            </div>
          </div>

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

        </main>
      </div>
    </div>
  );
}

export default App;
