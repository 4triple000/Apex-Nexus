/**
 * Apex AI — High-Conversion Viral Landing Page
 * Public route: /landing  (no auth, no FTUE)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useInView, useAnimationFrame, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Design tokens ──────────────────────────────────────────────────────────────
const G1 = "#6C5CE7";
const G2 = "#A29BFE";
const G3 = "#FD79A8";
const GRAD = `linear-gradient(135deg, ${G1}, ${G2}, ${G3})`;
const GOLD = "#ffcc33";
const BG   = "#07080E";

// ── Easing ─────────────────────────────────────────────────────────────────────
const SPRING = { type: "spring", stiffness: 280, damping: 26 } as const;
const IOS    = [0.25, 0.46, 0.45, 0.94] as const;

// ── Particle canvas background ─────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; r: number; a: number; da: number }[]>([]);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function resize() {
      canvas!.width  = window.innerWidth;
      canvas!.height = window.innerHeight * 4;
      particles.current = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.15,
        r: Math.random() * 1.6 + 0.3,
        a: Math.random(),
        da: (Math.random() - 0.5) * 0.004,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.a = Math.max(0.05, Math.min(0.6, p.a + p.da));
        if (p.a <= 0.05 || p.a >= 0.6) p.da *= -1;
        if (p.x < 0) p.x = canvas!.width;
        if (p.x > canvas!.width) p.x = 0;
        if (p.y < 0) p.y = canvas!.height;
        if (p.y > canvas!.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(162,155,254,${p.a})`;
        ctx.fill();
      }
      raf.current = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.5 }}
    />
  );
}

// ── Animated gradient orbs ──────────────────────────────────────────────────────
function Orbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div style={{
        position: "absolute", top: "-20%", left: "10%",
        width: 600, height: 600, borderRadius: "50%",
        background: `radial-gradient(circle, ${G1}22 0%, transparent 70%)`,
        animation: "orb1 18s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", top: "30%", right: "-10%",
        width: 500, height: 500, borderRadius: "50%",
        background: `radial-gradient(circle, ${G3}18 0%, transparent 70%)`,
        animation: "orb2 24s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "10%", left: "30%",
        width: 400, height: 400, borderRadius: "50%",
        background: `radial-gradient(circle, ${G2}1A 0%, transparent 70%)`,
        animation: "orb3 20s ease-in-out infinite",
      }} />
      <style>{`
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(60px,40px) scale(1.1)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-40px,60px) scale(1.08)} }
        @keyframes orb3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-50px) scale(0.95)} }
        @keyframes glow-pulse { 0%,100%{box-shadow:0 0 40px ${G1}50,0 0 80px ${G2}30} 50%{box-shadow:0 0 60px ${G1}80,0 0 120px ${G2}50} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(400%)} }
        @keyframes type-cursor { 0%,49%{opacity:1} 50%,100%{opacity:0} }
      `}</style>
    </div>
  );
}

// ── Glass card helper ──────────────────────────────────────────────────────────
function GlassCard({ children, className = "", style = {}, glow = "" }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  glow?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: glow ? `0 0 40px ${glow}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Fade-in-up animation wrapper ───────────────────────────────────────────────
function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...SPRING, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HERO SECTION
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section
      className="relative flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 min-h-screen"
      style={{ zIndex: 1 }}
    >
      {/* Nav bar */}
      <div
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4"
        style={{ zIndex: 50, background: "rgba(7,8,14,0.80)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black"
            style={{ background: GRAD, color: "#fff" }}
          >◆</div>
          <span className="text-white font-black text-base tracking-tight">APEX</span>
          <span
            className="text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-widest uppercase"
            style={{ background: "rgba(108,92,231,0.2)", color: G2, border: `1px solid ${G2}30` }}
          >AI</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`${BASE}/pricing`}
            className="text-white/50 text-sm hover:text-white transition-colors hidden sm:block"
          >Pricing</a>
          <a
            href={`${BASE}/`}
            className="px-4 py-2 rounded-xl text-sm font-bold text-black transition-all hover:brightness-110"
            style={{ background: GRAD }}
          >
            Enter App →
          </a>
        </div>
      </div>

      {/* Animated logo */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...SPRING, delay: 0.1 }}
        className="relative mb-8"
        style={{ animation: "float 4s ease-in-out infinite" }}
      >
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl relative"
          style={{
            background: GRAD,
            boxShadow: `0 0 60px ${G1}70, 0 0 120px ${G2}40`,
            animation: "glow-pulse 3s ease-in-out infinite",
          }}
        >
          ◆
          {/* Scan line effect */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "1.5rem", overflow: "hidden", pointerEvents: "none",
          }}>
            <div style={{
              position: "absolute", left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
              animation: "scan 2.5s linear infinite",
            }} />
          </div>
        </div>
        {/* Orbit ring */}
        <div
          className="absolute inset-[-12px] rounded-full border"
          style={{ borderColor: `${G2}30`, animation: "spin 8s linear infinite" }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.22 }}
        className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] tracking-tight max-w-3xl"
      >
        <span className="text-white">Your AI doesn't just answer.</span>
        <br />
        <span style={{ background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          It evolves with you.
        </span>
      </motion.h1>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: IOS, duration: 0.6, delay: 0.38 }}
        className="mt-5 text-white/50 text-base sm:text-lg max-w-xl leading-relaxed"
      >
        Chat. Build. Compete. Create.
        <br className="hidden sm:block" />
        With a living AI system that grows around you.
      </motion.p>

      {/* CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: IOS, duration: 0.6, delay: 0.5 }}
        className="flex items-center gap-3 mt-8"
      >
        <a
          href={`${BASE}/`}
          className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-black text-sm text-white transition-all hover:brightness-110 active:scale-95"
          style={{ background: GRAD, boxShadow: `0 8px 32px ${G1}50` }}
        >
          🚀 Get Started
        </a>
        <a
          href="#demo"
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm text-white/80 transition-all hover:text-white hover:bg-white/8"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          🎭 Watch Demo
        </a>
      </motion.div>

      {/* Live user count pill */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING, delay: 0.72 }}
        className="flex items-center gap-2 mt-7 px-4 py-2 rounded-full"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex -space-x-1.5">
          {["#6C5CE7","#FD79A8","#FFCC33","#00cec9"].map((c) => (
            <div key={c} className="w-5 h-5 rounded-full border-2" style={{ background: c, borderColor: BG }} />
          ))}
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-white/50 text-xs"><span className="text-white font-bold">12,847</span> builders active</span>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
      >
        <span className="text-white/20 text-[10px] tracking-widest uppercase">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          className="w-4 h-4 text-white/20"
        >↓</motion.div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LIVE DEMO SECTION
