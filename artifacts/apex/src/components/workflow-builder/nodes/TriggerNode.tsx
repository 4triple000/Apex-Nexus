import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";
import { type TriggerType, TRIGGER_META } from "../types";

interface TriggerNodeData {
  trigger: TriggerType;
  conditions?: Array<{ field: string; operator: string; value?: string }>;
}

export const TriggerNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as TriggerNodeData;
  const meta = TRIGGER_META[d.trigger] ?? {
    label: d.trigger,
    icon: "⚡",
    description: "",
  };

  return (
    <div
      style={{
        background: selected
          ? "rgba(162,155,254,0.18)"
          : "rgba(162,155,254,0.08)",
        border: `2px solid ${selected ? "#A29BFE" : "rgba(162,155,254,0.4)"}`,
        borderRadius: 14,
        padding: "12px 16px",
        minWidth: 220,
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: selected
          ? "0 0 0 3px rgba(162,155,254,0.2), 0 8px 24px rgba(0,0,0,0.4)"
          : "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {/* Top label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.5,
          color: "#A29BFE",
          textTransform: "uppercase",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <Zap size={10} />
        Trigger
      </div>

      {/* Main content */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(162,155,254,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {meta.icon}
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.3,
            }}
          >
            {meta.label}
          </div>
          <div
            style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}
          >
            {meta.description}
          </div>
        </div>
      </div>

      {/* Conditions badge */}
      {d.conditions && d.conditions.length > 0 && (
        <div
          style={{
            marginTop: 10,
            padding: "4px 8px",
            background: "rgba(162,155,254,0.1)",
            borderRadius: 6,
            fontSize: 11,
            color: "#A29BFE",
          }}
        >
          {d.conditions.length} condition{d.conditions.length > 1 ? "s" : ""}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "#A29BFE",
          width: 10,
          height: 10,
          border: "2px solid #0a0a0a",
        }}
      />
    </div>
  );
});

TriggerNode.displayName = "TriggerNode";
