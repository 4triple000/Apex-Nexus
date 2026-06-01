/**
 * FeatureModal — Full-screen cinematic preview modal
 * Shows a realistic (but fake) demo UI for each locked feature.
 * All interactions are disabled with a "Preview Only" notice.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Bell, Rocket, CheckCircle } from "lucide-react";
import type { ApexFeature } from "@/data/features";
import { PHASE_META } from "@/data/features";
import { WaitlistModal } from "@/components/viral/WaitlistModal";
import { WaitlistStats } from "@/components/viral/WaitlistStats";
import { hasJoined } from "@/utils/referralGenerator";

// ── helpers ──────────────────────────────────────────────────────────────────

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

// ── Preview UIs ───────────────────────────────────────────────────────────────

function WorkflowPreview() {
  const steps = [
    { icon: "⚡", label: "Trigger",    color: "#F59E0B", sub: "On new message" },
    { icon: "🔍", label: "Filter",     color: "#228BE6", sub: "Type = question" },
    { icon: "✦",  label: "GPT-4",      color: "#10A37F", sub: "Generate reply" },
    { icon: "🎨",  label: "Format",    color: "#A29BFE", sub: "Markdown → HTML" },
    { icon: "📤",  label: "Output",    color: "#FD79A8", sub: "Send to Slack" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0" }}>
      {steps.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.12, type: "spring", stiffness: 350, damping: 28 }}
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: `${s.color}18`, border: `1px solid ${s.color}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
            }}>
              {s.icon}
            </div>
            {i < steps.length - 1 && (
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: i * 0.12 + 0.15, duration: 0.3 }}
                style={{
                  width: 1.5, height: 18, marginTop: 2,
                  background: `linear-gradient(to bottom, ${s.color}60, ${steps[i + 1]!.color}60)`,
                  transformOrigin: "top",
                }}
              />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{s.label}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{s.sub}</div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.12 + 0.25, type: "spring" }}
            style={{
              fontSize: 9, fontWeight: 800, color: s.color,
              padding: "2px 7px", borderRadius: 99, background: `${s.color}15`,
              letterSpacing: "0.04em",
            }}
          >
            ACTIVE
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

function FpsPreview() {
  const [hp,     setHp]     = useState(100);
  const [ammo,   setAmmo]   = useState(30);
  const [kills,  setKills]  = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setHp(h  => Math.max(12, h  - Math.floor(Math.random() * 6)));
      setAmmo(a => Math.max(0,  a  - 1));
      setKills(k => k + (Math.random() > 0.7 ? 1 : 0));
    }, 900);
    return () => clearInterval(id);
  }, []);
  const hpColor = hp > 60 ? "#4ADE80" : hp > 30 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{
      position: "relative", borderRadius: 14, overflow: "hidden",
      background: "rgba(0,0,0,0.60)", height: 200,
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Crosshair */}
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        {[[-10,0],[10,0],[0,-10],[0,10]].map(([dx, dy], i) => (
          <div key={i} style={{
            position: "absolute", width: dx ? 6 : 1.5, height: dy ? 6 : 1.5,
            background: "rgba(255,255,255,0.80)",
            left: `calc(50% + ${dx ?? 0}px)`,
            top:  `calc(50% + ${dy ?? 0}px)`,
          }} />
        ))}
      </div>
      {/* Kill feed */}
      <div style={{ position: "absolute", top: 10, left: 10, display: "flex", flexDirection: "column", gap: 3 }}>
        {kills > 0 && Array.from({ length: Math.min(kills, 3) }).map((_, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            style={{ fontSize: 9, color: "#4ADE80", fontWeight: 700, fontFamily: "monospace" }}>
            🎯 You → Bot_{Math.floor(Math.random() * 99)}
          </motion.div>
        ))}
      </div>
      {/* Minimap */}
      <div style={{
        position: "absolute", top: 10, right: 10, width: 52, height: 52, borderRadius: 6,
        background: "rgba(0,0,0,0.60)", border: "1px solid rgba(255,255,255,0.15)",
        overflow: "hidden",
      }}>
        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#4ADE80", position: "absolute", top: 22, left: 22 }} />
        {[{t:8,l:30},{t:35,l:10},{t:20,l:40}].map((p,i)=>(
          <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "#EF4444", position: "absolute", top: p.t, left: p.l }} />
        ))}
      </div>
      {/* HUD bottom */}
      <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        {/* HP */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, width: 90 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.40)", fontWeight: 700 }}>HP</span>
            <span style={{ fontSize: 9, fontWeight: 900, color: hpColor }}>{hp}</span>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
            <motion.div animate={{ width: `${hp}%` }} transition={{ duration: 0.4 }}
              style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${hpColor}, ${hpColor}bb)` }}
            />
          </div>
        </div>
        {/* Ammo */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1, fontFamily: "monospace" }}>{ammo}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", fontWeight: 700 }}>/ 30 AMMO</div>
        </div>
      </div>
    </div>
  );
}

function MarketplacePreview() {
  const items = [
    { icon: "📱", name: "AutoPost Pro",    price: "$4.99",  rating: 4.9, category: "Social"    },
    { icon: "🎮", name: "GameForge Elite", price: "$9.99",  rating: 4.8, category: "Gaming"    },
    { icon: "💰", name: "PricePilot",      price: "$2.99",  rating: 4.7, category: "Finance"   },
    { icon: "🧠", name: "MindMap+",        price: "Free",   rating: 4.6, category: "Productivity" },
    { icon: "✍️", name: "CopyKing AI",    price: "$3.49",  rating: 4.9, category: "Writing"   },
    { icon: "📊", name: "DataLens",        price: "$6.99",  rating: 4.5, category: "Analytics" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {items.map((item, i) => (
        <motion.div key={item.name}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, type: "spring", stiffness: 350, damping: 28 }}
          style={{
            borderRadius: 12, padding: "10px 11px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 18 }}>{item.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#fff", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", marginTop: 1 }}>{item.category}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: "#4ADE80" }}>{item.price}</span>
            <span style={{ fontSize: 9, color: "#F59E0B" }}>★ {item.rating}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function AnalyticsPreview() {
  const bars = [
    { label: "Mon", value: 62,  color: "#6C5CE7" },
    { label: "Tue", value: 84,  color: "#A29BFE" },
    { label: "Wed", value: 73,  color: "#6C5CE7" },
    { label: "Thu", value: 91,  color: "#A29BFE" },
    { label: "Fri", value: 55,  color: "#6C5CE7" },
    { label: "Sat", value: 38,  color: "#A29BFE" },
    { label: "Sun", value: 69,  color: "#6C5CE7" },
  ];
  const [metric, setMetric] = useState(0);
  useEffect(() => { const id = setInterval(() => setMetric(m => (m + 1) % 3), 2000); return () => clearInterval(id); }, []);
  const metrics = [
    { label: "API Calls",    value: "84.2K", delta: "+12%" },
    { label: "Avg Quality",  value: "91.4",  delta: "+4.2" },
    { label: "Cost Saved",   value: "$247",  delta: "-18%" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Metric cards */}
      <div style={{ display: "flex", gap: 8 }}>
        {metrics.map((m, i) => (
          <motion.div key={m.label}
            animate={{ scale: i === metric ? 1.04 : 1, opacity: i === metric ? 1 : 0.55 }}
            transition={{ duration: 0.4 }}
            style={{
              flex: 1, padding: "10px 10px 8px", borderRadius: 11,
              background: i === metric ? "rgba(108,92,231,0.18)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${i === metric ? "rgba(108,92,231,0.40)" : "rgba(255,255,255,0.07)"}`,
            }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, marginBottom: 3 }}>{m.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{m.value}</div>
            <div style={{ fontSize: 9, color: "#4ADE80", fontWeight: 700, marginTop: 2 }}>{m.delta}</div>
          </motion.div>
        ))}
      </div>
      {/* Bar chart */}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 6, height: 80,
        padding: "0 2px", borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        {bars.map((bar, i) => (
          <div key={bar.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${bar.value}%` }}
              transition={{ delay: i * 0.06, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                width: "100%", borderRadius: "4px 4px 0 0",
                background: `linear-gradient(180deg, ${bar.color}, ${bar.color}88)`,
                boxShadow: `0 0 8px ${bar.color}40`,
              }}
            />
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.30)", fontWeight: 700 }}>{bar.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialPreview() {
  const posts = [
    { user: "nova.ai",    avatar: "🤖", text: "Just hit 91 in the GPT-4 vs Claude debate ⚔️ Battle Mode is insane", likes: 847, time: "2m" },
    { user: "apex.dev",   avatar: "⚡", text: "Workflow Engine preview looks incredible. 5 AIs chained in 16s 🔥",  likes: 532, time: "8m" },
    { user: "creator.xo", avatar: "🎨", text: "Published my first AI tool to the Marketplace. Already 40 installs!", likes: 219, time: "15m" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {posts.map((p, i) => (
        <motion.div key={p.user}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.10, type: "spring", stiffness: 350, damping: 28 }}
          style={{
            borderRadius: 14, padding: "11px 13px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
          <div style={{ display: "flex", gap: 9, marginBottom: 7 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(108,92,231,0.25)", border: "1px solid rgba(108,92,231,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
              {p.avatar}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>@{p.user}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)" }}>{p.time} ago</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.70)", lineHeight: 1.55, marginBottom: 8 }}>{p.text}</div>
          <div style={{ display: "flex", gap: 14 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>♥ {p.likes}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>💬 Reply</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>↗ Share</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function AiPreview({ accent }: { accent: string }) {
  const [pulse, setPulse] = useState(0);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const steps = ["Analysing patterns…", "Detecting improvements…", "Generating patch v2.3…", "Applying upgrade…", "Upgrade complete ✓"];
  useEffect(() => {
    const id1 = setInterval(() => setPulse(p => p + 1), 600);
    const id2 = setInterval(() => {
      setProgress(p => Math.min(100, p + Math.random() * 12));
      setStep(s => Math.min(steps.length - 1, s + (Math.random() > 0.6 ? 1 : 0)));
    }, 700);
    return () => { clearInterval(id1); clearInterval(id2); };
  }, []);
  const nodes = [{x:50,y:20},{x:20,y:50},{x:80,y:50},{x:35,y:80},{x:65,y:80}];
  const edges = [[0,1],[0,2],[1,3],[2,4],[1,4],[0,3]];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Neural network SVG */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width={180} height={110} viewBox="0 0 100 100">
          {edges.map(([a, b], i) => (
            <motion.line key={i}
              x1={nodes[a]!.x} y1={nodes[a]!.y} x2={nodes[b]!.x} y2={nodes[b]!.y}
              stroke={accent} strokeWidth={0.8} strokeOpacity={0.25 + 0.4 * ((pulse + i) % 2)}
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
            />
          ))}
          {nodes.map((n, i) => (
            <motion.circle key={i} cx={n.x} cy={n.y} r={5}
              fill={accent} fillOpacity={0.6 + 0.3 * ((pulse + i) % 2)}
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: i * 0.08, type: "spring" }}
            />
          ))}
        </svg>
      </div>
      {/* Processing steps */}
      <div style={{ borderRadius: 12, padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: accent, marginBottom: 8, letterSpacing: "0.04em" }}>SELF-IMPROVEMENT ENGINE</div>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, opacity: i <= step ? 1 : 0.22, transition: "opacity 0.4s" }}>
            <div style={{
              width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
              background: i < step ? "#4ADE80" : i === step ? accent : "rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8, fontWeight: 900, color: "#fff",
            }}>
              {i < step ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 10, color: i <= step ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.25)" }}>{s}</span>
          </div>
        ))}
        {/* Progress bar */}
        <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", marginTop: 10, overflow: "hidden" }}>
          <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }}
            style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${accent}, ${accent}99)`, boxShadow: `0 0 6px ${accent}60` }}
          />
        </div>
      </div>
    </div>
  );
}

