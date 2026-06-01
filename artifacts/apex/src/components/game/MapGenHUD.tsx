/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — AI Map Generation HUD Overlay             ║
 * ║                                                             ║
 * ║  Shows:                                                     ║
 * ║    📍  Current map info (seed, version, cover count)       ║
 * ║    📊  Live gameplay analytics summary                      ║
 * ║    🤖  Post-game optimization report                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useState, useEffect } from "react";
import type { MapConfig }    from "@/engine3d/MapGenSystem";
import { seedLabel }         from "@/engine3d/MapGenSystem";
import type { OptimizationResult } from "@/engine3d/MapOptimizerSystem";

// ── Props ─────────────────────────────────────────────────────────────────────

interface MapGenHUDProps {
  mapConfig:     MapConfig;
  /** Live analytics numbers pushed by FPSCanvas during play */
  liveDeaths:    number;
  liveCoverage:  number;   // 0..1
  chokeCount:    number;
  unusedCount:   number;
  /** Populated only after game over + optimization runs */
  optResult?:    OptimizationResult | null;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position:    "absolute",
  left:        10,
  top:         10,
  zIndex:      20,
  background:  "rgba(7,8,14,0.82)",
  border:      "1px solid rgba(108,92,231,0.35)",
  borderRadius: 12,
  padding:     "10px 14px",
  minWidth:    210,
  backdropFilter: "blur(12px)",
  pointerEvents:  "none",
  fontFamily:  "'Inter', sans-serif",
};

const ROW: React.CSSProperties = {
  display:    "flex",
  alignItems: "center",
  gap:        7,
  marginBottom: 4,
};

const LABEL: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.09em",
  color: "#555",
  textTransform: "uppercase",
};

const VALUE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#A29BFE",
};

