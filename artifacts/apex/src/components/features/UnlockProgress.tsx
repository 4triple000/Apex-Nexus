/**
 * UnlockProgress — shows how close the user is to the next feature state.
 * Displays a progress bar, percentage, and actionable hint.
 */
import { motion } from "framer-motion";
import { Users, Zap } from "lucide-react";
import { getUnlockProgress, STATE_META, type FeatureState } from "@/systems/featureAccess";

interface UnlockProgressProps {
  featureId:    string;
  currentState: FeatureState;
  accent:       string;
}

export function UnlockProgress({ featureId, currentState, accent }: UnlockProgressProps) {
  const { progress, label, nextState, hint } = getUnlockProgress(featureId);

  if (currentState === "live") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 10px", borderRadius: 10,
        background: "rgba(74,222,128,0.09)",
        border: "1px solid rgba(74,222,128,0.20)",
      }}>
        <span style={{ fontSize: 10 }}>✅</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#4ADE80" }}>
          Fully live — no action needed
        </span>
      </div>
    );
  }

  const nextMeta = nextState ? STATE_META[nextState] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Zap style={{ width: 10, height: 10, color: accent, flexShrink: 0 }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.40)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {nextState ? `Progress to ${STATE_META[nextState].label}` : "Unlock Progress"}
          </span>
        </div>
        <motion.span
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ fontSize: 10, fontWeight: 900, color: accent }}>
          {label}
        </motion.span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1.0, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            height: "100%", borderRadius: 99,
            background: nextMeta
              ? `linear-gradient(90deg, ${accent}, ${nextMeta.color})`
              : `linear-gradient(90deg, ${accent}, ${accent}88)`,
            boxShadow: `0 0 8px ${accent}60`,
          }}
        />
        {/* Marker at 100% = unlock point */}
        {progress < 100 && (
          <div style={{
            position: "absolute", top: 0, right: 0, width: 1.5, height: "100%",
            background: "rgba(255,255,255,0.20)",
          }} />
        )}
      </div>

      {/* Hint */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 5,
        padding: "6px 9px", borderRadius: 9,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <Users style={{ width: 9, height: 9, color: "rgba(255,255,255,0.30)", flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.40)", lineHeight: 1.5, fontWeight: 600 }}>
          {hint}
        </span>
      </div>
    </div>
  );
}
