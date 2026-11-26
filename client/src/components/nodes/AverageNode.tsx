import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../services/graphSerializer.ts';
import { BaseTelemetryNode } from './BaseTelemetryNode.tsx';
import type { CustomNodeRuntimeProps } from './SensorNode.tsx';

export function AverageNode({
  id,
  data,
  selected,
}: NodeProps & { data: FlowNodeData & CustomNodeRuntimeProps }) {
  const cfg = data.config ?? {};
  return (
    <BaseTelemetryNode
      id={id}
      nodeType="average"
      selected={selected}
      title={data.label}
      trace={data.trace}
      hasError={data.hasError}
      summaryRows={[
        { label: 'Mode', value: 'Tumbling Batch' },
        { label: 'Sample Count', value: `${String(cfg.sampleCount ?? 10)} readings` },
      ]}
    />
  );
}

