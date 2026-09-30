/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ApexAvatarEntity — Apex Visual Avatar System v1            ║
 * ║                                                              ║
 * ║  Energy orb avatar with 6 states + voice sync + mode colors ║
 * ║                                                              ║
 * ║  States:  idle · thinking · speaking · building · error     ║
 * ║           · success                                          ║
 * ║  Modes:   chat · builder · game · command                   ║
 * ║  Props:   amplitude (0–1) drives visual intensity during TTS ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useEffect, useRef, useState, memo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AvatarEntityState = "idle" | "thinking" | "speaking" | "building" | "error" | "success";
export type AvatarEntityMode  = "chat" | "builder" | "game" | "command";

// ── CSS injection (once) ──────────────────────────────────────────────────────

const STYLE_ID = "apex-avatar-entity-css";

function injectStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    /* ── Outer ring ── */
    @keyframes aeOuter      { from { transform: rotate(0deg);   } to { transform: rotate(360deg);   } }
    @keyframes aeOuterRev   { from { transform: rotate(0deg);   } to { transform: rotate(-360deg);  } }
    @keyframes aeOuterFast  { from { transform: rotate(0deg);   } to { transform: rotate(360deg);   } }

    /* ── Mid ring ── */
    @keyframes aeMid        { 0%,100%{ transform: rotate(0deg)  scale(1);    } 50%{ transform: rotate(180deg) scale(1.04); } }
    @keyframes aeMidFast    { 0%,100%{ transform: rotate(0deg)  scale(1);    } 50%{ transform: rotate(180deg) scale(1.08); } }
    @keyframes aeMidBuild   { 0%{ transform: rotate(0deg); } 25%{ transform: rotate(110deg); } 50%{ transform: rotate(180deg); } 75%{ transform: rotate(310deg); } 100%{ transform: rotate(360deg); } }

    /* ── Inner orb ── */
    @keyframes aeBreath     { 0%,100%{ transform: scale(1);    opacity: 0.90; } 50%{ transform: scale(1.06); opacity: 1;    } }
    @keyframes aeThinkPulse { 0%,100%{ transform: scale(0.96); opacity: 0.80; } 50%{ transform: scale(1.04); opacity: 1;    } }
    @keyframes aeBuildBounce{ 0%,100%{ transform: scale(1);    } 30%{ transform: scale(1.10); } 60%{ transform: scale(0.95); } }
    @keyframes aeErrorShake { 0%,100%{ transform: translateX(0);   } 15%{ transform: translateX(-8px); } 30%{ transform: translateX(8px); } 45%{ transform: translateX(-6px); } 60%{ transform: translateX(6px); } 75%{ transform: translateX(-3px); } 90%{ transform: translateX(3px); } }
    @keyframes aeSuccess    { 0%{ transform: scale(1);   opacity: 1; } 40%{ transform: scale(1.22); opacity: 0.95; } 70%{ transform: scale(0.97); opacity: 1; } 100%{ transform: scale(1); opacity: 1; } }

    /* ── Glow pulse ── */
    @keyframes aeGlow       { 0%,100%{ opacity: 0.55; } 50%{ opacity: 1;    } }
    @keyframes aeGlowFast   { 0%,100%{ opacity: 0.60; } 50%{ opacity: 1;    } }

    /* ── Particle orbit ── */
    @keyframes aeParticle   { from{ transform: rotate(var(--ao)) translateX(var(--ar)) rotate(calc(-1 * var(--ao))); } to{ transform: rotate(calc(var(--ao) + 360deg)) translateX(var(--ar)) rotate(calc(-1 * (var(--ao) + 360deg))); } }

    /* ── Scanline ── */
    @keyframes aeScanline   { 0%{ transform: translateY(-100%); } 100%{ transform: translateY(100%); } }

    /* ── Success burst ── */
    @keyframes aeBurst      { 0%{ transform: scale(0); opacity: 1; } 100%{ transform: scale(2.8); opacity: 0; } }

    /* ── Eye blink ── */
    @keyframes aeEyeBlink   { 0%,94%,100%{ scaleY: 1; } 96%,98%{ scaleY: 0; } }

    /* ── Speaking waveform bar ── */
    @keyframes aeWave       { 0%,100%{ transform: scaleY(0.3); } 50%{ transform: scaleY(1); } }
  `;
  document.head.appendChild(s);
}

// ── Mode palette ──────────────────────────────────────────────────────────────

interface ModePalette {
  primary:  string;
  secondary: string;
  glow:     string;
  ring:     string;
  particle: string;
}

const MODE_PALETTE: Record<AvatarEntityMode, ModePalette> = {
  chat:    { primary: "#FD79A8", secondary: "#C0392B", glow: "rgba(253,121,168,0.5)", ring: "rgba(253,121,168,0.25)", particle: "#FD79A8" },
  builder: { primary: "#A29BFE", secondary: "#6C5CE7", glow: "rgba(162,155,254,0.5)", ring: "rgba(162,155,254,0.25)", particle: "#A29BFE" },
  game:    { primary: "#00D2D3", secondary: "#0984E3", glow: "rgba(0,210,211,0.5)",   ring: "rgba(0,210,211,0.25)",   particle: "#00D2D3" },
  command: { primary: "#A29BFE", secondary: "#E17055", glow: "rgba(162,155,254,0.5)",  ring: "rgba(162,155,254,0.25)",  particle: "#A29BFE" },
};

// ── State animation params ────────────────────────────────────────────────────

interface StateParams {
  outerSpeed:  string;
  midSpeed:    string;
  innerAnim:   string;
  glowAnim:    string;
  outerAnim:   string;
  glowSize:    number;
  brightness:  number;
}

function getStateParams(state: AvatarEntityState): StateParams {
  switch (state) {
    case "thinking": return { outerSpeed: "3s",  midSpeed: "2.5s", innerAnim: `aeThinkPulse 1.0s ease-in-out infinite`, glowAnim: `aeGlowFast 1.0s ease-in-out infinite`, outerAnim: "aeOuter",    glowSize: 1.1,  brightness: 0.85 };
    case "speaking": return { outerSpeed: "2.2s",midSpeed: "1.8s", innerAnim: `aeBreath 0.5s ease-in-out infinite`,    glowAnim: `aeGlowFast 0.5s ease-in-out infinite`, outerAnim: "aeOuterFast", glowSize: 1.4,  brightness: 1.1  };
    case "building": return { outerSpeed: "1.4s",midSpeed: "1.1s", innerAnim: `aeBuildBounce 0.7s cubic-bezier(0.34,1.56,0.64,1) infinite`, glowAnim: `aeGlowFast 0.7s ease-in-out infinite`, outerAnim: "aeOuter", glowSize: 1.2, brightness: 1.0 };
    case "error":    return { outerSpeed: "4s",  midSpeed: "4s",   innerAnim: `aeErrorShake 0.5s ease-in-out 3`,       glowAnim: `aeGlow 1.5s ease-in-out infinite`,     outerAnim: "aeOuterRev",  glowSize: 0.9,  brightness: 0.9  };
    case "success":  return { outerSpeed: "1.8s",midSpeed: "1.4s", innerAnim: `aeSuccess 0.7s cubic-bezier(0.34,1.56,0.64,1)`,               glowAnim: `aeGlowFast 0.35s ease-in-out 4`,      outerAnim: "aeOuter",    glowSize: 1.8,  brightness: 1.2  };
    default:         return { outerSpeed: "8s",  midSpeed: "6s",   innerAnim: `aeBreath 3.2s ease-in-out infinite`,    glowAnim: `aeGlow 3.2s ease-in-out infinite`,     outerAnim: "aeOuter",    glowSize: 1.0,  brightness: 0.75 };
  }
}

// ── Particle system ───────────────────────────────────────────────────────────

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  startAngle: (i / 12) * 360,
  radius:     i % 3 === 0 ? 54 : i % 3 === 1 ? 62 : 70,
  size:       i % 4 === 0 ? 4 : i % 4 === 1 ? 3 : i % 4 === 2 ? 2.5 : 2,
  speed:      2.5 + (i % 4) * 0.6,
  opacity:    0.3 + (i % 3) * 0.18,
}));

// ── Waveform bars (speaking) ──────────────────────────────────────────────────

const WAVE_BARS = [0.45, 0.75, 1.0, 0.88, 0.65, 1.0, 0.78, 0.55, 0.90, 0.62, 0.80, 0.48];

// ── Component ─────────────────────────────────────────────────────────────────

interface ApexAvatarEntityProps {
  state?:       AvatarEntityState;
  mode?:        AvatarEntityMode;
  amplitude?:   number;
  size?:        number;
  onTap?:       () => void;
  showWave?:    boolean;
  focused?:     boolean;
}

export const ApexAvatarEntity = memo(function ApexAvatarEntity({
  state     = "idle",
  mode      = "chat",
  amplitude = 0,
  size      = 200,
  onTap,
  showWave  = true,
  focused   = false,
}: ApexAvatarEntityProps) {
  useEffect(() => { injectStyles(); }, []);

  const pal    = MODE_PALETTE[mode];
  const params = getStateParams(state);
  const isError    = state === "error";
  const isSpeaking = state === "speaking";
  const isSuccess  = state === "success";

  // Amplitude drives extra glow/scale during speech
  const ampScale  = 1 + amplitude * 0.18;
  const ampGlow   = params.glowSize + amplitude * 0.5;

  const R          = size / 2;
  const orbR       = R * 0.46;
  const midRingR   = R * 0.64;
  const outerRingR = R * 0.84;

  // Error overrides palette to red
  const effectivePrimary   = isError ? "#FF6B6B" : pal.primary;
  const effectiveSecondary = isError ? "#C0392B" : pal.secondary;
  const effectiveGlow      = isError ? "rgba(255,107,107,0.55)" : pal.glow;

  // Success burst visible once
  const [showBurst, setShowBurst] = useState(false);
  useEffect(() => {
    if (state === "success") {
      setShowBurst(true);
      const t = setTimeout(() => setShowBurst(false), 800);
      return () => clearTimeout(t);
    }
  }, [state]);

  // Eye blink timer
  const [eyesClosed, setEyesClosed] = useState(false);
  const blinkRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const scheduleBlink = () => {
      blinkRef.current = setTimeout(() => {
        setEyesClosed(true);
        setTimeout(() => {
          setEyesClosed(false);
          scheduleBlink();
        }, 120);
      }, 2500 + Math.random() * 3000);
    };
    scheduleBlink();
    return () => clearTimeout(blinkRef.current);
  }, []);

  return (
    <div
      onClick={onTap}
      style={{
        width:          size,
        height:         size,
        position:       "relative",
        cursor:         onTap ? "pointer" : "default",
        flexShrink:     0,
        userSelect:     "none",
        touchAction:    "manipulation",
      }}
    >
      {/* ── Ambient outer glow ─────────────────────────────────────────── */}
      <div style={{
        position:     "absolute",
        inset:        0,
        borderRadius: "50%",
        background:   `radial-gradient(circle, ${effectiveGlow} 0%, transparent 70%)`,
        transform:    `scale(${ampGlow * 1.1})`,
        transition:   "transform 0.08s ease, opacity 0.3s ease",
        opacity:      focused ? 1 : 0.7,
        animation:    `aeGlow ${params.outerSpeed} ease-in-out infinite`,
        pointerEvents: "none",
      }} />

      {/* ── Outer ring (rotating dashes) ───────────────────────────────── */}
      <div style={{
        position:     "absolute",
        top:          R - outerRingR,
        left:         R - outerRingR,
        width:        outerRingR * 2,
        height:       outerRingR * 2,
        borderRadius: "50%",
        border:       `1.5px dashed ${pal.ring}`,
        animation:    `${params.outerAnim} ${params.outerSpeed} linear infinite`,
        boxShadow:    `0 0 12px ${pal.ring}, inset 0 0 12px ${pal.ring}`,
      }} />

      {/* ── Outer ring 2 (solid, opposite dir) ────────────────────────── */}
      <div style={{
        position:     "absolute",
        top:          R - outerRingR * 0.88,
        left:         R - outerRingR * 0.88,
        width:        outerRingR * 0.88 * 2,
        height:       outerRingR * 0.88 * 2,
        borderRadius: "50%",
        border:       `1px solid ${effectivePrimary}22`,
        animation:    `aeOuterRev ${parseFloat(params.outerSpeed) * 1.4}s linear infinite`,
      }} />

      {/* ── Mid ring (morphing) ────────────────────────────────────────── */}
      <div style={{
        position:     "absolute",
        top:          R - midRingR,
        left:         R - midRingR,
        width:        midRingR * 2,
        height:       midRingR * 2,
        borderRadius: "50%",
        border:       `2px solid ${effectivePrimary}55`,
        boxShadow:    `0 0 18px ${effectivePrimary}33, inset 0 0 18px ${effectivePrimary}22`,
        animation:    state === "building"
          ? `aeMidBuild ${params.midSpeed} ease-in-out infinite`
          : `aeMid ${params.midSpeed} ease-in-out infinite`,
      }} />

      {/* ── Orbiting particles ─────────────────────────────────────────── */}
      {PARTICLES.map((p) => {
        const speedMultiplier = isSpeaking ? 0.5 : state === "building" ? 0.3 : state === "thinking" ? 0.6 : 1;
        return (
          <div
            key={p.id}
            style={{
              position:     "absolute",
              top:          "50%",
              left:         "50%",
              width:        p.size,
              height:       p.size,
              marginTop:    -p.size / 2,
              marginLeft:   -p.size / 2,
              borderRadius: "50%",
              background:   pal.particle,
              boxShadow:    `0 0 ${p.size * 2}px ${pal.particle}`,
              opacity:      state === "idle" ? p.opacity * 0.6 : p.opacity + amplitude * 0.3,
              animation:    `aeParticle ${p.speed * speedMultiplier}s linear infinite`,
              "--ao":       `${p.startAngle}deg`,
              "--ar":       `${p.radius * (size / 200)}px`,
            } as React.CSSProperties}
          />
        );
      })}

      {/* ── Inner orb ─────────────────────────────────────────────────── */}
      <div style={{
        position:     "absolute",
        top:          R - orbR,
        left:         R - orbR,
        width:        orbR * 2,
        height:       orbR * 2,
        borderRadius: "50%",
        background:   `radial-gradient(circle at 38% 35%,
          ${effectivePrimary}ee 0%,
          ${effectiveSecondary}bb 45%,
          ${effectiveSecondary}66 75%,
          transparent 100%)`,
        boxShadow:    [
          `0 0 ${30 + amplitude * 40}px ${effectiveGlow}`,
          `0 0 ${60 + amplitude * 60}px ${effectiveGlow}60`,
          `0 0 ${90 + amplitude * 80}px ${effectiveGlow}25`,
          `inset 0 1px 0 rgba(255,255,255,0.22)`,
          `inset 0 -1px 0 rgba(0,0,0,0.15)`,
        ].join(", "),
        transform:    `scale(${ampScale})`,
        transition:   "transform 0.07s ease",
        animation:    params.innerAnim,
        border:       `1.5px solid ${effectivePrimary}66`,
      }}>
        {/* ── Surface texture lines ──────────────────────────────────── */}
        <div style={{
          position:     "absolute",
          inset:        "12%",
          borderRadius: "50%",
          border:       `1px solid rgba(255,255,255,0.08)`,
          overflow:     "hidden",
        }}>
          {/* Scanline */}
          <div style={{
            position:   "absolute",
            left:       0, right: 0,
            height:     "30%",
            background: "linear-gradient(transparent, rgba(255,255,255,0.04), transparent)",
            animation:  `aeScanline 3s ease-in-out infinite`,
          }} />
        </div>

        {/* ── Eyes ─────────────────────────────────────────────────── */}
        {!isSpeaking && (
          <div style={{
            position:        "absolute",
            top:             "36%",
            left:            "50%",
            transform:       "translateX(-50%)",
            display:         "flex",
            gap:             orbR * 0.32,
            alignItems:      "center",
          }}>
            {[0, 1].map((i) => (
              <div key={i} style={{
                width:        orbR * 0.17,
                height:       eyesClosed ? 1 : orbR * 0.17,
                borderRadius: "50%",
                background:   "rgba(255,255,255,0.9)",
                boxShadow:    `0 0 ${orbR * 0.1}px rgba(255,255,255,0.8)`,
                transition:   "height 0.06s ease",
              }} />
            ))}
          </div>
        )}

        {/* ── Mouth / Speaking waveform ────────────────────────────── */}
        {isSpeaking ? (
          <div style={{
            position:   "absolute",
            bottom:     "26%",
            left:       "50%",
            transform:  "translateX(-50%)",
            display:    "flex",
            alignItems: "center",
            gap:        2,
            height:     orbR * 0.28,
          }}>
            {WAVE_BARS.map((base, i) => (
              <div key={i} style={{
                width:           2,
                borderRadius:    1,
                background:      "rgba(255,255,255,0.85)",
                height:          Math.max(2, base * (amplitude * 0.7 + 0.3) * orbR * 0.28),
                animation:       `aeWave ${0.35 + i * 0.04}s ease-in-out infinite`,
                animationDelay:  `${i * 0.03}s`,
                transition:      "height 0.06s ease",
              }} />
            ))}
          </div>
        ) : (
          <div style={{
            position:     "absolute",
            bottom:       "26%",
            left:         "50%",
            transform:    "translateX(-50%)",
            width:        orbR * 0.34,
            height:       orbR * 0.10,
            borderRadius: 99,
            background:   isError
              ? "rgba(255,100,100,0.7)"
              : "rgba(255,255,255,0.35)",
            boxShadow:    "0 1px 4px rgba(0,0,0,0.2)",
            transition:   "background 0.3s ease",
          }} />
        )}

        {/* ── Core glow point ─────────────────────────────────────── */}
        <div style={{
          position:     "absolute",
          top:          "50%",
          left:         "50%",
          transform:    "translate(-50%, -50%)",
          width:        orbR * 0.18,
          height:       orbR * 0.18,
          borderRadius: "50%",
          background:   "rgba(255,255,255,0.9)",
          boxShadow:    `0 0 ${orbR * 0.2}px rgba(255,255,255,0.8), 0 0 ${orbR * 0.4}px ${effectivePrimary}60`,
          animation:    `aeGlow ${params.outerSpeed} ease-in-out infinite`,
        }} />
      </div>

      {/* ── Success burst rings ────────────────────────────────────────── */}
      {showBurst && [0, 200, 400].map((delay, i) => (
        <div key={i} style={{
          position:     "absolute",
          inset:        R - orbR,
          width:        orbR * 2,
          height:       orbR * 2,
          borderRadius: "50%",
          border:       `3px solid ${effectivePrimary}`,
          animation:    `aeBurst 0.8s ease-out forwards`,
          animationDelay: `${delay}ms`,
          pointerEvents: "none",
        }} />
      ))}

      {/* ── Focused ring ──────────────────────────────────────────────── */}
      {focused && (
        <div style={{
          position:     "absolute",
          inset:        -6,
          borderRadius: "50%",
          border:       `2px solid ${effectivePrimary}88`,
          boxShadow:    `0 0 0 4px ${effectivePrimary}22`,
          animation:    `aeGlow 1.5s ease-in-out infinite`,
          pointerEvents: "none",
        }} />
      )}

      {/* ── Error X overlay ───────────────────────────────────────────── */}
      {isError && (
        <div style={{
          position:       "absolute",
          inset:          0,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          pointerEvents:  "none",
        }}>
          <span style={{
            fontSize:  orbR * 0.5,
            color:     "rgba(255,107,107,0.85)",
            fontWeight: 800,
            textShadow: "0 0 20px rgba(255,107,107,0.6)",
          }}>✕</span>
        </div>
      )}
    </div>
  );
});
