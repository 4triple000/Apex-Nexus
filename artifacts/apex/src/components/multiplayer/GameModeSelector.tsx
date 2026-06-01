import { useState } from "react";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export type GameMode = "tdm" | "conquest" | "ffa" | "custom";

interface ModeConfig {
  id: GameMode;
  label: string;
  sub: string;
  icon: string;
  players: string;
  mapSize: string;
  matchType: string;
  color: string;
  glow: string;
}

const MODES: ModeConfig[] = [
  {
    id: "tdm",
    label: "Team Deathmatch",
    sub: "COD Style",
    icon: "🎯",
    players: "6v6",
    mapSize: "Small",
    matchType: "Team vs Team",
    color: "#EF4444",
    glow: "rgba(239,68,68,0.30)",
  },
  {
    id: "conquest",
    label: "Conquest",
    sub: "Battlefield Style",
    icon: "⚔️",
    players: "16v16",
    mapSize: "Large",
    matchType: "Capture & Hold",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.30)",
  },
  {
    id: "ffa",
    label: "Free For All",
    sub: "Every man for himself",
    icon: "💀",
    players: "Up to 8",
    mapSize: "Medium",
    matchType: "Solo Kill Race",
    color: "#8B5CF6",
    glow: "rgba(139,92,246,0.30)",
  },
  {
    id: "custom",
    label: "Custom Match",
    sub: "Your rules",
    icon: "⚙️",
    players: "2–64",
    mapSize: "Any",
    matchType: "Configurable",
    color: "#06B6D4",
    glow: "rgba(6,182,212,0.30)",
  },
];

interface Props {
  selected: GameMode;
  onSelect: (mode: GameMode) => void;
  disabled?: boolean;
}

export function GameModeSelector({ selected, onSelect, disabled }: Props) {
  const [hovered, setHovered] = useState<GameMode | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{
          width: 3, height: 16, borderRadius: 2,
          background: "linear-gradient(180deg, #6C5CE7, #A29BFE)",
        }} />
        <span style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Game Mode
        </span>
      </div>

      {/* 2×2 grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {MODES.map(mode => {
          const isActive = selected === mode.id;
          const isHovered = hovered === mode.id;

          return (
            <button
              key={mode.id}
              disabled={disabled}
              onClick={() => onSelect(mode.id)}
              onMouseEnter={() => setHovered(mode.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                all: "unset",
                cursor: disabled ? "not-allowed" : "pointer",
                borderRadius: 16,
                padding: "14px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                position: "relative",
                overflow: "hidden",
                background: isActive
                  ? `linear-gradient(135deg, rgba(${hexToRgb(mode.color)},0.18) 0%, rgba(${hexToRgb(mode.color)},0.08) 100%)`
                  : isHovered
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(255,255,255,0.03)",
                border: isActive
                  ? `1px solid ${mode.color}55`
                  : "1px solid rgba(255,255,255,0.07)",
                boxShadow: isActive
                  ? `0 0 20px ${mode.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`
                  : "inset 0 1px 0 rgba(255,255,255,0.04)",
                transform: isActive ? "scale(1.02)" : isHovered ? "scale(1.01)" : "scale(1)",
                transition: [
                  `transform 0.25s ${SPRING}`,
                  `background 0.20s ${IOS}`,
                  `border-color 0.20s ${IOS}`,
                  `box-shadow 0.20s ${IOS}`,
                ].join(", "),
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {/* Active glow sweep */}
              {isActive && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `radial-gradient(ellipse at 20% 20%, ${mode.glow} 0%, transparent 70%)`,
                  pointerEvents: "none",
                }} />
              )}

              {/* Icon row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{mode.icon}</span>
                {isActive && (
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: mode.color,
                    boxShadow: `0 0 8px ${mode.glow}`,
                    animation: "pulse 2s ease-in-out infinite",
                  }} />
                )}
              </div>

              {/* Labels */}
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: isActive ? "#fff" : "rgba(255,255,255,0.75)",
                  lineHeight: 1.2,
                  transition: `color 0.18s ${IOS}`,
                }}>
                  {mode.label}
                </div>
                <div style={{
                  fontSize: 10, color: isActive ? mode.color : "rgba(255,255,255,0.35)",
                  fontWeight: 500, marginTop: 2,
                  transition: `color 0.18s ${IOS}`,
                }}>
                  {mode.sub}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { label: mode.players },
                  { label: mode.mapSize },
                ].map((s, i) => (
                  <span key={i} style={{
                    fontSize: 9, fontWeight: 600, letterSpacing: "0.05em",
                    color: isActive ? mode.color : "rgba(255,255,255,0.30)",
                    background: isActive ? `${mode.color}18` : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isActive ? mode.color + "33" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 4, padding: "2px 6px",
                    transition: `color 0.18s ${IOS}, background 0.18s ${IOS}`,
                  }}>
                    {s.label}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected mode detail bar */}
      {(() => {
        const m = MODES.find(m => m.id === selected)!;
        return (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: 12,
            background: `linear-gradient(135deg, rgba(${hexToRgb(m.color)},0.10) 0%, rgba(${hexToRgb(m.color)},0.04) 100%)`,
            border: `1px solid ${m.color}33`,
            transition: `all 0.25s ${IOS}`,
          }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>
              Match Type
            </div>
            <div style={{ fontSize: 12, color: m.color, fontWeight: 700, letterSpacing: "0.02em" }}>
              {m.matchType}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Utility: #RRGGBB → "R,G,B"
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export { MODES };
