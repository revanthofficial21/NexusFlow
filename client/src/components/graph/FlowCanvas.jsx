
import { useCallback, useEffect, useState } from "react";

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

// Sensor Node
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

// Moving Average Node
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

// Threshold Node
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

// Alert Node
function AlertNode({ data }) {
  return (
    <div style={{ ...nodeStyle, background: "#be123c" }}>
      <Handle type="target" position={Position.Left} />
      <div>🚨 SMS Alert</div>
      <small>{data.label}</small>
    </div>
  );
}

// React Flow mutates the node objects it is given (selected, measured, position),
// so the module-level arrays must never be handed to it directly.
const cloneNodes = (list) =>
  list.map((node) => ({
    ...node,
    position: { ...node.position },
    data: { ...node.data },
  }));

const cloneEdges = (list) => list.map((edge) => ({ ...edge }));

const nodeTypes = {
  sensor: SensorNode,
  average: MovingAverageNode,
  threshold: ThresholdNode,
  alert: AlertNode,
};

// Initial graph
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
    data: {
      label: "Window: 3 samples",
      windowSize: 3,
    },
  },
  {
    id: "3",
    type: "threshold",
    position: { x: 570, y: 150 },
    data: {
      label: "Temperature",
      condition: "Greater than 105°C",
      threshold: 105,
      operator: "greaterThan",
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

const initialEdges = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e2-3", source: "2", target: "3", animated: true },
  { id: "e3-4", source: "3", target: "4", animated: true },
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

export default function FlowCanvas({
  onGraphChange,
  initialGraph,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    cloneNodes(initialGraph?.nodes ?? initialNodes)
  );

  const [edges, setEdges, onEdgesChange] = useEdgesState(
    cloneEdges(initialGraph?.edges ?? initialEdges)
  );

  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const selectedNode = nodes.find(
    (node) => node.id === selectedNodeId
  );

  // Send graph data to App.jsx
  useEffect(() => {
    onGraphChange?.(nodes, edges);
  }, [nodes, edges, onGraphChange]);

  // Connect nodes
  const onConnect = useCallback(
    (connection) => {
      // A node cannot feed itself, and the same wire twice is a mistake, not a
      // feature. Both were accepted and only rejected later by the backend.
      if (connection.source === connection.target) return;

      setEdges((currentEdges) => {
        const duplicate = currentEdges.some(
          (edge) =>
            edge.source === connection.source &&
            edge.target === connection.target
        );

        if (duplicate) return currentEdges;

        return addEdge(
          { ...connection, animated: true },
          currentEdges
        );
      });
    },
    [setEdges]
  );

  // Update selected node properties
  const updateNodeData = (field, value) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== selectedNodeId) {
          return node;
        }

        const updatedData = {
          ...node.data,
          [field]: value,
        };

        if (field === "windowSize") {
          updatedData.label = `Window: ${value} samples`;
        }

        if (field === "threshold" || field === "operator") {
          const operator = updatedData.operator || "greaterThan";
          const threshold = updatedData.threshold ?? 105;

          const operatorLabels = {
            greaterThan: "Greater than",
            lessThan: "Less than",
            equal: "Equal to",
          };

          updatedData.condition =
            `${operatorLabels[operator]} ${threshold}°C`;
        }

        return {
          ...node,
          data: updatedData,
        };
      })
    );
  };

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
          x: 100 + (nodes.length % 3) * 80,
          y: 350 + Math.floor(nodes.length / 3) * 100,
        },
        data: {
          label:
            item.type === "sensor"
              ? "New Sensor"
              : item.type === "average"
              ? "Window: 3 samples"
              : item.type === "threshold"
              ? "New Condition"
              : "New Notification",

          value:
            item.type === "sensor"
              ? "Temperature: 25°C"
              : undefined,

          windowSize:
            item.type === "average" ? 3 : undefined,

          threshold:
            item.type === "threshold" ? 105 : undefined,

          operator:
            item.type === "threshold"
              ? "greaterThan"
              : undefined,

          condition:
            item.type === "threshold"
              ? "Greater than 105°C"
              : undefined,
        },
      };

      setNodes((currentNodes) => [
        ...currentNodes,
        newNode,
      ]);

      setSelectedNodeId(id);
    },
    [nodes.length, setNodes]
  );

  // Reset canvas to default graph
  const resetCanvas = () => {
    setNodes(cloneNodes(initialNodes));
    setEdges(cloneEdges(initialEdges));
    setSelectedNodeId(null);
  };

  return (
    <div className="flow-workspace">

      {/* Node Library and Properties */}
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

        {/* Node Properties */}
        <div className="properties-panel">
          <h3>NODE PROPERTIES</h3>

          {!selectedNode && (
            <p>Select a node to edit its properties.</p>
          )}

          {selectedNode?.type === "average" && (
            <>
              <label>Moving Average Window Size</label>

              <input
                type="number"
                min="1"
                max="100"
                value={selectedNode.data.windowSize ?? 3}
                onChange={(event) =>
                  updateNodeData(
                    "windowSize",
                    Math.min(
                      100,
                      Math.max(1, Number(event.target.value) || 1)
                    )
                  )
                }
              />

              <small>
                Number of sensor readings used to calculate
                the rolling average.
              </small>
            </>
          )}

          {selectedNode?.type === "threshold" && (
            <>
              <label>Comparison Operator</label>

              <select
                value={
                  selectedNode.data.operator || "greaterThan"
                }
                onChange={(event) =>
                  updateNodeData("operator", event.target.value)
                }
              >
                <option value="greaterThan">
                  Greater Than (&gt;)
                </option>

                <option value="lessThan">
                  Less Than (&lt;)
                </option>

                <option value="equal">
                  Equal To (=)
                </option>
              </select>

              <label>Threshold Value</label>

              <input
                type="number"
                value={selectedNode.data.threshold ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;

                  // Clearing the field used to store Number("") === 0, which
                  // turned the rule into "alert on everything positive".
                  updateNodeData(
                    "threshold",
                    raw === "" ? null : Number(raw)
                  );
                }}
              />

              <small>
                Values are compared against this threshold.
              </small>
            </>
          )}

          {(selectedNode?.type === "sensor" ||
            selectedNode?.type === "alert") && (
            <p>
              Properties for this node will be configurable
              in a later step.
            </p>
          )}
        </div>
      </aside>

      {/* Graph Canvas */}
      <div className="flow-canvas-area">
        <div className="canvas-toolbar">
          <span>{nodes.length} Nodes</span>
          <span>{edges.length} Connections</span>

          <button onClick={resetCanvas}>
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
            onNodeClick={(_, node) =>
              setSelectedNodeId(node.id)
            }
            onPaneClick={() => setSelectedNodeId(null)}
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
