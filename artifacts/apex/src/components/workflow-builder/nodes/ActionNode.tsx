import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { type ActionType, ACTION_META, type WorkflowAction } from "../types";

interface ActionNodeData {
  action: WorkflowAction;
  index: number;
}

function getPreview(action: WorkflowAction): string {
  const d = action.data ?? {};
  switch (action.type) {
    case "send_message":
      return String(d.message ?? "").slice(0, 48) + (String(d.message ?? "").length > 48 ? "…" : "");
    case "call_ai_model":
      return String(d.prompt ?? "").slice(0, 48) + (String(d.prompt ?? "").length > 48 ? "…" : "");
    case "update_user_data":
      return `${d.field} = "${d.value}"`;
    case "trigger_webhook":
      return `${d.method ?? "POST"} ${String(d.url ?? "").replace("https://", "").slice(0, 35)}`;
    default:
      return "";
  }
}

export const ActionNode = memo(({ data, selected }: NodeProps) => {
  const d = data as ActionNodeData;
  const { action } = d;
  const meta = ACTION_META[action.type as ActionType] ?? {
    label: action.type,
    icon: "⚙",
    color: "#6b7280",
    bgColor: "rgba(107,114,128,0.12)",
  };
  const preview = getPreview(action);

  return (
    <div
      style={{
        background: selected
          ? `rgba(${hexToRgb(meta.color)},0.15)`
          : "#141414",
        border: `2px solid ${selected ? meta.color : "#252525"}`,
        borderRadius: 14,
        padding: "12px 16px",
        minWidth: 220,
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: selected
          ? `0 0 0 3px ${meta.color}33, 0 8px 24px rgba(0,0,0,0.4)`
          : "0 4px 16px rgba(0,0,0,0.3)",
        position: "relative",
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 8,
          bottom: 8,
          width: 3,
          borderRadius: 99,
          background: meta.color,
          opacity: 0.8,
        }}
      />

      {/* Top label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.2,
          color: meta.color,
          textTransform: "uppercase",
          marginBottom: 8,
          paddingLeft: 8,
        }}
      >
        Action {d.index + 1}
      </div>

      {/* Main content */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 8 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: meta.bgColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 17,
            flexShrink: 0,
            border: `1px solid ${meta.color}33`,
          }}
        >
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {meta.label}
          </div>
          {preview && (
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                marginTop: 3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {preview}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "#333",
          width: 10,
          height: 10,
          border: `2px solid ${meta.color}`,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "#333",
          width: 10,
          height: 10,
          border: `2px solid ${meta.color}`,
        }}
      />
    </div>
  );
});

ActionNode.displayName = "ActionNode";

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
