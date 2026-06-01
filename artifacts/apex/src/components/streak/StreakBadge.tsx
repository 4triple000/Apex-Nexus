/**
 * StreakBadge — Compact "🔥 N day streak" chip for the home header.
 *
 * • Glow intensity scales with streak (dim at 3, intense at 30+)
 * • Pulse animation on every render
 * • Shows milestone label instead of "day streak" on milestone days
 * • Hides when streak < 2 (no badge for day 1 — earn it first)
 */
import { useMemo } from "react";
import { Flame } from "lucide-react";
import { MILESTONE_MESSAGES, getStreakMilestone } from "@/lib/userMemory";

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// ── CSS injected once ──────────────────────────────────────────────────────────
const BADGE_CSS = `
  @keyframes sb-flame {
    0%, 100% { transform: scaleY(1)    rotate(-3deg); }
    40%       { transform: scaleY(1.18) rotate(2deg);  }
    70%       { transform: scaleY(0.95) rotate(-2deg); }
  }
  @keyframes sb-pulse {
    0%, 100% { box-shadow: var(--sb-glow-base); }
    50%       { box-shadow: var(--sb-glow-peak); }
  }
  @keyframes sb-in {
    from { transform: scale(0.70); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }
  @keyframes sb-number-pop {
    0%   { transform: scale(1);    }
    40%  { transform: scale(1.22); }
    100% { transform: scale(1);    }
  }
`;

// ── Colour gradient per streak tier ───────────────────────────────────────────
function getTierColors(streak: number) {
  if (streak >= 30) return { from: "#FCD34D", to: "#F59E0B", flame: "#FCD34D", label: "#FBBF24" };
  if (streak >= 14) return { from: "#FB923C", to: "#EF4444", flame: "#FB923C", label: "#FCA5A5" };
  if (streak >= 7)  return { from: "#F97316", to: "#EF4444", flame: "#F97316", label: "#FCA5A5" };
  if (streak >= 3)  return { from: "#FBBF24", to: "#F97316", flame: "#FBBF24", label: "#FCD34D" };
  return              { from: "#FCD34D", to: "#FBBF24", flame: "#FCD34D", label: "#FCD34D" };
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface StreakBadgeProps {
  streak:        number;
  glowIntensity: number;   // 0–1
  onClick?:      () => void;
}

export function StreakBadge({ streak, glowIntensity, onClick }: StreakBadgeProps) {
  const colors    = useMemo(() => getTierColors(streak), [streak]);
  const milestone = useMemo(() => getStreakMilestone(streak), [streak]);

  // Don't render for day 1 — earn the badge
  if (streak < 2) return null;

  const glowBase = `0 0 ${8  * glowIntensity}px ${colors.from}${Math.round(glowIntensity * 80).toString(16).padStart(2, "0")}, 0 0 ${4  * glowIntensity}px ${colors.to}40`;
  const glowPeak = `0 0 ${18 * glowIntensity}px ${colors.from}${Math.round(glowIntensity * 140).toString(16).padStart(2, "0")}, 0 0 ${10 * glowIntensity}px ${colors.to}60`;

  const milestoneLabel = milestone ? MILESTONE_MESSAGES[milestone] : null;
  const streakLabel    = milestoneLabel ?? `${streak} day streak`;

  return (
    <>
      <style>{BADGE_CSS}</style>
      <button
        onClick={onClick}
        title={`🔥 ${streak}-day streak${milestoneLabel ? ` · ${milestoneLabel}` : ""}`}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "4px 9px", borderRadius: 99,
          background: `linear-gradient(135deg, ${colors.from}18, ${colors.to}10)`,
          border: `1px solid ${colors.from}35`,
          cursor: onClick ? "pointer" : "default",
          animation: `sb-in 0.40s ${SPRING} both, sb-pulse 2.5s ease-in-out infinite`,
          // CSS variables for the pulse keyframe
          ["--sb-glow-base" as string]: glowBase,
          ["--sb-glow-peak" as string]: glowPeak,
          transition: `all 0.22s ${IOS}`,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { if (onClick) e.currentTarget.style.opacity = "0.80"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
      >
        {/* Flame icon */}
        <Flame
          style={{
            width: 11, height: 11,
            color: colors.flame,
            fill: colors.flame,
            flexShrink: 0,
            animation: "sb-flame 1.4s ease-in-out infinite",
            filter: `drop-shadow(0 0 ${3 * glowIntensity}px ${colors.flame})`,
          }}
        />

        {/* Streak number */}
        <span style={{
          fontSize: 11, fontWeight: 800,
          color: colors.label,
          letterSpacing: "-0.01em",
          animation: "sb-number-pop 0.40s ease both",
          lineHeight: 1,
        }}>
          {streak}
        </span>

        {/* Label text */}
        <span style={{
          fontSize: 9, fontWeight: 700,
          color: `${colors.label}BB`,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
          textTransform: milestoneLabel ? "none" : "lowercase",
          lineHeight: 1,
        }}>
          {milestoneLabel ?? "day streak"}
        </span>
      </button>
    </>
  );
}
