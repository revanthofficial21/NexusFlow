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

import "@xyflow/react/dist/style.css";

// ------------------------------------
// Shared node styles
// ------------------------------------

const nodeStyle = {
  minWidth: "170px",
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #475569",
  background: "#1e293b",
  color: "#f8fafc",
  fontSize: "13px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
};

const titleStyle = {
  fontWeight: "700",
  fontSize: "14px",
  marginBottom: "7px",
};

const descriptionStyle = {
  color: "#cbd5e1",
  fontSize: "11px",
};

// ------------------------------------
// Custom Nodes
// ------------------------------------

function SensorNode({ data }) {
  return (
    <div style={{ ...nodeStyle, borderColor: "#38bdf8" }}>
      <Handle type="source" position={Position.Bottom} />
      <div style={titleStyle}>🌡️ {data.label || "Data Source"}</div>
      <div style={descriptionStyle}>
        {data.description || "Receives sensor telemetry"}
      </div>
    </div>
  );
}

function AverageNode({ data }) {
  return (
    <div style={{ ...nodeStyle, borderColor: "#a78bfa" }}>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <div style={titleStyle}>📊 {data.label || "Average"}</div>
      <div style={descriptionStyle}>
        {data.description || "Calculates average values"}
      </div>
    </div>
  );
}

function MovingAverageNode({ data }) {
  return (
    <div style={{ ...nodeStyle, borderColor: "#a78bfa" }}>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <div style={titleStyle}>
        📈 {data.label || "Moving Average"}
      </div>
      <div style={descriptionStyle}>
        {data.description || "Smooths incoming sensor values"}
      </div>
    </div>
  );
}

function ThresholdNode({ data }) {
  return (
    <div style={{ ...nodeStyle, borderColor: "#facc15" }}>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <div style={titleStyle}>⚖️ {data.label || "Threshold"}</div>
      <div style={descriptionStyle}>
        {data.description || "Checks values against a limit"}
      </div>
    </div>
  );
}

function AlertNode({ data }) {
  return (
    <div style={{ ...nodeStyle, borderColor: "#fb7185" }}>
      <Handle type="target" position={Position.Top} />
      <div style={titleStyle}>🚨 {data.label || "SMS Alert"}</div>
      <div style={descriptionStyle}>
        {data.description || "Alert action node"}
      </div>
    </div>
  );
}

function WebhookNode({ data }) {
  return (
    <div style={{ ...nodeStyle, borderColor: "#34d399" }}>
      <Handle type="target" position={Position.Top} />
      <div style={titleStyle}>🔗 {data.label || "Webhook"}</div>
      <div style={descriptionStyle}>
        {data.description || "Sends data to an external endpoint"}
      </div>
    </div>
  );
}

// ------------------------------------
// Node type registration
// ------------------------------------

const nodeTypes = {
  sensor: SensorNode,
  average: AverageNode,
  movingAverage: MovingAverageNode,
  threshold: ThresholdNode,
  alert: AlertNode,
  webhook: WebhookNode,
};

// ------------------------------------
// Initial graph
// ------------------------------------

const initialNodes = [
  {
    id: "sensor-1",
    type: "sensor",
    position: { x: 250, y: 40 },
    data: {
      label: "Temperature Sensor",
      description: "Receives temperature data",
    },
  },
  {
    id: "moving-average-1",
    type: "movingAverage",
    position: { x: 250, y: 180 },
    data: {
      label: "Moving Average",
      description: "Smooths sensor readings",
    },
  },
  {
    id: "threshold-1",
    type: "threshold",
    position: { x: 250, y: 320 },
    data: {
      label: "Threshold",
      description: "Checks temperature limit",
    },
  },
  {
    id: "alert-1",
    type: "alert",
    position: { x: 250, y: 460 },
    data: {
      label: "SMS Alert",
      description: "Alert when limit is exceeded",
    },
  },
];

const initialEdges = [
  {
    id: "edge-1",
    source: "sensor-1",
    target: "moving-average-1",
    animated: true,
  },
  {
    id: "edge-2",
    source: "moving-average-1",
    target: "threshold-1",
    animated: true,
  },
  {
    id: "edge-3",
    source: "threshold-1",
    target: "alert-1",
    animated: true,
  },
];

// ------------------------------------
// Node library
// ------------------------------------

const libraryItems = [
  {
    type: "sensor",
    label: "Data Source",
    description: "Sensor input",
    icon: "🌡️",
  },
  {
    type: "average",
    label: "Average",
    description: "Average calculation",
    icon: "📊",
  },
  {
    type: "movingAverage",
    label: "Moving Average",
    description: "Smooth data stream",
    icon: "📈",
  },
  {
    type: "threshold",
    label: "Threshold",
    description: "Compare against a limit",
    icon: "⚖️",
  },
  {
    type: "alert",
    label: "SMS Alert",
    description: "Alert action",
    icon: "🚨",
  },
  {
    type: "webhook",
    label: "Webhook",
    description: "External endpoint",
    icon: "🔗",
  },
];

