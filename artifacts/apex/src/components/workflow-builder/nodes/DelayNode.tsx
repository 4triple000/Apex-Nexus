import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { type WorkflowAction } from "../types";

interface DelayNodeData {
  action: WorkflowAction;
  index: number;
}

export const DelayNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as DelayNodeData;
  const duration = Number((d.action.data as Record<string, unknown>)?.duration ?? 5);
  const unit = String((d.action.data as Record<string, unknown>)?.unit ?? "minutes");

  return (
    <div
      style={{
        background: selected ? "rgba(107,114,128,0.2)" : "#111",
        border: `2px dashed ${selected ? "#9ca3af" : "#374151"}`,
        borderRadius: 14,
        padding: "10px 16px",
        minWidth: 200,
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: selected
          ? "0 0 0 3px rgba(107,114,128,0.2), 0 8px 24px rgba(0,0,0,0.4)"
          : "0 4px 12px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "rgba(107,114,128,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        ⏱
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#6b7280", textTransform: "uppercase" }}>
          Delay
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db", marginTop: 2 }}>
          Wait {duration} {unit}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#374151", width: 10, height: 10, border: "2px solid #6b7280" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#374151", width: 10, height: 10, border: "2px solid #6b7280" }}
      />
    </div>
  );
});

DelayNode.displayName = "DelayNode";
