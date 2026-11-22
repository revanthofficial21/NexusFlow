
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

// Common node styling
const nodeStyle = {
  borderRadius: "12px",
  padding: "15px",
  minWidth: "165px",
  color: "#ffffff",
  fontWeight: "600",
  border: "1px solid #475569",
};

// Common connection handle styling
const handleStyle = {
  width: 12,
  height: 12,
  background: "#ffffff",
  border: "2px solid #9333ea",
  borderRadius: "50%",
};

// Sensor Node
function SensorNode({ data }) {
  return (
    <div style={{ ...nodeStyle, background: "#1d4ed8" }}>
      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle}
      />
      <div>🌡️ Data Source</div>
      <small>{data.label}</small>
      <p>{data.value}</p>
    </div>
  );
}

// Average Node
function AverageNode({ data }) {
  return (
    <div style={{ ...nodeStyle, background: "#0f766e" }}>
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle}
      />
      <div>📈 Average</div>
      <small>{data.label}</small>
    </div>
  );
}

// Moving Average Node
function MovingAverageNode({ data }) {
  return (
    <div style={{ ...nodeStyle, background: "#7c3aed" }}>
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle}
      />
      <div>📊 Moving Average</div>
      <small>{data.label}</small>
    </div>
  );
}

// Threshold Node
function ThresholdNode({ data }) {
  return (
    <div style={{ ...nodeStyle, background: "#b45309" }}>
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle}
      />
      <div>⚙️ Threshold</div>
      <small>{data.label}</small>
      <p>{data.condition}</p>
    </div>
  );
}

// SMS Alert Node
function AlertNode({ data }) {
  return (
    <div style={{ ...nodeStyle, background: "#be123c" }}>
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
      />
      <div>🚨 SMS Alert</div>
      <small>{data.label}</small>
    </div>
  );
}

// Webhook Node
function WebhookNode({ data }) {
  return (
    <div style={{ ...nodeStyle, background: "#9333ea" }}>
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle}
      />
      <div>🔗 Webhook</div>
      <small>{data.label}</small>
    </div>
  );
}

// Register node types
const nodeTypes = {
  sensor: SensorNode,
  average: AverageNode,
  movingAverage: MovingAverageNode,
  threshold: ThresholdNode,
  alert: AlertNode,
  webhook: WebhookNode,
};

// Initial pipeline nodes
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
    type: "movingAverage",
    position: { x: 310, y: 150 },
    data: {
      label: "Window: 5 samples",
    },
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
    data: {
      label: "Manager Notification",
    },
  },
];

// Initial pipeline connections
const initialEdges = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    animated: true,
  },
  {
    id: "e2-3",
    source: "2",
    target: "3",
    animated: true,
  },
  {
    id: "e3-4",
    source: "3",
    target: "4",
    animated: true,
  },
];

// Node library
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
    name: "Average",
    description: "Calculate average values",
    icon: "📈",
    color: "#0f766e",
  },
  {
    type: "movingAverage",
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
  {
    type: "webhook",
    name: "Webhook",
    description: "Send HTTP notifications",
    icon: "🔗",
    color: "#9333ea",
  },
];

// Default data for each node
function getNodeData(type) {
  switch (type) {
    case "sensor":
      return {
        label: "New Sensor",
        value: "Temperature: 25°C",
      };

    case "average":
      return {
        label: "Calculate Average",
      };

    case "movingAverage":
      return {
        label: "Window: 5 samples",
      };

    case "threshold":
      return {
        label: "New Condition",
        condition: "Greater than 80°C",
      };

    case "alert":
      return {
        label: "New Notification",
      };

    case "webhook":
      return {
        label: "New Webhook Action",
      };

    default:
      return {
        label: "New Node",
      };
  }
}

// Convert React Flow graph into a clean JSON structure
function serializeGraph(nodes, edges) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: {
        x: node.position.x,
        y: node.position.y,
      },
      data: { ...node.data },
    })),

    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      animated: edge.animated ?? false,
    })),
  };
}

// Main Flow Canvas
export default function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState(initialNodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState(initialEdges);

  const [showJSON, setShowJSON] = useState(false);

  // Generate graph JSON
  const graphJSON = JSON.stringify(
    serializeGraph(nodes, edges),
    null,
    2
  );

  // Download graph JSON
  const downloadJSON = useCallback(() => {
    const json = JSON.stringify(
      serializeGraph(nodes, edges),
      null,
      2
    );

    const blob = new Blob([json], {
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
  }, [nodes, edges]);

  // Handle node connections
  const onConnect = useCallback(
    (connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            animated: true,
          },
          currentEdges
        )
      );
    },
    [setEdges]
  );

  // Add new node
  const addNode = useCallback(
    (item) => {
      const id = `node-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}`;

      const newNode = {
        id,
        type: item.type,
        position: {
          x: 80 + (nodes.length % 3) * 260,
          y: 350 + Math.floor(nodes.length / 3) * 170,
        },
        data: getNodeData(item.type),
      };

      setNodes((currentNodes) => [
        ...currentNodes,
        newNode,
      ]);
    },
    [nodes.length, setNodes]
  );

  // Reset pipeline
  const resetCanvas = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [setNodes, setEdges]);

  return (
    <div className="flow-workspace">

      {/* Node Library */}
      <aside className="node-library">
        <h3>NODE LIBRARY</h3>

        <p>Add components to your pipeline</p>

        {library.map((item) => (
          <button
            key={item.type}
            className="library-node"
            onClick={() => addNode(item)}
            style={{
              borderLeft: `4px solid ${item.color}`,
            }}
          >
            <span className="library-icon">
              {item.icon}
            </span>

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

      {/* Pipeline Canvas */}
      <div className="flow-canvas-area">

        {/* Canvas Toolbar */}
        <div className="canvas-toolbar">
          <span>{nodes.length} Nodes</span>
          <span>{edges.length} Connections</span>

          <button onClick={resetCanvas}>
            Reset Canvas
          </button>

          <button onClick={downloadJSON}>
            Download Graph JSON
          </button>

          <button
            onClick={() =>
              setShowJSON((previous) => !previous)
            }
          >
            {showJSON ? "Hide Graph JSON" : "View Graph JSON"}
          </button>
        </div>

        {/* React Flow */}
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
            <Background
              color="#64748b"
              gap={20}
            />

            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Graph JSON Preview */}
        {showJSON && (
          <pre
            style={{
              marginTop: "12px",
              padding: "15px",
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: "8px",
              maxHeight: "300px",
              overflow: "auto",
              fontSize: "12px",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {graphJSON}
          </pre>
        )}
      </div>
    </div>
  );
}
