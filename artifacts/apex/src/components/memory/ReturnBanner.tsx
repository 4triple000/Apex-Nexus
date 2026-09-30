/**
 * ReturnBanner — Personalized "welcome back" banner for returning users.
 *
 * Shows a contextual message based on:
 *   • Time away (same day / 1 day / 3+ days / week+)
 *   • Last conversation topic ("You were working on '...'")
 *   • Daily streak
 *
 * Slides in from the bottom with spring physics.
 * Auto-dismisses after 8 seconds. One per session.
 */
import { useEffect, useState } from "react";
import { X, Clock, Flame, ArrowRight } from "lucide-react";
import { useReturnMessage } from "@/hooks/useReturnMessage";
import { loadUserProfile } from "@/lib/userMemory";

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const AUTO_DISMISS_MS = 8000;

// ── Animated CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @keyframes rb-in {
    from { transform: translateY(100%) scale(0.95); opacity: 0; }
    to   { transform: translateY(0)    scale(1);    opacity: 1; }
  }
  @keyframes rb-out {
    from { transform: translateY(0)    scale(1);    opacity: 1; }
    to   { transform: translateY(110%) scale(0.95); opacity: 0; }
  }
  @keyframes rb-progress {
    from { width: 100%; }
    to   { width: 0%; }
  }
  @keyframes rb-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.6; }
  }
  @keyframes rb-flame {
    0%, 100% { transform: scaleY(1)    rotate(-2deg); }
    50%       { transform: scaleY(1.15) rotate(2deg);  }
  }
`;

// ── Category styling ───────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  same_day:        { accent: "#A29BFE", label: "Welcome back"   },
  next_day:        { accent: "#A29BFE", label: "Good to see you" },
  short_absence:   { accent: "#FD79A8", label: "You're back!"   },
  long_absence:    { accent: "#FBBF24", label: "It's been a while" },
  extended_break:  { accent: "#F87171", label: "Been a minute"  },
};

// ── Main component ─────────────────────────────────────────────────────────────

export function ReturnBanner() {
  const { context, visible, dismiss } = useReturnMessage();
  const [exiting, setExiting]         = useState(false);
  const [mounted, setMounted]         = useState(false);

  const streak = loadUserProfile().streak;

  // Small mount delay so the home page renders first
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setMounted(true), 1200);
    return () => clearTimeout(t);
  }, [visible]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => handleDismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !context) return null;
  if (!mounted) return null;

  function handleDismiss() {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => dismiss(), 380);
  }

  const cfg     = CATEGORY_CONFIG[context.category] ?? CATEGORY_CONFIG.same_day;
  const accent  = cfg.accent;
  const anim    = exiting
    ? `rb-out 0.38s ${IOS} forwards`
    : `rb-in  0.50s ${SPRING} both`;

  return (
    <>
      <style>{CSS}</style>

      {/* ── Backdrop (tap to dismiss) ───────────────────────────────────── */}
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 9800,
          background: "rgba(0,0,0,0.30)",
          backdropFilter: exiting ? "none" : "blur(3px)",
          opacity: exiting ? 0 : 1,
          transition: `opacity 0.35s ${IOS}`,
        }}
      />

      {/* ── Banner ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: "max(env(safe-area-inset-bottom, 0px), 80px)", // above bottom nav
          left: 12, right: 12,
          zIndex: 9801,
          animation: anim,
        }}
      >
        <div style={{
          position: "relative",
          borderRadius: 24,
          background: "rgba(14,12,32,0.55)",
          border: `1px solid ${accent}25`,
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          boxShadow: [
            `0 0 0 1px ${accent}12`,
            "0 24px 64px rgba(0,0,0,0.70)",
            `0 0 48px ${accent}18`,
          ].join(", "),
          overflow: "hidden",
        }}>
          {/* ── Gradient tint at top ──────────────────────────────────── */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 60,
            background: `linear-gradient(180deg, ${accent}10 0%, transparent 100%)`,
            pointerEvents: "none",
          }} />

          {/* ── Main content ─────────────────────────────────────────── */}
          <div style={{ padding: "16px 16px 0", position: "relative" }}>

            {/* Row: icon + text + dismiss */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>

              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: `${accent}15`,
                border: `1px solid ${accent}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Clock style={{ width: 18, height: 18, color: accent }} />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Label row */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  marginBottom: 5,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: "0.09em",
                    textTransform: "uppercase", color: accent,
                  }}>
                    {cfg.label}
                  </span>

                  {/* Streak badge */}
                  {streak > 1 && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 3,
                      background: "rgba(251,191,36,0.12)",
                      border: "1px solid rgba(251,191,36,0.25)",
                      borderRadius: 99,
                      padding: "2px 7px",
                    }}>
                      <Flame style={{
                        width: 9, height: 9, color: "#FBBF24",
                        animation: "rb-flame 1.5s ease-in-out infinite",
                      }} />
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: "#FBBF24",
                        letterSpacing: "0.03em",
                      }}>
                        {streak} day streak
                      </span>
                    </div>
                  )}

                  {/* Days away badge */}
                  {context.daysSince > 0 && (
                    <span style={{
                      fontSize: 9, color: "rgba(255,255,255,0.25)",
                      fontWeight: 500,
                    }}>
                      {context.daysSince === 1
                        ? "1 day ago"
                        : `${context.daysSince} days ago`}
                    </span>
                  )}
                </div>

                {/* Message */}
                <p style={{
                  fontSize: 14, fontWeight: 700, color: "#fff",
                  lineHeight: 1.45, letterSpacing: "-0.01em",
                  margin: 0,
                }}>
                  {context.message}
                </p>

                {/* Last topic chip */}
                {context.lastTopic && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    marginTop: 8,
                    background: `${accent}12`,
                    border: `1px solid ${accent}22`,
                    borderRadius: 10,
                    padding: "4px 10px",
                  }}>
                    <span style={{
                      fontSize: 11, color: `${accent}CC`,
                      fontWeight: 600, fontStyle: "italic",
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", maxWidth: 200,
                    }}>
                      "{context.lastTopic}"
                    </span>
                  </div>
                )}
              </div>

              {/* Dismiss X */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.45)" }} />
              </button>
            </div>

            {/* CTA button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              style={{
                marginTop: 14,
                width: "100%", padding: "12px 0",
                borderRadius: 14, border: "none",
                background: `linear-gradient(135deg, ${accent}CC, ${accent}88)`,
                color: "#fff",
                fontSize: 13, fontWeight: 800,
                letterSpacing: "0.02em",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                cursor: "pointer",
                boxShadow: `0 4px 20px ${accent}30`,
                transition: `opacity 0.18s ${IOS}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              {context.cta}
              <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* ── Progress bar ─────────────────────────────────────────── */}
          <div style={{ margin: "12px 0 0", height: 2, background: "rgba(255,255,255,0.05)" }}>
            <div style={{
              height: "100%",
              background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
              animation: `rb-progress ${AUTO_DISMISS_MS}ms linear forwards`,
            }} />
          </div>
        </div>
      </div>
    </>
  );
}