const BADGE: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  padding: "2px 7px",
  borderRadius: 99,
  letterSpacing: "0.06em",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Bar({ value, color = "#6C5CE7", label }: { value: number; color?: string; label: string }) {
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={LABEL}>{label}</span>
        <span style={{ ...VALUE, fontSize: 9 }}>{Math.round(value * 100)}%</span>
      </div>
      <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ height: "100%", width: `${Math.max(2, Math.round(value * 100))}%`, borderRadius: 99, background: color, transition: "width 0.6s" }} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ ...LABEL, color: "#333", marginBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 3 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MapGenHUD({ mapConfig, liveDeaths, liveCoverage, chokeCount, unusedCount, optResult }: MapGenHUDProps) {
  const [expanded, setExpanded] = useState(false);
  const [optVisible, setOptVisible] = useState(false);

  // Auto-show optimization panel for 8s after game ends
  useEffect(() => {
    if (!optResult) return;
    setOptVisible(true);
    const tid = setTimeout(() => setOptVisible(false), 8000);
    return () => clearTimeout(tid);
  }, [optResult]);

  const chokeColor = chokeCount === 0 ? "#00ff88" : chokeCount < 3 ? "#ffcc33" : "#ff4444";
  const unusedColor = unusedCount === 0 ? "#00ff88" : unusedCount < 3 ? "#ffcc33" : "#A29BFE";

  return (
    <>
      {/* ── Main info panel (top-left) ────────────────────────────────────── */}
      <div
        style={{ ...PANEL, cursor: "pointer", pointerEvents: "auto" }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Header */}
        <div style={{ ...ROW, marginBottom: 6 }}>
          <span style={{ fontSize: 13 }}>🧠</span>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", flex: 1 }}>AI MAP</span>
          <span style={{
            ...BADGE,
            background: "rgba(108,92,231,0.2)",
            color: "#A29BFE",
            border: "1px solid rgba(108,92,231,0.4)",
          }}>v{mapConfig.version}</span>
          <span style={{ fontSize: 9, color: "#333", marginLeft: 4 }}>{expanded ? "▲" : "▼"}</span>
        </div>

        {/* Seed + cover count */}
        <div style={ROW}>
          <span style={LABEL}>SEED</span>
          <span style={{ ...VALUE, fontSize: 10, fontFamily: "monospace" }}>{seedLabel(mapConfig.seed)}</span>
        </div>
        <div style={ROW}>
          <span style={LABEL}>OBJECTS</span>
          <span style={{ ...VALUE, fontSize: 10 }}>{mapConfig.covers.length}</span>
          <span style={{ ...LABEL, marginLeft: "auto" }}>GEN #{mapConfig.generationCount}</span>
        </div>

        {/* Live choke / unused badges */}
        <div style={{ ...ROW, marginTop: 6 }}>
          <span style={{ ...BADGE, background: `${chokeColor}18`, color: chokeColor, border: `1px solid ${chokeColor}44` }}>
            ⚠ {chokeCount} choke{chokeCount !== 1 ? "s" : ""}
          </span>
          <span style={{ ...BADGE, background: `${unusedColor}18`, color: unusedColor, border: `1px solid ${unusedColor}44` }}>
            🏜 {unusedCount} unused
          </span>
        </div>

        {/* Expanded section */}
        {expanded && (
          <Section title="LIVE ANALYTICS">
            <div style={ROW}>
              <span style={LABEL}>DEATHS</span>
              <span style={{ ...VALUE, color: "#ff4444" }}>{liveDeaths}</span>
            </div>
            <Bar value={liveCoverage} color="#A29BFE" label="AREA EXPLORED" />

            {mapConfig.optimizationLog.length > 0 && (
              <Section title="OPTIMIZATION LOG">
                {mapConfig.optimizationLog.slice(-4).map((entry, i) => (
                  <div key={i} style={{ fontSize: 9, color: "#444", marginBottom: 2, lineHeight: 1.4 }}>{entry}</div>
                ))}
              </Section>
            )}
          </Section>
        )}
      </div>

      {/* ── Optimization report (post-game, auto-dismiss) ──────────────────── */}
      {optVisible && optResult && (
        <div style={{
          position:   "absolute",
          left:       "50%",
          bottom:     120,
          transform:  "translateX(-50%)",
          zIndex:     25,
          background: "rgba(7,8,14,0.95)",
          border:     "1px solid rgba(108,92,231,0.5)",
          borderRadius: 16,
          padding:    "18px 24px",
          minWidth:   300,
          backdropFilter: "blur(20px)",
          pointerEvents:  "none",
          animation:  "fadeInUp 0.35s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>MAP OPTIMIZED</div>
              <div style={{ fontSize: 10, color: "#555" }}>Applied after gameplay analysis</div>
            </div>
            <div style={{
              marginLeft: "auto", textAlign: "center",
              background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.25)",
              borderRadius: 10, padding: "6px 12px",
            }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#00ff88" }}>{optResult.balanceScore}</div>
              <div style={{ fontSize: 8, color: "#555", letterSpacing: "0.06em" }}>BALANCE</div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {[
              { icon: "➕", label: "ADDED",    value: optResult.addedCover,   color: "#00ff88" },
              { icon: "➖", label: "REMOVED",  value: optResult.removedCover, color: "#ff7675" },
              { icon: "⚖",  label: "SPAWNS",   value: optResult.movedSpawns,  color: "#fdcb6e" },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, textAlign: "center",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: "8px 4px",
              }}>
                <div style={{ fontSize: 16 }}>{s.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 8, color: "#444", letterSpacing: "0.06em" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Changes list */}
          <div style={{ maxHeight: 90, overflow: "hidden" }}>
            {optResult.changes.slice(0, 4).map((ch, i) => (
              <div key={i} style={{ fontSize: 10, color: "#888", marginBottom: 3, lineHeight: 1.4 }}>{ch}</div>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 9, color: "#333", textAlign: "center" }}>
            Next session will use the optimized layout
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  );
}
