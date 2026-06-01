import { motion } from "framer-motion";
import type { ApexEdgeMode } from "./ApexCore";

interface Props {
  mode: ApexEdgeMode;
  setMode: (m: ApexEdgeMode) => void;
}

const MODE_COLOR: Record<ApexEdgeMode, string> = {
  idle:      "#4ADE80",
  listening: "#06B6D4",
  thinking:  "#FACC15",
  active:    "#A78BFA",
};

const MODE_LABEL: Record<ApexEdgeMode, string> = {
  idle:      "Apex",
  listening: "Listening",
  thinking:  "Thinking…",
  active:    "Active",
};

export default function ApexArc({ mode, setMode }: Props) {
  const isOpen = mode !== "idle";
  const color  = MODE_COLOR[mode];

  return (
    /* ── Dynamic Island–style pill — fixed in the header zone ──────────────
       Sits at top-right inside the natural header area (top: 12px).
       Does NOT expand — it's always a compact indicator.
       The glass panel in ApexOverlay does the expansion.
    ────────────────────────────────────────────────────────────────────── */
    <motion.button
      onClick={() => setMode(isOpen ? "idle" : "listening")}
      aria-label="Open Apex AI"
      style={{
        position:     "fixed",
        top:          10,
        right:        12,
        zIndex:       60,
        display:      "flex",
        alignItems:   "center",
        gap:          6,
        padding:      "0 12px",
        height:       30,
        borderRadius: 99,
        cursor:       "pointer",
        border:       "none",
        outline:      "none",
        WebkitTapHighlightColor: "transparent",
        /* Glass pill */
        background:   "rgba(255,255,255,0.06)",
        backdropFilter:       "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: [
          "inset 0 1px 0 rgba(255,255,255,0.10)",
          `0 0 0 1px rgba(${hexToRgb(color)},0.28)`,
          `0 0 14px rgba(${hexToRgb(color)},0.20)`,
        ].join(", "),
      }}
      animate={{
        boxShadow: isOpen
          ? [
              "inset 0 1px 0 rgba(255,255,255,0.10)",
              `0 0 0 1px rgba(${hexToRgb(color)},0.55)`,
              `0 0 22px rgba(${hexToRgb(color)},0.40)`,
            ].join(", ")
          : [
              "inset 0 1px 0 rgba(255,255,255,0.10)",
              `0 0 0 1px rgba(${hexToRgb(color)},0.28)`,
              `0 0 14px rgba(${hexToRgb(color)},0.20)`,
            ].join(", "),
      }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      whileTap={{ scale: 0.93 }}
    >
      {/* Status dot */}
      <motion.div
        style={{
          width:        6,
          height:       6,
          borderRadius: "50%",
          background:   color,
          flexShrink:   0,
          boxShadow:    `0 0 6px ${color}`,
        }}
        animate={{
          scale:   [1, 1.3, 1],
          opacity: [1, 0.7, 1],
        }}
        transition={{
          duration: mode === "listening" ? 0.9 : mode === "thinking" ? 0.6 : 2.4,
          repeat:   Infinity,
          ease:     "easeInOut",
        }}
      />

      {/* Label */}
      <span
        style={{
          fontSize:      11,
          fontWeight:    700,
          color:         "rgba(255,255,255,0.80)",
          letterSpacing: "0.02em",
          whiteSpace:    "nowrap",
          userSelect:    "none",
        }}
      >
        {MODE_LABEL[mode]}
      </span>

      {/* Listening mic icon */}
      {mode === "listening" && (
        <motion.span
          style={{ fontSize: 10, color }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
        >
          ●
        </motion.span>
      )}
    </motion.button>
  );
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
