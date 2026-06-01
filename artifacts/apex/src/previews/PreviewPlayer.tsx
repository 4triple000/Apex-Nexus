/**
 * Apex Cinematic Preview Player
 *
 * Renders a full-screen animated "feature trailer" with sequential scenes:
 * title cards, AI battle exchanges, energy clashes, pipeline flows, avatar voice.
 *
 * Triggered when user clicks on a locked feature — before the referral CTA.
 * Total runtime: 7–9 s per feature, then loops.
 */
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { X, Share2, Zap } from "lucide-react";
import type { FeatureConfig } from "@/lib/featureFlags";
import type {
  CinemaScene, TitleScene, BattleScene, ClashScene,
  FlowScene, AvatarScene, ResultScene,
} from "./previewScripts";
import { scriptDuration } from "./previewScripts";
import { getReferralUrl, getShareText } from "@/lib/referralSystem";

// ── Easing ────────────────────────────────────────────────────────────────────
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// ── Typing text ───────────────────────────────────────────────────────────────
function TypingText({ text, speed = 22, delay = 0 }: { text: string; speed?: number; delay?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [started,   setStarted]   = useState(delay === 0);

  useEffect(() => {
    setDisplayed("");
    setStarted(delay === 0);
    if (delay > 0) {
      const t = setTimeout(() => setStarted(true), delay);
      return () => clearTimeout(t);
    }
  }, [text, delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    setDisplayed("");
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [started, text, speed]);

  return <>{displayed}</>;
}

// ── Scene: TITLE ──────────────────────────────────────────────────────────────
function TitleSceneView({ scene }: { scene: TitleScene }) {
  const accent = scene.accent ?? "#A29BFE";
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", textAlign: "center", padding: "0 28px",
      animation: `cp-zoom-in 0.45s ${SPRING} both`,
    }}>
      <div style={{
        fontSize: "clamp(32px, 8vw, 52px)", fontWeight: 900,
        lineHeight: 1.1, letterSpacing: "-0.03em",
        background: `linear-gradient(135deg, #fff 40%, ${accent} 100%)`,
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        marginBottom: 14,
      }}>
        {scene.text}
      </div>
      {scene.sub && (
        <div style={{
          fontSize: "clamp(12px, 3vw, 16px)", fontWeight: 500,
          color: "rgba(255,255,255,0.45)", lineHeight: 1.5,
          maxWidth: 320,
          animation: `cp-fade-in 0.40s 0.25s ${IOS} both`,
        }}>
          {scene.sub}
        </div>
      )}
      {/* Ambient glow */}
      <div style={{
        position: "absolute", width: 200, height: 200, borderRadius: "50%",
        background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`,
        animation: "cp-orb 6s ease-in-out infinite",
        pointerEvents: "none",
      }} />
    </div>
  );
}

// ── Scene: BATTLE ─────────────────────────────────────────────────────────────
function BattleSceneView({ scene }: { scene: BattleScene }) {
  const { left, right } = scene;
  const mid = Math.floor(scene.duration / 2);

  return (
    <div style={{
      display: "flex", gap: 10, height: "100%", padding: "16px 16px 8px",
      animation: `cp-fade-in 0.30s ${IOS} both`,
    }}>
      {/* Left fighter */}
      <div style={{
        flex: 1, borderRadius: 16, padding: "14px 14px",
        background: `${left.color}0e`,
        border: `1px solid ${left.color}25`,
        display: "flex", flexDirection: "column", gap: 10,
        animation: `cp-slide-left 0.35s 0.05s ${SPRING} both`,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${left.color}22`, border: `1px solid ${left.color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: left.color, fontWeight: 900,
          }}>
            {left.icon}
          </div>
          <span style={{
            fontSize: 12, fontWeight: 800, color: left.color, letterSpacing: "0.04em",
          }}>
            {left.name}
          </span>
        </div>
        <div style={{
          fontSize: 11, lineHeight: 1.6, color: "rgba(255,255,255,0.75)",
          flex: 1,
        }}>
          <TypingText text={left.text} speed={18} />
        </div>
      </div>

      {/* Divider VS */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 4, flexShrink: 0,
      }}>
        <div style={{
          width: 1, flex: 1, background: "rgba(255,255,255,0.06)",
        }} />
        <div style={{
          fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.20)",
          letterSpacing: "0.08em",
        }}>VS</div>
        <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,0.06)" }} />
      </div>

      {/* Right fighter */}
      <div style={{
        flex: 1, borderRadius: 16, padding: "14px 14px",
        background: `${right.color}0e`,
        border: `1px solid ${right.color}25`,
        display: "flex", flexDirection: "column", gap: 10,
        animation: `cp-slide-right 0.35s 0.05s ${SPRING} both`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${right.color}22`, border: `1px solid ${right.color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: right.color, fontWeight: 900,
          }}>
            {right.icon}
          </div>
          <span style={{
            fontSize: 12, fontWeight: 800, color: right.color, letterSpacing: "0.04em",
          }}>
            {right.name}
          </span>
        </div>
        <div style={{
          fontSize: 11, lineHeight: 1.6, color: "rgba(255,255,255,0.75)",
          flex: 1,
        }}>
          <TypingText text={right.text} speed={18} delay={Math.max(300, mid - right.text.length * 18 - 300)} />
        </div>
      </div>
    </div>
  );
}

// ── Scene: CLASH ──────────────────────────────────────────────────────────────
function ClashSceneView({ scene }: { scene: ClashScene }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", position: "relative",
      animation: `cp-fade-in 0.20s ${IOS} both`,
    }}>
      {/* Expanding rings */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: "absolute",
          width: 80 + i * 50, height: 80 + i * 50,
          borderRadius: "50%",
          border: `${2 - i * 0.5}px solid ${scene.color}`,
          animation: `cp-ring-expand 0.7s ${i * 0.12}s ease-out both`,
          pointerEvents: "none",
        }} />
      ))}
      {/* Center flash */}
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: `radial-gradient(circle, ${scene.color} 0%, ${scene.color}00 70%)`,
        animation: `cp-center-flash 0.6s ${IOS} both`,
        marginBottom: 16,
      }} />
      {/* Label */}
      <div style={{
        fontSize: 15, fontWeight: 900, letterSpacing: "0.12em",
        color: scene.color, textTransform: "uppercase",
        textShadow: `0 0 20px ${scene.color}80`,
        animation: `cp-label-in 0.30s 0.15s ${SPRING} both`,
      }}>
        {scene.label}
      </div>
    </div>
  );
}

// ── Scene: FLOW ───────────────────────────────────────────────────────────────
function FlowSceneView({ scene }: { scene: FlowScene }) {
  const staggerMs = Math.min(380, (scene.duration * 0.65) / scene.steps.length);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 22, padding: "0 20px",
    }}>
      {/* Headline */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)",
        letterSpacing: "0.08em", textTransform: "uppercase",
        animation: `cp-fade-in 0.30s ${IOS} both`,
      }}>
        {scene.headline}
      </div>

      {/* Pipeline nodes */}
      <div style={{
        display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap",
        justifyContent: "center",
      }}>
        {scene.steps.map((step, i) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {/* Node */}
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              animation: `cp-node-pop 0.40s ${i * staggerMs}ms ${SPRING} both`,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: `${step.color}18`,
                border: `1.5px solid ${step.color}45`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
                boxShadow: `0 0 16px ${step.color}30`,
              }}>
                {step.icon}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 800, color: step.color,
                letterSpacing: "0.04em", whiteSpace: "nowrap",
              }}>
                {step.label}
              </span>
            </div>

            {/* Arrow connector (between nodes, not after last) */}
            {i < scene.steps.length - 1 && (
              <div style={{
                width: 22, height: 2, margin: "0 2px",
                marginBottom: 18,
                background: `linear-gradient(90deg, ${step.color}50, ${scene.steps[i + 1]!.color}50)`,
                borderRadius: 1,
                position: "relative",
                animation: `cp-fade-in 0.30s ${(i + 0.7) * staggerMs}ms ${IOS} both`,
              }}>
                {/* Arrowhead */}
                <div style={{
                  position: "absolute", right: -3, top: "50%",
                  transform: "translateY(-50%)",
                  width: 0, height: 0,
                  borderLeft: `5px solid ${scene.steps[i + 1]!.color}60`,
                  borderTop: "3px solid transparent",
                  borderBottom: "3px solid transparent",
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pulse line */}
      <div style={{
        height: 2, width: "80%", borderRadius: 1,
        background: `linear-gradient(90deg, ${scene.steps[0]!.color}40, ${scene.steps[scene.steps.length - 1]!.color}40)`,
        animation: `cp-pulse-line 1.4s ${scene.steps.length * staggerMs + 200}ms ease-in-out infinite`,
        boxShadow: `0 0 8px ${scene.steps[0]!.color}40`,
      }} />
    </div>
  );
}

// ── Scene: AVATAR ─────────────────────────────────────────────────────────────
function AvatarSceneView({ scene }: { scene: AvatarScene }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 20, padding: "0 24px",
      animation: `cp-fade-in 0.35s ${IOS} both`,
    }}>
      {/* Avatar circle */}
      <div style={{
        position: "relative",
        animation: `cp-zoom-in 0.40s ${SPRING} both`,
      }}>
        {/* Rotating ring */}
        <div style={{
          position: "absolute", inset: -6, borderRadius: "50%",
          border: "1.5px solid transparent",
          borderTopColor: "#EC4899",
          borderRightColor: "#A29BFE",
          animation: "cp-ring-spin 2s linear infinite",
        }} />
        <div style={{
          width: 70, height: 70, borderRadius: "50%",
          background: "linear-gradient(135deg, #EC4899, #BE185D)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30,
          boxShadow: "0 0 24px rgba(236,72,153,0.50)",
        }}>
          🎭
        </div>
      </div>

      {/* Speech bubble */}
      <div style={{
        borderRadius: 16, padding: "14px 18px", maxWidth: 320,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.10)",
        position: "relative",
        animation: `cp-bubble-in 0.35s 0.20s ${SPRING} both`,
      }}>
        {/* Triangle */}
        <div style={{
          position: "absolute", top: -7, left: "50%", transform: "translateX(-50%)",
          width: 0, height: 0,
          borderLeft: "7px solid transparent",
          borderRight: "7px solid transparent",
          borderBottom: "7px solid rgba(255,255,255,0.08)",
        }} />
        <div style={{
          fontSize: 12, lineHeight: 1.65,
          color: "rgba(255,255,255,0.80)",
        }}>
          <TypingText text={scene.text} speed={22} />
        </div>
        {scene.sub && (
          <div style={{
            marginTop: 10, fontSize: 9, fontWeight: 700,
            color: "#EC4899", letterSpacing: "0.06em",
          }}>
            {scene.sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scene: RESULT ─────────────────────────────────────────────────────────────
function ResultSceneView({ scene }: { scene: ResultScene }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 12, textAlign: "center",
      animation: `cp-zoom-in 0.40s ${SPRING} both`,
    }}>
      <div style={{ fontSize: 36 }}>🏆</div>
      <div style={{
        fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em",
        color: scene.color,
        textShadow: `0 0 24px ${scene.color}80`,
      }}>
        {scene.winner}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 800,
        color: "rgba(255,255,255,0.60)",
        letterSpacing: "0.02em",
      }}>
        {scene.score}
      </div>
      <div style={{
        fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.5,
        animation: `cp-fade-in 0.30s 0.20s ${IOS} both`,
      }}>
        {scene.sub}
      </div>
    </div>
  );
}

// ── Scene dispatcher ──────────────────────────────────────────────────────────
function renderScene(scene: CinemaScene): ReactNode {
  switch (scene.type) {
    case "title":   return <TitleSceneView  scene={scene} />;
    case "battle":  return <BattleSceneView scene={scene} />;
    case "clash":   return <ClashSceneView  scene={scene} />;
    case "flow":    return <FlowSceneView   scene={scene} />;
    case "avatar":  return <AvatarSceneView scene={scene} />;
    case "result":  return <ResultSceneView scene={scene} />;
    default:        return null;
  }
}

// ── CTA Frame ────────────────────────────────────────────────────────────────
function CtaFrame({
  feature,
  onClose,
  onUnlock,
}: {
  feature:  FeatureConfig;
  onClose:  () => void;
  onUnlock: () => void;
}) {
  const [c0, c1] = feature.borderColors;
  const shareUrl  = getReferralUrl(feature.id);
  const shareText = getShareText(feature.name);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 16, padding: "0 28px",
      textAlign: "center",
      animation: `cp-zoom-in 0.45s ${SPRING} both`,
    }}>
      {/* Icon */}
      <div style={{
        width: 64, height: 64, borderRadius: 18, fontSize: 28,
        background: `linear-gradient(135deg, ${feature.gradient[0]}, ${feature.gradient[1]})`,
        boxShadow: `0 0 32px ${feature.accentColor}50`,
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "cp-float 3s ease-in-out infinite",
      }}>
        {feature.icon}
      </div>

      <div>
        <div style={{
          fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em",
          color: "#fff", marginBottom: 6,
        }}>
          {feature.name}
        </div>
        <div style={{
          fontSize: 12, color: "rgba(255,255,255,0.40)", lineHeight: 1.6, maxWidth: 260,
        }}>
          {feature.tagline}
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 300 }}>
        <button
          onClick={onUnlock}
          style={{
            padding: "14px 0", borderRadius: 14, cursor: "pointer",
            background: `linear-gradient(135deg, ${c0}, ${c1})`,
            border: "none", color: "#fff",
            fontSize: 14, fontWeight: 900,
            letterSpacing: "-0.01em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: `0 4px 24px ${c0}50`,
            transition: `all 0.30s ${SPRING}`,
          }}
          onPointerDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
          onPointerUp={e   => (e.currentTarget.style.transform = "scale(1)")}
          onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
        >
          <Zap style={{ width: 15, height: 15 }} />
          Unlock Early Access
        </button>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "12px 0", borderRadius: 14, cursor: "pointer",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.55)",
            fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            textDecoration: "none",
          }}
        >
          <Share2 style={{ width: 13, height: 13 }} />
          Invite to Unlock Faster
        </a>
      </div>
    </div>
  );
}

// ── Main PreviewPlayer ─────────────────────────────────────────────────────────
interface PreviewPlayerProps {
  script:   CinemaScene[];
  feature:  FeatureConfig;
  onClose:  () => void;
  onUnlock: () => void;
}

export function PreviewPlayer({ script, feature, onClose, onUnlock }: PreviewPlayerProps) {
  const total        = scriptDuration(script);
  const [step,       setStep]       = useState(0);
  const [sceneKey,   setSceneKey]   = useState(0);
  const [visible,    setVisible]    = useState(true);
  const [showCta,    setShowCta]    = useState(false);
  const [elapsed,    setElapsed]    = useState(0);
  const stepTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedAcc = useRef(0);

  const FADE_DURATION = 220; // ms cross-fade between scenes

  const advanceStep = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setStep(prev => {
        const next = prev + 1;
        if (next >= script.length) {
          setShowCta(true);
          return 0;
        }
        setShowCta(false);
        return next;
      });
      setSceneKey(k => k + 1);
      setVisible(true);
    }, FADE_DURATION);
  }, [script.length]);

  // Scene timer
  useEffect(() => {
    if (showCta) return;
    const scene = script[step];
    if (!scene || scene.duration <= 0) { advanceStep(); return; }
    stepTimer.current = setTimeout(advanceStep, scene.duration);
    return () => { if (stepTimer.current) clearTimeout(stepTimer.current); };
  }, [step, sceneKey, showCta, advanceStep, script]);

  // Progress bar (elapsed time)
  useEffect(() => {
    elapsedAcc.current = 0;
    setElapsed(0);
    elapsedRef.current = setInterval(() => {
      elapsedAcc.current += 80;
      setElapsed(Math.min(elapsedAcc.current, total));
    }, 80);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [sceneKey, total]);

  // Loop: after CTA auto-replay after 4s
  useEffect(() => {
    if (!showCta) return;
    const t = setTimeout(() => {
      setShowCta(false);
      setStep(0);
      setSceneKey(k => k + 1);
      setElapsed(0);
      elapsedAcc.current = 0;
    }, 4000);
    return () => clearTimeout(t);
  }, [showCta]);

  const progressPct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;
  const scene = script[step];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      display: "flex", flexDirection: "column",
      background: "rgba(4,5,10,0.96)",
      backdropFilter: "blur(28px) saturate(0.4)",
      WebkitBackdropFilter: "blur(28px) saturate(0.4)",
      animation: `cp-fade-in 0.22s ${IOS} both`,
    }}>
      <style>{`
        @keyframes cp-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cp-zoom-in {
          from { opacity: 0; transform: scale(0.90); }
          to   { opacity: 1; transform: scale(1);    }
        }
        @keyframes cp-slide-left {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0);      }
        }
        @keyframes cp-slide-right {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        @keyframes cp-label-in {
          from { opacity: 0; transform: translateY(8px) scale(0.90); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes cp-ring-expand {
          from { opacity: 0.90; transform: scale(0.2); }
          to   { opacity: 0;    transform: scale(2.4); }
        }
        @keyframes cp-center-flash {
          0%   { opacity: 1; transform: scale(0.2); }
          40%  { opacity: 1; transform: scale(1.4); }
          100% { opacity: 0; transform: scale(1.0); }
        }
        @keyframes cp-node-pop {
          from { opacity: 0; transform: scale(0.6) translateY(12px); }
          to   { opacity: 1; transform: scale(1)   translateY(0);    }
        }
        @keyframes cp-pulse-line {
          0%, 100% { opacity: 0.30; transform: scaleX(0.85); }
          50%       { opacity: 1.00; transform: scaleX(1.00); }
        }
        @keyframes cp-bubble-in {
          from { opacity: 0; transform: translateY(10px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes cp-ring-spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        @keyframes cp-orb {
          0%, 100% { transform: translate(0, 0) scale(1);    }
          50%       { transform: translate(20px, -10px) scale(1.1); }
        }
        @keyframes cp-float {
          0%, 100% { transform: translateY(0px);  }
          50%       { transform: translateY(-5px); }
        }
        @keyframes cp-bar-fill {
          from { width: 0%; }
        }
        @keyframes cp-progress-glow {
          0%, 100% { box-shadow: 0 0 4px ${feature.accentColor}60; }
          50%       { box-shadow: 0 0 10px ${feature.accentColor}90; }
        }
      `}</style>

      {/* ── Top bar: progress + close ────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px 0",
      }}>
        {/* Progress track */}
        <div style={{
          flex: 1, height: 3, borderRadius: 99,
          background: "rgba(255,255,255,0.08)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 99,
            background: `linear-gradient(90deg, ${feature.borderColors[0]}, ${feature.borderColors[1]})`,
            width: `${progressPct}%`,
            transition: "width 0.08s linear",
            boxShadow: `0 0 6px ${feature.accentColor}70`,
          }} />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: 9,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.50)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* ── Scene area ───────────────────────────────────────────────────── */}
      <div
        key={sceneKey}
        style={{
          flex: 1, position: "relative",
          paddingTop: 44,
          opacity: visible ? 1 : 0,
          transition: visible ? "none" : `opacity ${FADE_DURATION}ms ${IOS}`,
        }}
      >
        {showCta
          ? <CtaFrame feature={feature} onClose={onClose} onUnlock={onUnlock} />
          : scene ? renderScene(scene) : null}
      </div>

      {/* ── Bottom identity bar ──────────────────────────────────────────── */}
      {!showCta && (
        <div style={{
          padding: "12px 20px 20px",
          display: "flex", alignItems: "center", gap: 10,
          animation: `cp-fade-in 0.30s 0.40s ${IOS} both`,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${feature.gradient[0]}, ${feature.gradient[1]})`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}>
            {feature.icon}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: "0.01em" }}>
              {feature.name}
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", marginTop: 1, fontWeight: 600, letterSpacing: "0.04em" }}>
              FEATURE PREVIEW
            </div>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={onUnlock}
              style={{
                padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                background: `linear-gradient(135deg, ${feature.borderColors[0]}, ${feature.borderColors[1]})`,
                border: "none", color: "#fff",
                fontSize: 11, fontWeight: 800,
                display: "flex", alignItems: "center", gap: 5,
                boxShadow: `0 3px 14px ${feature.accentColor}40`,
                transition: `all 0.22s ${SPRING}`,
              }}
              onPointerDown={e => (e.currentTarget.style.transform = "scale(0.96)")}
              onPointerUp={e   => (e.currentTarget.style.transform = "scale(1)")}
              onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              🔓 Unlock Early
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
