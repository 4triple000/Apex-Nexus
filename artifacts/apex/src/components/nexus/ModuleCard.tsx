import { motion, AnimatePresence } from "framer-motion";
import type { Module } from "./types";

interface Props {
  module:      Module;
  depWarning?: string[];
  onToggle:    (id: string) => void;
  onClick:     (module: Module) => void;
  onAutoFix?:  (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  "Active":       "#00b894",
  "Disabled":     "#636e72",
  "Coming Soon":  "#fdcb6e",
};

const PERM_ICONS: Record<string, string> = {
  network: "🌐", storage: "💾", compute: "⚡", microphone: "🎙️",
  audio: "🔊", camera: "📷", contacts: "👥", notifications: "🔔",
};

export function ModuleCard({ module, depWarning, onToggle, onClick, onAutoFix }: Props) {
  const isComingSoon = module.status === "Coming Soon";
  const hasDepWarn   = depWarning && depWarning.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ marginBottom: 10 }}
    >
      <motion.div
        whileTap={{ scale: isComingSoon ? 1 : 0.97 }}
        onClick={() => !isComingSoon && onClick(module)}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${hasDepWarn ? "rgba(253,203,110,0.3)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: hasDepWarn ? "16px 16px 0 0" : 16,
          padding: "14px 16px",
          cursor: isComingSoon ? "default" : "pointer",
          position: "relative",
          overflow: "hidden",
          transition: "border-color 0.2s",
        }}
      >
        {/* Accent glow strip */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: 3, borderRadius: "16px 0 0 16px",
          background: module.enabled && !isComingSoon ? module.accentColor : "#2d3436",
          transition: "background 0.3s",
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 6 }}>
          {/* Icon */}
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: module.enabled ? `${module.accentColor}22` : "rgba(255,255,255,0.04)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, transition: "background 0.3s",
          }}>
            {module.icon}
          </div>

          {/* Text block */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{module.name}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                padding: "2px 6px", borderRadius: 20,
                background: `${STATUS_COLORS[module.status]}22`,
                color: STATUS_COLORS[module.status],
                border: `1px solid ${STATUS_COLORS[module.status]}44`,
              }}>
                {module.status.toUpperCase()}
              </span>
              <span style={{
                fontSize: 9, color: "rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.06)",
                padding: "2px 6px", borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                v{module.version}
              </span>
            </div>
            <p style={{
              color: "#636e72", fontSize: 11, margin: 0, lineHeight: 1.4,
              overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            }}>
              {module.description}
            </p>

            {/* Permission pills */}
            {module.permissions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {module.permissions.map((p) => (
                  <span key={p} style={{
                    fontSize: 9, color: "rgba(255,255,255,0.3)",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 20, padding: "1px 6px",
                  }}>
                    {PERM_ICONS[p] ?? "•"} {p}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); if (!isComingSoon) onToggle(module.id); }}
            style={{
              position: "relative", width: 46, height: 26, borderRadius: 13,
              border: "none", flexShrink: 0,
              background: module.enabled && !isComingSoon ? module.accentColor : "rgba(255,255,255,0.1)",
              cursor: isComingSoon ? "not-allowed" : "pointer",
              transition: "background 0.25s", opacity: isComingSoon ? 0.4 : 1,
            }}
          >
            <motion.div
              animate={{ x: module.enabled && !isComingSoon ? 20 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              style={{
                position: "absolute", top: 3, width: 20, height: 20,
                borderRadius: "50%", background: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              }}
            />
          </button>
        </div>

        {/* Dep chips */}
        {module.dependencies.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, paddingLeft: 56 }}>
            {module.dependencies.map((depId) => (
              <span key={depId} style={{
                fontSize: 9, color: "rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 20, padding: "1px 6px",
              }}>
                needs: {depId.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Dep warning banner */}
      <AnimatePresence>
        {hasDepWarn && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: "rgba(253,203,110,0.08)",
              border: "1px solid rgba(253,203,110,0.25)",
              borderTop: "none",
              borderRadius: "0 0 16px 16px",
              padding: "8px 14px",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <span style={{ fontSize: 12 }}>⚠️</span>
            <span style={{ color: "#fdcb6e", fontSize: 11, flex: 1 }}>
              Requires: {depWarning!.join(", ")} to be enabled
            </span>
            {onAutoFix && (
              <button
                onClick={(e) => { e.stopPropagation(); onAutoFix(module.id); }}
                style={{
                  padding: "4px 10px", borderRadius: 8, border: "none",
                  background: "rgba(253,203,110,0.2)", color: "#fdcb6e",
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}
              >
                Auto-Fix
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
