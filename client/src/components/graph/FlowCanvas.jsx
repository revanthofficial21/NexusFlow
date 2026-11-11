
import { useCallback } from "react";
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

import "@xyflow/react/dist/style.css";

const nodeStyle = {
  borderRadius: "12px",
  padding: "15px",
  minWidth: "165px",
  color: "#fff",
  fontWeight: "600",
  border: "1px solid #475569",
};

function SensorNode({ data }) {
  return (
    <div style={{ ...nodeStyle, background: "#1d4ed8" }}>
      <Handle type="source" position={Position.Right} />
      <div>🌡️ Data Source</div>
      <small>{data.label}</small>
      <p>{data.value}</p>
    </div>
  );
}

function MovingAverageNode({ data }) {
  return (
    <div style={{ ...nodeStyle, background: "#7c3aed" }}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div>📊 Moving Average</div>
      <small>{data.label}</small>
    </div>
  );
}

function ThresholdNode({ data }) {
  return (
    <div style={{ ...nodeStyle, background: "#b45309" }}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div>⚙️ Threshold</div>
      <small>{data.label}</small>
      <p>{data.condition}</p>
    </div>
  );
}

function AlertNode({ data }) {
  return (
    <div style={{ ...nodeStyle, background: "#be123c" }}>
      <Handle type="target" position={Position.Left} />
      <div>🚨 SMS Alert</div>
      <small>{data.label}</small>
    </div>
  );
}

const nodeTypes = {
  sensor: SensorNode,
  average: MovingAverageNode,
  threshold: ThresholdNode,
  alert: AlertNode,
};

const initialNodes = [
  {
    id: "1",
    type: "sensor",
    position: { x: 50, y: 150 },
    data: {
      label: "Turbine Sensor",
      value: "Temperature: 85°C",
    },
  },
  {
    id: "2",
    type: "average",
    position: { x: 310, y: 150 },
    data: { label: "Window: 5 samples" },
  },
  {
    id: "3",
    type: "threshold",
    position: { x: 570, y: 150 },
    data: {
      label: "Temperature",
      condition: "Greater than 80°C",
    },
  },
  {
    id: "4",
    type: "alert",
    position: { x: 830, y: 150 },
    data: { label: "Manager Notification" },
  },
];

const initialEdges = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e2-3", source: "2", target: "3", animated: true },
  { id: "e3-4", source: "3", target: "4", animated: true },
];

const library = [
  {
    type: "sensor",
    name: "Data Source",
    description: "Receive IoT sensor data",
    icon: "🌡️",
    color: "#1d4ed8",
  },
  {
    type: "average",
    name: "Moving Average",
    description: "Calculate rolling average",
    icon: "📊",
    color: "#7c3aed",
  },
  {
    type: "threshold",
    name: "Threshold",
    description: "Compare sensor values",
    icon: "⚙️",
    color: "#b45309",
  },
  {
    type: "alert",
    name: "SMS Alert",
    description: "Trigger notifications",
    icon: "🚨",
    color: "#be123c",
  },
];

export default function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState(initialNodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection) => {
      setEdges((currentEdges) =>
        addEdge(
          { ...connection, animated: true },
          currentEdges
        )
      );
    },
    [setEdges]
  );

  const addNode = useCallback(
    (item) => {
      const id = `node-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}`;

      const newNode = {
        id,
        type: item.type,
        position: {
          x: 100 + (nodes.length % 3) * 80,
          y: 350 + Math.floor(nodes.length / 3) * 100,
        },
        data: {
          label:
            item.type === "sensor"
              ? "New Sensor"
              : item.type === "average"
              ? "Window: 5 samples"
              : item.type === "threshold"
              ? "New Condition"
              : "New Notification",

          value:
            item.type === "sensor"
              ? "Temperature: 25°C"
              : undefined,

          condition:
            item.type === "threshold"
              ? "Greater than 80°C"
              : undefined,
        },
      };

      setNodes((currentNodes) => [...currentNodes, newNode]);
    },
    [nodes.length, setNodes]
  );

  return (
    <div className="flow-workspace">
      <aside className="node-library">
        <h3>NODE LIBRARY</h3>
        <p>Add components to your pipeline</p>

        {library.map((item) => (
          <button
            key={item.type}
            className="library-node"
            onClick={() => addNode(item)}
            style={{ borderLeft: `4px solid ${item.color}` }}
          >
            <span className="library-icon">{item.icon}</span>

            <span className="library-details">
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </span>

            <span className="add-icon">+</span>
          </button>
        ))}

        <div className="library-tip">
          <strong>Tip</strong>
          <p>
            Add nodes and connect their handles to
            create your IoT data pipeline.
          </p>
        </div>
      </aside>

      <div className="flow-canvas-area">
        <div className="canvas-toolbar">
          <span>{nodes.length} Nodes</span>
          <span>{edges.length} Connections</span>
          <button
            onClick={() => {
              setNodes(initialNodes);
              setEdges(initialEdges);
            }}
          >
            Reset Canvas
          </button>
        </div>

        <div className="flow-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background color="#64748b" gap={20} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
