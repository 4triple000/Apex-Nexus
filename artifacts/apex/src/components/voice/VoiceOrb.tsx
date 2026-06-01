/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  VoiceOrb — floating voice button with reactive animations  ║
 * ║                                                              ║
 * ║  States:  idle | listening | processing | speaking | error   ║
 * ║  Modes:   builder | game | chat | command                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useRef, useEffect } from "react";
import { Mic, MicOff, Square, Loader2 } from "lucide-react";
import type { VoiceMode, VoiceState } from "@/hooks/useVoiceConversation";

// ── CSS keyframes (injected once) ────────────────────────────────────────────

const VOICE_ORB_STYLE_ID = "voice-orb-keyframes";

function ensureKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(VOICE_ORB_STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = VOICE_ORB_STYLE_ID;
  s.textContent = `
    @keyframes voiceOrbPulse {
      0%,100% { transform: scale(1);    opacity: 1; }
      50%      { transform: scale(1.08); opacity: 0.92; }
    }
    @keyframes voiceOrbRing {
      0%   { transform: scale(1);   opacity: 0.8; }
      100% { transform: scale(2.2); opacity: 0;   }
    }
    @keyframes voiceOrbSpin {
      from { transform: rotate(0deg);   }
      to   { transform: rotate(360deg); }
    }
    @keyframes voiceOrbBounce {
      0%,100% { transform: scaleY(0.4); }
      50%      { transform: scaleY(1);   }
    }
    @keyframes voiceOrbFade {
      0%,100% { opacity: 0.3; }
      50%      { opacity: 1;   }
    }
    @keyframes voiceOrbGlitch {
      0%,100% { transform: translateX(0);  filter: hue-rotate(0deg);   }
      20%      { transform: translateX(-2px); filter: hue-rotate(30deg);  }
      40%      { transform: translateX(2px);  filter: hue-rotate(-20deg); }
      60%      { transform: translateX(-1px); filter: hue-rotate(15deg);  }
      80%      { transform: translateX(1px);  filter: hue-rotate(-10deg); }
    }
    @keyframes voiceOrbBreath {
      0%,100% { transform: scale(1);    box-shadow: 0 0 20px var(--orb-glow); }
      50%      { transform: scale(1.04); box-shadow: 0 0 40px var(--orb-glow); }
    }
  `;
  document.head.appendChild(s);
}

// ── Mode colour map ───────────────────────────────────────────────────────────

const MODE_CONFIG: Record<VoiceMode, { color: string; glow: string; label: string; emoji: string }> = {
  builder: { color: "#A29BFE", glow: "rgba(162,155,254,0.55)", label: "Builder", emoji: "⚙️" },
  game:    { color: "#00D2D3", glow: "rgba(0,210,211,0.55)",   label: "Game",    emoji: "🎮" },
  chat:    { color: "#FD79A8", glow: "rgba(253,121,168,0.55)", label: "Chat",    emoji: "💬" },
  command: { color: "#FFCC33", glow: "rgba(255,204,51,0.55)",  label: "Command", emoji: "⚡" },
};

// ── Waveform bars (speaking animation) ───────────────────────────────────────

