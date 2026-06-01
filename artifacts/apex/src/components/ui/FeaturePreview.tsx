/**
 * FeaturePreview — Preview Mode System for Apex
 *
 * Shows REAL UI (visible, not blurred) for locked features,
 * plays pre-scripted demo sequences, and drives upgrades via the
 * referral system instead of a blocking wall.
 *
 * UX goals:
 *   1. User SEES the feature → understands the value
 *   2. User INTERACTS → gets a demo, not a dead end
 *   3. User WANTS access → shares to unlock / joins waitlist
 */
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { X, Share2, Zap, Users, Copy, Check, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { isFeatureEnabled, FEATURES } from "@/lib/featureFlags";
import {
  getDemoForFeature,
  type DemoMessage,
  type DemoSequence,
} from "@/lib/previewDemos";
import { PreviewPlayer } from "@/previews/PreviewPlayer";
import { getScript } from "@/previews/previewScripts";
import {
  getReferralCode,
  getReferralCount,
  getUnlockThreshold,
  tryUnlockViaReferral,
  isReferralUnlocked,
  getReferralUrl,
  getShareText,
  incrementReferralCount,
} from "@/lib/referralSystem";
import { ReferralPrompt } from "./ReferralPrompt";
import type { FeatureConfig } from "@/lib/featureFlags";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── Teaser phrases that cycle on the overlay ──────────────────────────────────
const TEASER_PHRASES = [
  "Imagine having this fully unlocked…",
  "Your AI could be doing this right now.",
  "This is what the next level looks like.",
  "Be first. Unlock early access.",
  "The future of AI — available now.",
];

// ── Actor colors ──────────────────────────────────────────────────────────────
const ACTOR_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  system:     { color: "#A29BFE", label: "Apex",       bg: "rgba(108,92,231,0.12)" },
  gpt4:       { color: "#10A37F", label: "GPT-4",      bg: "rgba(16,163,127,0.10)" },
  claude:     { color: "#D97757", label: "Claude",     bg: "rgba(217,119,87,0.10)"  },
  perplexity: { color: "#228BE6", label: "Perplexity", bg: "rgba(34,139,230,0.10)"  },
  ai:         { color: "#FD79A8", label: "AI",         bg: "rgba(253,121,168,0.10)" },
  step:       { color: "#F59E0B", label: "Step",       bg: "rgba(245,158,11,0.10)"  },
};

// ── Typing animation hook ─────────────────────────────────────────────────────
function useTypingText(target: string, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const frameRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDisplayed("");
    if (frameRef.current) clearInterval(frameRef.current);
    let i = 0;
    frameRef.current = setInterval(() => {
      i++;
      setDisplayed(target.slice(0, i));
      if (i >= target.length && frameRef.current) {
        clearInterval(frameRef.current);
        frameRef.current = null;
      }
    }, speed);
    return () => { if (frameRef.current) clearInterval(frameRef.current); };
  }, [target, speed]);

  return displayed;
}