function PrivacyPreview() {
  const [locked, setLocked] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLocked(true), 800); return () => clearTimeout(t); }, []);
  const items = ["Chat history", "Memory banks", "Location data", "Usage patterns", "Model requests"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <motion.div
        animate={{ scale: locked ? 1 : 0.95, opacity: locked ? 1 : 0.5 }}
        style={{ display: "flex", justifyContent: "center", padding: "14px 0" }}>
        <div style={{
          width: 60, height: 60, borderRadius: "50%",
          background: locked ? "rgba(16,185,129,0.20)" : "rgba(255,255,255,0.06)",
          border: `2px solid ${locked ? "#10B981" : "rgba(255,255,255,0.15)"}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
          boxShadow: locked ? "0 0 24px rgba(16,185,129,0.40)" : "none",
          transition: "all 0.6s ease",
        }}>
          {locked ? "🔒" : "🔓"}
        </div>
      </motion.div>
      {items.map((item, i) => (
        <motion.div key={item}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 + i * 0.10 }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "9px 12px", borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(16,185,129,0.15)",
          }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{item}</span>
          <div style={{
            fontSize: 9, fontWeight: 900, color: "#10B981",
            padding: "2px 8px", borderRadius: 99, background: "rgba(16,185,129,0.15)",
          }}>
            ENCRYPTED
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function MemoryPreview() {
  const memories = [
    { text: "Prefers concise, bullet-point answers", type: "Preference", color: "#6C5CE7" },
    { text: "Working on a React + Vite SaaS project",  type: "Project",    color: "#10B981" },
    { text: "Loves GPT-4 for creative tasks",           type: "Interest",   color: "#F59E0B" },
    { text: "UK-based, prefers £ pricing",              type: "Context",    color: "#228BE6" },
    { text: "Goal: ship Apex to Product Hunt",          type: "Goal",       color: "#FD79A8" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {memories.map((m, i) => (
        <motion.div key={m.text}
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.09, type: "spring", stiffness: 350, damping: 28 }}
          style={{
            borderRadius: 11, padding: "10px 12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.68)", lineHeight: 1.4, flex: 1 }}>{m.text}</span>
          <div style={{
            fontSize: 8, fontWeight: 800, color: m.color,
            padding: "2px 7px", borderRadius: 99, background: `${m.color}15`,
            flexShrink: 0, letterSpacing: "0.04em",
          }}>
            {m.type}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function MonetizationPreview() {
  const [revenue, setRevenue] = useState(1247);
  useEffect(() => { const id = setInterval(() => setRevenue(r => r + Math.floor(Math.random() * 12)), 1200); return () => clearInterval(id); }, []);
  const items = [
    { label: "Skins Pack",   price: "$2.99", sales: 312, color: "#6C5CE7" },
    { label: "Weapons DLC",  price: "$4.99", sales: 147, color: "#EF4444" },
    { label: "Battle Pass",  price: "$9.99", sales: 89,  color: "#F59E0B" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, marginBottom: 4, letterSpacing: "0.06em" }}>TOTAL REVENUE</div>
        <motion.div animate={{ scale: [1, 1.03, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
          style={{ fontSize: 32, fontWeight: 900, color: "#4ADE80", letterSpacing: "-0.03em" }}>
          ${revenue.toLocaleString()}
        </motion.div>
      </div>
      {items.map((item, i) => (
        <motion.div key={item.label}
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.10, type: "spring" }}
          style={{ borderRadius: 11, padding: "10px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{item.label}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{item.sales} sales</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: item.color }}>{item.price}</div>
        </motion.div>
      ))}
    </div>
  );
}

function DefaultPreview({ feature }: { feature: ApexFeature }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 0", gap: 16 }}>
      <motion.div
        animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
        transition={{ repeat: Infinity, duration: 3 }}
        style={{ fontSize: 52 }}>
        {feature.icon}
      </motion.div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{feature.title}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, maxWidth: 260 }}>
          {feature.description}
        </div>
      </div>
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        style={{
          fontSize: 11, fontWeight: 800, color: feature.accent,
          padding: "6px 18px", borderRadius: 99,
          background: `${feature.accent}18`, border: `1px solid ${feature.accent}35`,
          letterSpacing: "0.06em",
        }}>
        IN DEVELOPMENT
      </motion.div>
    </div>
  );
}

function renderPreview(feature: ApexFeature) {
  switch (feature.previewType) {
    case "workflow":    return <WorkflowPreview />;
    case "fps":         return <FpsPreview />;
    case "marketplace": return <MarketplacePreview />;
    case "analytics":   return <AnalyticsPreview />;
    case "social":      return <SocialPreview />;
    case "privacy":     return <PrivacyPreview />;
    case "memory":      return <MemoryPreview />;
    case "monetization":return <MonetizationPreview />;
    default:            return <AiPreview accent={feature.accent} />;
  }
}

// ── Main Modal ────────────────────────────────────────────────────────────────

interface FeatureModalProps {
  feature: ApexFeature | null;
  onClose: () => void;
}

export function FeatureModal({ feature, onClose }: FeatureModalProps) {
  const [notified,     setNotified]     = useState(false);
  const [toast,        setToast]        = useState("");
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [joined,       setJoined]       = useState(false);

  useEffect(() => {
    if (feature) {
      setNotified(isNotified(feature.id));
      setJoined(hasJoined(feature.id));
    }
  }, [feature?.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleNotify() {
    if (!feature) return;
    const next = toggleNotify(feature.id);
    setNotified(next);
    setToast(next ? "We'll notify you at launch!" : "Notification removed");
    setTimeout(() => setToast(""), 2000);
  }

  function handleLockedAction() {
    setToast("This feature is not available yet");
    setTimeout(() => setToast(""), 2000);
  }

  const phase = feature ? PHASE_META[feature.phase] : null;

  return (
    <AnimatePresence>
      {feature && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 8000,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: "100%", scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: "60%", scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 8001,
              maxHeight: "92vh", display: "flex", flexDirection: "column",
              borderRadius: "24px 24px 0 0",
              background: "linear-gradient(180deg, #0E0F1A 0%, #080912 100%)",
              border: `1px solid ${feature.accent}30`,
              borderBottom: "none",
              boxShadow: `0 -8px 60px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 -4px 40px ${feature.accent}10`,
              overflow: "hidden",
            }}>

            {/* Gradient header strip */}
            <div style={{
              height: 3, flexShrink: 0,
              background: `linear-gradient(90deg, ${feature.accent}, ${feature.accent}66, ${feature.accent})`,
              boxShadow: `0 0 12px ${feature.accent}80`,
            }} />

            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.12)" }} />
            </div>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "14px 20px 12px", flexShrink: 0,
            }}>
              <div style={{
                width: 50, height: 50, borderRadius: 15, flexShrink: 0,
                background: `linear-gradient(135deg, ${feature.accent}28, ${feature.accent}12)`,
                border: `1px solid ${feature.accent}35`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, boxShadow: `0 4px 16px ${feature.accent}20`,
              }}>
                {feature.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  {phase && (
                    <div style={{ fontSize: 9, fontWeight: 800, color: phase.color, padding: "2px 7px", borderRadius: 99, background: phase.bg, letterSpacing: "0.06em" }}>
                      {phase.label}
                    </div>
                  )}
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#F59E0B", padding: "2px 7px", borderRadius: 99, background: "rgba(245,158,11,0.12)", letterSpacing: "0.04em" }}>
                    COMING SOON
                  </div>
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                  {feature.title}
                </div>
              </div>
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "rgba(255,255,255,0.50)",
              }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Description */}
            <div style={{ padding: "0 20px 10px", flexShrink: 0 }}>
              <div style={{
                fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.6,
              }}>
                {feature.description}
              </div>
            </div>

            {/* Waitlist counter */}
            <div style={{ padding: "0 20px 10px", flexShrink: 0 }}>
              <WaitlistStats featureId={feature.id} accent={feature.accent} compact />
            </div>

            {/* Preview Only notice */}
            <div style={{
              margin: "0 20px 12px", padding: "9px 13px", borderRadius: 11, flexShrink: 0,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Lock style={{ width: 12, height: 12, color: "#F59E0B", flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.40)", fontWeight: 600 }}>
                Preview Only — This feature is not available yet
              </span>
            </div>

            {/* Demo area (scrollable) */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px", scrollbarWidth: "none" }}>
              <div style={{
                borderRadius: 16, padding: "16px",
                background: "rgba(255,255,255,0.025)",
                border: `1px solid ${feature.accent}20`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 24px ${feature.accent}08`,
                minHeight: 180,
              }}>
                {renderPreview(feature)}
              </div>
            </div>

            {/* Footer CTAs */}
            <div style={{
              padding: "12px 20px 28px", flexShrink: 0,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(0,0,0,0.20)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              {/* Request Early Access — primary CTA */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowWaitlist(true)}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 15, cursor: "pointer",
                  background: joined
                    ? "rgba(74,222,128,0.15)"
                    : `linear-gradient(135deg, ${feature.accent}, ${feature.accent}cc)`,
                  border: joined ? "1px solid rgba(74,222,128,0.40)" : "none",
                  color: joined ? "#4ADE80" : "#fff",
                  fontSize: 13, fontWeight: 900,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: joined ? "none" : `0 4px 24px ${feature.accent}40`,
                }}>
                {joined
                  ? <><CheckCircle style={{ width: 14, height: 14 }} /> On the Waitlist — View Status</>
                  : <><Rocket style={{ width: 14, height: 14 }} /> Request Early Access</>}
              </motion.button>

              {/* Notify Me + Locked row */}
              <div style={{ display: "flex", gap: 8 }}>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleNotify} style={{
                  flex: 1, padding: "11px 0", borderRadius: 13, cursor: "pointer",
                  background: notified ? `${feature.accent}14` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${notified ? feature.accent + "35" : "rgba(255,255,255,0.08)"}`,
                  color: notified ? feature.accent : "rgba(255,255,255,0.40)",
                  fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}>
                  <Bell style={{ width: 12, height: 12 }} />
                  {notified ? "Notified" : "Notify Me"}
                </motion.button>

                <motion.button whileTap={{ scale: 0.95 }} onClick={handleLockedAction} style={{
                  flex: 1, padding: "11px 0", borderRadius: 13, cursor: "not-allowed",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.20)",
                  fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}>
                  <Lock style={{ width: 12, height: 12 }} />
                  Activate
                </motion.button>
              </div>
            </div>

            {/* Toast */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  style={{
                    position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)",
                    whiteSpace: "nowrap", background: "rgba(14,15,26,0.96)",
                    border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.85)",
                    fontSize: 11, fontWeight: 700, padding: "8px 16px",
                    borderRadius: 99, zIndex: 100,
                    backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(0,0,0,0.50)",
                  }}>
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}

      {/* Waitlist modal — renders above the feature modal */}
      <WaitlistModal
        feature={showWaitlist ? feature : null}
        onClose={() => {
          setShowWaitlist(false);
          if (feature) setJoined(hasJoined(feature.id));
        }}
      />
    </AnimatePresence>
  );
}
