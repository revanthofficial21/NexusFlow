
function Dashboard() {
  const nodeTypes = [
    "Sensor",
    "Average",
    "Moving Average",
    "Threshold",
    "Alert",
    "Webhook",
  ];

  const overview = [
    {
      title: "Pipelines",
      value: "1",
      description: "1 draft pipeline in workspace",
    },
    {
      title: "Backend",
      value: "Pending",
      description: "Server connection not configured",
    },
    {
      title: "Telemetry",
      value: "Waiting",
      description: "Live sensor data not connected",
    },
    {
      title: "Alerts",
      value: "Not active",
      description: "Alert execution is not configured",
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1>Dashboard Overview</h1>
          <p>Monitor your IoT workspace and pipeline configuration.</p>
        </div>
      </div>

      <div className="dashboard-cards">
        {overview.map((item) => (
          <div className="dashboard-card" key={item.title}>
            <p className="dashboard-card-title">{item.title}</p>
            <h2>{item.value}</h2>
            <p className="dashboard-card-description">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <h2>Recent Pipeline</h2>
          <span className="dashboard-status">Draft</span>
        </div>

        <div className="pipeline-card">
          <div>
            <h3>Turbine Temperature Monitoring</h3>
            <p>Visual IoT telemetry pipeline</p>
          </div>
          <span className="dashboard-status">Not deployed</span>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Node Library</h2>
        <p className="dashboard-section-description">
          Available building blocks in the visual rule builder.
        </p>

        <div className="node-library-grid">
          {nodeTypes.map((node) => (
            <div className="node-library-item" key={node}>
              <span className="node-library-dot"></span>
              {node}
            </div>
          ))}
        </div>
      </section>

      <p className="dashboard-note">
        Dashboard preview: live metrics will be available after backend,
        database, and telemetry integration.
      </p>
    </div>
  );
}

export default Dashboard;

