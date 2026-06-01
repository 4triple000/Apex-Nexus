/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — Director Status Overlay                  ║
 * ║  Small floating indicator showing the AI director state.║
 * ╚══════════════════════════════════════════════════════════╝
 */
import type { EngagementPhase, DifficultyBand, PlayerStyle } from "@/engine3d/GameDirector";

interface DirectorOverlayProps {
  phase:   EngagementPhase;
  band:    DifficultyBand;
  style?:  PlayerStyle;
  visible?: boolean;
}

// ── Phase config ──────────────────────────────────────────────────────────────

const PHASE_META: Record<EngagementPhase, { label: string; color: string; emoji: string }> = {
  calm:     { label: "Calm",     color: "#00cec9", emoji: "🌙" },
  buildup:  { label: "Build-up", color: "#fdcb6e", emoji: "📈" },
  peak:     { label: "PEAK",     color: "#e17055", emoji: "🔥" },
  reward:   { label: "Reward",   color: "#00b894", emoji: "⭐" },
  recovery: { label: "Recovery", color: "#6c5ce7", emoji: "💫" },
};

const BAND_META: Record<DifficultyBand, { label: string; color: string }> = {
  too_easy: { label: "Too Easy", color: "#55efc4" },
  easy:     { label: "Easy",     color: "#74b9ff" },
  balanced: { label: "Balanced", color: "#a29bfe" },
  hard:     { label: "Hard",     color: "#fd79a8" },
  too_hard: { label: "Too Hard", color: "#ff7675" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function DirectorOverlay({ phase, band, style, visible = true }: DirectorOverlayProps) {
  if (!visible) return null;

  const pm = PHASE_META[phase];
  const bm = BAND_META[band];

  return (
    <div style={{
      position: "absolute", bottom: 90, right: 12,
      zIndex: 40, pointerEvents: "none",
      display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4,
    }}>
      {/* Phase pill */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
        border: `1px solid ${pm.color}44`,
        borderRadius: 20, padding: "4px 10px",
        fontSize: 10, fontWeight: 700, color: pm.color,
        letterSpacing: 0.5,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: pm.color,
          boxShadow: `0 0 6px ${pm.color}`,
          animation: phase === "peak" ? "dirPulse 0.8s ease-in-out infinite alternate" : "none",
        }} />
        {pm.emoji} {pm.label.toUpperCase()}
      </div>

      {/* Difficulty pill */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
        border: `1px solid ${bm.color}33`,
        borderRadius: 20, padding: "3px 9px",
        fontSize: 9, fontWeight: 600, color: bm.color,
        letterSpacing: 0.3, opacity: 0.85,
      }}>
        {bm.label}
      </div>

      {/* Style pill (shown only when not unknown) */}
      {style && style !== "unknown" && (
        <div style={{
          background: "rgba(0,0,0,0.50)", backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 20, padding: "2px 8px",
          fontSize: 9, color: "rgba(255,255,255,0.40)",
          letterSpacing: 0.3,
        }}>
          {style}
        </div>
      )}

      <style>{`
        @keyframes dirPulse {
          from { box-shadow: 0 0 4px #e17055; }
          to   { box-shadow: 0 0 12px #e17055, 0 0 20px #e17055; }
        }
      `}</style>
    </div>
  );
}
