/**
 * WaitlistModal — "Get Early Access" form + confetti + referral hand-off.
 * Sits above the FeatureModal at z-index 9500.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, User, Rocket, ChevronRight } from "lucide-react";
import { joinWaitlist, hasJoined, getWaitlistEntry, type WaitlistEntry } from "@/utils/referralGenerator";
import { WaitlistStats } from "@/components/viral/WaitlistStats";
import { ReferralPanel } from "@/components/viral/ReferralPanel";
import type { ApexFeature } from "@/data/features";

// ── Confetti ──────────────────────────────────────────────────────────────────

interface Particle {
  id:     number;
  x:      number;
  y:      number;
  vx:     number;
  vy:     number;
  color:  string;
  size:   number;
  angle:  number;
  spin:   number;
  life:   number;
}

const CONFETTI_COLORS = [
  "#6C5CE7","#A29BFE","#FD79A8","#F59E0B",
  "#4ADE80","#38BDF8","#FB923C","#fff",
];

function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf       = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Spawn 140 particles from the center-top
    const cx = canvas.width  / 2;
    const cy = canvas.height * 0.30;
    particles.current = Array.from({ length: 140 }, (_, i) => ({
      id:    i,
      x:     cx + (Math.random() - 0.5) * 60,
      y:     cy,
      vx:    (Math.random() - 0.5) * 10,
      vy:    -(4 + Math.random() * 8),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
      size:  4 + Math.random() * 5,
      angle: Math.random() * 360,
      spin:  (Math.random() - 0.5) * 8,
      life:  1,
    }));

    function tick() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter(p => p.life > 0.02);
      for (const p of particles.current) {
        p.x     += p.vx;
        p.y     += p.vy;
        p.vy    += 0.28;   // gravity
        p.vx    *= 0.99;
        p.angle += p.spin;
        p.life  -= 0.012;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle   = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (particles.current.length > 0) {
        raf.current = requestAnimationFrame(tick);
      }
    }

    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 1,
      }}
    />
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface WaitlistModalProps {
  feature: ApexFeature | null;
  onClose: () => void;
}

export function WaitlistModal({ feature, onClose }: WaitlistModalProps) {
  const [phase,     setPhase]     = useState<"form" | "success">("form");
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [confetti,  setConfetti]  = useState(false);
  const [entry,     setEntry]     = useState<WaitlistEntry | null>(null);

  // If already joined, show success immediately
  useEffect(() => {
    if (!feature) return;
    setPhase("form");
    setName(""); setEmail(""); setError(""); setConfetti(false);
    if (hasJoined(feature.id)) {
      const existing = getWaitlistEntry(feature.id);
      if (existing) { setEntry(existing); setPhase("success"); }
    }
  }, [feature?.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSubmit() {
    if (!feature) return;
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    setTimeout(() => {
      const joined = joinWaitlist(feature.id, email.trim(), name.trim());
      setEntry(joined);
      setLoading(false);
      setConfetti(true);
      setTimeout(() => { setPhase("success"); }, 400);
      setTimeout(() => setConfetti(false), 3500);
    }, 700);
  }

  if (!feature) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9400,
          background: "rgba(0,0,0,0.78)",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: "100%", scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: "80%", scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9500,
          maxHeight: "94vh", display: "flex", flexDirection: "column",
          borderRadius: "24px 24px 0 0",
          background: "linear-gradient(180deg, #0D0F1D 0%, #080912 100%)",
          border: `1px solid ${feature.accent}35`,
          borderBottom: "none",
          boxShadow: `0 -12px 60px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 -8px 60px ${feature.accent}12`,
          overflow: "hidden",
        }}>

        {/* Confetti canvas */}
        <Confetti active={confetti} />

        {/* Accent strip */}
        <div style={{
          height: 3, flexShrink: 0,
          background: `linear-gradient(90deg, ${feature.accent}, ${feature.accent}66, ${feature.accent})`,
          boxShadow: `0 0 14px ${feature.accent}90`,
        }} />

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 20px 0", flexShrink: 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: `${feature.accent}20`, border: `1px solid ${feature.accent}35`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>
            {feature.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
              {phase === "form" ? "Get Early Access" : "You're on the list!"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
              {feature.title}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "rgba(255,255,255,0.50)",
          }}>
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 32px", scrollbarWidth: "none" }}>

          <AnimatePresence mode="wait">
            {phase === "form" ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Live waitlist stats */}
                <WaitlistStats featureId={feature.id} accent={feature.accent} />

                {/* Form */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Name */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", borderRadius: 14,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.09)",
                  }}>
                    <User style={{ width: 14, height: 14, color: "rgba(255,255,255,0.30)", flexShrink: 0 }} />
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="First name (optional)"
                      style={{
                        flex: 1, background: "none", border: "none", outline: "none",
                        fontSize: 13, color: "#fff", fontFamily: "inherit",
                      }}
                    />
                  </div>

                  {/* Email */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", borderRadius: 14,
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${error ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.09)"}`,
                  }}>
                    <Mail style={{ width: 14, height: 14, color: "rgba(255,255,255,0.30)", flexShrink: 0 }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(""); }}
                      onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
                      placeholder="Email address (required)"
                      style={{
                        flex: 1, background: "none", border: "none", outline: "none",
                        fontSize: 13, color: "#fff", fontFamily: "inherit",
                      }}
                    />
                  </div>
                  {error && (
                    <div style={{ fontSize: 10, color: "#EF4444", fontWeight: 700, paddingLeft: 4 }}>{error}</div>
                  )}
                </div>

                {/* Benefits list */}
                <div style={{
                  borderRadius: 14, padding: "12px 14px",
                  background: `${feature.accent}09`,
                  border: `1px solid ${feature.accent}20`,
                }}>
                  {[
                    "First to access when this feature ships",
                    "Share your referral code to move up the list",
                    "Early adopters get exclusive lifetime perks",
                  ].map((b, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < 2 ? 7 : 0 }}>
                      <span style={{ color: feature.accent, fontSize: 11, flexShrink: 0 }}>✦</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", lineHeight: 1.5 }}>{b}</span>
                    </div>
                  ))}
                </div>

                {/* Submit */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    padding: "15px", borderRadius: 16, cursor: loading ? "wait" : "pointer",
                    background: loading
                      ? "rgba(255,255,255,0.06)"
                      : `linear-gradient(135deg, ${feature.accent}, ${feature.accent}cc)`,
                    border: "none",
                    color: "#fff", fontSize: 13, fontWeight: 900,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: loading ? "none" : `0 4px 24px ${feature.accent}40`,
                    opacity: loading ? 0.7 : 1,
                    transition: "all 0.25s ease",
                  }}>
                  {loading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                        style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.30)", borderTopColor: "#fff" }}
                      />
                      Joining…
                    </>
                  ) : (
                    <>
                      <Rocket style={{ width: 14, height: 14 }} />
                      Join Waitlist
                      <ChevronRight style={{ width: 13, height: 13, opacity: 0.60 }} />
                    </>
                  )}
                </motion.button>

                <div style={{ textAlign: "center", fontSize: 9, color: "rgba(255,255,255,0.20)", lineHeight: 1.6 }}>
                  No spam. Unsubscribe any time. Data stored locally on your device.
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}>
                {entry && (
                  <ReferralPanel
                    entry={entry}
                    accent={feature.accent}
                    onUpdate={setEntry}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
