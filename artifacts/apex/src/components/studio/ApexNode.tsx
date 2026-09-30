import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { NODE_DEF_MAP } from "./nodeDefinitions";

export interface ApexNodeData {
  nodeType: string;
  config: Record<string, string | number | boolean>;
  isActive?: boolean;
  isCompleted?: boolean;
  hasError?: boolean;
  output?: string;
  [key: string]: unknown;
}

interface ApexNodeProps {
  id: string;
  data: ApexNodeData;
  selected: boolean;
}

export const ApexNode = memo(function ApexNode({ id, data, selected }: ApexNodeProps) {
  const def = NODE_DEF_MAP[data.nodeType];
  if (!def) return null;

  const { isActive, isCompleted, hasError } = data;
  const outputPorts = def.outputLabels ?? (def.outputs > 0 ? ["out"] : []);

  const borderColor = isActive
    ? "#A29BFE"
    : hasError
    ? "#f87171"
    : isCompleted
    ? def.color
    : selected
    ? def.color
    : "rgba(255,255,255,0.08)";

  const glowStyle: React.CSSProperties = isActive
    ? { boxShadow: `0 0 0 1px ${def.color}80, 0 0 20px ${def.color}50, 0 0 40px ${def.color}20` }
    : isCompleted
    ? { boxShadow: `0 0 0 1px ${def.color}40, 0 4px 16px ${def.color}15` }
    : selected
    ? { boxShadow: `0 0 0 1.5px ${def.color}60` }
    : { boxShadow: "0 2px 12px rgba(0,0,0,0.5)" };

  const previewValue = def.fields[0] ? String(data.config[def.fields[0].key] ?? "").slice(0, 32) : null;

  return (
    <div
      className="relative rounded-xl overflow-visible"
      style={{
        width: 176,
        background: isActive
          ? `linear-gradient(135deg, ${def.bgColor}, rgba(0,0,0,0.8))`
          : "rgba(8,12,22,0.95)",
        border: `1.5px solid ${borderColor}`,
        transition: "all 0.25s ease",
        ...glowStyle,
      }}
    >
      {/* Active pulse ring */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-xl animate-ping pointer-events-none"
          style={{ background: `${def.color}08`, border: `1px solid ${def.color}30` }}
        />
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-xl"
        style={{ background: `${def.bgColor}`, borderBottom: `1px solid ${def.color}15` }}
      >
        <span className="text-sm">{def.icon}</span>
        <span className="text-white text-[11px] font-bold leading-tight flex-1 truncate">{def.label}</span>
        <span
          className="text-[8px] font-black px-1 py-0.5 rounded flex-shrink-0"
          style={{ background: `${def.color}25`, color: def.color }}
        >
          {def.category === "trigger" ? "TRG"
            : def.category === "logic" ? "LOG"
            : def.category === "ai" ? "AI"
            : def.category === "media" ? "MED"
            : def.category === "game" ? "GAME"
            : "OUT"}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-1.5 min-h-[26px]">
        {isActive && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: def.color }} />
            <span className="text-[9px] font-mono" style={{ color: def.color }}>Running...</span>
          </div>
        )}
        {isCompleted && data.output && !isActive ? (
          <p className="text-[9px] font-mono text-white/50 truncate">{data.output.slice(0, 35)}</p>
        ) : !isActive && previewValue ? (
          <p className="text-[9px] font-mono text-white/30 truncate">{previewValue}</p>
        ) : !isActive && !previewValue ? (
          <p className="text-[9px] italic text-white/15">—</p>
        ) : null}
      </div>

      {/* Completed checkmark */}
      {isCompleted && !isActive && (
        <div
          className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-black"
          style={{ background: def.color, color: "black" }}
        >
          ✓
        </div>
      )}

      {/* Input handle */}
      {def.inputs > 0 && (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          style={{
            width: 10,
            height: 10,
            background: "rgba(30,26,62,0.62)",
            border: `2px solid ${def.color}`,
            left: -5,
          }}
        />
      )}

      {/* Output handles */}
      {outputPorts.map((portLabel, i) => {
        const portColor =
          portLabel === "true" || portLabel === "win" ? "#4ade80"
          : portLabel === "false" || portLabel === "loss" ? "#f87171"
          : def.color;
        const topPct = outputPorts.length === 1 ? 50 : 30 + i * 40;
        return (
          <Handle
            key={portLabel}
            type="source"
            position={Position.Right}
            id={portLabel}
            style={{
              width: 10,
              height: 10,
              background: portColor,
              border: "2px solid rgba(0,0,0,0.6)",
              right: -5,
              top: `${topPct}%`,
            }}
            title={portLabel !== "out" ? portLabel : undefined}
          />
        );
      })}
    </div>
  );
});
