/**
 * StreakMilestone — Fullscreen celebration modal for streak milestones.
 *
 * Fires once per milestone (tracked via localStorage).
 * Features:
 *   • Particle burst (32 coloured sparks)
 *   • Central glow orb with the streak number
 *   • Milestone label ("Momentum building" / "You're locked in" / etc.)
 *   • Tier-coloured gradient card
 *   • Auto-dismisses after 5.5s or on tap
 */
import { useEffect, useState, useRef } from "react";
import { Flame, Zap } from "lucide-react";
import { MILESTONE_MESSAGES } from "@/lib/userMemory";

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

const CSS = `
  @keyframes sm-backdrop {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes sm-card-in {
    from { transform: scale(0.72) translateY(32px); opacity: 0; }
    to   { transform: scale(1)    translateY(0);    opacity: 1; }
  }
  @keyframes sm-card-out {
    from { transform: scale(1)    translateY(0);    opacity: 1; }
    to   { transform: scale(0.88) translateY(20px); opacity: 0; }
  }
  @keyframes sm-orb-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes sm-orb-ccw {
    from { transform: translate(-50%,-50%) rotate(0deg); }
    to   { transform: translate(-50%,-50%) rotate(-360deg); }
  }
  @keyframes sm-orb-cw {
    from { transform: translate(-50%,-50%) rotate(0deg); }
    to   { transform: translate(-50%,-50%) rotate(360deg); }
  }
  @keyframes sm-particle {
    0%   { transform: translate(0, 0) scale(1); opacity: 1; }
    80%  { opacity: 0.7; }
    100% { opacity: 0; }
  }
  @keyframes sm-flame {
    0%, 100% { transform: scaleY(1) rotate(-3deg); }
    50%       { transform: scaleY(1.20) rotate(3deg); }
  }
  @keyframes sm-number-in {
    0%   { transform: scale(0.50); opacity: 0; }
    60%  { transform: scale(1.10); }
    100% { transform: scale(1);    opacity: 1; }
  }
  @keyframes sm-label-in {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sm-progress {
    from { width: 100%; }
    to   { width: 0%; }
  }
  @keyframes sm-glow-pulse {
    0%, 100% { opacity: 0.55; }
    50%       { opacity: 0.85; }
  }
`;

// ── Tier config ────────────────────────────────────────────────────────────────
function getTierTheme(streak: number) {
  if (streak >= 30) return {
    from: "#FCD34D", to: "#F59E0B", accent: "#FBBF24",
    glow: "rgba(251,191,36,0.55)", label: "gold",
    bg: "linear-gradient(160deg, #1A1508 0%, #0F0D04 100%)",
  };
  if (streak >= 14) return {
    from: "#FB923C", to: "#EF4444", accent: "#F97316",
    glow: "rgba(249,115,22,0.55)", label: "red",
    bg: "linear-gradient(160deg, #1A0C08 0%, #100804 100%)",
  };
  if (streak >= 7) return {
    from: "#F97316", to: "#EF4444", accent: "#F97316",
    glow: "rgba(239,68,68,0.50)", label: "orange",
    bg: "linear-gradient(160deg, #170C06 0%, #0F0602 100%)",
  };
  return {
    from: "#FBBF24", to: "#F97316", accent: "#FBBF24",
    glow: "rgba(251,191,36,0.45)", label: "yellow",
    bg: "linear-gradient(160deg, #161003 0%, #0E0A02 100%)",
  };
}

// ── Particle system ────────────────────────────────────────────────────────────
const PARTICLE_COLORS = [
  "#FBBF24", "#F97316", "#EF4444", "#A78BFA",
  "#60A5FA", "#34D399", "#F472B6", "#FCD34D",
];

interface Particle { id: number; angle: number; dist: number; color: string; size: number; dur: number; }

function generateParticles(count = 32): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id:    i,
    angle: (360 / count) * i + Math.random() * 14 - 7,
    dist:  110 + Math.random() * 70,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    size:  3 + Math.random() * 4,
    dur:   0.8 + Math.random() * 0.7,
  }));
}

// ── Main component ─────────────────────────────────────────────────────────────

interface StreakMilestoneProps {
  streak:    number;
  milestone: number;
  onDismiss: () => void;
}

const AUTO_DISMISS = 5500;

