import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Module, SettingField } from "./types";

interface Props {
  module:  Module | null;
  onClose: () => void;
  onSave:  (id: string, settings: Record<string, string | boolean | number>) => void;
}

const PERM_ICONS: Record<string, string> = {
  network: "🌐", storage: "💾", compute: "⚡", microphone: "🎙️",
  audio: "🔊", camera: "📷", contacts: "👥", notifications: "🔔",
};
const PERM_COLORS: Record<string, string> = {
  network: "#00cec9", storage: "#a29bfe", compute: "#fdcb6e",
  microphone: "#e056fd", audio: "#fd79a8", camera: "#00b894",
  contacts: "#74b9ff", notifications: "#ffeaa7",
};

function FieldEditor({
  field, value, onChange, accent,
}: {
  field: SettingField; value: string | boolean | number; onChange: (v: string | boolean | number) => void; accent: string;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "11px 14px",
    color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  if (field.type === "toggle") {
    const on = Boolean(value);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
        <span style={{ color: "#b2bec3", fontSize: 14 }}>{field.label}</span>
        <button
          onClick={() => onChange(!on)}
          style={{
            position: "relative", width: 48, height: 27, borderRadius: 14,
            border: "none", background: on ? accent : "rgba(255,255,255,0.1)",
            cursor: "pointer", flexShrink: 0, transition: "background 0.25s",
          }}
        >
          <motion.div
            animate={{ x: on ? 21 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            style={{
              position: "absolute", top: 3, width: 21, height: 21,
              borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            }}
          />
        </button>
      </div>
    );
  }
  if (field.type === "dropdown") {
    return (
      <div>
        <label style={{ color: "#b2bec3", fontSize: 12, display: "block", marginBottom: 6 }}>{field.label}</label>
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, appearance: "none" }}>
          {field.options?.map((o) => (
            <option key={o} value={o} style={{ background: "#1a1d2e" }}>{o}</option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div>
        <label style={{ color: "#b2bec3", fontSize: 12, display: "block", marginBottom: 6 }}>{field.label}</label>
        <textarea value={String(value)} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder} rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <div>
        <label style={{ color: "#b2bec3", fontSize: 12, display: "block", marginBottom: 6 }}>{field.label}</label>
        <input type="number" value={Number(value)} min={field.min} max={field.max}
          step={field.max && field.max <= 2 ? 0.05 : 1}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={inputStyle} />
      </div>
    );
  }
  return (
    <div>
      <label style={{ color: "#b2bec3", fontSize: 12, display: "block", marginBottom: 6 }}>{field.label}</label>
      <input type="text" value={String(value)} placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

export function ModuleSettingsPanel({ module, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Record<string, string | boolean | number>>(module?.settings ?? {});
  const [saved, setSaved] = useState(false);

  if (!module) return null;

  const handleSave = () => {
    onSave(module.id, draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, backdropFilter: "blur(4px)" }}
      />
      <motion.div key="panel"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 36 }}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
          background: "#12141e", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "22px 22px 0 0", maxHeight: "90vh", overflowY: "auto",
          paddingBottom: "env(safe-area-inset-bottom, 20px)",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 20px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: `${module.accentColor}22`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          }}>
            {module.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>{module.name}</span>
              <span style={{
                fontSize: 10, color: "rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "2px 7px", borderRadius: 20,
              }}>
                v{module.version}
              </span>
            </div>
            <div style={{ color: "#636e72", fontSize: 12, marginTop: 2 }}>{module.description}</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%", border: "none",
            background: "rgba(255,255,255,0.08)", color: "#fff",
            fontSize: 18, cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Permissions row */}
        {module.permissions.length > 0 && (
          <div style={{
            padding: "10px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            display: "flex", flexWrap: "wrap", gap: 6,
          }}>
            {module.permissions.map((p) => (
              <span key={p} style={{
                fontSize: 11, padding: "3px 9px", borderRadius: 20,
                background: `${PERM_COLORS[p] ?? "#fff"}18`,
                color: PERM_COLORS[p] ?? "#fff",
                border: `1px solid ${PERM_COLORS[p] ?? "#fff"}33`,
              }}>
                {PERM_ICONS[p] ?? "•"} {p}
              </span>
            ))}
          </div>
        )}

        {/* Dependencies */}
        {module.dependencies.length > 0 && (
          <div style={{
            padding: "8px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <span style={{ color: "#636e72", fontSize: 11 }}>
              Depends on: {module.dependencies.map((d) => d.replace(/-/g, " ")).join(", ")}
            </span>
          </div>
        )}

        {/* Fields */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {module.settingsSchema.map((field) => (
            <FieldEditor
              key={field.key}
              field={field}
              value={draft[field.key] ?? ""}
              accent={module.accentColor}
              onChange={(v) => setDraft((prev) => ({ ...prev, [field.key]: v }))}
            />
          ))}
        </div>

        {/* Save */}
        <div style={{ padding: "4px 20px 24px" }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} style={{
            width: "100%", padding: "15px", borderRadius: 14, border: "none",
            background: saved
              ? "linear-gradient(135deg, #00b894, #00cec9)"
              : `linear-gradient(135deg, ${module.accentColor}, ${module.accentColor}bb)`,
            color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer",
            transition: "background 0.3s",
          }}>
            {saved ? "✓ Saved!" : "Save Changes"}
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