// ─────────────────────────────────────────────────────────────────────────────

const CHAT_LINES = [
  { from: "user",  text: "What should I build today?" },
  { from: "apex",  text: "Based on your personality profile, I'm thinking a competitive quiz game. Your Arena rank puts you in the top 12%. Want me to scaffold it?" },
  { from: "user",  text: "Yes — make it multiplayer" },
  { from: "apex",  text: "Done. Generating real-time matchmaking + leaderboard... 3 workflows created. Preview is live ✨" },
];

function DemoSection() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [typing, setTyping]   = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    function next() {
      if (i >= CHAT_LINES.length) return;
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setVisibleLines(i + 1);
        i++;
        setTimeout(next, 900);
      }, 1100);
    }
    setTimeout(next, 600);
  }, [inView]);

  return (
    <section id="demo" ref={ref} className="relative py-20 px-6" style={{ zIndex: 1 }}>
      <FadeUp className="text-center mb-12">
        <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: G2 }}>Live Preview</p>
        <h2 className="text-3xl sm:text-4xl font-black text-white">See Apex in action</h2>
        <p className="text-white/40 mt-2 text-sm">Watch the AI build an app from a single message</p>
      </FadeUp>

      <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-4">

        {/* Chat demo */}
        <GlassCard className="sm:col-span-2 rounded-3xl overflow-hidden" glow={`${G1}20`}>
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            <span className="text-white/25 text-[10px] font-mono ml-2">apex_chat — active session</span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-[9px] font-mono">LIVE</span>
            </div>
          </div>

          <div className="p-5 space-y-4 min-h-[260px]">
            <AnimatePresence>
              {CHAT_LINES.slice(0, visibleLines).map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING }}
                  className={`flex gap-3 ${line.from === "user" ? "justify-end" : "justify-start"}`}
                >
                  {line.from === "apex" && (
                    <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-black" style={{ background: GRAD }}>◆</div>
                  )}
                  <div
                    className="max-w-[75%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed"
                    style={
                      line.from === "user"
                        ? { background: "rgba(108,92,231,0.20)", color: "#fff", border: `1px solid ${G1}30` }
                        : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.08)" }
                    }
                  >
                    {line.text}
                  </div>
                  {line.from === "user" && (
                    <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-black bg-white/10">U</div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {typing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-black" style={{ background: GRAD }}>◆</div>
                <div className="flex gap-1 px-4 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {[0, 0.2, 0.4].map((d) => (
                    <motion.div key={d} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: d }}
                      className="w-1.5 h-1.5 rounded-full" style={{ background: G2 }} />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </GlassCard>

        {/* Right column: Avatar + Battle */}
        <div className="flex flex-col gap-4">
          {/* Avatar card */}
          <GlassCard className="rounded-3xl p-4 flex flex-col items-center gap-3" glow={`${G3}18`}>
            <p className="text-white/30 text-[10px] font-mono uppercase tracking-widest">Your Avatar</p>
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl relative"
              style={{ background: `linear-gradient(135deg, ${G3}22, ${G1}22)`, border: `1px solid ${G3}30` }}
            >
              🤖
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px]"
                style={{ background: G3, borderColor: BG }}>✨</div>
            </motion.div>
            <div className="text-center">
              <p className="text-white font-bold text-xs">Apex Entity</p>
              <p className="text-white/35 text-[9px]">Mood: Creative · Rank: Gold</p>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={inView ? { width: "72%" } : {}}
                transition={{ duration: 1.4, delay: 0.8, ease: IOS }}
                className="h-full rounded-full"
                style={{ background: GRAD }}
              />
            </div>
            <p className="text-white/25 text-[9px]">72 XP to next level</p>
          </GlassCard>

          {/* Battle teaser */}
          <GlassCard className="rounded-3xl p-4" glow={`${GOLD}15`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Battle Arena</p>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black" style={{ background: `${GOLD}20`, color: GOLD }}>LIVE</span>
            </div>
            <div className="space-y-2">
              {[{ name: "You", hp: 82, color: G2 }, { name: "Ghost_X", hp: 54, color: G3 }].map((p) => (
                <div key={p.name}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-white/60 font-bold">{p.name}</span>
                    <span style={{ color: p.color }}>{p.hp}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={inView ? { width: `${p.hp}%` } : {}}
                      transition={{ duration: 1.2, delay: 1, ease: IOS }}
                      className="h-full rounded-full"
                      style={{ background: p.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 px-3 py-2 rounded-xl text-center text-[9px] font-bold" style={{ background: `${GOLD}12`, color: GOLD }}>
              ⚔️ Round 3 — You're winning
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FEATURE STRIP
// ─────────────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "💬", name: "Chat AI",              desc: "Context-aware AI that remembers you across sessions and evolves with your style.",    accent: G2,    live: true  },
  { icon: "🧠", name: "Personality Engine",   desc: "Blend multiple AI personalities into one unique voice. Your AI, your way.",           accent: G3,    live: true  },
  { icon: "🤖", name: "Avatar System",        desc: "A living digital character that grows, levels up, and reacts in real-time.",          accent: "#4ecdc4", live: true },
  { icon: "⚔️", name: "Battle Arena",         desc: "Challenge other AIs in real-time AI combat. Climb the global leaderboard.",          accent: GOLD,  live: false },
  { icon: "⚡", name: "Workflow Automation",  desc: "Visual drag-and-drop AI pipelines. Build and run multi-step automations in minutes.", accent: G1,    live: true  },
];

function FeatureStrip() {
  return (
    <section className="relative py-20 px-6" style={{ zIndex: 1 }}>
      <FadeUp className="text-center mb-12">
        <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: G2 }}>What's inside</p>
        <h2 className="text-3xl sm:text-4xl font-black text-white">Every tool you need.</h2>
        <p className="text-white/40 mt-2 text-sm">Built into one cohesive AI system</p>
      </FadeUp>

      <div className="max-w-4xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <FadeUp key={f.name} delay={i * 0.07}>
            <GlassCard
              className="rounded-3xl p-6 h-full transition-all hover:scale-[1.02] cursor-default group"
              glow={`${f.accent}15`}
              style={{ borderColor: `${f.accent}18` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: `${f.accent}15`, border: `1px solid ${f.accent}25` }}
                >
                  {f.icon}
                </div>
                {f.live ? (
                  <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
                    style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>
                    <div className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />LIVE
                  </span>
                ) : (
                  <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
                    style={{ background: `${GOLD}12`, color: GOLD }}>SOON</span>
                )}
              </div>
              <h3 className="text-white font-black text-base mb-2">{f.name}</h3>
              <p className="text-white/45 text-xs leading-relaxed">{f.desc}</p>
              <div className="mt-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-bold" style={{ color: f.accent }}>Explore →</span>
              </div>
            </GlassCard>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SOCIAL PROOF
// ─────────────────────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  { quote: "Apex replaced three of my AI tools. It's the only one that actually remembers context.", name: "Maya R.", role: "Indie Game Dev", avatar: "🎮", color: G1 },
  { quote: "The battle arena alone is worth it. Watching my AI fight others is genuinely fun.", name: "TechWolf", role: "Creator · 142k followers", avatar: "🐺", color: G3 },
  { quote: "Built a full automation workflow in 8 minutes. No code. No friction. Just results.", name: "Jess L.", role: "Product Builder", avatar: "⚡", color: G2 },
];

const STATS = [
  { value: "12.8K", label: "Active Builders" },
  { value: "3.2M", label: "AI Interactions" },
  { value: "98%", label: "Satisfaction Rate" },
  { value: "< 8s", label: "Avg. Response Time" },
];

function SocialProof() {
  return (
    <section className="relative py-20 px-6" style={{ zIndex: 1 }}>
      {/* Stats row */}
      <FadeUp>
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
          {STATS.map((s, i) => (
            <GlassCard key={s.label} className="rounded-2xl p-5 text-center">
              <p className="text-2xl font-black mb-1" style={{ background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {s.value}
              </p>
              <p className="text-white/35 text-[11px]">{s.label}</p>
            </GlassCard>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={0.1} className="text-center mb-10">
        <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: G2 }}>Community</p>
        <h2 className="text-3xl sm:text-4xl font-black text-white">
          Built for <span style={{ background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>creators</span>.
          <br />Designed for <span style={{ background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>builders</span>.
          <br />AI that adapts to <span style={{ background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>you</span>.
        </h2>
      </FadeUp>

      <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-4">
        {TESTIMONIALS.map((t, i) => (
          <FadeUp key={t.name} delay={i * 0.09}>
            <GlassCard className="rounded-3xl p-6 h-full" glow={`${t.color}15`} style={{ borderColor: `${t.color}18` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
                  style={{ background: `${t.color}15`, border: `1px solid ${t.color}25` }}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{t.name}</p>
                  <p className="text-white/35 text-[10px]">{t.role}</p>
                </div>
              </div>
              <p className="text-white/65 text-xs leading-relaxed">"{t.quote}"</p>
              <div className="flex gap-0.5 mt-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <span key={j} style={{ color: GOLD }} className="text-sm">★</span>
                ))}
              </div>
            </GlassCard>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. VIRAL LOOP SECTION
// ─────────────────────────────────────────────────────────────────────────────
const UNLOCK_STEPS = [
  { step: 1, action: "Join Apex", reward: "Free tier unlocked", icon: "🚀", done: true },
  { step: 2, action: "Invite 1 friend", reward: "Early feature access", icon: "👥", done: true },
  { step: 3, action: "Invite 3 friends", reward: "Pro features unlocked", icon: "⚡", done: false },
  { step: 4, action: "Invite 5 friends", reward: "Elite tier forever free", icon: "👑", done: false },
];

function ViralLoopSection() {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  function copyLink() {
    void navigator.clipboard.writeText("https://apex.ai/ref/YOU123").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  return (
    <section className="relative py-20 px-6" style={{ zIndex: 1 }}>
      <div className="max-w-2xl mx-auto">
        <FadeUp className="text-center mb-10">
          <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: G2 }}>Referral System</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Invite friends.
            <br />
            <span style={{ background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Unlock features faster.
            </span>
          </h2>
          <p className="text-white/40 mt-3 text-sm">The more you share, the more powerful your Apex becomes.</p>
        </FadeUp>

        {/* Step tracker */}
        <FadeUp delay={0.1}>
          <GlassCard className="rounded-3xl p-6 mb-5" glow={`${G2}12`}>
            <div className="space-y-3">
              {UNLOCK_STEPS.map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ ...SPRING, delay: i * 0.09 }}
                  className="flex items-center gap-4"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{
                      background: s.done ? `${G2}20` : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${s.done ? G2 + "50" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {s.done ? "✓" : s.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: s.done ? "#fff" : "rgba(255,255,255,0.35)" }}>
                      {s.action}
                    </p>
                    <p className="text-[11px]" style={{ color: s.done ? G2 : "rgba(255,255,255,0.20)" }}>
                      {s.reward}
                    </p>
                  </div>
                  {s.done && (
                    <span className="text-[9px] font-black px-2 py-1 rounded-full" style={{ background: `${G2}15`, color: G2 }}>
                      UNLOCKED
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </FadeUp>

        {/* Referral link box */}
        <FadeUp delay={0.2}>
          <GlassCard className="rounded-2xl p-4 flex items-center gap-3" glow={`${G1}10`}>
            <div className="flex-1 min-w-0">
              <p className="text-white/30 text-[10px] mb-0.5">Your referral link</p>
              <p className="text-white/70 text-xs font-mono truncate">apex.ai/ref/YOU123</p>
            </div>
            <button
              onClick={copyLink}
              className="px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95"
              style={copied
                ? { background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                : { background: GRAD, color: "#fff" }
              }
            >
              {copied ? "✓ Copied!" : "Copy Link"}
            </button>
          </GlassCard>
        </FadeUp>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. FINAL CTA SECTION
// ─────────────────────────────────────────────────────────────────────────────
function CTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="relative py-28 px-6 text-center" style={{ zIndex: 1 }}>
      {/* Background radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${G1}18 0%, transparent 70%)`,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ ...SPRING }}
      >
        <p className="text-[11px] font-bold tracking-widest uppercase mb-4" style={{ color: G2 }}>Ready?</p>
        <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
          The future of AI<br />
          <span style={{ background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            starts here.
          </span>
        </h2>
        <p className="text-white/40 text-sm max-w-md mx-auto mb-10">
          Join thousands of builders, creators, and competitors already inside Apex.
          Your AI is waiting.
        </p>

        {/* Glowing main CTA */}
        <motion.a
          href={`${BASE}/`}
          animate={{
            boxShadow: [
              `0 0 30px ${G1}60, 0 0 60px ${G2}30`,
              `0 0 50px ${G1}90, 0 0 100px ${G2}50`,
              `0 0 30px ${G1}60, 0 0 60px ${G2}30`,
            ],
          }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-black text-lg text-white"
          style={{ background: GRAD }}
        >
          <span style={{ fontSize: "1.4em", lineHeight: 1 }}>◆</span>
          Enter Apex
          <span className="opacity-60">→</span>
        </motion.a>

        <p className="text-white/20 text-xs mt-5">Free to join · No credit card required</p>
      </motion.div>

      {/* Bottom footer strip */}
      <div className="mt-20 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black" style={{ background: GRAD }}>◆</div>
          <span className="text-white/40 text-sm font-bold">APEX AI</span>
        </div>
        <div className="flex items-center gap-6">
          {["Privacy", "Terms", "Pricing", "Features"].map((l) => (
            <a key={l} href={`${BASE}/${l.toLowerCase()}`} className="text-white/25 text-xs hover:text-white/50 transition-colors">{l}</a>
          ))}
        </div>
        <p className="text-white/20 text-xs">© 2026 Apex AI. All rights reserved.</p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: BG, color: "#fff", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <ParticleCanvas />
      <Orbs />

      {/* Sections */}
      <HeroSection />
      <DemoSection />
      <FeatureStrip />
      <SocialProof />
      <ViralLoopSection />
      <CTASection />
    </div>
  );
}
