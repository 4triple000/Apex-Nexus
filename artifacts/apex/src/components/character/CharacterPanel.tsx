/**
 * CharacterPanel — Me tab widget showing the full character status:
 * Apex Bond level · XP progress · Mood · Memory · Interaction count
 */
import { useState } from "react";
import { Brain, Trash2, ChevronDown, ChevronUp, Zap, Heart } from "lucide-react";
import { useCharacter } from "@/hooks/useCharacter";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const LEVEL_COLORS: Record<number, { color: string; glow: string }> = {
  1:  { color: "#6C5CE7", glow: "rgba(108,92,231,0.35)"  },
  2:  { color: "#6C5CE7", glow: "rgba(108,92,231,0.35)"  },
  3:  { color: "#A29BFE", glow: "rgba(162,155,254,0.40)" },
  4:  { color: "#A29BFE", glow: "rgba(162,155,254,0.40)" },
  5:  { color: "#10B981", glow: "rgba(16,185,129,0.40)"  },
  6:  { color: "#F59E0B", glow: "rgba(245,158,11,0.40)"  },
  7:  { color: "#F59E0B", glow: "rgba(245,158,11,0.40)"  },
  8:  { color: "#EC4899", glow: "rgba(236,72,153,0.45)"  },
  9:  { color: "#FD79A8", glow: "rgba(253,121,168,0.50)" },
  10: { color: "#FD79A8", glow: "rgba(253,121,168,0.55)" },
};

export function CharacterPanel() {
  const character = useCharacter();
  const [memoryOpen, setMemoryOpen] = useState(false);

  const { color, glow } = LEVEL_COLORS[character.level] ?? LEVEL_COLORS[1];
  const pct             = Math.round(character.levelProgress * 100);

  const allMemoryItems: { label: string; tag: string; color: string }[] = [
    ...character.memory.facts.slice(0, 5).map((f) => ({ label: f, tag: "Fact",       color: "#A29BFE" })),
    ...character.memory.preferences.slice(0, 4).map((p) => ({ label: p, tag: "Pref",  color: "#10B981" })),
    ...character.memory.goals.slice(0, 3).map((g) => ({ label: g, tag: "Goal",        color: "#F59E0B" })),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Apex Bond Card ────────────────────────────────────────── */}
      <div style={{
        borderRadius: 22,
        background: "linear-gradient(135deg, rgba(108,92,231,0.14) 0%, rgba(162,155,254,0.06) 60%, rgba(253,121,168,0.10) 100%)",
        border: `1px solid ${color}30`,
        padding: "18px 18px 16px",
        position: "relative", overflow: "hidden",
        boxShadow: `0 0 30px ${glow}`,
      }}>
        {/* Ambient orb */}
        <div style={{
          position: "absolute", top: -40, right: -20, width: 130, height: 130,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glow}, transparent 70%)`,
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}>
          {/* Level orb */}
          <div style={{
            width: 56, height: 56, borderRadius: 18, flexShrink: 0,
            background: `linear-gradient(135deg, ${color}40, ${color}18)`,
            border: `2px solid ${color}55`,
            boxShadow: `0 0 20px ${glow}, 0 6px 20px rgba(0,0,0,0.30)`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 1,
          }}>
            <span style={{ fontSize: 9, fontWeight: 900, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>LVL</span>
            <span style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{character.level}</span>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <Heart size={11} style={{ color }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: "white" }}>Apex Bond</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                background: `${color}22`, color, border: `1px solid ${color}40`,
              }}>{character.levelLabel}</span>
            </div>

            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.40)", marginBottom: 8 }}>
              Relationship {character.state.relationshipLevel.toFixed(1)}/10 · {character.state.totalInteractions} interactions
            </div>

            {/* XP bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>
                  {character.state.xp.toLocaleString()} XP
                </span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)" }}>{pct}% to Level {character.level + 1}</span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${pct}%`, borderRadius: 99,
                  background: `linear-gradient(90deg, ${color}cc, ${color})`,
                  boxShadow: `0 0 6px ${glow}`,
                  transition: `width 0.7s ${IOS}`,
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Mood pill */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12,
          padding: "5px 12px", borderRadius: 99,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
        }}>
          <span style={{ fontSize: 13 }}>{character.moodEmoji}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.60)" }}>
            Current Mood: <span style={{ color: "white" }}>{character.moodLabel}</span>
          </span>
        </div>
      </div>

      {/* ── Memory Profile ─────────────────────────────────────────── */}
      <div style={{
        borderRadius: 18,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}>
        <button
          onClick={() => setMemoryOpen((v) => !v)}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "14px 16px", cursor: "pointer",
            background: "none", border: "none",
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 9,
            background: "rgba(162,155,254,0.14)", border: "1px solid rgba(162,155,254,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Brain size={13} style={{ color: "#A29BFE" }} />
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
              What Apex Knows
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", marginTop: 1 }}>
              {allMemoryItems.length} memories stored · tap to view
            </div>
          </div>
          {memoryOpen
            ? <ChevronUp  size={14} style={{ color: "rgba(255,255,255,0.30)" }} />
            : <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.30)" }} />}
        </button>

        {memoryOpen && (
          <div style={{
            padding: "0 14px 14px",
            animation: "dm-drawer-enter 0.20s ease-out both",
          }}>
            {allMemoryItems.length === 0 ? (
              <div style={{
                padding: "18px 0", textAlign: "center",
                fontSize: 11, color: "rgba(255,255,255,0.25)",
              }}>
                No memories yet — start chatting to build your profile
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {allMemoryItems.map((item, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "8px 10px", borderRadius: 12,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <span style={{
                      fontSize: 8, fontWeight: 800, padding: "2px 7px", borderRadius: 99,
                      background: `${item.color}18`, color: item.color,
                      border: `1px solid ${item.color}30`, flexShrink: 0, marginTop: 1,
                    }}>{item.tag}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}

            {allMemoryItems.length > 0 && (
              <button
                onClick={character.clearMemory}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  marginTop: 10, padding: "6px 12px", borderRadius: 99, cursor: "pointer",
                  background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)",
                  fontSize: 10, fontWeight: 700, color: "rgba(239,68,68,0.75)",
                }}
              >
                <Trash2 size={10} />
                Clear memory
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── XP Badge row ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { icon: "⚡", label: "XP Earned",     value: `${character.state.xp.toLocaleString()} pts`, color: "#F59E0B" },
          { icon: "💬", label: "Interactions",   value: character.state.totalInteractions.toString(),  color: "#A29BFE" },
        ].map(({ icon, label, value, color: c }) => (
          <div key={label} style={{
            padding: "12px 14px", borderRadius: 16,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              fontSize: 18, width: 36, height: 36, borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `${c}12`, border: `1px solid ${c}25`,
            }}>{icon}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: c, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
