/**
 * GlobalPersonalityBadge — compact pill showing the active personality / blend.
 * Shows the dominant personality. Tap to open the PersonalityBlender sheet.
 */
import { useState } from "react";
import { usePersonality } from "@/contexts/PersonalityContext";
import { APEX_PERSONALITIES } from "@/lib/personalityEngine";
import { PersonalityBlender } from "./PersonalityBlender";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

interface Props {
  compact?: boolean;
}

export function GlobalPersonalityBadge({ compact = false }: Props) {
  const { blend, profile, blendDescription } = usePersonality();
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Show top-2 active personalities as mini segments
  const active = [...blend].filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight);
  const isBlended = active.length > 1;

  function handleClick() {
    setPressed(true);
    setTimeout(() => setPressed(false), 220);
    setOpen((prev) => !prev);
  }

  return (
    <>
      <button
        onClick={handleClick}
        title={blendDescription}
        style={{
          display: "flex", alignItems: "center", gap: compact ? 0 : 5,
          padding: compact ? "4px 8px" : "4px 10px",
          borderRadius: 99, cursor: "pointer",
          background: `${profile.color}18`,
          border: `1px solid ${profile.color}35`,
          transition: `all 0.22s ${IOS}`,
          transform: pressed ? "scale(0.90)" : open ? "scale(1.06)" : "scale(1)",
          boxShadow: open ? `0 0 14px ${profile.color}35` : `0 0 8px ${profile.color}18`,
          position: "relative",
        }}
      >
        {isBlended ? (
          /* Multi-blend: show top-2 emojis + weights */
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {active.slice(0, 2).map((s) => {
              const p = APEX_PERSONALITIES[s.id];
              return (
                <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: compact ? 12 : 11 }}>{p.emoji}</span>
                  {!compact && (
                    <span style={{ fontSize: 8, fontWeight: 800, color: p.color }}>
                      {s.weight}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ) : (
          /* Single: just the emoji */
          <span style={{ fontSize: compact ? 14 : 12 }}>{profile.emoji}</span>
        )}

        {!compact && (
          <span style={{
            fontSize: 9, fontWeight: 800, color: profile.color,
            letterSpacing: "0.04em", textTransform: "uppercase",
            whiteSpace: "nowrap",
            maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {isBlended ? "BLEND" : profile.name}
          </span>
        )}

        {/* open indicator dot */}
        {open && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            width: 7, height: 7, borderRadius: "50%",
            background: profile.color,
            boxShadow: `0 0 8px ${profile.color}`,
          }} />
        )}
      </button>

      {/* ── Dropdown blender panel ── */}
      {open && (
        <>
          {/* backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 998,
              background: "transparent",
            }}
          />
          <div style={{
            position: "fixed",
            top: 56, right: 10,
            zIndex: 999,
            width: 320,
            background: "rgba(14,12,32,0.55)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(162,155,254,0.18)",
            borderRadius: 20,
            padding: 18,
            boxShadow: "0 24px 64px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04)",
            animation: `blenderPanelEnter 0.28s ${SPRING} both`,
          }}>
            <style>{`
              @keyframes blenderPanelEnter {
                from { opacity: 0; transform: translateY(-12px) scale(0.96); }
                to   { opacity: 1; transform: translateY(0)     scale(1);    }
              }
            `}</style>

            {/* header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>
                  Personality Blend
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                  Mix how Apex thinks
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 24, height: 24, borderRadius: 99,
                  background: "rgba(255,255,255,0.07)", border: "none",
                  color: "rgba(255,255,255,0.50)", fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            <PersonalityBlender compact />
          </div>
        </>
      )}
    </>
  );
}

/**
 * GlobalPersonalitySelector — full card list for selecting single personality.
 * Kept for backwards compat — internally calls setPersonalityId.
 */
export function GlobalPersonalitySelector({ onSelect }: { onSelect?: () => void }) {
  const { setPersonalityId, blend } = usePersonality();
  const ids = ['strategist', 'friend', 'mentor', 'debater', 'innovator'] as const;

  const dominantId = [...blend].sort((a, b) => b.weight - a.weight)[0]?.id;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {ids.map((id) => {
        const p = APEX_PERSONALITIES[id];
        const isActive = dominantId === id;
        return (
          <button
            key={id}
            onClick={() => { setPersonalityId(id); onSelect?.(); }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 14px", borderRadius: 14, cursor: "pointer", textAlign: "left",
              background: isActive ? `${p.color}14` : "rgba(255,255,255,0.03)",
              border: `1px solid ${isActive ? p.color + "40" : "rgba(255,255,255,0.07)"}`,
              transition: `all 0.20s ${IOS}`,
              transform: isActive ? "scale(1.02)" : "scale(1)",
              boxShadow: isActive ? `0 0 16px ${p.color}20` : "none",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 11, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              background: isActive ? `${p.color}20` : "rgba(255,255,255,0.04)",
              border: `1px solid ${isActive ? p.color + "35" : "rgba(255,255,255,0.07)"}`,
              filter: isActive ? `drop-shadow(0 0 6px ${p.color}80)` : "none",
              transition: `all 0.20s ${IOS}`,
            }}>{p.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: isActive ? p.color : "rgba(255,255,255,0.75)", marginBottom: 2 }}>
                {p.name}
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.tone.split(",")[0]}
              </div>
            </div>
            {isActive && (
              <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: p.color, boxShadow: `0 0 10px ${p.color}` }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