// ── Demo Player ───────────────────────────────────────────────────────────────
function DemoPlayer({ demo, accentColor }: { demo: DemoSequence; accentColor: string }) {
  const [visibleMessages, setVisibleMessages] = useState<DemoMessage[]>([]);
  const [loopCount, setLoopCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  }, []);

  const startSequence = useCallback(() => {
    setVisibleMessages([]);
    clearTimers();

    demo.messages.forEach((msg) => {
      const t = setTimeout(() => {
        setVisibleMessages(prev => [...prev, msg]);
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        });
      }, msg.ms);
      timerRefs.current.push(t);
    });

    // Loop
    const lastMs = Math.max(...demo.messages.map(m => m.ms));
    const loopT  = setTimeout(() => {
      setLoopCount(c => c + 1);
    }, lastMs + demo.loopDelay);
    timerRefs.current.push(loopT);
  }, [demo, clearTimers]);

  useEffect(() => { startSequence(); return clearTimers; }, [loopCount, startSequence]);

  return (
    <div
      ref={scrollRef}
      style={{
        height: 164, overflowY: "auto", display: "flex", flexDirection: "column",
        gap: 6, padding: "4px 0",
        scrollbarWidth: "none",
      }}
    >
      {visibleMessages.map((msg, i) => {
        const cfg = ACTOR_CONFIG[msg.actor] ?? ACTOR_CONFIG.system!;
        return (
          <div
            key={`${loopCount}-${i}`}
            style={{
              display: "flex", gap: 8, alignItems: "flex-start",
              animation: `prev-msg-in 0.22s ${IOS} both`,
            }}
          >
            {/* Actor chip */}
            <div style={{
              flexShrink: 0, padding: "2px 7px", borderRadius: 6,
              background: cfg.bg, border: `1px solid ${cfg.color}30`,
              fontSize: 9, fontWeight: 800, color: cfg.color, letterSpacing: "0.04em",
              whiteSpace: "nowrap", marginTop: 1,
            }}>
              {msg.emoji ? `${msg.emoji}` : cfg.label}
            </div>
            {/* Message */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 11, lineHeight: 1.55, color: "rgba(255,255,255,0.80)",
              }}>
                {msg.text}
              </span>
              {msg.badge && (
                <span style={{
                  marginLeft: 6, fontSize: 9, fontWeight: 800,
                  color: accentColor, opacity: 0.85,
                }}>
                  · {msg.badge}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Teaser text cycler ────────────────────────────────────────────────────────
function TeaserText() {
  const [idx, setIdx]     = useState(0);
  const [fade, setFade]   = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % TEASER_PHRASES.length);
        setFade(true);
      }, 400);
    }, 3800);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      fontSize: 11, fontStyle: "italic",
      color: "rgba(255,255,255,0.42)",
      textAlign: "center", lineHeight: 1.5,
      opacity: fade ? 1 : 0,
      transition: `opacity 0.35s ${IOS}`,
    }}>
      {TEASER_PHRASES[idx]}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ReferralProgress({ featureId, accentColor }: { featureId: string; accentColor: string }) {
  const count     = getReferralCount();
  const threshold = getUnlockThreshold(featureId);
  const pct       = Math.min(100, (count / threshold) * 100);
  const [filled, setFilled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFilled(true), 400); return () => clearTimeout(t); }, []);

  return (
    <div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 5,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: "0.06em" }}>
          UNLOCK PROGRESS
        </span>
        <span style={{ fontSize: 10, fontWeight: 900, color: accentColor }}>
          {count}/{threshold} friends
        </span>
      </div>
      <div style={{
        height: 5, borderRadius: 99,
        background: "rgba(255,255,255,0.06)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 99,
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`,
          boxShadow: `0 0 10px ${accentColor}60`,
          width: filled ? `${pct}%` : "0%",
          transition: `width 1.0s cubic-bezier(0.34,1.20,0.64,1) 0.5s`,
        }} />
      </div>
      <div style={{
        marginTop: 5, fontSize: 9, color: "rgba(255,255,255,0.25)",
        textAlign: "center",
      }}>
        {count >= threshold
          ? "Ready to unlock! Click below →"
          : `Invite ${threshold - count} more friend${threshold - count !== 1 ? "s" : ""} to unlock`}
      </div>
    </div>
  );
}

// ── Main PreviewOverlay component ─────────────────────────────────────────────
function PreviewOverlay({
  feature,
  demo,
  onUnlocked,
  onClickedInside,
}: {
  feature: FeatureConfig;
  demo:    DemoSequence | null;
  onUnlocked:      () => void;
  onClickedInside: boolean;
}) {
  const [expanded,       setExpanded]       = useState(false);
  const [showReferral,   setShowReferral]   = useState(false);
  const [unlocked,       setUnlocked]       = useState(isReferralUnlocked(feature.id));
  const [copied,         setCopied]         = useState(false);
  const [demoTriggered,  setDemoTriggered]  = useState(false);
  const [pulseCount,     setPulseCount]     = useState(0);

  const [c0, c1] = feature.borderColors;
  const accent   = feature.accentColor;

  // Auto-expand when user clicks inside the locked content
  useEffect(() => {
    if (onClickedInside && !expanded) {
      setExpanded(true);
      setDemoTriggered(true);
    }
  }, [onClickedInside]);

  // Subtle glow pulse every few seconds
  useEffect(() => {
    const id = setInterval(() => setPulseCount(n => n + 1), 3500);
    return () => clearInterval(id);
  }, []);

  function handleUnlockEarly() {
    const count     = getReferralCount();
    const threshold = getUnlockThreshold(feature.id);
    if (count >= threshold || tryUnlockViaReferral(feature.id)) {
      setUnlocked(true);
      setTimeout(onUnlocked, 600);
    } else {
      setShowReferral(true);
    }
  }

  function handleCopyLink() {
    const url = getReferralUrl(feature.id);
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Simulate a referral arriving for demo purposes
    setTimeout(() => { incrementReferralCount(); }, 3000);
  }

  const shareUrl  = getReferralUrl(feature.id);
  const shareText = getShareText(feature.name);

  return (
    <>
      <style>{`
        @keyframes prev-msg-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes prev-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes prev-glow-pulse {
          0%, 100% { box-shadow: 0 0 20px ${accent}40; }
          50%       { box-shadow: 0 0 36px ${accent}70, 0 0 60px ${accent}25; }
        }
        @keyframes prev-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-3px); }
        }
        @keyframes prev-badge-in {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* ── Bottom floating overlay card ────────────────────────────────── */}
      <div
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50,
          animation: `prev-slide-up 0.40s ${SPRING} both`,
        }}
      >
        {/* Gradient fade at bottom of content */}
        <div style={{
          height: 80, pointerEvents: "none",
          background: `linear-gradient(to bottom, transparent, rgba(7,8,14,0.85))`,
        }} />

        {/* Card itself */}
        <div style={{
          background: "rgba(10,11,20,0.97)",
          borderTop: `1px solid ${expanded ? accent : "rgba(255,255,255,0.08)"}40`,
          transition: `border-color 0.4s ${IOS}`,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          padding: expanded ? "18px 20px 24px" : "12px 20px 16px",
        }}>

          {/* ── Top row: icon + name + expand/collapse ── */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: expanded ? 14 : 0,
          }}>
            {/* Feature icon with glow pulse */}
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: `linear-gradient(135deg, ${feature.gradient[0]}, ${feature.gradient[1]})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
              animation: `prev-glow-pulse 3.5s ease-in-out infinite`,
            }}>
              {feature.icon}
            </div>

            {/* Name + badge */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em",
                }}>
                  {feature.name}
                </span>
                <span style={{
                  fontSize: 8, fontWeight: 900, padding: "2px 7px", borderRadius: 99,
                  background: `${accent}18`, border: `1px solid ${accent}35`,
                  color: accent, letterSpacing: "0.08em",
                  animation: `prev-badge-in 0.30s ${SPRING}`,
                }}>
                  PREVIEW MODE
                </span>
              </div>
              {!expanded && (
                <div style={{
                  fontSize: 10, color: "rgba(255,255,255,0.35)",
                  marginTop: 2, overflow: "hidden",
                  whiteSpace: "nowrap", textOverflow: "ellipsis",
                }}>
                  {feature.tagline} · tap to explore
                </div>
              )}
            </div>

            {/* Expand / collapse */}
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: 8,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.45)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {expanded
                ? <ChevronDown style={{ width: 13, height: 13 }} />
                : <ChevronUp   style={{ width: 13, height: 13 }} />}
            </button>
          </div>

          {/* ── Expanded content ──────────────────────────────────────────── */}
          {expanded && (
            <div style={{ animation: `prev-slide-up 0.30s ${IOS} both` }}>

              {/* Demo player */}
              {demo && (
                <div style={{
                  borderRadius: 12, padding: "12px 14px", marginBottom: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${accent}18`,
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7, marginBottom: 10,
                  }}>
                    <Zap style={{ width: 11, height: 11, color: accent }} />
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: accent, letterSpacing: "0.07em",
                    }}>
                      LIVE PREVIEW
                    </span>
                    {demo.prompt && (
                      <span style={{
                        marginLeft: "auto", fontSize: 9,
                        color: "rgba(255,255,255,0.30)", fontStyle: "italic",
                      }}>
                        "{demo.prompt}"
                      </span>
                    )}
                  </div>
                  <DemoPlayer demo={demo} accentColor={accent} />
                </div>
              )}

              {/* Teaser text */}
              <div style={{ marginBottom: 14 }}>
                <TeaserText />
              </div>

              {/* Referral progress */}
              <div style={{ marginBottom: 16 }}>
                <ReferralProgress featureId={feature.id} accentColor={accent} />
              </div>

              {/* CTA buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>

                {/* Primary: Unlock Early */}
                <button
                  onClick={handleUnlockEarly}
                  style={{
                    width: "100%", padding: "13px 0",
                    borderRadius: 14, cursor: "pointer",
                    background: unlocked
                      ? "rgba(74,222,128,0.12)"
                      : `linear-gradient(135deg, ${c0}, ${c1})`,
                    border: unlocked
                      ? "1px solid rgba(74,222,128,0.35)"
                      : "1px solid transparent",
                    color: unlocked ? "#4ADE80" : "#fff",
                    fontSize: 13, fontWeight: 800,
                    letterSpacing: "-0.01em",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: unlocked ? "none" : `0 4px 20px ${c0}45`,
                    transition: `all 0.35s ${SPRING}`,
                  }}
                  onPointerDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                  onPointerUp={e   => (e.currentTarget.style.transform = "scale(1)")}
                  onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {unlocked ? "✓ Unlocked!" : "🔓 Unlock Early Access"}
                </button>

                {/* Secondary row: Copy link + Share */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleCopyLink}
                    style={{
                      flex: 1, padding: "10px 0",
                      borderRadius: 12, cursor: "pointer",
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${accent}25`,
                      color: copied ? "#4ADE80" : "rgba(255,255,255,0.55)",
                      fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      transition: `all 0.25s ${IOS}`,
                    }}
                  >
                    {copied
                      ? <><Check style={{ width: 12, height: 12 }} /> Copied!</>
                      : <><Copy style={{ width: 12, height: 12 }} /> Copy Link</>}
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1, padding: "10px 0",
                      borderRadius: 12, cursor: "pointer",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.55)",
                      fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      textDecoration: "none",
                      transition: `all 0.25s ${IOS}`,
                    }}
                  >
                    <Share2 style={{ width: 12, height: 12 }} />
                    Share
                  </a>
                </div>

                {/* Tertiary: Be first link */}
                <button
                  onClick={() => setShowReferral(true)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 10, color: "rgba(255,255,255,0.25)",
                    padding: "4px 0", textAlign: "center",
                    letterSpacing: "0.02em",
                  }}
                >
                  <Users style={{ width: 10, height: 10, display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                  Be first to access · view your referral dashboard
                </button>
              </div>
            </div>
          )}

          {/* Collapsed CTA strip */}
          {!expanded && (
            <div style={{
              display: "flex", gap: 8, marginTop: 10,
            }}>
              <button
                onClick={handleUnlockEarly}
                style={{
                  flex: 2, padding: "9px 0",
                  borderRadius: 10, cursor: "pointer",
                  background: `linear-gradient(135deg, ${c0}, ${c1})`,
                  border: "none", color: "#fff",
                  fontSize: 11, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  boxShadow: `0 3px 14px ${c0}40`,
                  transition: `all 0.25s ${SPRING}`,
                }}
                onPointerDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                onPointerUp={e   => (e.currentTarget.style.transform = "scale(1)")}
                onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                🔓 Unlock Early
              </button>
              <button
                onClick={handleCopyLink}
                style={{
                  flex: 1, padding: "9px 0",
                  borderRadius: 10, cursor: "pointer",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${accent}20`,
                  color: copied ? "#4ADE80" : "rgba(255,255,255,0.50)",
                  fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  transition: `all 0.25s ${IOS}`,
                }}
              >
                {copied
                  ? <><Check style={{ width: 11, height: 11 }} /> Copied</>
                  : <><Copy style={{ width: 11, height: 11 }} /> Share</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Referral prompt modal */}
      {showReferral && (
        <ReferralPrompt
          feature={feature}
          onClose={() => setShowReferral(false)}
          onUnlocked={() => { setUnlocked(true); setShowReferral(false); setTimeout(onUnlocked, 400); }}
        />
      )}
    </>
  );
}

