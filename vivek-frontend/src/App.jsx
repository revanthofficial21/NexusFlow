
import { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import {
  Activity, Bell, Boxes, ChevronDown, CircleHelp,
  Database, GitBranch, LayoutDashboard, Play,
  Plus, Search, Settings, Workflow, Zap, Save,
  Clock3, CheckCircle2, Menu
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import "./App.css";

const initialNodes = [
  { id: "1", type: "custom", position: { x: 100, y: 130 }, data: { label: "MongoDB Source", subtitle: "Database input", icon: "database", color: "#a78bfa" } },
  { id: "2", type: "custom", position: { x: 390, y: 130 }, data: { label: "Stream Processor", subtitle: "Process incoming data", icon: "activity", color: "#38bdf8" } },
  { id: "3", type: "custom", position: { x: 680, y: 130 }, data: { label: "Threshold Check", subtitle: "Evaluate conditions", icon: "zap", color: "#fbbf24" } },
  { id: "4", type: "custom", position: { x: 970, y: 130 }, data: { label: "SMS Alert", subtitle: "Send notification", icon: "bell", color: "#fb7185" } },
];

const initialEdges = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e2-3", source: "2", target: "3", animated: true },
  { id: "e3-4", source: "3", target: "4", animated: true },
];

function CustomNode({ data }) {
  const icons = {
    database: Database,
    activity: Activity,
    zap: Zap,
    bell: Bell,
  };
  const Icon = icons[data.icon] || Boxes;

  return (
    <div className="workflow-node">
      <Handle type="target" position={Position.Left} />
      <div className="node-icon" style={{ color: data.color, background: `${data.color}18` }}>
        <Icon size={19} />
      </div>
      <div className="node-info">
        <strong>{data.label}</strong>
        <span>{data.subtitle}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [active, setActive] = useState("Workflow Builder");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");

  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  );

  const addNode = () => {
    const id = `${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "custom",
        position: { x: 160 + Math.random() * 350, y: 300 + Math.random() * 180 },
        data: { label: "New Data Node", subtitle: "Configure this node", icon: "activity", color: "#38bdf8" },
      },
    ]);
    setNotice("New node added to canvas");
  };

  const showNotice = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 2500);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Workflow size={23} /></div>
          <span>Nexus<span className="brand-light">Flow</span></span>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        {[
          [LayoutDashboard, "Overview"],
          [Workflow, "Workflow Builder"],
          [Database, "Data Sources"],
          [Activity, "Executions"],
        ].map(([Icon, label]) => (
          <button key={label} className={`nav-item ${active === label ? "selected" : ""}`} onClick={() => setActive(label)}>
            <Icon size={18} /> {label}
          </button>
        ))}

        <div className="workspace-label tools-label">PREFERENCES</div>
        <button className="nav-item" onClick={() => showNotice("Settings coming soon")}><Settings size={18} /> Settings</button>
        <button className="nav-item" onClick={() => showNotice("Help center coming soon")}><CircleHelp size={18} /> Help Center</button>

        <div className="sidebar-bottom">
          <div className="plan-card">
            <div className="plan-icon"><Zap size={17} /></div>
            <strong>Build something great</strong>
            <span>Your workflows, connected.</span>
          </div>
          <div className="user-profile">
            <div className="avatar">N</div>
            <div><strong>Naseema</strong><span>Developer</span></div>
            <ChevronDown size={16} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><Menu size={18} /><span>Workspace</span><span className="slash">/</span><strong>{active}</strong></div>
          <div className="top-actions">
            <button className="icon-button" onClick={() => showNotice("You're all caught up")}><Bell size={18} /></button>
            <div className="top-avatar">N</div>
          </div>
        </header>

        <section className="content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">YOUR DATA, IN MOTION</div>
              <h1>{active === "Workflow Builder" ? "Workflow Builder" : active}</h1>
              <p>Design, connect and monitor your data pipelines.</p>
            </div>
            <button className="primary-button" onClick={() => showNotice("New workflow created")}>
              <Plus size={17} /> New Workflow
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-top"><span>Total Workflows</span><Workflow size={18} /></div><strong>24</strong><small className="positive">↗ 12% <span>vs last month</span></small></div>
            <div className="stat-card"><div className="stat-top"><span>Active Pipelines</span><Activity size={18} /></div><strong>08</strong><small className="positive">↗ 2 <span>this week</span></small></div>
            <div className="stat-card"><div className="stat-top"><span>Data Sources</span><Database size={18} /></div><strong>12</strong><small className="muted">Connected sources</small></div>
            <div className="stat-card"><div className="stat-top"><span>Successful Runs</span><CheckCircle2 size={18} /></div><strong>1,284</strong><small className="positive">↗ 8.4% <span>success rate</span></small></div>
          </div>

          <div className="builder-heading">
            <div>
              <h2>Live Pipeline</h2>
              <p>Build your workflow by connecting nodes</p>
            </div>
            <div className="builder-actions">
              <button className="secondary-button" onClick={() => showNotice("Workflow saved locally")}><Save size={16} /> Save</button>
              <button className="primary-button" onClick={() => { setRunning(!running); showNotice(running ? "Workflow stopped" : "Workflow started"); }}>
                <Play size={15} /> {running ? "Stop" : "Run Workflow"}
              </button>
            </div>
          </div>

          <div className="canvas-toolbar">
            <div className="canvas-title"><span className={`status-dot ${running ? "live" : ""}`}></span> Customer Analytics Pipeline <span className="draft-tag">{running ? "RUNNING" : "DRAFT"}</span></div>
            <div className="canvas-tools">
              <button onClick={addNode}><Plus size={15} /> Add Node</button>
              <button onClick={() => showNotice("Search nodes coming soon")}><Search size={15} /> Search</button>
            </div>
          </div>

          <div className="flow-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              deleteKeyCode={["Backspace", "Delete"]}
            >
              <Background color="#283347" gap={22} size={1} />
              <Controls />
              <MiniMap nodeColor="#64748b" maskColor="rgba(8,13,24,0.7)" />
            </ReactFlow>
          </div>

          <div className="bottom-info">
            <div><GitBranch size={16} /> <span>{nodes.length} nodes</span><span className="info-separator">·</span><span>{edges.length} connections</span></div>
            <div><Clock3 size={15} /> Last edited just now</div>
          </div>
        </section>
      </main>

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}
