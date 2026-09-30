import { motion } from "framer-motion";
import type { GlobalSettings, Personality } from "./types";

interface Props {
  settings:  GlobalSettings;
  onChange:  (s: GlobalSettings) => void;
}

const PERSONALITIES: { id: Personality; icon: string; desc: string; color: string }[] = [
  { id: "Balanced",     icon: "⚖️",  desc: "Neutral and adaptive",      color: "#a29bfe" },
  { id: "Playful",      icon: "🎭",  desc: "Fun, casual, and witty",    color: "#fd79a8" },
  { id: "Professional", icon: "💼",  desc: "Formal and precise",        color: "#00cec9" },
  { id: "Aggressive",   icon: "🔥",  desc: "Bold, direct, no-filter",   color: "#d63031" },
  { id: "Empathetic",   icon: "💜",  desc: "Warm and understanding",    color: "#e056fd" },
  { id: "Genius",       icon: "🧠",  desc: "Deep, analytical, expert",  color: "#fdcb6e" },
];

const APP_MODES = [
  { id: "Dev",       icon: "⚙️",  desc: "Full control, debug tools"    },
  { id: "Creator",   icon: "🎨",  desc: "Content & creative workflows" },
  { id: "Assistant", icon: "🤖",  desc: "Pure assistant mode"          },
  { id: "Battle",    icon: "⚔️",  desc: "Competitive debate mode"      },
] as const;

function ToggleRow({
  label, sub, value, onChange, accent = "#7c5ce7",
}: {
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; accent?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ color: "#636e72", fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          position: "relative",
          width: 48, height: 27, borderRadius: 14, border: "none",
          background: value ? accent : "rgba(255,255,255,0.1)",
          cursor: "pointer", flexShrink: 0, transition: "background 0.25s",
        }}
      >
        <motion.div
          animate={{ x: value ? 21 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{
            position: "absolute", top: 3,
            width: 21, height: 21, borderRadius: "50%",
            background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
          }}
        />
      </button>
    </div>
  );
}

export function GlobalSettingsPanel({ settings, onChange }: Props) {
  return (
    <div style={{ padding: "0 16px 80px" }}>

      {/* Personality */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", margin: "0 0 12px" }}>
          AI PERSONALITY
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {PERSONALITIES.map((p) => {
            const active = settings.personality === p.id;
            return (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => onChange({ ...settings, personality: p.id })}
                style={{
                  padding: "12px 10px",
                  borderRadius: 12,
                  border: active ? `1px solid ${p.color}66` : "1px solid rgba(255,255,255,0.07)",
                  background: active ? `${p.color}18` : "rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</div>
                <div style={{ color: active ? p.color : "#fff", fontWeight: 700, fontSize: 13 }}>{p.id}</div>
                <div style={{ color: "#636e72", fontSize: 11, marginTop: 2 }}>{p.desc}</div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* App Mode */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", margin: "0 0 12px" }}>
          APP MODE
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {APP_MODES.map((m) => {
            const active = settings.appMode === m.id;
            return (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => onChange({ ...settings, appMode: m.id })}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: active ? "1px solid rgba(124,92,231,0.5)" : "1px solid rgba(255,255,255,0.07)",
                  background: active ? "rgba(124,92,231,0.15)" : "rgba(255,255,255,0.04)",
                  cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 20 }}>{m.icon}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: active ? "#a29bfe" : "#fff", fontWeight: 700, fontSize: 14 }}>{m.id}</div>
                  <div style={{ color: "#636e72", fontSize: 12 }}>{m.desc}</div>
                </div>
                {active && (
                  <div style={{ marginLeft: "auto", color: "#a29bfe", fontSize: 16 }}>✓</div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", margin: "0 0 4px" }}>
          SYSTEM
        </p>
        <ToggleRow
          label="Memory"
          sub="Apex remembers previous conversations"
          value={settings.memoryEnabled}
          onChange={(v) => onChange({ ...settings, memoryEnabled: v })}
          accent="#7c5ce7"
        />
        <ToggleRow
          label="Auto Save"
          sub="Save config changes automatically"
          value={settings.autoSave}
          onChange={(v) => onChange({ ...settings, autoSave: v })}
          accent="#00b894"
        />
        <ToggleRow
          label="Debug Mode"
          sub="Show extra technical info in UI"
          value={settings.debugMode}
          onChange={(v) => onChange({ ...settings, debugMode: v })}
          accent="#fdcb6e"
        />
      </div>

      {/* Language */}
      <div>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", margin: "0 0 10px" }}>
          LANGUAGE
        </p>
        <select
          value={settings.language}
          onChange={(e) => onChange({ ...settings, language: e.target.value })}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "12px 14px",
            color: "#fff", fontSize: 14, outline: "none",
            appearance: "none", boxSizing: "border-box",
          }}
        >
          {["English", "Spanish", "French", "German", "Japanese", "Portuguese", "Arabic", "Chinese"].map((l) => (
            <option key={l} value={l} style={{ background: "rgba(30,26,62,0.62)" }}>{l}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