function WaveformBars({ amplitude, color }: { amplitude: number; color: string }) {
  const bars = [0.4, 0.7, 1.0, 0.7, 0.5, 0.8, 0.6, 0.9, 0.5, 0.7];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 20 }}>
      {bars.map((base, i) => (
        <div
          key={i}
          style={{
            width:           3,
            borderRadius:    2,
            backgroundColor: color,
            height:          Math.max(3, base * amplitude * 20),
            animation:       `voiceOrbBounce ${0.4 + i * 0.07}s ease-in-out infinite`,
            animationDelay:  `${i * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface VoiceOrbProps {
  state:           VoiceState;
  mode:            VoiceMode;
  amplitude:       number;
  interimText?:    string;
  transcript?:     string;
  isSupported:     boolean;
  pushToTalk?:     boolean;
  onToggle?:       () => void;
  onPttStart?:     () => void;
  onPttEnd?:       () => void;
  onInterrupt?:    () => void;
  onModeChange?:   (mode: VoiceMode) => void;
  onOpenPanel?:    () => void;
  size?:           number;
  className?:      string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoiceOrb({
  state,
  mode,
  amplitude,
  interimText  = "",
  transcript   = "",
  isSupported,
  pushToTalk   = false,
  onToggle,
  onPttStart,
  onPttEnd,
  onInterrupt,
  onModeChange,
  onOpenPanel,
  size         = 56,
}: VoiceOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { ensureKeyframes(); }, []);

  const cfg       = MODE_CONFIG[mode];
  const listening = state === "listening";
  const speaking  = state === "speaking";
  const processing = state === "processing";
  const error     = state === "error";

  // Ring pulse count when listening
  const rings = listening ? [0, 0.4, 0.8] : speaking ? [0, 0.6] : [];

  // Orb icon
  const OrbIcon = error
    ? MicOff
    : processing
      ? Loader2
      : speaking
        ? Square
        : Mic;

  // Handle interactions
  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pushToTalk) onPttStart?.();
    else if (speaking) onInterrupt?.();
    else onToggle?.();
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (pushToTalk) onPttEnd?.();
  };

  const orbAnimation = listening
    ? "voiceOrbBreath 1.6s ease-in-out infinite"
    : speaking
      ? "voiceOrbPulse 0.6s ease-in-out infinite"
      : processing
        ? undefined
        : "voiceOrbFade 3s ease-in-out infinite";

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>

      {/* ── Expanding rings ─────────────────────────────────────────────── */}
      {rings.map((delay, i) => (
        <div
          key={i}
          style={{
            position:     "absolute",
            top:          "50%",
            left:         "50%",
            transform:    "translate(-50%, -50%)",
            width:        size,
            height:       size,
            borderRadius: "50%",
            border:       `2px solid ${cfg.color}`,
            animation:    `voiceOrbRing 1.8s ease-out infinite`,
            animationDelay: `${delay}s`,
            pointerEvents: "none",
            zIndex:       0,
          }}
        />
      ))}

      {/* ── Main orb ────────────────────────────────────────────────────── */}
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => { e.preventDefault(); onOpenPanel?.(); }}
        style={{
          "--orb-glow": cfg.glow,
          width:         size,
          height:        size,
          borderRadius:  "50%",
          background:    listening
            ? `radial-gradient(circle at 40% 40%, ${cfg.color}, #2d2040)`
            : speaking
              ? `radial-gradient(circle at 40% 40%, ${cfg.color}cc, #1a0e2e)`
              : processing
                ? "radial-gradient(circle at 40% 40%, #A29BFE88, #12121c)"
                : "radial-gradient(circle at 40% 40%, #2d2a4a, #0d0e18)",
          boxShadow:     listening || speaking
            ? `0 0 ${Math.round(amplitude * 40 + 20)}px ${cfg.glow}, 0 0 60px ${cfg.glow}40, inset 0 1px 0 rgba(255,255,255,0.15)`
            : `0 0 20px ${cfg.glow}60, inset 0 1px 0 rgba(255,255,255,0.08)`,
          border:        `1.5px solid ${listening || speaking ? cfg.color : cfg.color + "55"}`,
          display:       "flex",
          alignItems:    "center",
          justifyContent: "center",
          cursor:        "pointer",
          animation:     orbAnimation,
          transition:    "box-shadow 0.1s ease, background 0.3s ease",
          position:      "relative",
          zIndex:        1,
          userSelect:    "none",
          touchAction:   "none",
          flexShrink:    0,
        } as React.CSSProperties}
        title={pushToTalk ? "Hold to talk" : listening ? "Tap to stop" : "Tap to talk (hold for panel)"}
      >
        {/* Spinning loader ring for processing */}
        {processing && (
          <div style={{
            position:     "absolute",
            inset:        -3,
            borderRadius: "50%",
            border:       `2px solid transparent`,
            borderTopColor: cfg.color,
            animation:    "voiceOrbSpin 0.8s linear infinite",
          }} />
        )}

        {/* Waveform when speaking */}
        {speaking ? (
          <WaveformBars amplitude={amplitude} color={cfg.color} />
        ) : (
          <OrbIcon
            size={size * 0.38}
            color={error ? "#FF6B6B" : listening ? cfg.color : "#ffffff88"}
            style={{
              animation: processing ? "voiceOrbSpin 1s linear infinite" : undefined,
              strokeWidth: 2,
            }}
          />
        )}
      </div>

      {/* ── Mode badge ──────────────────────────────────────────────────── */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        gap:            3,
        background:     "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        borderRadius:   8,
        padding:        "2px 7px",
        border:         `1px solid ${cfg.color}33`,
        cursor:         "pointer",
        userSelect:     "none",
      }}
        onClick={onOpenPanel}
      >
        <span style={{ fontSize: 8 }}>{cfg.emoji}</span>
        <span style={{
          fontSize:      9,
          fontWeight:    700,
          color:         cfg.color,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          {cfg.label}
        </span>
      </div>

      {/* ── Live transcript bubble ──────────────────────────────────────── */}
      {(interimText || (listening && !interimText)) && (
        <div style={{
          position:    "absolute",
          bottom:      "calc(100% + 12px)",
          left:        "50%",
          transform:   "translateX(-50%)",
          background:  "rgba(13,14,24,0.95)",
          backdropFilter: "blur(20px)",
          border:      `1px solid ${cfg.color}44`,
          borderRadius: 12,
          padding:     "6px 12px",
          maxWidth:    220,
          whiteSpace:  "nowrap",
          overflow:    "hidden",
          textOverflow: "ellipsis",
          zIndex:      20,
          pointerEvents: "none",
        }}>
          <span style={{
            fontSize:   12,
            color:      interimText ? "#ffffffcc" : cfg.color + "88",
            fontStyle:  interimText ? "normal" : "italic",
            animation:  !interimText ? "voiceOrbFade 1.2s ease-in-out infinite" : undefined,
          }}>
            {interimText || "Listening…"}
          </span>
          {/* Triangle pointer */}
          <div style={{
            position:    "absolute",
            bottom:      -6,
            left:        "50%",
            transform:   "translateX(-50%)",
            width:       0,
            height:      0,
            borderLeft:  "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop:   `6px solid ${cfg.color}44`,
          }} />
        </div>
      )}

      {/* ── Mode switcher row (shown below orb when panel is closed) ────── */}
      {onModeChange && (
        <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
          {(["chat","builder","game","command"] as VoiceMode[]).map((m) => {
            const mc = MODE_CONFIG[m];
            return (
              <div
                key={m}
                onClick={() => onModeChange(m)}
                title={mc.label}
                style={{
                  width:        18,
                  height:       18,
                  borderRadius: "50%",
                  background:   mode === m ? mc.glow : "rgba(255,255,255,0.06)",
                  border:       `1.5px solid ${mode === m ? mc.color : "rgba(255,255,255,0.12)"}`,
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                  cursor:       "pointer",
                  fontSize:     9,
                  transition:   "all 0.2s",
                }}
              >
                {mc.emoji}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
