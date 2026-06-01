/**
 * AvatarReengagement — Behavioral re-engagement modal.
 *
 * Cinematic 4-phase sequence:
 *   Phase 0  (0 – 700ms)    LOOK   — avatar "focuses" on user (rings converge, glow intensifies)
 *   Phase 1  (700 – 1600ms) PAUSE  — thinking dot indicator, silent
 *   Phase 2  (1600ms+)      SPEAK  — typewriter text + optional Web Speech API voice
 *   Phase 3  (after typing) REACT  — expression shifts to tone (concerned / affirming / engaged)
 *
 * Tone drives everything: visual palette, voice params, avatar expression, sub-text.
 *
 * Session-gated: fires at most once per session per set of conditions.
 * Slides up from the bottom of the screen (distinct from the top-slide AvatarGreeting).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { X, Zap } from "lucide-react";
import { usePersonality } from "@/contexts/PersonalityContext";
import {
  ReengagementMessage,
  ReengagementTone,
  getAvatarExpression,
  getVoiceParams,
  markReengagementShown,
} from "@/lib/reengagementEngine";

// ── Constants ──────────────────────────────────────────────────────────────────
const SPRING   = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const IOS      = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SHOW_MS  = 7000;

// Phase durations (ms)
const LOOK_MS  = 700;
const PAUSE_MS = 900;   // LOOK_MS + PAUSE_MS = phase 2 start

// ── Tone palette ───────────────────────────────────────────────────────────────
const TONE_PALETTE: Record<ReengagementTone, {
  primary: string; secondary: string; glow: string; label: string;
}> = {
  concerned: {
    primary:   "#60A5FA",
    secondary: "#93C5FD",
    glow:      "rgba(96,165,250,0.45)",
    label:     "Apex noticed",
  },
  affirming: {
    primary:   "#34D399",
    secondary: "#6EE7B7",
    glow:      "rgba(52,211,153,0.50)",
    label:     "Apex sees you",
  },
  engaged: {
    primary:   "#A78BFA",
    secondary: "#C4B5FD",
    glow:      "rgba(167,139,250,0.45)",
    label:     "Apex is ready",
  },
};

// ── Personality primary override ───────────────────────────────────────────────
const PERSONALITY_PRIMARY: Record<string, string> = {
  strategist: "#6C5CE7",
  friend:     "#F59E0B",
  innovator:  "#EC4899",
  mentor:     "#10B981",
  debater:    "#228BE6",
};

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes ar-slide-up {
    from { transform: translateY(110%) scale(0.94); opacity: 0; }
    to   { transform: translateY(0)      scale(1);   opacity: 1; }
  }
  @keyframes ar-slide-down {
    from { transform: translateY(0)      scale(1);   opacity: 1; }
    to   { transform: translateY(110%)   scale(0.94); opacity: 0; }
  }
  @keyframes ar-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ar-breathe {
    0%, 100% { transform: scale(1); }
    50%       { transform: scale(1.06); }
  }
  @keyframes ar-focus-ring {
    0%   { transform: translate(-50%,-50%) scale(1.5); opacity: 0; }
    40%  { opacity: 1; }
    100% { transform: translate(-50%,-50%) scale(1);   opacity: 0; }
  }
  @keyframes ar-ring-cw {
    from { transform: translate(-50%,-50%) rotate(0deg); }
    to   { transform: translate(-50%,-50%) rotate(360deg); }
  }
  @keyframes ar-ring-ccw {
    from { transform: translate(-50%,-50%) rotate(0deg); }
    to   { transform: translate(-50%,-50%) rotate(-360deg); }
  }
  @keyframes ar-thinking-dot {
    0%, 100% { opacity: 0.20; transform: scaleY(0.6); }
    50%       { opacity: 1;    transform: scaleY(1.0); }
  }
  @keyframes ar-wave {
    0%, 100% { transform: scaleY(0.3); }
    50%       { transform: scaleY(1.0); }
  }
  @keyframes ar-cursor {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  @keyframes ar-progress {
    from { width: 100%; }
    to   { width: 0%; }
  }
  @keyframes ar-glow-pulse {
    0%, 100% { opacity: 0.50; }
    50%       { opacity: 0.90; }
  }
  @keyframes ar-nod {
    0%   { transform: rotate(0deg); }
    25%  { transform: rotate(4deg); }
    50%  { transform: rotate(-2deg); }
    75%  { transform: rotate(2deg); }
    100% { transform: rotate(0deg); }
  }
  @keyframes ar-lean-in {
    0%   { transform: scale(1)    rotate(0deg); }
    40%  { transform: scale(1.06) rotate(-3deg); }
    100% { transform: scale(1.04) rotate(-2deg); }
  }
  @keyframes ar-forward {
    0%   { transform: scale(1)    translateY(0); }
    100% { transform: scale(1.05) translateY(-2px); }
  }
  @keyframes ar-star-twinkle {
    0%, 100% { opacity: 0.05; }
    50%       { opacity: 0.35; }
  }
`;

// ── Phase type ─────────────────────────────────────────────────────────────────
type Phase = "look" | "pause" | "speak" | "react";

// ── Typewriter ─────────────────────────────────────────────────────────────────
function useTypewriter(text: string, enabled: boolean, speed = 36) {
  const [displayed, setDisplayed] = useState("");
  const [done,      setDone]      = useState(false);

  useEffect(() => {
    if (!enabled) { setDisplayed(""); setDone(false); return; }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { setDone(true); clearInterval(id); }
    }, speed);
    return () => clearInterval(id);
  }, [text, enabled, speed]);

  return { displayed, done };
}

// ── Focus rings (LOOK phase) ───────────────────────────────────────────────────
function FocusRings({ color }: { color: string }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          position: "absolute", top: "50%", left: "50%",
          width: 80 + i * 24, height: 80 + i * 24,
          borderRadius: "50%",
          border: `1.5px solid ${color}`,
          animation: `ar-focus-ring 0.90s ${i * 0.18}s ${IOS} both`,
          pointerEvents: "none",
        }} />
      ))}
    </>
  );
}

// ── Thinking dots (PAUSE phase) ────────────────────────────────────────────────
function ThinkingDots({ color }: { color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", gap: 3, height: 14,
      animation: `ar-fade-in 0.25s ease both`,
    }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 3, height: 10, borderRadius: 2,
          background: color,
          transformOrigin: "bottom",
          animation: `ar-thinking-dot 0.65s ${i * 0.18}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Voice wave (SPEAK phase) ───────────────────────────────────────────────────
function VoiceWave({ color, speaking }: { color: string; speaking: boolean }) {
  if (!speaking) return null;
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", gap: 2, height: 14,
      animation: `ar-fade-in 0.20s ease both`,
    }}>
      {Array.from({ length: 7 }).map((_, i) => {
        const h = 40 + Math.sin(i * 1.1) * 45;
        return (
          <div key={i} style={{
            width: 2, borderRadius: 1,
            background: color,
            height: `${h}%`,
            animation: `ar-wave ${0.45 + i * 0.07}s ${i * 0.05}s ease-in-out infinite alternate`,
            transformOrigin: "bottom",
          }} />
        );
      })}
    </div>
  );
}

// ── Avatar orb ─────────────────────────────────────────────────────────────────
function ReengagementOrb({
  primary, secondary, glow, phase, tone, speaking,
}: {
  primary: string; secondary: string; glow: string;
  phase: Phase; tone: ReengagementTone; speaking: boolean;
}) {
  const expr     = getAvatarExpression(tone);
  const orbAnim  = phase === "react"
    ? `ar-${expr.animVariant} 0.60s ${IOS} both`
    : `ar-breathe ${phase === "look" ? "0.8" : "2.8"}s ease-in-out infinite`;

  return (
    <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>

      {/* Ambient glow */}
      <div style={{
        position: "absolute", inset: -20,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
        opacity: phase === "look" ? 0.90 : expr.glowIntensity,
        animation: "ar-glow-pulse 2s ease-in-out infinite",
        transition: `opacity 0.60s ${IOS}`,
        pointerEvents: "none",
      }} />

      {/* Focus rings (LOOK phase) */}
      {phase === "look" && <FocusRings color={`${primary}80`} />}

      {/* Orbital rings (SPEAK / REACT) */}
      {(phase === "speak" || phase === "react") && <>
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 98, height: 98, borderRadius: "50%",
          border: `1.5px solid ${primary}28`, borderTopColor: `${primary}CC`,
          animation: "ar-ring-cw 5s linear infinite",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 76, height: 76, borderRadius: "50%",
          border: `1px solid ${secondary}20`, borderBottomColor: `${secondary}AA`,
          animation: "ar-ring-ccw 3.5s linear infinite",
        }} />
      </>}

      {/* Core orb */}
      <div style={{
        position: "absolute", inset: 10,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 60%, #FD79A8 100%)`,
        animation: orbAnim,
        boxShadow: [
          `0 0 ${20 * expr.glowIntensity}px ${glow}`,
          `0 0 ${40 * expr.glowIntensity}px ${glow.replace("0.45", "0.20").replace("0.50", "0.22").replace("0.70", "0.30")}`,
          "inset 0 1px 0 rgba(255,255,255,0.28)",
        ].join(", "),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, color: "#fff",
        transform: `rotate(${expr.headTilt}deg)`,
        transition: `transform 0.60s ${IOS}`,
      }}>
        ◆
      </div>

      {/* Voice wave below orb */}
      <div style={{
        position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)",
      }}>
        <VoiceWave color={primary} speaking={speaking} />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface AvatarReengagementProps {
  message:   ReengagementMessage;
  onDismiss: () => void;
}

