/**
 * AvatarGreeting — Dynamic greeting card shown on app open for returning users.
 *
 * Features:
 *   • Personality-tinted avatar orb with idle head movement + orbital rings
 *   • Greeting text with typewriter reveal
 *   • Optional voice via Web Speech API (respects user's TTS preference)
 *   • Real-time voice wave bars while speaking
 *   • Progress bar showing auto-dismiss timer (5 seconds)
 *   • Slides in from top, fades out on dismiss / timeout
 *   • Tap backdrop or ✕ to dismiss
 *   • Never shown again this session after dismissal
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { usePersonality } from "@/contexts/PersonalityContext";
import { useAvatarGreeting } from "@/hooks/useAvatarGreeting";

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING   = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const IOS      = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SHOW_MS  = 5800; // auto-dismiss after this
const SESSION_SHOWN_KEY = "apex_greeting_shown";

const PERSONALITY_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
  strategist: { primary: "#6C5CE7", secondary: "#A29BFE", glow: "rgba(108,92,231,0.40)" },
  friend:     { primary: "#F59E0B", secondary: "#FCD34D", glow: "rgba(245,158,11,0.40)"  },
  innovator:  { primary: "#EC4899", secondary: "#F9A8D4", glow: "rgba(236,72,153,0.40)"  },
  mentor:     { primary: "#10B981", secondary: "#6EE7B7", glow: "rgba(16,185,129,0.40)"  },
  debater:    { primary: "#228BE6", secondary: "#74C0FC", glow: "rgba(34,139,230,0.40)"  },
  default:    { primary: "#6C5CE7", secondary: "#A29BFE", glow: "rgba(108,92,231,0.40)"  },
};

// ── CSS injected once ─────────────────────────────────────────────────────────

const GREETING_CSS = `
  @keyframes ag-slide-in {
    from { transform: translateY(-110%) scale(0.94); opacity: 0; }
    to   { transform: translateY(0)       scale(1);    opacity: 1; }
  }
  @keyframes ag-slide-out {
    from { transform: translateY(0)       scale(1);    opacity: 1; }
    to   { transform: translateY(-110%)   scale(0.94); opacity: 0; }
  }
  @keyframes ag-fade-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ag-orb-breathe {
    0%, 100% { transform: scale(1)    rotate(-1deg); }
    50%       { transform: scale(1.06) rotate(1deg);  }
  }
  @keyframes ag-ring-cw {
    from { transform: translate(-50%, -50%) rotate(0deg); }
    to   { transform: translate(-50%, -50%) rotate(360deg); }
  }
  @keyframes ag-ring-ccw {
    from { transform: translate(-50%, -50%) rotate(0deg); }
    to   { transform: translate(-50%, -50%) rotate(-360deg); }
  }
  @keyframes ag-wave {
    0%, 100% { transform: scaleY(0.4); }
    50%       { transform: scaleY(1.0); }
  }
  @keyframes ag-progress {
    from { width: 100%; }
    to   { width: 0%; }
  }
  @keyframes ag-cursor {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  @keyframes ag-star-twinkle {
    0%, 100% { opacity: 0.06; }
    50%       { opacity: 0.40; }
  }
`;

// ── Mini Avatar Orb (compact version for the greeting card) ───────────────────

function MiniAvatarOrb({ primary, secondary, glow, speaking }: {
  primary: string; secondary: string; glow: string; speaking: boolean;
}) {
  const bars = Array.from({ length: 7 });

  return (
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>

      {/* Ambient glow */}
      <div style={{
        position: "absolute", inset: -16,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
        animation: "ag-orb-breathe 3s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Ring CW */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 88, height: 88,
        borderRadius: "50%",
        border:          `1.5px solid ${primary}28`,
        borderTopColor:  `${primary}BB`,
        animation: "ag-ring-cw 6s linear infinite",
      }} />

      {/* Ring CCW */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 68, height: 68,
        borderRadius: "50%",
        border:             `1px solid ${secondary}20`,
        borderBottomColor:  `${secondary}99`,
        animation: "ag-ring-ccw 4s linear infinite",
      }} />

      {/* Core orb */}
      <div style={{
        position: "absolute", inset: 8,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 55%, #FD79A8 100%)`,
        animation: "ag-orb-breathe 2.8s ease-in-out infinite",
        boxShadow: [
          `0 0 18px ${glow}`,
          `0 0 36px ${glow.replace("0.40", "0.20")}`,
          "inset 0 1px 0 rgba(255,255,255,0.30)",
        ].join(", "),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, color: "#fff", userSelect: "none",
      }}>
        ◆
      </div>

      {/* Voice wave bars below orb (shown when speaking) */}
      {speaking && (
        <div style={{
          position: "absolute",
          bottom: -18, left: "50%",
          transform: "translateX(-50%)",
          display: "flex", alignItems: "flex-end", gap: 2,
          height: 16,
          animation: "ag-fade-in 0.25s ease both",
        }}>
          {bars.map((_, i) => {
            const h = 40 + Math.sin(i * 1.1) * 45;
            return (
              <div key={i} style={{
                width: 2, borderRadius: 1,
                background: `linear-gradient(to top, ${primary}, ${secondary})`,
                height: `${h}%`,
                animation: `ag-wave ${0.5 + i * 0.07}s ${i * 0.05}s ease-in-out infinite alternate`,
                transformOrigin: "bottom",
              }} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Typewriter hook ───────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 38) {
  const [displayed, setDisplayed] = useState("");
  const [done,      setDone]      = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { setDone(true); clearInterval(id); }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return { displayed, done };
}

// ── Main AvatarGreeting component ─────────────────────────────────────────────

interface AvatarGreetingProps {
  /** Optional override — if omitted, `useAvatarGreeting()` generates it */
  text?: string;
  /** Enable Web Speech API voice (default: true) */
  voice?: boolean;
}

export function AvatarGreeting({ text: textOverride, voice = true }: AvatarGreetingProps) {
  const { profile: { id: personalityId } } = usePersonality();
  const greeting = useAvatarGreeting();

  const [visible,   setVisible]   = useState(true);
  const [exiting,   setExiting]   = useState(false);
  const [speaking,  setSpeaking]  = useState(false);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const palette = PERSONALITY_COLORS[personalityId ?? "default"] ?? PERSONALITY_COLORS.default;

  // Determine text to show
  const greetingText = textOverride ?? greeting?.text;

  const { displayed, done } = useTypewriter(greetingText ?? "", 42);

  // ── Dismiss handler ───────────────────────────────────────────────────────

  const dismiss = useCallback(() => {
    if (exiting) return;
    greeting?.markSeen();
    try { sessionStorage.setItem(SESSION_SHOWN_KEY, "1"); } catch {}
    setExiting(true);
    window.speechSynthesis?.cancel();
    if (dismissRef.current) clearTimeout(dismissRef.current);
    setTimeout(() => setVisible(false), 400);
  }, [exiting, greeting]);

  // ── Auto-dismiss timer ────────────────────────────────────────────────────

  useEffect(() => {
    dismissRef.current = setTimeout(dismiss, SHOW_MS);
    return () => { if (dismissRef.current) clearTimeout(dismissRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!greetingText || !voice || !window.speechSynthesis) return;

    // Small delay so text animation starts first
    const t = setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(greetingText);
      utter.rate   = 0.92;
      utter.pitch  = 1.05;
      utter.volume = 0.85;

      utter.onstart = () => setSpeaking(true);
      utter.onend   = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utter);
    }, 400);

    return () => {
      clearTimeout(t);
      window.speechSynthesis?.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetingText]);

  // Don't mount if already shown this session
  if (!greetingText) return null;
  try {
    if (sessionStorage.getItem(SESSION_SHOWN_KEY)) return null;
  } catch {}
  if (!visible) return null;

  const cardAnim = exiting
    ? `ag-slide-out 0.40s ${IOS} forwards`
    : `ag-slide-in  0.52s ${SPRING} both`;

  return (
    <>
      <style>{GREETING_CSS}</style>

      {/* ── Subtle backdrop tap-to-dismiss ──────────────────────────────── */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 9000,
          pointerEvents: exiting ? "none" : "all",
          background: "transparent",
        }}
      />

      {/* ── Greeting card ────────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: "max(env(safe-area-inset-top, 0px), 12px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 32px)",
          maxWidth: 420,
          zIndex: 9001,
          animation: cardAnim,
        }}
      >
        <div style={{
          position: "relative",
          borderRadius: 24,
          background: "rgba(13,14,24,0.96)",
          border: `1px solid ${palette.primary}30`,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: [
            `0 0 0 1px ${palette.primary}18`,
            `0 8px 48px rgba(0,0,0,0.70)`,
            `0 0 40px ${palette.glow}`,
          ].join(", "),
          overflow: "hidden",
          padding: "18px 18px 0",
        }}>

          {/* Ambient gradient blob */}
          <div style={{
            position: "absolute",
            top: -40, right: -40,
            width: 180, height: 180,
            borderRadius: "50%",
            background: palette.primary,
            filter: "blur(80px)",
            opacity: 0.10,
            pointerEvents: "none",
          }} />

          {/* Stars */}
          {[...Array(14)].map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${(i * 31.7 + 5) % 100}%`,
              top:  `${(i * 47.3 + 11) % 100}%`,
              width: 1.5, height: 1.5,
              borderRadius: "50%",
              background: "#fff",
              opacity: 0.12,
              animation: `ag-star-twinkle ${2 + (i % 3)}s ${(i * 0.3) % 2}s ease-in-out infinite`,
              pointerEvents: "none",
            }} />
          ))}

          {/* ── Main row: avatar + text + dismiss ─────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            position: "relative", zIndex: 1,
          }}>

            {/* Avatar orb */}
            <MiniAvatarOrb
              primary={palette.primary}
              secondary={palette.secondary}
              glow={palette.glow}
              speaking={speaking}
            />

            {/* Text + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* "Apex says" label */}
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: `${palette.secondary}99`,
                marginBottom: 6,
                animation: "ag-fade-in 0.4s 0.1s both",
              }}>
                Apex
              </div>

              {/* Greeting text with typewriter */}
              <div style={{
                fontSize: 16, fontWeight: 700,
                color: "#fff",
                lineHeight: 1.45,
                letterSpacing: "-0.01em",
                animation: "ag-fade-in 0.5s 0.2s both",
              }}>
                {displayed}
                {!done && (
                  <span style={{
                    display: "inline-block",
                    width: 2, height: 14,
                    background: palette.secondary,
                    borderRadius: 1,
                    marginLeft: 2,
                    verticalAlign: "text-bottom",
                    animation: "ag-cursor 0.75s step-end infinite",
                  }} />
                )}
              </div>

              {/* "Tap to respond" hint */}
              {done && (
                <div style={{
                  fontSize: 10, color: "rgba(255,255,255,0.28)",
                  marginTop: 6, fontWeight: 500,
                  animation: "ag-fade-in 0.4s 0.1s both",
                }}>
                  Tap to start chatting
                </div>
              )}
            </div>

            {/* Dismiss button */}
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
                transition: `all 0.15s ${IOS}`,
                animation: "ag-fade-in 0.4s 0.3s both",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
            >
              <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.55)" }} />
            </button>
          </div>

          {/* ── Progress bar (auto-dismiss countdown) ────────────────────── */}
          <div style={{
            marginTop: 14,
            height: 2,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 1,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              background: `linear-gradient(90deg, ${palette.primary}, ${palette.secondary})`,
              borderRadius: 1,
              animation: `ag-progress ${SHOW_MS}ms linear forwards`,
            }} />
          </div>

          {/* Bottom padding */}
          <div style={{ height: 14 }} />
        </div>
      </div>
    </>
  );
}

// ── AvatarGreetingGate — renders once per session, skips FTUE users ───────────

export function AvatarGreetingGate() {
  const [mounted, setMounted] = useState(false);

  // Small delay so the home page renders first (better UX)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 800);
    return () => clearTimeout(t);
  }, []);

  if (!mounted) return null;

  // Check session guard (avoid showing if already dismissed)
  try {
    if (sessionStorage.getItem(SESSION_SHOWN_KEY)) return null;
  } catch {}

  return <AvatarGreeting />;
}
