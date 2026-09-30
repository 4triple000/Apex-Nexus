import { type WorkflowState, type WorkflowAction, TRIGGER_META, ACTION_META } from "./types";
import { Sliders, Trash2, PlusCircle } from "lucide-react";

interface PropertiesPanelProps {
  workflow: WorkflowState | null;
  selectedNodeId: string | null;
  onUpdateWorkflow: (w: WorkflowState) => void;
  onDeleteAction: (index: number) => void;
}

const FIELD = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <label style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.8 }}>
      {label}
    </label>
    {children}
  </div>
);

const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(30,26,62,0.62)",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 12,
  color: "#e5e5e5",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.15s",
};

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  resize: "vertical",
  minHeight: 72,
  lineHeight: 1.5,
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 28,
};

export function PropertiesPanel({
  workflow,
  selectedNodeId,
  onUpdateWorkflow,
  onDeleteAction,
}: PropertiesPanelProps) {
  if (!workflow) {
    return <EmptyProperties />;
  }

  // Determine what's selected
  const isTrigger = selectedNodeId === "trigger";
  const actionMatch = selectedNodeId?.match(/^action-(\d+)$/);
  const actionIndex = actionMatch ? parseInt(actionMatch[1]) : null;
  const selectedAction = actionIndex !== null ? workflow.actions[actionIndex] : null;

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: "1px solid #1a1a1a",
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Sliders size={14} color="#555" />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Properties</div>
        {selectedNodeId && (
          <div style={{ fontSize: 10, color: "#444", marginLeft: "auto", textTransform: "uppercase", letterSpacing: 0.8 }}>
            {isTrigger ? "Trigger" : `Action ${(actionIndex ?? 0) + 1}`}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px" }}>
        {!selectedNodeId && (
          <WorkflowMetaEditor workflow={workflow} onChange={onUpdateWorkflow} />
        )}
        {isTrigger && (
          <TriggerEditor workflow={workflow} onChange={onUpdateWorkflow} />
        )}
        {selectedAction !== null && actionIndex !== null && (
          <ActionEditor
            action={selectedAction}
            index={actionIndex}
            workflow={workflow}
            onChange={onUpdateWorkflow}
            onDelete={() => onDeleteAction(actionIndex)}
          />
        )}
      </div>

      {/* Add action shortcut */}
      {!selectedNodeId && workflow && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid #1a1a1a" }}>
          <button
            onClick={() => {
              const newAction: WorkflowAction = {
                type: "send_message",
                data: { message: "New message", channel: "in-app" },
              };
              onUpdateWorkflow({
                ...workflow,
                actions: [...workflow.actions, newAction],
              });
            }}
            style={{
              width: "100%",
              background: "rgba(30,26,62,0.62)",
              border: "1px dashed #2a2a2a",
              borderRadius: 8,
              padding: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 11,
              color: "#555",
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#A29BFE55";
              e.currentTarget.style.color = "#A29BFE";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2a2a2a";
              e.currentTarget.style.color = "#555";
            }}
          >
            <PlusCircle size={13} />
            Add Action
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-editors ────────────────────────────────────────────────────────────

function WorkflowMetaEditor({
  workflow,
  onChange,
}: {
  workflow: WorkflowState;
  onChange: (w: WorkflowState) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 11, color: "#444", marginBottom: 2 }}>
        Click a node to edit it, or update workflow details below.
      </div>
      <FIELD label="Workflow Name">
        <input
          style={INPUT_STYLE}
          value={workflow.name}
          onChange={(e) => onChange({ ...workflow, name: e.target.value })}
          placeholder="My Workflow"
          onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
          onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
        />
      </FIELD>
      <FIELD label="Description">
        <textarea
          style={TEXTAREA_STYLE}
          value={workflow.description}
          onChange={(e) => onChange({ ...workflow, description: e.target.value })}
          placeholder="What does this workflow do?"
          onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
          onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
        />
      </FIELD>
      <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
          Summary
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <StatRow label="Trigger" value={TRIGGER_META[workflow.trigger]?.label ?? workflow.trigger} />
          <StatRow label="Actions" value={`${workflow.actions.length} step${workflow.actions.length !== 1 ? "s" : ""}`} />
          <StatRow label="Conditions" value={workflow.conditions.length > 0 ? `${workflow.conditions.length} filter${workflow.conditions.length !== 1 ? "s" : ""}` : "None"} />
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "#555" }}>{label}</span>
      <span style={{ fontSize: 11, color: "#999", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function TriggerEditor({
  workflow,
  onChange,
}: {
  workflow: WorkflowState;
  onChange: (w: WorkflowState) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(162,155,254,0.06)", borderRadius: 8, border: "1px solid rgba(162,155,254,0.15)" }}>
        <span style={{ fontSize: 16 }}>{TRIGGER_META[workflow.trigger]?.icon}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#A29BFE" }}>
            {TRIGGER_META[workflow.trigger]?.label}
          </div>
          <div style={{ fontSize: 10, color: "#665900" }}>
            {TRIGGER_META[workflow.trigger]?.description}
          </div>
        </div>
      </div>
      <FIELD label="Trigger Event">
        <select
          style={SELECT_STYLE}
          value={workflow.trigger}
          onChange={(e) => onChange({ ...workflow, trigger: e.target.value as WorkflowState["trigger"] })}
          onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
          onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
        >
          <option value="user_signup">User Signup</option>
          <option value="user_message_received">Message Received</option>
          <option value="api_call_received">API Call Received</option>
        </select>
      </FIELD>
    </div>
  );
}

function ActionEditor({
  action,
  index,
  workflow,
  onChange,
  onDelete,
}: {
  action: WorkflowAction;
  index: number;
  workflow: WorkflowState;
  onChange: (w: WorkflowState) => void;
  onDelete: () => void;
}) {
  const meta = ACTION_META[action.type];
  const d = action.data as Record<string, unknown>;

  const updateField = (field: string, value: unknown) => {
    const newActions = [...workflow.actions];
    newActions[index] = {
      ...newActions[index],
      data: { ...newActions[index].data, [field]: value },
    };
    onChange({ ...workflow, actions: newActions });
  };

  const updateType = (type: WorkflowAction["type"]) => {
    const defaults: Record<string, Record<string, unknown>> = {
      send_message: { message: "", channel: "in-app" },
      call_ai_model: { prompt: "", model: "gpt-5.2", outputKey: "ai_output", temperature: 0.7 },
      update_user_data: { field: "", value: "" },
      trigger_webhook: { url: "", method: "POST", payload: {} },
      delay: { duration: 5, unit: "minutes" },
    };
    const newActions = [...workflow.actions];
    newActions[index] = { type, data: defaults[type] ?? {} };
    onChange({ ...workflow, actions: newActions });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Type selector + delete */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: meta?.bgColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            flexShrink: 0,
            border: `1px solid ${meta?.color}33`,
          }}
        >
          {meta?.icon}
        </div>
        <select
          style={{ ...SELECT_STYLE, flex: 1 }}
          value={action.type}
          onChange={(e) => updateType(e.target.value as WorkflowAction["type"])}
          onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
          onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
        >
          <option value="send_message">Send Message</option>
          <option value="call_ai_model">Call AI Model</option>
          <option value="update_user_data">Update User Data</option>
          <option value="trigger_webhook">Trigger Webhook</option>
          <option value="delay">Delay</option>
        </select>
        <button
          onClick={onDelete}
          style={{
            background: "none",
            border: "1px solid #2a2a2a",
            borderRadius: 7,
            cursor: "pointer",
            padding: "5px 6px",
            color: "#555",
            display: "flex",
            alignItems: "center",
            transition: "all 0.12s",
          }}
          title="Delete action"
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#555"; }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div style={{ borderTop: "1px solid #1a1a1a" }} />

      {/* send_message */}
      {action.type === "send_message" && (
        <>
          <FIELD label="Message">
            <textarea
              style={TEXTAREA_STYLE}
              value={String(d.message ?? "")}
              onChange={(e) => updateField("message", e.target.value)}
              placeholder="Enter message text… Use {{user.name}} for variables"
              onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
            />
          </FIELD>
          <FIELD label="Channel">
            <select
              style={SELECT_STYLE}
              value={String(d.channel ?? "in-app")}
              onChange={(e) => updateField("channel", e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
            >
              <option value="in-app">In-App</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </FIELD>
          {d.channel === "email" && (
            <FIELD label="Subject">
              <input
                style={INPUT_STYLE}
                value={String(d.subject ?? "")}
                onChange={(e) => updateField("subject", e.target.value)}
                placeholder="Email subject"
                onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
                onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
              />
            </FIELD>
          )}
        </>
      )}

      {/* call_ai_model */}
      {action.type === "call_ai_model" && (
        <>
          <FIELD label="Prompt">
            <textarea
              style={{ ...TEXTAREA_STYLE, minHeight: 90 }}
              value={String(d.prompt ?? "")}
              onChange={(e) => updateField("prompt", e.target.value)}
              placeholder="Describe what the AI should do… Use {{variables}}"
              onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
            />
          </FIELD>
          <FIELD label="Model">
            <input
              style={INPUT_STYLE}
              value={String(d.model ?? "gpt-5.2")}
              onChange={(e) => updateField("model", e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
            />
          </FIELD>
          <FIELD label="Output Variable">
            <input
              style={INPUT_STYLE}
              value={String(d.outputKey ?? "")}
              onChange={(e) => updateField("outputKey", e.target.value)}
              placeholder="e.g. ai_response"
              onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
            />
          </FIELD>
          <FIELD label={`Temperature: ${Number(d.temperature ?? 0.7).toFixed(1)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={Number(d.temperature ?? 0.7)}
              onChange={(e) => updateField("temperature", parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#A29BFE" }}
            />
          </FIELD>
        </>
      )}

      {/* update_user_data */}
      {action.type === "update_user_data" && (
        <>
          <FIELD label="Field Name">
            <input
              style={INPUT_STYLE}
              value={String(d.field ?? "")}
              onChange={(e) => updateField("field", e.target.value)}
              placeholder="e.g. user.region"
              onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
            />
          </FIELD>
          <FIELD label="Value">
            <input
              style={INPUT_STYLE}
              value={String(d.value ?? "")}
              onChange={(e) => updateField("value", e.target.value)}
              placeholder="Value or {{variable}}"
              onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
            />
          </FIELD>
        </>
      )}

      {/* trigger_webhook */}
      {action.type === "trigger_webhook" && (
        <>
          <FIELD label="URL">
            <input
              style={INPUT_STYLE}
              value={String(d.url ?? "")}
              onChange={(e) => updateField("url", e.target.value)}
              placeholder="https://your-endpoint.com/hook"
              onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
            />
          </FIELD>
          <FIELD label="Method">
            <select
              style={SELECT_STYLE}
              value={String(d.method ?? "POST")}
              onChange={(e) => updateField("method", e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </FIELD>
        </>
      )}

      {/* delay */}
      {action.type === "delay" && (
        <>
          <FIELD label="Duration">
            <input
              type="number"
              min={1}
              style={INPUT_STYLE}
              value={Number(d.duration ?? 5)}
              onChange={(e) => updateField("duration", parseInt(e.target.value) || 1)}
              onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
            />
          </FIELD>
          <FIELD label="Unit">
            <select
              style={SELECT_STYLE}
              value={String(d.unit ?? "minutes")}
              onChange={(e) => updateField("unit", e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = "#A29BFE66")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </FIELD>
        </>
      )}
    </div>
  );
}

function EmptyProperties() {
  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: "1px solid #1a1a1a",
        background: "transparent",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 8 }}>
        <Sliders size={14} color="#333" />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#444" }}>Properties</div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, opacity: 0.2, marginBottom: 8 }}>⚙</div>
          <div style={{ fontSize: 12, color: "#333" }}>Build a workflow first</div>
        </div>
      </div>
    </div>
  );
}