// ── Public: FeaturePreview ────────────────────────────────────────────────────

interface FeaturePreviewProps {
  feature:  string;
  children: ReactNode;
}

export function FeaturePreview({ feature: featureId, children }: FeaturePreviewProps) {
  const [forceUnlocked, setForceUnlocked] = useState(false);
  const [clickedInside, setClickedInside] = useState(false);
  const [showPlayer,    setShowPlayer]    = useState(false);
  const clickResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLive    = isFeatureEnabled(featureId);
  const feature   = FEATURES[featureId];
  const demo      = getDemoForFeature(featureId);
  const script    = getScript(featureId);

  // If already enabled by phase OR force-unlocked → render real children
  if (isLive || forceUnlocked || !feature) return <>{children}</>;

  function handleClickCapture() {
    // If we have a cinematic script, launch the full-screen trailer first
    if (script && script.length > 0) {
      setShowPlayer(true);
      return;
    }
    // Fallback: expand the bottom overlay as before
    if (!clickedInside) {
      setClickedInside(true);
      if (clickResetRef.current) clearTimeout(clickResetRef.current);
      clickResetRef.current = setTimeout(() => setClickedInside(false), 300);
    }
  }

  function handlePlayerClose() {
    setShowPlayer(false);
    // Expand bottom overlay so the CTA is immediately visible
    setClickedInside(true);
    if (clickResetRef.current) clearTimeout(clickResetRef.current);
    clickResetRef.current = setTimeout(() => setClickedInside(false), 300);
  }

  return (
    <>
      {/* Real content renders normally — position:fixed children escape wrappers,
          so we use fixed overlays instead of wrapping the children in a filter div. */}
      {children}

      {/* Fixed dim overlay — sits above all page content (incl. position:fixed at z≤4999) */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 5000,
        background: "rgba(0,0,0,0.42)",
        pointerEvents: "none",
      }} />

      {/* Fixed click-capture — intercepts all taps across the full viewport */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 5001, cursor: "pointer" }}
        onClick={handleClickCapture}
      />

      {/* Fixed bottom overlay card — "Preview Mode" badge + demo + CTA */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 5002,
      }}>
        <PreviewOverlay
          feature={feature}
          demo={demo}
          onUnlocked={() => setForceUnlocked(true)}
          onClickedInside={clickedInside}
        />
      </div>

      {/* Cinematic full-screen trailer — fires on first tap (zIndex above all) */}
      {showPlayer && script && (
        <PreviewPlayer
          script={script}
          feature={feature}
          onClose={handlePlayerClose}
          onUnlock={() => {
            setShowPlayer(false);
            setClickedInside(true);
          }}
        />
      )}
    </>
  );
}
