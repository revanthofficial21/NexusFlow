import { Handle, Position } from '@xyflow/react';
import type { ReactNode } from 'react';
import { getNodeDefinition } from '../../../shared/nodeRegistry.ts';
import type { NodeTraceSnapshot, SupportedNodeType } from '../../../shared/types.ts';

interface BaseTelemetryNodeProps {
  id: string;
  nodeType: SupportedNodeType;
  selected?: boolean;
  title?: string;
  summaryRows: Array<{ label: string; value: string }>;
  trace?: NodeTraceSnapshot;
  hasError?: boolean;
  footerNote?: string;
  children?: ReactNode;
}

const CATEGORY_DOT: Record<string, string> = {
  source: 'bg-sky-600',
  transform: 'bg-indigo-600',
  logic: 'bg-amber-600',
  sink: 'bg-rose-600',
};

export function BaseTelemetryNode({
  nodeType,
  selected,
  title,
  summaryRows,
  trace,
  hasError,
  footerNote,
}: BaseTelemetryNodeProps) {
  const def = getNodeDefinition(nodeType);
  if (!def) return null;

  const borderClass = hasError
    ? 'border-red-500 ring-2 ring-red-500/20'
    : selected
    ? 'border-sky-600 ring-2 ring-sky-600/20'
    : 'border-slate-200 hover:border-slate-300';

  return (
    <div
      className={`w-[248px] rounded-xl border bg-white text-slate-900 shadow-sm transition-colors ${borderClass}`}
    >
      {def.inputs.map((input, idx) => (
        <Handle
          key={input.id}
          id={input.id}
          type="target"
          position={Position.Left}
          style={{
            top: def.inputs.length === 1 ? '50%' : `${35 + idx * 30}%`,
            backgroundColor: '#0284c7',
          }}
          title={input.label}
        />
      ))}

      <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[def.category] ?? 'bg-slate-400'}`}
          />
          <span className="truncate font-display text-xs font-semibold text-slate-900">
            {title || def.label}
          </span>
        </div>
        <span className="shrink-0 text-[11px] font-medium capitalize text-slate-500">
          {def.category}
        </span>
      </div>

      <div className="space-y-1.5 px-3.5 py-2.5">
        {summaryRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-slate-500">{row.label}</span>
            <span className="truncate font-mono text-xs font-medium text-slate-800 tabular-nums">
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {trace && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-3.5 py-2 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Last Output</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {trace.lastPacket.value}
              {trace.lastPacket.unit ? ` ${trace.lastPacket.unit}` : ''}
              {trace.lastPacket.evaluationStatus
                ? ` · ${trace.lastPacket.evaluationStatus}`
                : ''}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-slate-500">
            <span>Processed</span>
            <span className="font-mono tabular-nums">{trace.processedCount}</span>
          </div>
        </div>
      )}

      {footerNote && (
        <div className="border-t border-slate-100 px-3.5 py-1.5 text-[11px] text-slate-500">
          {footerNote}
        </div>
      )}

      {def.outputs.map((output, idx) => (
        <Handle
          key={output.id}
          id={output.id}
          type="source"
          position={Position.Right}
          style={{
            top: def.outputs.length === 1 ? '50%' : `${35 + idx * 30}%`,
            backgroundColor: '#0f172a',
          }}
          title={output.label}
        />
      ))}
    </div>
  );
}
