import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { VersionSnapshot, Module, GlobalSettings, AppEnvironment } from "./types";

interface Props {
  snapshots:      VersionSnapshot[];
  currentModules: Module[];
  globalSettings: GlobalSettings;
  environment:    AppEnvironment;
  onSave:         (label: string, note?: string) => void;
  onRollback:     (snapshot: VersionSnapshot) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function diffSnapshots(a: Module[], b: Module[]): string[] {
  const changes: string[] = [];
  for (const ma of a) {
    const mb = b.find((m) => m.id === ma.id);
    if (!mb) { changes.push(`+ ${ma.name} added`); continue; }
    if (ma.enabled !== mb.enabled) {
      changes.push(`${ma.icon} ${ma.name}: ${mb.enabled ? "ON" : "OFF"} → ${ma.enabled ? "ON" : "OFF"}`);
    }
    for (const key of Object.keys(ma.settings)) {
      if (ma.settings[key] !== mb.settings[key]) {
        changes.push(`${ma.icon} ${ma.name}.${key}: ${mb.settings[key]} → ${ma.settings[key]}`);
      }
    }
  }
  return changes.slice(0, 8);
}

const ENV_COLORS: Record<AppEnvironment, string> = {
  sandbox:    "#fdcb6e",
  production: "#00b894",
};

export function VersionControl({ snapshots, currentModules, globalSettings, environment, onSave, onRollback }: Props) {
  const [label,     setLabel]     = useState("");
  const [note,      setNote]      = useState("");
  const [comparing, setComparing] = useState<VersionSnapshot | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [rolledBack, setRolledBack] = useState<string | null>(null);

  const handleSave = () => {
    const name = label.trim() || `v${Date.now().toString(36).toUpperCase()}`;
    setSaving(true);
    setTimeout(() => {
      onSave(name, note.trim() || undefined);
      setLabel("");
      setNote("");
      setSaving(false);
    }, 600);
  };

  const handleRollback = (snap: VersionSnapshot) => {
    onRollback(snap);
    setRolledBack(snap.id);
    setTimeout(() => setRolledBack(null), 2500);
  };

  return (
    <div style={{ padding: "0 16px 80px" }}>

      {/* Save new version */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: 16, marginBottom: 20,
      }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", margin: "0 0 12px" }}>
          SAVE CURRENT CONFIG
        </p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Version label (e.g. Battle Ready v2)"
          style={{
            width: "100%", background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "10px 14px",
            color: "#fff", fontSize: 13, outline: "none",
            boxSizing: "border-box", marginBottom: 8,
          }}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note..."
          style={{
            width: "100%", background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "10px 14px",
            color: "#fff", fontSize: 13, outline: "none",
            boxSizing: "border-box", marginBottom: 12,
          }}
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          style={{
            width: "100%", padding: "13px",
            borderRadius: 12, border: "none",
            background: saving
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(135deg, #7c5ce7, #a29bfe)",
            color: "#fff", fontWeight: 700, fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "💾 Save Version"}
        </motion.button>
      </div>

      {/* Version list */}
      {snapshots.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#636e72" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 14 }}>No saved versions yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Save your current config above to start tracking changes</div>
        </div>
      ) : (
        <div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", margin: "0 0 12px" }}>
            VERSION HISTORY ({snapshots.length})
          </p>
          <AnimatePresence>
            {snapshots.map((snap, i) => {
              const isRolledBack = rolledBack === snap.id;
              const isComparing  = comparing?.id === snap.id;
              const diff         = isComparing ? diffSnapshots(currentModules, snap.modules) : [];
              const activeCount  = snap.modules.filter((m) => m.enabled).length;

              return (
                <motion.div
                  key={snap.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${isComparing ? "rgba(162,155,254,0.4)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 14, padding: "14px", marginBottom: 10,
                    transition: "border-color 0.2s",
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{snap.label}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                          background: `${ENV_COLORS[snap.environment]}22`,
                          color: ENV_COLORS[snap.environment],
                          border: `1px solid ${ENV_COLORS[snap.environment]}44`,
                        }}>
                          {snap.environment.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ color: "#636e72", fontSize: 11, marginTop: 3 }}>
                        {formatDate(snap.createdAt)} · {activeCount} modules active · {snap.globalSettings.personality}
                      </div>
                      {snap.note && (
                        <div style={{ color: "#a29bfe", fontSize: 11, marginTop: 4, fontStyle: "italic" }}>
                          "{snap.note}"
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => setComparing(isComparing ? null : snap)}
                        style={{
                          padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                          background: isComparing ? "rgba(162,155,254,0.15)" : "rgba(255,255,255,0.05)",
                          color: isComparing ? "#a29bfe" : "#b2bec3", fontSize: 11, cursor: "pointer",
                        }}
                      >
                        {isComparing ? "Close" : "Diff"}
                      </button>
                      <motion.button
                        whileTap={{ scale: 0.93 }}
                        onClick={() => handleRollback(snap)}
                        style={{
                          padding: "5px 10px", borderRadius: 8, border: "none",
                          background: isRolledBack
                            ? "rgba(0,184,148,0.2)"
                            : "linear-gradient(135deg, #7c5ce7, #a29bfe)",
                          color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        {isRolledBack ? "✓" : "↩ Roll Back"}
                      </motion.button>
                    </div>
                  </div>

                  {/* Module chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {snap.modules.map((m) => (
                      <span key={m.id} style={{
                        fontSize: 10, padding: "2px 7px", borderRadius: 20,
                        background: m.enabled ? `${m.accentColor}22` : "rgba(255,255,255,0.05)",
                        color: m.enabled ? m.accentColor : "#636e72",
                        border: `1px solid ${m.enabled ? `${m.accentColor}44` : "rgba(255,255,255,0.06)"}`,
                      }}>
                        {m.icon} {m.name}
                      </span>
                    ))}
                  </div>

                  {/* Diff panel */}
                  <AnimatePresence>
                    {isComparing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          marginTop: 12, padding: "10px 12px",
                          background: "rgba(162,155,254,0.06)",
                          border: "1px solid rgba(162,155,254,0.15)",
                          borderRadius: 10,
                        }}
                      >
                        <p style={{ color: "#a29bfe", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>
                          DIFF vs CURRENT
                        </p>
                        {diff.length === 0 ? (
                          <p style={{ color: "#636e72", fontSize: 12 }}>No differences found — configs are identical.</p>
                        ) : (
                          diff.map((line, i) => (
                            <div key={i} style={{ color: "#dfe6e9", fontSize: 11, fontFamily: "monospace", marginBottom: 3 }}>
                              {line}
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
