import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Module, CommandResult, GlobalSettings, Personality } from "./types";
import { autoEnableDeps, moduleLabel } from "./dependencyEngine";

interface Props {
  modules:          Module[];
  globalSettings:   GlobalSettings;
  onModulesChange:  (m: Module[]) => void;
  onGlobalChange:   (g: GlobalSettings) => void;
}

// ── Command Parser ────────────────────────────────────────────────────────────

function parseCommand(
  raw: string,
  modules: Module[],
  globalSettings: GlobalSettings,
  onModulesChange: (m: Module[]) => void,
  onGlobalChange:  (g: GlobalSettings) => void,
): CommandResult {
  const cmd = raw.trim().toLowerCase();

  // enable <module>
  const enableMatch = cmd.match(/^enable\s+(.+)$/);
  if (enableMatch) {
    const query = enableMatch[1]!.trim();
    const mod   = modules.find((m) =>
      m.id === query ||
      m.name.toLowerCase().includes(query) ||
      m.id.replace(/-/g, " ").includes(query),
    );
    if (!mod) return { success: false, type: "error", message: `Unknown module: "${query}"` };
    if (mod.status === "Coming Soon") return { success: false, type: "warn", message: `${mod.name} is Coming Soon and can't be enabled yet.` };
    if (mod.enabled) return { success: false, type: "info", message: `${mod.name} is already enabled.` };

    let next = autoEnableDeps(mod.id, modules);
    next = next.map((m) => m.id === mod.id ? { ...m, enabled: true, status: "Active" as const } : m);
    onModulesChange(next);
    const depCount = mod.dependencies.length;
    return {
      success: true, type: "success",
      message: `✓ ${mod.name} enabled${depCount ? ` (+ ${depCount} dep${depCount > 1 ? "s" : ""} auto-enabled)` : ""}`,
    };
  }

  // disable <module>
  const disableMatch = cmd.match(/^disable\s+(.+)$/);
  if (disableMatch) {
    const query = disableMatch[1]!.trim();
    const mod   = modules.find((m) =>
      m.id === query ||
      m.name.toLowerCase().includes(query) ||
      m.id.replace(/-/g, " ").includes(query),
    );
    if (!mod) return { success: false, type: "error", message: `Unknown module: "${query}"` };
    if (!mod.enabled) return { success: false, type: "info", message: `${mod.name} is already disabled.` };
    const dependents = modules.filter((m) => m.enabled && m.dependencies.includes(mod.id));
    const next = modules.map((m) => m.id === mod.id ? { ...m, enabled: false, status: "Disabled" as const } : m);
    onModulesChange(next);
    const depWarn = dependents.length ? ` ⚠ ${dependents.map((d) => d.name).join(", ")} may break.` : "";
    return { success: true, type: dependents.length ? "warn" : "success", message: `✓ ${mod.name} disabled.${depWarn}` };
  }

  // set personality <value>
  const personalityMatch = cmd.match(/^set\s+personality\s+(.+)$/);
  if (personalityMatch) {
    const val = personalityMatch[1]!.trim();
    const map: Record<string, Personality> = {
      balanced: "Balanced", playful: "Playful", professional: "Professional",
      aggressive: "Aggressive", empathetic: "Empathetic", genius: "Genius",
    };
    const mapped = map[val];
    if (!mapped) return { success: false, type: "error", message: `Unknown personality: "${val}". Options: ${Object.keys(map).join(", ")}` };
    onGlobalChange({ ...globalSettings, personality: mapped });
    return { success: true, type: "success", message: `✓ Personality set to ${mapped}` };
  }

  // set mode <value>
  const modeMatch = cmd.match(/^set\s+mode\s+(.+)$/);
  if (modeMatch) {
    const val  = modeMatch[1]!.trim();
    const opts = ["Creator", "Assistant", "Battle", "Dev"] as const;
    const mode = opts.find((o) => o.toLowerCase() === val);
    if (!mode) return { success: false, type: "error", message: `Unknown mode: "${val}". Options: ${opts.join(", ")}` };
    onGlobalChange({ ...globalSettings, appMode: mode });
    return { success: true, type: "success", message: `✓ App mode set to ${mode}` };
  }

  // toggle memory
  if (cmd === "toggle memory" || cmd === "memory on" || cmd === "memory off") {
    const next = cmd === "memory on" ? true : cmd === "memory off" ? false : !globalSettings.memoryEnabled;
    onGlobalChange({ ...globalSettings, memoryEnabled: next });
    return { success: true, type: "success", message: `✓ Memory ${next ? "enabled" : "disabled"}` };
  }

  // list modules
  if (cmd === "list" || cmd === "list modules") {
    const lines = modules.map((m) => `${m.icon} ${m.name} — ${m.enabled ? "ON" : "OFF"} v${m.version}`).join("\n");
    return { success: true, type: "info", message: lines };
  }

  // status
  if (cmd === "status") {
    const on  = modules.filter((m) => m.enabled).length;
    const off = modules.length - on;
    return { success: true, type: "info", message: `${on} active / ${off} disabled · Personality: ${globalSettings.personality} · Mode: ${globalSettings.appMode}` };
  }

  // help
  if (cmd === "help" || cmd === "?") {
    return {
      success: true, type: "info",
      message: "Commands:\n  enable <module>\n  disable <module>\n  set personality <value>\n  set mode <value>\n  toggle memory\n  list modules\n  status",
    };
  }

  return { success: false, type: "error", message: `Unknown command: "${raw}". Type "help" for options.` };
}

