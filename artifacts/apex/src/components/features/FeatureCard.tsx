/**
 * FeatureCard — Apple-style feature showcase card.
 * Now supports the full LOCKED → PREVIEW → EARLY → LIVE state machine.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, Eye, Zap, ExternalLink, Lock } from "lucide-react";
import { useLocation } from "wouter";
import type { ApexFeature } from "@/data/features";
import { PHASE_META } from "@/data/features";
import { STATE_META, FEATURE_CONFIGS, type FeatureState } from "@/systems/featureAccess";
import { tierCanAccessFeature } from "@/systems/tierAccess";
import { useCurrentTier } from "@/hooks/useBillingStatus";
import { usePaywall } from "@/contexts/PaywallContext";
import { FeatureStatusBadge } from "./FeatureStatusBadge";
import { UnlockProgress } from "./UnlockProgress";
import { WaitlistStats } from "@/components/viral/WaitlistStats";
import { hasJoined } from "@/utils/referralGenerator";

const IOS    = [0.25, 0.46, 0.45, 0.94] as const;
const SPRING = { type: "spring", stiffness: 380, damping: 28 } as const;

function isNotified(id: string): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem("apex_feature_notify") ?? "[]");
    return Array.isArray(stored) && stored.includes(id);
  } catch { return false; }
}

function toggleNotify(id: string): boolean {
  try {
    const stored: string[] = JSON.parse(localStorage.getItem("apex_feature_notify") ?? "[]");
    const next = stored.includes(id) ? stored.filter((x) => x !== id) : [...stored, id];
    localStorage.setItem("apex_feature_notify", JSON.stringify(next));
    return next.includes(id);
  } catch { return false; }
}

interface FeatureCardProps {
  feature:   ApexFeature;
  state:     FeatureState;
  onPreview: (feature: ApexFeature) => void;
  index?:    number;
  isNew?:    boolean;  // true when state just upgraded (triggers glow burst)
}

export function FeatureCard({ feature, state, onPreview, index = 0, isNew = false }: FeatureCardProps) {
  const [, nav]    = useLocation();
  const [notified, setNotified] = useState(() => isNotified(feature.id));
  const [toast,    setToast]    = useState("");
  const [joined]               = useState(() => hasJoined(feature.id));
  const [glowing,  setGlowing]  = useState(isNew);

  const currentTier    = useCurrentTier();
  const { showPaywall } = usePaywall();
  const tierAllows     = tierCanAccessFeature(currentTier, feature.id);

  const phase    = PHASE_META[feature.phase];
  const stateMeta = STATE_META[state];
  const cfg      = FEATURE_CONFIGS[feature.id];

  // Glow burst on new unlock
  useEffect(() => {
    if (isNew) {
      setGlowing(true);
      const t = setTimeout(() => setGlowing(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  function handleNotify() {
    const next = toggleNotify(feature.id);
    setNotified(next);
    setToast(next ? "You'll be notified at launch!" : "Notification removed");
    setTimeout(() => setToast(""), 2200);
  }

  function handlePrimaryAction() {
    if (state === "locked") {
      setToast("Invite friends to unlock this feature!");
      setTimeout(() => setToast(""), 2000);
      return;
    }
    // Billing tier gate — check before navigating or previewing
    if ((state === "early" || state === "live") && !tierAllows) {
      showPaywall({ featureId: feature.id, featureName: feature.title, featureIcon: feature.icon });
      return;
    }
    if ((state === "early" || state === "live") && cfg?.route) {
      nav(cfg.route);
      return;
    }
    onPreview(feature);
  }

  const isActive   = state === "early" || state === "live";
  const cardGlow   = glowing
    ? `0 0 0 2px ${stateMeta.color}60, 0 8px 40px ${stateMeta.glow}`
    : `0 4px 32px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 40px ${feature.accent}08`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: index * 0.06 }}
      whileHover={{ y: -4, scale: 1.01 }}
      style={{ position: "relative" }}
    >
      {/* Glow burst overlay when newly unlocked */}
      <AnimatePresence>
        {glowing && (
          <motion.div
            initial={{ opacity: 0.8, scale: 0.9 }}
            animate={{ opacity: 0, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            style={{
              position: "absolute", inset: -4, borderRadius: 26, zIndex: 0,
              background: `radial-gradient(circle, ${stateMeta.color}50 0%, transparent 70%)`,
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 1,
        borderRadius: 22,
        background: isActive
          ? `linear-gradient(145deg, ${stateMeta.bg} 0%, rgba(255,255,255,0.018) 100%)`
          : "linear-gradient(145deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)",
        border: `1px solid ${isActive ? stateMeta.border : feature.accent + "28"}`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        padding: "16px 16px 14px",
        display: "flex", flexDirection: "column", gap: 10,
        boxShadow: cardGlow,
        cursor: "pointer",
        transition: "box-shadow 0.4s ease",
      }}>

        {/* Top row: phase + state badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
            padding: "3px 8px", borderRadius: 99,
            background: phase.bg, color: phase.color,
            textTransform: "uppercase",
          }}>
            {phase.label}
          </div>
          <FeatureStatusBadge state={state} pulse={isActive} />
        </div>

        {/* Icon + title */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <motion.div
            whileHover={{ rotate: [0, -8, 8, 0], scale: 1.12 }}
            transition={{ duration: 0.5 }}
            style={{
              width: 42, height: 42, borderRadius: 13, flexShrink: 0,
              background: isActive
                ? `linear-gradient(135deg, ${stateMeta.bg}, ${feature.accent}15)`
                : `linear-gradient(135deg, ${feature.accent}22, ${feature.accent}10)`,
              border: `1px solid ${isActive ? stateMeta.border : feature.accent + "35"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20,
              boxShadow: isActive ? `0 4px 16px ${stateMeta.glow}` : `0 4px 16px ${feature.accent}20`,
            }}>
            {feature.icon}
          </motion.div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 800, color: "#fff",
              letterSpacing: "-0.01em", lineHeight: 1.3, marginBottom: 3,
            }}>
              {feature.title}
            </div>
            <div style={{
              fontSize: 10, color: "rgba(255,255,255,0.38)",
              lineHeight: 1.5, display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {feature.description}
            </div>
          </div>
        </div>

        {/* Waitlist counter (compact) */}
        <WaitlistStats featureId={feature.id} accent={isActive ? stateMeta.color : feature.accent} compact />

        {/* Unlock progress */}
        <UnlockProgress featureId={feature.id} currentState={state} accent={isActive ? stateMeta.color : feature.accent} />

        {/* Joined badge */}
        {joined && (
          <div style={{
            padding: "4px 8px", borderRadius: 99, textAlign: "center",
            background: "rgba(74,222,128,0.10)", border: "1px solid rgba(74,222,128,0.25)",
            fontSize: 8, fontWeight: 800, color: "#4ADE80", letterSpacing: "0.04em",
          }}>
            ✓ On the waitlist
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 7 }}>
          {/* Notify Me */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleNotify}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer",
              background: notified ? `${feature.accent}18` : "rgba(255,255,255,0.04)",
              border: `1px solid ${notified ? feature.accent + "45" : "rgba(255,255,255,0.10)"}`,
              color: notified ? feature.accent : "rgba(255,255,255,0.40)",
              fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              transition: "all 0.25s ease",
            }}>
            {notified
              ? <><BellOff style={{ width: 10, height: 10 }} /> Notified</>
              : <><Bell    style={{ width: 10, height: 10 }} /> Notify</>}
          </motion.button>

          {/* Primary CTA — varies by state */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handlePrimaryAction}
            style={{
              flex: state === "locked" ? 1 : 1.5,
              padding: "9px 0", borderRadius: 10, cursor: state === "locked" ? "default" : "pointer",
              background: state === "locked"
                ? "rgba(255,255,255,0.04)"
                : isActive
                  ? `linear-gradient(135deg, ${stateMeta.color}35, ${stateMeta.color}20)`
                  : `linear-gradient(135deg, ${feature.accent}28, ${feature.accent}14)`,
              border: state === "locked"
                ? "1px solid rgba(255,255,255,0.09)"
                : `1px solid ${isActive ? stateMeta.border : feature.accent + "45"}`,
              color: state === "locked"
                ? "rgba(255,255,255,0.25)"
                : isActive ? stateMeta.color : feature.accent,
              fontSize: 10, fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              boxShadow: isActive ? `0 2px 12px ${stateMeta.glow}` : "none",
              opacity: state === "locked" ? 0.65 : 1,
            }}>
            {state === "locked"  && <><Lock         style={{ width: 10, height: 10 }} /> Coming Soon</>}
            {state === "preview" && <><Eye          style={{ width: 10, height: 10 }} /> Preview</>}
            {state === "early"   && <><Zap          style={{ width: 10, height: 10 }} /> Try Now</>}
            {state === "live"    && <><ExternalLink  style={{ width: 10, height: 10 }} /> Open</>}
          </motion.button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
            transform: "translateX(-50%)", whiteSpace: "nowrap",
            background: "rgba(16,18,28,0.96)", border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 700,
            padding: "7px 14px", borderRadius: 99, zIndex: 200,
            backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(0,0,0,0.40)",
          }}>
          {toast}
        </motion.div>
      )}
    </motion.div>
  );
}
