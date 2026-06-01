import { motion, useSpring, useMotionValue, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import type { ApexEdgeMode } from "./ApexCore";

interface Props {
  mode: ApexEdgeMode;
}

// Float bounds relative to the panel origin (absolute in overlay)
const BOUNDS = { minX: 50, maxX: 220, minY: 50, maxY: 240 };

// 8-point blob radii that cycle for organic morphing
const MORPH_KEYFRAMES = [
  "45% 55% 58% 42% / 48% 44% 56% 52%",
  "52% 48% 44% 56% / 55% 45% 52% 48%",
  "38% 62% 55% 45% / 42% 58% 48% 52%",
  "60% 40% 48% 52% / 50% 54% 44% 56%",
  "50% 50% 60% 40% / 45% 55% 52% 48%",
  "42% 58% 52% 48% / 56% 44% 50% 50%",
];

// Glow / gradient per mode
const STYLE: Record<ApexEdgeMode, { glow: string; gradient: string }> = {
  idle:      { glow: "rgba(139,92,246,0.28)", gradient: "radial-gradient(circle at 34% 28%, #a855f7, #4f46e5)"    },
  listening: { glow: "rgba(6,182,212,0.38)",  gradient: "radial-gradient(circle at 34% 28%, #06B6D4, #4f46e5)"    },
  thinking:  { glow: "rgba(139,92,246,0.35)", gradient: "radial-gradient(circle at 34% 28%, #8B5CF6, #1e1b4b)"    },
  active:    { glow: "rgba(236,72,153,0.35)", gradient: "radial-gradient(circle at 34% 28%, #EC4899, #7C3AED)"    },
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function ApexBlob({ mode }: Props) {
  const morphIdx = useRef(0);
  const blobRef  = useRef<HTMLDivElement | null>(null);

  // Spring-driven position with heavy damping for organic float
  const mx = useMotionValue(130);
  const my = useMotionValue(150);
  const sx = useSpring(mx, { stiffness: 36, damping: 13, mass: 1.1 });
  const sy = useSpring(my, { stiffness: 36, damping: 13, mass: 1.1 });

  // Drift loop — slower when idle, faster when active
  useEffect(() => {
    const speed = mode === "active" ? 1000 : mode === "listening" ? 1400 : 2200;
    const drift = () => {
      mx.set(clamp(mx.get() + (Math.random() - 0.5) * 52, BOUNDS.minX, BOUNDS.maxX));
      my.set(clamp(my.get() + (Math.random() - 0.5) * 52, BOUNDS.minY, BOUNDS.maxY));
    };
    const id = setInterval(drift, speed);
    return () => clearInterval(id);
  }, [mode, mx, my]);

  // Continuous organic border-radius morph via CSS animation on the DOM node
  useEffect(() => {
    const el = blobRef.current;
    if (!el) return;
    let frame = 0;
    let animId: number;
    const DURATION = mode === "listening" ? 1600 : mode === "thinking" ? 900 : 2400;

    const morph = () => {
      const next = MORPH_KEYFRAMES[frame % MORPH_KEYFRAMES.length];
      animate(el, { borderRadius: next }, {
        duration: DURATION / 1000,
        ease: "easeInOut",
        onComplete: () => {
          frame++;
          animId = requestAnimationFrame(morph);
        },
      });
    };
    morph();
    return () => { cancelAnimationFrame(animId); };
  }, [mode]);

  const { glow, gradient } = STYLE[mode];
  const bodyScale = mode === "active" ? 1.18 : mode === "listening" ? 1.08 : 1;
  const eyeScaleY = mode === "listening" ? 1.5 : mode === "thinking" ? 0.45 : mode === "active" ? 1.25 : 1;
  const eyeGap    = mode === "listening" ? 16 : 14;

  return (
    <motion.div
      style={{ position: "absolute", x: sx, y: sy, originX: 0.5, originY: 0.5 }}
    >
      {/* Outer ambient glow ring — breathes independently */}
      <motion.div
        style={{
          position: "absolute",
          inset:    -24,
          borderRadius: "50%",
          background:   `radial-gradient(circle, ${glow}, transparent 68%)`,
          pointerEvents: "none",
        }}
        animate={{ scale: [1, 1.14, 1], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Blob body — morphing shape via ref */}
      <motion.div
        ref={blobRef}
        style={{
          width:      92,
          height:     92,
          background: gradient,
          boxShadow:  `0 0 52px ${glow}, 0 8px 24px rgba(0,0,0,0.45)`,
          position:   "relative",
          overflow:   "hidden",
          display:    "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "45% 55% 58% 42% / 48% 44% 56% 52%",
        }}
        animate={{ scale: bodyScale }}
        transition={{ type: "spring", stiffness: 80, damping: 14 }}
      >
        {/* Specular highlight — gives it a 3D glass feel */}
        <div style={{
          position:    "absolute",
          top:         8,
          left:        12,
          width:       26,
          height:      14,
          borderRadius: "50%",
          background:   "rgba(255,255,255,0.26)",
          filter:       "blur(6px)",
          pointerEvents: "none",
          transform:    "rotate(-15deg)",
        }} />

        {/* Secondary highlight — small bright spot */}
        <div style={{
          position:     "absolute",
          top:          18,
          left:         22,
          width:        10,
          height:       6,
          borderRadius: "50%",
          background:   "rgba(255,255,255,0.45)",
          filter:       "blur(2px)",
          pointerEvents: "none",
        }} />

        {/* Eyes */}
        <div style={{
          display:    "flex",
          gap:        eyeGap,
          alignItems: "center",
          position:   "relative",
          zIndex:     1,
          marginTop:  6,
        }}>
          {[0, 1].map((i) => (
            <motion.div
              key={i}
              style={{
                width:        8,
                height:       16,
                background:   "white",
                borderRadius: 99,
                boxShadow:    "0 0 8px rgba(255,255,255,0.75), 0 0 2px rgba(255,255,255,1)",
                transformOrigin: "center",
              }}
              animate={{ scaleY: eyeScaleY }}
              transition={{ type: "spring", stiffness: 160, damping: 18 }}
            />
          ))}
        </div>

        {/* Listening pulse ring */}
        {mode === "listening" && (
          <motion.div
            style={{
              position:      "absolute",
              inset:         0,
              borderRadius:  "inherit",
              border:        "1.5px solid rgba(255,255,255,0.30)",
              pointerEvents: "none",
            }}
            animate={{ scale: [1, 1.28, 1], opacity: [0.65, 0, 0.65] }}
            transition={{ duration: 1.3, repeat: Infinity }}
          />
        )}

        {/* Thinking shimmer sweep */}
        {mode === "thinking" && (
          <motion.div
            style={{
              position:   "absolute",
              inset:      0,
              background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)",
              pointerEvents: "none",
            }}
            animate={{ x: ["-100%", "140%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.div>

      {/* State label */}
      <motion.div
        style={{
          marginTop:     12,
          textAlign:     "center",
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color:         "rgba(255,255,255,0.45)",
          whiteSpace:    "nowrap",
          userSelect:    "none",
        }}
        animate={{ opacity: mode === "idle" ? 0 : 0.85, y: mode === "idle" ? 4 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {mode === "listening" ? "Listening…" : mode === "active" ? "Responding" : mode === "thinking" ? "Thinking…" : ""}
      </motion.div>
    </motion.div>
  );
}