// ------------------------------------
// Graph serialization
// ------------------------------------

export function serializeGraph(nodes, edges) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: {
        x: node.position.x,
        y: node.position.y,
      },
      data: node.data || {},
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
      animated: Boolean(edge.animated),
    })),
  };
}

// ------------------------------------
// Main Flow Canvas Component
// ------------------------------------

export default function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState(initialNodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState(initialEdges);

  const [showJSON, setShowJSON] = useState(false);

  const onConnect = useCallback(
    (connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "#38bdf8" },
          },
          currentEdges
        )
      );
    },
    [setEdges]
  );

  // Add a node from the library
  const addNode = useCallback(
    (item) => {
      const newNode = {
        id: `${item.type}-${Date.now()}`,
        type: item.type,
        position: {
          x: 180 + Math.random() * 200,
          y: 100 + nodes.length * 45,
        },
        data: {
          label: item.label,
          description: item.description,
        },
      };

      setNodes((currentNodes) => [...currentNodes, newNode]);
    },
    [nodes.length, setNodes]
  );

  // Reset canvas
  const resetCanvas = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [setNodes, setEdges]);

  // Prepare graph JSON
  const graphData = serializeGraph(nodes, edges);
  const graphJSON = JSON.stringify(graphData, null, 2);

  // Download graph JSON
  const downloadJSON = useCallback(() => {
    const blob = new Blob([graphJSON], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "nexusflow-pipeline.json";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [graphJSON]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: "600px",
        background: "#0f172a",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "14px",
          background: "#1e293b",
          borderBottom: "1px solid #334155",
        }}
      >
        <div>
          <div
            style={{
              color: "#f8fafc",
              fontWeight: "700",
              fontSize: "15px",
            }}
          >
            Visual Pipeline Builder
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: "11px",
              marginTop: "4px",
            }}
          >
            Create and connect your IoT workflow nodes
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => setShowJSON((current) => !current)}
            style={buttonStyle}
          >
            {showJSON ? "Hide JSON" : "View JSON"}
          </button>

          <button onClick={downloadJSON} style={buttonStyle}>
            Download Graph JSON
          </button>

          <button onClick={resetCanvas} style={resetButtonStyle}>
            Reset Canvas
          </button>
        </div>
      </div>

      {/* Main workspace */}
      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: "450px",
        }}
      >
        {/* Node Library */}
        <aside
          style={{
            width: "190px",
            minWidth: "170px",
            padding: "14px",
            background: "#1e293b",
            borderRight: "1px solid #334155",
            overflowY: "auto",
          }}
        >
          <h3
            style={{
              color: "#f8fafc",
              fontSize: "13px",
              margin: "0 0 14px",
            }}
          >
            Node Library
          </h3>

          {libraryItems.map((item) => (
            <button
              key={item.type}
              onClick={() => addNode(item)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px",
                marginBottom: "9px",
                borderRadius: "8px",
                border: "1px solid #475569",
                background: "#0f172a",
                color: "#f8fafc",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: "600" }}>
                {item.icon} {item.label}
              </div>

              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "10px",
                  marginTop: "4px",
                }}
              >
                {item.description}
              </div>
            </button>
          ))}
        </aside>

        {/* React Flow Canvas */}
        <div style={{ flex: 1, minWidth: 0, minHeight: "450px" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background color="#475569" gap={20} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case "sensor":
                    return "#38bdf8";
                  case "average":
                  case "movingAverage":
                    return "#a78bfa";
                  case "threshold":
                    return "#facc15";
                  case "alert":
                    return "#fb7185";
                  case "webhook":
                    return "#34d399";
                  default:
                    return "#64748b";
                }
              }}
              maskColor="rgba(15, 23, 42, 0.7)"
            />
          </ReactFlow>
        </div>
      </div>

      {/* JSON Preview */}
      {showJSON && (
        <div
          style={{
            padding: "14px",
            background: "#020617",
            borderTop: "1px solid #334155",
            maxHeight: "260px",
            overflow: "auto",
          }}
        >
          <div
            style={{
              color: "#38bdf8",
              fontWeight: "700",
              fontSize: "12px",
              marginBottom: "10px",
            }}
          >
            Pipeline JSON
          </div>

          <pre
            style={{
              color: "#cbd5e1",
              fontSize: "11px",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              margin: 0,
            }}
          >
            {graphJSON}
          </pre>
        </div>
      )}
    </div>
  );
}

// ------------------------------------
// Button styles
// ------------------------------------

const buttonStyle = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #475569",
  background: "#334155",
  color: "#f8fafc",
  fontSize: "11px",
  cursor: "pointer",
};

const resetButtonStyle = {
  ...buttonStyle,
  background: "#7f1d1d",
  borderColor: "#991b1b",
};