export function StreakMilestone({ streak, milestone, onDismiss }: StreakMilestoneProps) {
  const [exiting, setExiting]     = useState(false);
  const [particles]               = useState(() => generateParticles(32));
  const [burstDone, setBurstDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = getTierTheme(streak);
  const label = MILESTONE_MESSAGES[milestone] ?? "Streak milestone!";

  useEffect(() => {
    // Trigger burst fade-out after animation duration
    const t1 = setTimeout(() => setBurstDone(true), 1200);
    // Auto-dismiss
    timerRef.current = setTimeout(handleDismiss, AUTO_DISMISS);
    return () => { clearTimeout(t1); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismiss() {
    if (exiting) return;
    setExiting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(onDismiss, 360);
  }

  return (
    <>
      <style>{CSS}</style>

      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 99900,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(16px)",
          animation: "sm-backdrop 0.30s ease both",
        }}
      />

      {/* ── Particle burst ───────────────────────────────────────────────── */}
      {!burstDone && (
        <div style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 0, height: 0, zIndex: 99901,
          pointerEvents: "none",
        }}>
          {particles.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx  = Math.cos(rad) * p.dist;
            const ty  = Math.sin(rad) * p.dist;
            return (
              <div
                key={p.id}
                style={{
                  position: "absolute",
                  top: 0, left: 0,
                  width: p.size, height: p.size,
                  borderRadius: "50%",
                  background: p.color,
                  boxShadow: `0 0 6px ${p.color}`,
                  animation: `sm-particle ${p.dur}s 0.15s ${IOS} both`,
                  ["--tx" as string]: `${tx}px`,
                  ["--ty" as string]: `${ty}px`,
                }}
                // Inline keyframe can't use CSS vars easily, use transform via style hack
                onAnimationStart={(e) => {
                  (e.currentTarget as HTMLElement).animate(
                    [
                      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
                      { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0.3)`, opacity: 0 },
                    ],
                    { duration: p.dur * 1000, delay: 150, easing: IOS, fill: "forwards" }
                  );
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── Celebration card ─────────────────────────────────────────────── */}
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 99902,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24, pointerEvents: "none",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 340,
            borderRadius: 32,
            background: theme.bg,
            border: `1px solid ${theme.accent}30`,
            boxShadow: [
              `0 0 0 1px ${theme.accent}15`,
              `0 32px 80px rgba(0,0,0,0.70)`,
              `0 0 60px ${theme.glow}`,
            ].join(", "),
            overflow: "hidden",
            pointerEvents: "all",
            animation: exiting
              ? `sm-card-out 0.36s ${IOS} forwards`
              : `sm-card-in  0.55s ${SPRING} both`,
          }}
        >
          {/* Top glow bar */}
          <div style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${theme.from}, ${theme.to}, transparent)`,
          }} />

          <div style={{ padding: "36px 28px 28px", textAlign: "center" }}>

            {/* ── Central orb ──────────────────────────────────────── */}
            <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 24px" }}>

              {/* Ambient glow */}
              <div style={{
                position: "absolute", inset: -24,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
                animation: "sm-glow-pulse 1.8s ease-in-out infinite",
              }} />

              {/* Outer ring CW */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                width: 140, height: 140,
                borderRadius: "50%",
                border: `2px solid ${theme.from}35`,
                borderTopColor: `${theme.from}CC`,
                animation: "sm-orb-cw 4s linear infinite",
              }} />

              {/* Inner ring CCW */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                width: 110, height: 110,
                borderRadius: "50%",
                border: `1.5px solid ${theme.to}25`,
                borderBottomColor: `${theme.to}AA`,
                animation: "sm-orb-ccw 3s linear infinite",
              }} />

              {/* Core */}
              <div style={{
                position: "absolute", inset: 16,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 32px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}>
                <Flame style={{
                  width: 26, height: 26,
                  color: "white", fill: "white",
                  animation: "sm-flame 1.2s ease-in-out infinite",
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.40))",
                }} />
                <span style={{
                  fontSize: 22, fontWeight: 900, color: "white",
                  lineHeight: 1, letterSpacing: "-0.03em",
                  animation: `sm-number-in 0.55s 0.20s ${SPRING} both`,
                }}>
                  {streak}
                </span>
              </div>
            </div>

            {/* ── Labels ────────────────────────────────────────────── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              marginBottom: 8,
              animation: `sm-label-in 0.50s 0.30s both`,
            }}>
              <Zap style={{ width: 13, height: 13, color: theme.accent, fill: theme.accent }} />
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
                textTransform: "uppercase", color: theme.accent,
              }}>
                {milestone}-Day Milestone
              </span>
              <Zap style={{ width: 13, height: 13, color: theme.accent, fill: theme.accent }} />
            </div>

            <h2 style={{
              fontSize: 28, fontWeight: 900, color: "white",
              letterSpacing: "-0.03em", lineHeight: 1.15,
              margin: "0 0 8px",
              animation: `sm-label-in 0.50s 0.40s both`,
            }}>
              {label}
            </h2>

            <p style={{
              fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.55,
              margin: "0 0 28px",
              animation: `sm-label-in 0.50s 0.50s both`,
            }}>
              {milestone === 3  && "You're building a habit. Keep the momentum going."}
              {milestone === 7  && "A full week. You're not stopping here."}
              {milestone === 14 && "Two weeks straight. You're one of the best Apex users."}
              {milestone === 30 && "30 days. Legendary. You've mastered the Apex way."}
            </p>

            {/* CTA */}
            <button
              onClick={handleDismiss}
              style={{
                width: "100%", padding: "15px 0",
                borderRadius: 18, border: "none",
                background: `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
                color: "white",
                fontSize: 15, fontWeight: 800, letterSpacing: "0.01em",
                boxShadow: `0 6px 24px ${theme.glow}`,
                cursor: "pointer",
                animation: `sm-label-in 0.50s 0.60s both`,
              }}
            >
              Keep the streak alive 🔥
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ height: 2, background: "rgba(255,255,255,0.05)" }}>
            <div style={{
              height: "100%",
              background: `linear-gradient(90deg, ${theme.from}, ${theme.to})`,
              animation: `sm-progress ${AUTO_DISMISS}ms linear forwards`,
            }} />
          </div>
        </div>
      </div>
    </>
  );
}
