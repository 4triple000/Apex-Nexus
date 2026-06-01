import { motion, AnimatePresence } from "framer-motion";
import ApexBlob from "./ApexBlob";
import type { ApexEdgeMode } from "./ApexCore";
import { useApexState } from "@/contexts/ApexStateContext";

interface Props {
  mode: ApexEdgeMode;
  setMode: (m: ApexEdgeMode) => void;
}

export default function ApexOverlay({ mode, setMode }: Props) {
  const { wakePhrase } = useApexState();
  const isOpen = mode !== "idle";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Tap-away backdrop (NOT inset:0 full block) ──────────── */}
          {/* Very subtle — just enough to register the tap, not block UI */}
          <motion.div
            key="backdrop"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 56,
              background: "rgba(0,0,0,0.18)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMode("idle")}
          />

          {/* ── Glass panel — anchored top-right, expands downward ──── */}
          {/* This sits on top of the backdrop so its contents are interactive */}
          <motion.div
            key="panel"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              zIndex: 62,
              transformOrigin: "top right",
              background:
                "linear-gradient(150deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.022) 100%)",
              backdropFilter: "blur(32px)",
              WebkitBackdropFilter: "blur(32px)",
              borderLeft: "1px solid rgba(255,255,255,0.09)",
              borderBottom: "1px solid rgba(255,255,255,0.09)",
              overflow: "hidden",
            }}
            initial={{
              width: 90,
              height: 90,
              borderBottomLeftRadius: 90,
              opacity: 0.6,
            }}
            animate={{
              width: "min(340px, 88vw)",
              height: "min(480px, 58vh)",
              borderBottomLeftRadius: 40,
              opacity: 1,
            }}
            exit={{
              width: 90,
              height: 90,
              borderBottomLeftRadius: 90,
              opacity: 0,
            }}
            transition={{
              type: "spring",
              stiffness: 95,
              damping: 18,
              mass: 0.9,
            }}
          >
            {/* Gradient accent — top right corner glow */}
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 180,
                height: 180,
                background:
                  "radial-gradient(circle at top right, rgba(139,92,246,0.22), transparent 70%)",
                pointerEvents: "none",
              }}
            />

            {/* Inner border line */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderBottomLeftRadius: "inherit",
                background:
                  "linear-gradient(150deg, rgba(139,92,246,0.09) 0%, rgba(6,182,212,0.05) 60%, transparent 100%)",
                pointerEvents: "none",
              }}
            />

            {/* ── AI Blob — lives inside the panel ──────────────────── */}
            <ApexBlob mode={mode} />

            {/* ── Bottom controls ───────────────────────────────────── */}
            <motion.div
              style={{
                position: "absolute",
                bottom: 18,
                left: 18,
                right: 18,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.3 }}
            >
              <div
                style={{
                  color: "rgba(255,255,255,0.28)",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                Say{" "}
                <span style={{ color: "rgba(139,92,246,0.85)" }}>
                  "{wakePhrase}"
                </span>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {mode === "listening" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMode("active"); }}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 99,
                      background: "rgba(139,92,246,0.2)",
                      border: "1px solid rgba(139,92,246,0.4)",
                      color: "#a78bfa",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Activate →
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setMode("idle"); }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 99,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
