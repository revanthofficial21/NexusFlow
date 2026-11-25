
import { useState } from "react";
import FlowCanvas from "./components/graph/FlowCanvas";
import Dashboard from "./components/dashboard/dashboard";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("builder");

  return (
    <div className="app">
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
          Frontend Ready
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <h3>WORKSPACE</h3>

          <button
            className={`nav-item ${activePage === "builder" ? "active" : ""}`}
            onClick={() => setActivePage("builder")}
          >
            ⌘ Rule Builder
          </button>

          <button
            className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}
            onClick={() => setActivePage("dashboard")}
          >
            ▦ Dashboard
          </button>

          <div className="nav-item">◉ Devices</div>
          <div className="nav-item">⚡ Telemetry</div>
          <div className="nav-item">♧ Alerts</div>

          <div className="sidebar-bottom">
            <span className="status-dot"></span>
            Backend connection pending
          </div>
        </aside>

        <main className="main-content">
          {activePage === "dashboard" ? (
            <Dashboard />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <h1>Visual Rule Builder</h1>
                  <p>
                    Build and manage your IoT data pipelines visually.
                  </p>
                </div>
              </div>

              <div className="pipeline-info">
                <div>
                  <span className="label">PIPELINE NAME</span>
                  <h3>Turbine Temperature Monitoring</h3>
                </div>

                <div className="pipeline-status">
                  <span className="status-dot"></span>
                  Draft Pipeline
                </div>
              </div>

              <div className="canvas-heading">
                <h3>Pipeline Canvas</h3>
                <span>Add nodes and connect them</span>
              </div>

              <section className="canvas-container">
                <FlowCanvas />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
