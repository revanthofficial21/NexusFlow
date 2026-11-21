
import FlowCanvas from "./components/graph/FlowCanvas";
import "./App.css";

function App() {
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
          Frontend Ready
        </div>
      </header>

      <div className="workspace">

        {/* Sidebar */}
        <aside className="sidebar">
          <h3>WORKSPACE</h3>

          <div className="nav-item active">
            ⌘ Rule Builder
          </div>

          <div className="nav-item">
            ▦ Dashboard
          </div>

          <div className="nav-item">
            ◉ Devices
          </div>

          <div className="nav-item">
            ⚡ Telemetry
          </div>

          <div className="nav-item">
            ♧ Alerts
          </div>

          <div className="sidebar-bottom">
            <span className="status-dot"></span>
            Backend connection pending
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

          {/* Pipeline Information */}
          <div className="pipeline-info">
            <div>
              <span className="label">
                PIPELINE NAME
              </span>

              <h3>
                Turbine Temperature Monitoring
              </h3>
            </div>

            <div className="pipeline-status">
              <span className="status-dot"></span>
              Draft Pipeline
            </div>
          </div>

          {/* Canvas Heading */}
          <div className="canvas-heading">
            <h3>Pipeline Canvas</h3>

            <span>
              Add nodes and connect them
            </span>
          </div>

          {/* Pipeline Builder */}
          <section className="canvas-container">
            <FlowCanvas />
          </section>

        </main>
      </div>
    </div>
  );
}

export default App;