// ── UI ────────────────────────────────────────────────────────────────────────

const RESULT_COLORS = {
  success: { bg: "rgba(0,184,148,0.12)", border: "rgba(0,184,148,0.3)", text: "#00b894" },
  error:   { bg: "rgba(214,48,49,0.12)", border: "rgba(214,48,49,0.3)", text: "#ff7675"  },
  warn:    { bg: "rgba(253,203,110,0.12)", border: "rgba(253,203,110,0.3)", text: "#fdcb6e" },
  info:    { bg: "rgba(162,155,254,0.12)", border: "rgba(162,155,254,0.3)", text: "#a29bfe" },
};

export function CommandCenter({ modules, globalSettings, onModulesChange, onGlobalChange }: Props) {
  const [input,  setInput]  = useState("");
  const [result, setResult] = useState<CommandResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const execute = () => {
    const cmd = input.trim();
    if (!cmd) return;
    const r = parseCommand(cmd, modules, globalSettings, onModulesChange, onGlobalChange);
    setResult(r);
    setHistory((h) => [cmd, ...h.slice(0, 19)]);
    setHistIdx(-1);
    setInput("");
    setTimeout(() => setResult(null), 4000);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { execute(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      setInput(history[next] ?? "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setInput(next === -1 ? "" : (history[next] ?? ""));
    }
  };

  const hints = ["enable voice", "disable dm system", "set personality playful", "list modules", "status"];
  const matchingHints = input.length > 0
    ? hints.filter((h) => h.startsWith(input.toLowerCase()))
    : [];

  return (
    <div style={{ padding: "10px 16px 0" }}>
      {/* Input bar */}
      <div style={{
        display: "flex", gap: 8, alignItems: "center",
        background: focused ? "rgba(124,92,231,0.1)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${focused ? "rgba(124,92,231,0.5)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 14, padding: "8px 12px",
        transition: "all 0.2s",
      }}>
        <span style={{ color: "#a29bfe", fontSize: 13, fontFamily: "monospace", flexShrink: 0 }}>⌘</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setHistIdx(-1); }}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Type a command… (help for list)"
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "#fff", fontSize: 13, fontFamily: "monospace",
          }}
        />
        {input && (
          <button
            onClick={execute}
            style={{
              background: "linear-gradient(135deg, #7c5ce7, #a29bfe)",
              border: "none", borderRadius: 8, padding: "4px 10px",
              color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}
          >
            RUN
          </button>
        )}
      </div>

      {/* Autocomplete hints */}
      <AnimatePresence>
        {matchingHints.length > 0 && focused && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              background: "rgba(30,26,62,0.62)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, marginTop: 4, overflow: "hidden",
            }}
          >
            {matchingHints.map((h) => (
              <button
                key={h}
                onMouseDown={(e) => { e.preventDefault(); setInput(h); inputRef.current?.focus(); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "8px 14px", background: "none", border: "none",
                  color: "#a29bfe", fontSize: 12, fontFamily: "monospace",
                  cursor: "pointer",
                }}
              >
                {h}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result toast */}
      <AnimatePresence>
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginTop: 8,
              padding: "10px 14px",
              borderRadius: 10,
              background: RESULT_COLORS[result.type].bg,
              border: `1px solid ${RESULT_COLORS[result.type].border}`,
              color: RESULT_COLORS[result.type].text,
              fontSize: 12, fontFamily: "monospace",
              whiteSpace: "pre-wrap", lineHeight: 1.5,
            }}
          >
            {result.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