export function AvatarReengagement({ message, onDismiss }: AvatarReengagementProps) {
  const { personalityId } = usePersonality();

  const [phase,    setPhase]    = useState<Phase>("look");
  const [visible,  setVisible]  = useState(true);
  const [exiting,  setExiting]  = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const palette = TONE_PALETTE[message.tone];

  // Use personality colour if available, blend with tone for the orb
  const primaryColor = PERSONALITY_PRIMARY[personalityId ?? ""] ?? palette.primary;

  // ── Phase state machine ──────────────────────────────────────────────────────
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("pause"), LOOK_MS);
    const t2 = setTimeout(() => setPhase("speak"), LOOK_MS + PAUSE_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── Auto-dismiss ─────────────────────────────────────────────────────────────
  useEffect(() => {
    dismissRef.current = setTimeout(handleDismiss, SHOW_MS);
    return () => { if (dismissRef.current) clearTimeout(dismissRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Typewriter (only starts in speak phase) ──────────────────────────────────
  const { displayed, done } = useTypewriter(
    message.text,
    phase === "speak" || phase === "react",
    38,
  );

  // Shift to REACT once typing completes
  useEffect(() => {
    if (done && phase === "speak") setPhase("react");
  }, [done, phase]);

  // ── Voice ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "speak") return;
    if (!window.speechSynthesis) return;

    const vp = getVoiceParams(message.tone);
    const t  = setTimeout(() => {
      const utter    = new SpeechSynthesisUtterance(message.text);
      utter.rate     = vp.rate;
      utter.pitch    = vp.pitch;
      utter.volume   = vp.volume;
      utter.onstart  = () => setSpeaking(true);
      utter.onend    = () => setSpeaking(false);
      utter.onerror  = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    }, 300);

    return () => { clearTimeout(t); window.speechSynthesis?.cancel(); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dismiss ───────────────────────────────────────────────────────────────────
  const handleDismiss = useCallback(() => {
    if (exiting) return;
    markReengagementShown();
    window.speechSynthesis?.cancel();
    if (dismissRef.current) clearTimeout(dismissRef.current);
    setExiting(true);
    setTimeout(() => { setVisible(false); onDismiss(); }, 380);
  }, [exiting, onDismiss]);

  if (!visible) return null;

  const cardAnim = exiting
    ? `ar-slide-down 0.38s ${IOS} forwards`
    : `ar-slide-up   0.52s ${SPRING} both`;

  // Phase-aware label
  const phaseLabel = {
    look:  "Looking at you…",
    pause: "Thinking…",
    speak: palette.label,
    react: palette.label,
  }[phase];

  return (
    <>
      <style>{CSS}</style>

      {/* Backdrop */}
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 8900,
          background: "rgba(0,0,0,0.25)",
          backdropFilter: "blur(2px)",
          pointerEvents: exiting ? "none" : "all",
        }}
      />

      {/* Card — slides up from bottom */}
      <div
        style={{
          position: "fixed",
          bottom: "max(env(safe-area-inset-bottom, 0px), 84px)",
          left: "50%", transform: "translateX(-50%)",
          width: "calc(100% - 32px)", maxWidth: 420,
          zIndex: 8901,
          animation: cardAnim,
        }}
      >
        <div style={{
          position: "relative",
          borderRadius: 28,
          background: "rgba(10,10,20,0.97)",
          border: `1px solid ${primaryColor}28`,
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          boxShadow: [
            `0 0 0 1px ${primaryColor}15`,
            `0 -4px 48px rgba(0,0,0,0.60)`,
            `0  8px 48px rgba(0,0,0,0.50)`,
            `0 0 48px ${palette.glow}`,
          ].join(", "),
          overflow: "hidden",
        }}>

          {/* Top glow line */}
          <div style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${primaryColor}, ${palette.secondary}, transparent)`,
            opacity: 0.70,
          }} />

          {/* Ambient blob */}
          <div style={{
            position: "absolute", top: -50, left: -50,
            width: 200, height: 200, borderRadius: "50%",
            background: primaryColor, filter: "blur(90px)", opacity: 0.07,
            pointerEvents: "none",
          }} />

          {/* Stars */}
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${(i * 37.1 + 8) % 100}%`,
              top:  `${(i * 53.7 + 15) % 100}%`,
              width: 1.5, height: 1.5, borderRadius: "50%",
              background: "#fff", opacity: 0.10,
              animation: `ar-star-twinkle ${2 + (i % 3) * 0.8}s ${(i * 0.25) % 2}s ease-in-out infinite`,
              pointerEvents: "none",
            }} />
          ))}

          {/* Main content */}
          <div style={{ padding: "20px 18px 0", position: "relative", zIndex: 1 }}>

            {/* Header row */}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 16,
            }}>
              {/* Orb */}
              <ReengagementOrb
                primary={primaryColor}
                secondary={palette.secondary}
                glow={palette.glow}
                phase={phase}
                tone={message.tone}
                speaking={speaking}
              />

              {/* Text area */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                {/* Phase label with icon */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 5,
                  marginBottom: 8,
                  animation: "ar-fade-in 0.35s 0.10s both",
                }}>
                  <Zap style={{
                    width: 10, height: 10,
                    color: primaryColor,
                    fill: primaryColor,
                    opacity: phase === "look" || phase === "pause" ? 0.50 : 1,
                    transition: `opacity 0.40s ${IOS}`,
                  }} />
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: `${primaryColor}${phase === "look" || phase === "pause" ? "80" : "CC"}`,
                    transition: `color 0.40s ${IOS}`,
                  }}>
                    {phaseLabel}
                  </span>
                </div>

                {/* Message content */}
                <div style={{ minHeight: 48 }}>
                  {/* LOOK phase — just glow, no text */}
                  {phase === "look" && (
                    <div style={{
                      width: "60%", height: 3, borderRadius: 2,
                      background: `${primaryColor}30`,
                      animation: "ar-fade-in 0.30s ease both",
                    }} />
                  )}

                  {/* PAUSE phase — thinking dots */}
                  {phase === "pause" && (
                    <div style={{ paddingTop: 8 }}>
                      <ThinkingDots color={primaryColor} />
                    </div>
                  )}

                  {/* SPEAK / REACT phases — typewriter text */}
                  {(phase === "speak" || phase === "react") && (
                    <p style={{
                      fontSize: 17, fontWeight: 700,
                      color: "#FFFFFF",
                      lineHeight: 1.45, letterSpacing: "-0.01em",
                      margin: 0,
                      animation: "ar-fade-in 0.30s ease both",
                    }}>
                      {displayed}
                      {!done && (
                        <span style={{
                          display: "inline-block",
                          width: 2, height: 15,
                          background: palette.secondary,
                          borderRadius: 1,
                          marginLeft: 2,
                          verticalAlign: "text-bottom",
                          animation: "ar-cursor 0.75s step-end infinite",
                        }} />
                      )}
                    </p>
                  )}
                </div>

                {/* Subtext — shown once typing is done */}
                {phase === "react" && (
                  <p style={{
                    fontSize: 12, color: "rgba(255,255,255,0.40)",
                    margin: "6px 0 0", lineHeight: 1.55,
                    animation: "ar-fade-in 0.40s 0.15s both",
                  }}>
                    {message.subtext}
                  </p>
                )}

                {/* CTA hint */}
                {phase === "react" && (
                  <div style={{
                    marginTop: 10,
                    animation: "ar-fade-in 0.40s 0.30s both",
                  }}>
                    <span style={{
                      fontSize: 10, color: "rgba(255,255,255,0.26)",
                      fontWeight: 500,
                    }}>
                      Tap to start chatting
                    </span>
                  </div>
                )}
              </div>

              {/* Dismiss button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  animation: "ar-fade-in 0.40s 0.30s both",
                  transition: `background 0.15s ${IOS}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
              >
                <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.50)" }} />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 18, height: 2, background: "rgba(255,255,255,0.05)" }}>
            <div style={{
              height: "100%",
              background: `linear-gradient(90deg, ${primaryColor}, ${palette.secondary})`,
              animation: `ar-progress ${SHOW_MS}ms linear forwards`,
            }} />
          </div>

          <div style={{ height: 16 }} />
        </div>
      </div>
    </>
  );
}
