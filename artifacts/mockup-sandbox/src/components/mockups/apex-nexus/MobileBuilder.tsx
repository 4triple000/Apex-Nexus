import React from 'react';
import { Zap, Sparkles } from 'lucide-react';

const PURPLE = "#7C3AED";
const BLUE   = "#3B82F6";
const CARD   = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";

const STEPS = [
  { label: "Analyzing prompt",   done: true,    active: false },
  { label: "Generating files",   done: false,   active: true  },
  { label: "Installing deps",    done: false,   active: false },
  { label: "Preview ready",      done: false,   active: false },
];

const PROJECTS = [
  { icon: "⚡", name: "E-commerce App",  stack: "React, TypeScript", status: "Live",     statusColor: "#4ADE80" },
  { icon: "🤖", name: "AI Chatbot",      stack: "Node.js, Python",   status: "Building", statusColor: "#60A5FA" },
  { icon: "🌐", name: "Portfolio Site",  stack: "Next.js",           status: "Draft",    statusColor: "rgba(255,255,255,0.3)" },
];

export function MobileBuilder() {
  return (
    <div style={{ width: 390, height: 844, background: "#07070F", color: "white", fontFamily: "Inter, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "52px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Nexus Builder</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, marginBottom: 0 }}>Build anything with AI</p>
        </div>
        <div style={{ background: `linear-gradient(135deg, ${PURPLE}, ${BLUE})`, padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          ⚡ New
        </div>
      </div>

      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 100px" }}>

        {/* Prompt Input Card */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 20, padding: 16, marginBottom: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: -4, background: "linear-gradient(135deg, rgba(124,58,237,0.1), rgba(59,130,246,0.1))", filter: "blur(20px)", opacity: 0.5, pointerEvents: "none" }} />
          <textarea
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 14, color: "rgba(255,255,255,0.9)", resize: "none", height: 80, fontFamily: "inherit", position: "relative", zIndex: 1, boxSizing: "border-box" }}
            placeholder="Describe what you want to build..."
            readOnly
          />
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, position: "relative", zIndex: 1 }}>
            {[["📱","App"], ["🌐","Web"], ["🤖","Bot"], ["🎮","Game"]].map(([icon, label]) => (
              <button key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12, color: "rgba(255,255,255,0.8)", cursor: "pointer", whiteSpace: "nowrap" }}>{icon} {label}</button>
            ))}
          </div>
          <button style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: `linear-gradient(135deg, ${PURPLE}, ${BLUE})`, border: "none", color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, position: "relative", zIndex: 1 }}>
            ⚡ Build with Apex
          </button>
        </div>

        {/* AI Build Status */}
        <div style={{ background: CARD, border: "1px solid rgba(124,58,237,0.3)", borderRadius: 20, padding: 20, marginBottom: 20, position: "relative", overflow: "hidden" }}>
          {/* Progress bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.08)" }}>
            <div style={{ height: "100%", background: `linear-gradient(90deg, ${PURPLE}, ${BLUE})`, width: "45%" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 16, background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✨</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>AI is building...</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Generating components</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 12, position: "relative" }}>
            <div style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 1, background: "rgba(255,255,255,0.1)" }} />
            {STEPS.map(({ label, done, active }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: done ? "#4ADE80" : active ? PURPLE : "rgba(255,255,255,0.2)", boxShadow: active ? `0 0 8px ${PURPLE}` : undefined, position: "relative", zIndex: 1 }} />
                <span style={{ fontSize: 12, color: done ? "#4ADE80" : active ? "#A78BFA" : "rgba(255,255,255,0.4)" }}>{label}{done ? " ✓" : ""}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Projects */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Recent Projects</span>
            <button style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(124,58,237,0.5)", color: "#A78BFA", background: "rgba(124,58,237,0.1)", cursor: "pointer" }}>New +</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PROJECTS.map(({ icon, name, stack, status, statusColor }) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{stack}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, background: `${statusColor}15`, border: `1px solid ${statusColor}30` }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: statusColor }} />
                  <span style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>{status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Cards */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 12 }}>TOOLS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[["📁","Templates"], ["📥","Import"], ["🚀","Deploy"]].map(([icon, label]) => (
              <div key={label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 84, background: "rgba(7,7,15,0.95)", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-around", paddingBottom: 20 }}>
        {[
          { label: "Home",    icon: "🏠",  active: false },
          { label: "Builder", icon: "🔨",  active: true  },
          { label: "Identity",icon: "🪪",  active: false },
        ].map(({ label, icon, active }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: active ? 1 : 0.4 }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? "#A78BFA" : "white" }}>{label}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
