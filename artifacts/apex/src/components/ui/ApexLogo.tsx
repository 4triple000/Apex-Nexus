/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ApexLogo — shared brand identity component                 ║
 * ║  Drop-in anywhere; handles size, state-based animations,    ║
 * ║  glow intensity, and tappable nav shortcut.                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { useRef, useId } from "react";

// ─── Animation keyframes (injected once) ─────────────────────────────────────

const KEYFRAMES = `
  @keyframes apex-logo-glow-idle {
    0%,100% { filter: drop-shadow(0 0 8px rgba(108,92,231,0.45)) drop-shadow(0 0 20px rgba(108,92,231,0.18)); }
    50%      { filter: drop-shadow(0 0 18px rgba(162,155,254,0.85)) drop-shadow(0 0 44px rgba(253,121,168,0.32)); }
  }
  @keyframes apex-logo-glow-active {
    0%,100% { filter: drop-shadow(0 0 16px rgba(108,92,231,0.80)) drop-shadow(0 0 40px rgba(253,121,168,0.40)); }
    50%      { filter: drop-shadow(0 0 28px rgba(162,155,254,1.00)) drop-shadow(0 0 64px rgba(253,121,168,0.60)); }
  }
  @keyframes apex-logo-spin {
    from { transform: rotate(0deg);   }
    to   { transform: rotate(360deg); }
  }
  @keyframes apex-logo-pulse {
    0%,100% { transform: scale(1.00); opacity: 1;    }
    50%      { transform: scale(1.10); opacity: 0.88; }
  }
  @keyframes apex-logo-thinking {
    0%   { transform: scale(1.00) rotate(0deg);   }
    25%  { transform: scale(1.06) rotate(-4deg);  }
    50%  { transform: scale(1.12) rotate(4deg);   }
    75%  { transform: scale(1.06) rotate(-2deg);  }
    100% { transform: scale(1.00) rotate(0deg);   }
  }
  @keyframes apex-logo-build {
    0%,100% { transform: scale(1.00) translateY(0);  }
    33%      { transform: scale(1.08) translateY(-3px); }
    66%      { transform: scale(0.96) translateY(2px);  }
  }
`;

let injected = false;
function ensureKeyframes() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const s = document.createElement("style");
  s.textContent = KEYFRAMES;
  document.head.appendChild(s);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApexLogoState =
  | "idle"        // default subtle pulse glow
  | "active"      // brighter, stronger glow
  | "thinking"    // slow wobble — AI is processing
  | "building"    // bounce — code is running
  | "spinning"    // full spin — loading
  | "dim";        // very faint — inactive/manual mode

export interface ApexLogoProps {
  /** Pixel size (width = height). Default 36. */
  size?: number;
  /** Animation state. Default "idle". */
  state?: ApexLogoState;
  /** Border-radius override (0 = circle). Default size/4 rounded corners. */
  radius?: number | string;
  /** Wrap in a tappable button that calls onClick. */
  onClick?: () => void;
  /** Extra style on the outer wrapper. */
  style?: React.CSSProperties;
  /** Show a tiny "APEX" wordmark underneath. */
  showLabel?: boolean;
  /** Label text override. Default "APEX". */
  label?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ApexLogo({
  size = 36,
  state = "idle",
  radius,
  onClick,
  style,
  showLabel = false,
  label = "APEX",
}: ApexLogoProps) {
  ensureKeyframes();
  const ref = useRef<HTMLDivElement>(null);

  const r = radius ?? Math.round(size * 0.28);
  // Unique per instance: a hidden duplicate (mobile vs desktop layout) must not own the gradient
  const gradientId = `apex-logo-bg-${useId().replace(/:/g, "")}`;

  // ── Filter / animation per state ─────────────────────────────────────────
  let imgAnimation  = "";
  let wrapAnimation = "";
  let opacity       = 1;

  switch (state) {
    case "idle":
      wrapAnimation = "apex-logo-glow-idle 3.2s ease-in-out infinite";
      break;
    case "active":
      wrapAnimation = "apex-logo-glow-active 2s ease-in-out infinite";
      break;
    case "thinking":
      imgAnimation  = "apex-logo-thinking 1.4s ease-in-out infinite";
      wrapAnimation = "apex-logo-glow-active 1.4s ease-in-out infinite";
      break;
    case "building":
      imgAnimation  = "apex-logo-build 0.8s ease-in-out infinite";
      wrapAnimation = "apex-logo-glow-active 0.8s ease-in-out infinite";
      break;
    case "spinning":
      imgAnimation  = "apex-logo-spin 1s linear infinite";
      wrapAnimation = "apex-logo-glow-idle 1s ease-in-out infinite";
      break;
    case "dim":
      opacity       = 0.35;
      break;
  }

  const inner = (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        overflow: "hidden",
        flexShrink: 0,
        animation: wrapAnimation,
        opacity,
        transition: "opacity 0.35s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {/* Apex mark: a white diamond on the brand gradient (the old PNG asset never shipped) */}
      <svg
        viewBox="0 0 64 64"
        role="img"
        aria-label="Apex"
        style={{ width: "100%", height: "100%", display: "block", animation: imgAnimation }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6C5CE7" />
            <stop offset="0.55" stopColor="#A29BFE" />
            <stop offset="1" stopColor="#FD79A8" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill={`url(#${gradientId})`} />
        <path d="M32 14 L50 32 L32 50 L14 32 Z" fill="#FFFFFF" fillOpacity="0.95" />
      </svg>
    </div>
  );

  const wrapped = onClick ? (
    <button
      onClick={onClick}
      style={{
        display:    "flex",
        flexDirection: showLabel ? "column" : "row",
        alignItems: "center",
        gap: showLabel ? 5 : 0,
        background: "transparent",
        border:     "none",
        padding:    0,
        cursor:     "pointer",
        WebkitTapHighlightColor: "transparent",
        outline: "none",
      }}
    >
      {inner}
      {showLabel && (
        <span style={{
          fontSize: Math.max(9, Math.round(size * 0.28)),
          fontWeight: 900,
          letterSpacing: "0.1em",
          background: "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          {label}
        </span>
      )}
    </button>
  ) : inner;

  if (showLabel && !onClick) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        {inner}
        <span style={{
          fontSize: Math.max(9, Math.round(size * 0.28)),
          fontWeight: 900,
          letterSpacing: "0.1em",
          background: "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          {label}
        </span>
      </div>
    );
  }

  return wrapped;
}

// ─── Specialised exports ──────────────────────────────────────────────────────

/** Micro logo for chat bubble headers (14–18 px) */
export function ApexLogoMini({ size = 16, state = "idle" }: { size?: number; state?: ApexLogoState }) {
  return <ApexLogo size={size} state={state} radius={size / 4} />;
}

/** Full-page centered logo for splash / loading screens */
export function ApexLogoSplash({ size = 96, state = "active" }: { size?: number; state?: ApexLogoState }) {
  return <ApexLogo size={size} state={state} radius={size * 0.26} showLabel />;
}

/** Toggle icon: glowing = auto (active), dim = manual */
export function ApexLogoToggle({
  isAuto,
  size = 28,
  onClick,
}: {
  isAuto: boolean;
  size?: number;
  onClick?: () => void;
}) {
  return (
    <ApexLogo
      size={size}
      state={isAuto ? "active" : "dim"}
      onClick={onClick}
      style={{
        border: isAuto
          ? "1.5px solid rgba(162,155,254,0.50)"
          : "1.5px solid rgba(255,255,255,0.12)",
        transition: "border-color 0.30s ease, opacity 0.30s ease",
      }}
    />
  );
}
