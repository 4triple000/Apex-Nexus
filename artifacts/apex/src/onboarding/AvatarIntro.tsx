/**
 * AvatarIntro — Step 2 of FTUE (the WOW moment)
 *
 * The avatar orb materializes with two counter-rotating rings,
 * a pulsing glow, idle head movement, and voice wave bars.
 * The spoken quote fades in with a 0.7s delay.
 * Calls onNext() after 4.2 seconds, or on "Continue" tap.
 */
import { useState, useEffect } from "react";
import { IOS, SPRING } from "./useOnboarding";

interface AvatarIntroProps {
  exiting: boolean;
  onNext:  () => void;
}

// ── Animated orb with idle head movement ─────────────────────────────────────

function ApexAvatar() {
  const bars = Array.from({ length: 9 });

  return (
    <div style={{ position: "relative", width: 170, height: 170 }}>

      {/* Outer ambient glow — breathes */}
      <div style={{
        position: "absolute", inset: -50,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(108,92,231,0.28) 0%, transparent 65%)",
        animation: "ob-orb-breathe 3.2s ease-in-out infinite",
      }} />

      {/* Ring 1 — slow clockwise, violet */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 194, height: 194,
        borderRadius: "50%",
        border:           "1.5px solid rgba(162,155,254,0.18)",
        borderTopColor:   "rgba(162,155,254,0.75)",
        borderRightColor: "rgba(162,155,254,0.12)",
        animation: "ob-ring-cw 7s linear infinite",
      }} />

      {/* Ring 2 — faster counter-clockwise, pink */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 150, height: 150,
        borderRadius: "50%",
        border:             "1px solid rgba(253,121,168,0.14)",
        borderBottomColor:  "rgba(253,121,168,0.70)",
        borderLeftColor:    "rgba(253,121,168,0.08)",
        animation: "ob-ring-ccw 4.5s linear infinite",
      }} />

      {/* Ring 3 — medium, aqua tint */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 122, height: 122,
        borderRadius: "50%",
        border:           "0.8px solid rgba(6,182,212,0.10)",
        borderTopColor:   "rgba(6,182,212,0.45)",
        animation: "ob-ring-cw 10s 1.5s linear infinite",
      }} />

      {/* Core orb — idle head movement */}
      <div style={{
        position: "absolute", inset: 16,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #6C5CE7 0%, #A29BFE 50%, #FD79A8 100%)",
        animation: `ob-orb-breathe 2.9s 0.4s ease-in-out infinite, ob-head-idle 4s 0.8s ease-in-out infinite`,
        boxShadow: [
          "0 0 32px rgba(108,92,231,0.55)",
          "0 0 64px rgba(162,155,254,0.30)",
          "inset 0 2px 0 rgba(255,255,255,0.28)",
          "inset 0 -2px 0 rgba(0,0,0,0.18)",
        ].join(", "),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 56, userSelect: "none",
      }}>
        ◆
      </div>

      {/* Voice-wave bars */}
      <div style={{
        position: "absolute",
        bottom: -36, left: "50%",
        transform: "translateX(-50%)",
        display: "flex", alignItems: "flex-end", gap: 3,
        height: 28,
      }}>
        {bars.map((_, i) => {
          const mid = 4;
          const dist = Math.abs(i - mid);
          const base = 100 - dist * 14;
          return (
            <div key={i} style={{
              width: 2.5, borderRadius: 2,
              background: "linear-gradient(to top, #6C5CE7 0%, #A29BFE 50%, #FD79A8 100%)",
              height: `${base}%`,
              animation: `ob-wave-bar ${0.55 + i * 0.06}s ${i * 0.05}s ease-in-out infinite alternate`,
              transformOrigin: "bottom",
            }} />
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AvatarIntro({ exiting, onNext }: AvatarIntroProps) {
  const [btnPressed, setBtnPressed] = useState(false);

  // Auto-advance after 4.2 seconds
  useEffect(() => {
    const t = setTimeout(() => onNext(), 4200);
    return () => clearTimeout(t);
  }, [onNext]);

  const wrapAnim = exiting
    ? "ob-fade-out 0.36s ease forwards"
    : "ob-fade-in  0.55s ease both";

  function handleContinue() {
    setBtnPressed(true);
    setTimeout(onNext, 280);
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: 54,
      width: "100%", padding: "0 32px",
      textAlign: "center",
      animation: wrapAnim,
    }}>

      {/* Avatar */}
      <div style={{ animation: "ob-fade-in 0.75s 0.1s both" }}>
        <ApexAvatar />
      </div>

      {/* Quote block */}
      <div style={{
        maxWidth: 290,
        animation: "ob-fade-in 0.85s 0.8s both",
      }}>
        <div style={{
          fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.30)",
          marginBottom: 12,
        }}>
          Apex says
        </div>

        <div style={{
          fontSize: 18, fontWeight: 700,
          color: "#fff", lineHeight: 1.65,
          letterSpacing: "-0.01em",
        }}>
          "I'll adapt to how you think…&nbsp;how you work…&nbsp;and how you grow."
        </div>

        {/* Accent rule */}
        <div style={{
          width: 44, height: 2, borderRadius: 1,
          background: "linear-gradient(90deg, #6C5CE7, #FD79A8)",
          margin: "18px auto 0",
        }} />
      </div>

      {/* Manual continue button (visible after 1.5s) */}
      <div style={{ animation: "ob-fade-in 0.5s 1.5s both" }}>
        <button
          onClick={handleContinue}
          style={{
            padding: "10px 28px",
            borderRadius: 99,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "rgba(255,255,255,0.55)",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            transform: btnPressed ? "scale(0.93)" : "scale(1)",
            transition: `all 0.2s ${SPRING}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.10)";
            e.currentTarget.style.color = "rgba(255,255,255,0.85)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            e.currentTarget.style.color = "rgba(255,255,255,0.55)";
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
