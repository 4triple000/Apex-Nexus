/**
 * FeatureStatusBadge — displays current state with appropriate glow/color.
 * Supports locked | preview | early | live states.
 */
import { motion } from "framer-motion";
import { STATE_META, type FeatureState } from "@/systems/featureAccess";

interface FeatureStatusBadgeProps {
  state:   FeatureState;
  size?:   "sm" | "md";
  pulse?:  boolean;  // animated glow pulse (for "early" and "live")
}

export function FeatureStatusBadge({ state, size = "sm", pulse = false }: FeatureStatusBadgeProps) {
  const meta = STATE_META[state];
  const isActive = state === "early" || state === "live";

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      style={{
        display: "inline-flex", alignItems: "center", gap: size === "md" ? 5 : 4,
        padding: size === "md" ? "4px 10px" : "3px 8px",
        borderRadius: 99,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        boxShadow: isActive && pulse ? `0 0 12px ${meta.glow}` : "none",
        flexShrink: 0,
      }}>

      {/* Pulse dot for active states */}
      {isActive && (
        <motion.div
          animate={pulse ? { scale: [1, 1.5, 1], opacity: [1, 0.4, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.8 }}
          style={{
            width: size === "md" ? 6 : 5,
            height: size === "md" ? 6 : 5,
            borderRadius: "50%",
            background: meta.color,
            boxShadow: `0 0 5px ${meta.color}`,
            flexShrink: 0,
          }}
        />
      )}

      {/* Icon */}
      <span style={{ fontSize: size === "md" ? 11 : 9 }}>{meta.icon}</span>

      {/* Label */}
      <span style={{
        fontSize: size === "md" ? 10 : 8,
        fontWeight: 900,
        color: meta.color,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}>
        {meta.label}
      </span>
    </motion.div>
  );
}
