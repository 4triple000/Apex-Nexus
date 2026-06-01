import React from 'react';
import {
  MessageSquare, Bot, Network, Camera, Mic, Brain,
  Swords, PenLine, Archive, User, Terminal, Settings,
  Search, Bell, ChevronDown, ChevronRight, ArrowUp,
  Globe, ThumbsUp, ThumbsDown, Copy, Share, Zap, Sparkles, Hammer
} from 'lucide-react';

const NAV = [
  { icon: Bot,           label: "DM Automation"  },
  { icon: Network,       label: "Hive Mode"       },
  { icon: Camera,        label: "Screenshot AI"   },
  { icon: Mic,           label: "Voice & Audio"   },
  { icon: Brain,         label: "AI Coach"        },
  { icon: Swords,        label: "Battle Mode"     },
  { icon: PenLine,       label: "Content Writer"  },
  { icon: Archive,       label: "Memory"          },
  { icon: User,          label: "Identity"        },
  { icon: Hammer,        label: "Nexus Builder"   },
  { icon: Terminal,      label: "Dev Cockpit"     },
];

export function WebDashboard() {
  return (
    <div style={{ width: 1280, height: 900, display: "flex", overflow: "hidden", background: "#07070F", color: "white", fontFamily: "Inter, sans-serif", position: "relative" }}>

      {/* BG gradient */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(124,58,237,0.05) 0%, transparent 50%, rgba(59,130,246,0.05) 100%)", pointerEvents: "none" }} />

      {/* LEFT SIDEBAR */}
      <div style={{ width: 224, height: "100%", background: "#0D0D1A", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", position: "relative", zIndex: 10, flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ height: 56, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #7C3AED, #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>A</div>
          <span style={{ fontWeight: 800, letterSpacing: 3, fontSize: 12, background: "linear-gradient(90deg, white, rgba(255,255,255,0.6))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>APEX NEXUS</span>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 0", display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Active item */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", margin: "0 8px", borderRadius: 8, background: "linear-gradient(90deg, rgba(124,58,237,0.2), rgba(59,130,246,0.1))", borderLeft: "2px solid #A78BFA", cursor: "pointer" }}>
            <MessageSquare style={{ width: 16, height: 16, color: "#A78BFA" }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: "#EDE9FE" }}>AI Chat</span>
          </div>
          {NAV.map(({ icon: Icon, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", margin: "0 8px", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14 }}>
              <Icon style={{ width: 16, height: 16 }} />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(249,115,22,0.15)", borderRadius: 8, border: "1px solid rgba(249,115,22,0.2)", width: "fit-content", marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>🔥</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#FED7AA" }}>Daily Streak — 23 Days</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, marginLeft: -8 }}>
            <Settings style={{ width: 16, height: 16 }} />
            <span>Settings</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 10, minWidth: 0 }}>

        {/* TOP BAR */}
        <div style={{ height: 56, background: "#0A0A15", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, flexShrink: 0 }}>
          <div style={{ flex: 1, maxWidth: 400, margin: "0 auto", position: "relative" }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "rgba(255,255,255,0.4)" }} />
            <input type="text" placeholder="Search anything..." style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "6px 48px 6px 36px", fontSize: 14, color: "white", outline: "none", boxSizing: "border-box" }} />
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)" }}>⌘ K</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative" }}>
              <Bell style={{ width: 16, height: 16, color: "rgba(255,255,255,0.6)" }} />
              <div style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, background: "#3B82F6", borderRadius: 3 }} />
            </div>
            <div style={{ background: "linear-gradient(90deg, #7C3AED, #3B82F6)", color: "white", fontSize: 13, padding: "6px 16px", borderRadius: 99, display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: "white" }} />
              Apex Orb
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 16, borderLeft: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: "linear-gradient(135deg, #7C3AED, #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>A</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Apex</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Prime User</span>
              </div>
              <ChevronDown style={{ width: 12, height: 12, color: "rgba(255,255,255,0.5)" }} />
            </div>
          </div>
        </div>

        {/* TWO-COL LAYOUT */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* MAIN CHAT AREA */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, overflow: "hidden" }}>
            <div style={{ marginBottom: 24, flexShrink: 0 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, margin: 0 }}>AI Chat</h1>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 4 }}>Powered by the most advanced AI models.</p>
            </div>

            {/* Suggestion chips */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexShrink: 0, overflowX: "auto" }}>
              {["Give me a battle plan", "Analyze this screenshot", "Write a viral tweet", "Life advice"].map((t) => (
                <button key={t} style={{ whiteSpace: "nowrap", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "6px 16px", fontSize: 13, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>{t}</button>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, paddingRight: 8 }}>
              {/* User bubble */}
              <div style={{ marginLeft: "auto", maxWidth: 400, background: "linear-gradient(135deg, #7C3AED, #3B82F6)", borderRadius: "16px 16px 4px 16px", padding: "12px 16px" }}>
                <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>What are the keys to becoming an unstoppable entrepreneur?</p>
              </div>
              {/* AI bubble */}
              <div style={{ display: "flex", gap: 16, maxWidth: 720 }}>
                <div style={{ width: 32, height: 32, borderRadius: 16, background: "linear-gradient(135deg, #7C3AED, #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>A</div>
                <div style={{ flex: 1 }}>
                  <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px 16px 16px 4px", padding: "16px 20px", fontSize: 14, lineHeight: 1.7 }}>
                    <p style={{ marginTop: 0, fontWeight: 600 }}>Becoming an unstoppable entrepreneur requires mastery in mindset, systems, and execution:</p>
                    <ul style={{ paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, margin: 0 }}>
                      {[["⚡", "#A78BFA", "Relentless Focus", "Eliminate distractions and obsess over your mission."],
                        ["✨", "#60A5FA", "Value Creation",   "Solve real problems. Provide insane value."],
                        ["⚡", "#A78BFA", "Discipline",       "Consistency compounds. Show up every day."],
                        ["✨", "#60A5FA", "Leverage",         "Build systems and teams that scale your impact."]].map(([icon, color, title, desc]) => (
                        <li key={title as string} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <span style={{ color: color as string, marginTop: 2 }}>{icon}</span>
                          <span><strong style={{ color: "white" }}>{title as string}</strong> <span style={{ color: "rgba(255,255,255,0.6)" }}>— {desc as string}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 8, paddingLeft: 8 }}>
                    {[ThumbsUp, ThumbsDown, Copy, Share].map((Icon, i) => (
                      <button key={i} style={{ width: 28, height: 28, borderRadius: 8, background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon style={{ width: 14, height: 14 }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Input bar */}
            <div style={{ flexShrink: 0, marginTop: 16, background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 8, display: "flex", alignItems: "flex-end", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, paddingBottom: 4, paddingLeft: 8, flexShrink: 0 }}>
                {[["✨", "Apex 3.0"], ["🌐", "Web"], ["🧠", "Mem: On"]].map(([icon, label]) => (
                  <button key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>{icon} {label}</button>
                ))}
              </div>
              <textarea placeholder="Message Apex Nexus..." rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontSize: 14, resize: "none", minHeight: 44, padding: "10px 0" }} />
              <div style={{ paddingBottom: 4, paddingRight: 4, flexShrink: 0 }}>
                <button style={{ width: 40, height: 40, borderRadius: 20, background: "linear-gradient(135deg, #7C3AED, #3B82F6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>↑</button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{ width: 288, background: "#07070F", borderLeft: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 20, padding: 20, overflowY: "auto", flexShrink: 0 }}>
            {/* Orb card */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <h3 style={{ fontWeight: 600, margin: "0 0 4px" }}>Apex Orb</h3>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 0, marginBottom: 20 }}>Your command center.</p>
              {/* Orb ring animation */}
              <div style={{ width: 96, height: 96, position: "relative", marginBottom: 20 }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px dashed rgba(124,58,237,0.5)" }} />
                <div style={{ position: "absolute", inset: 4, borderRadius: "50%", border: "1px dotted rgba(59,130,246,0.4)" }} />
                <div style={{ position: "absolute", inset: 8, borderRadius: "50%", background: "linear-gradient(135deg, #1c1236, #0d1430)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>A</div>
              </div>
              <button style={{ width: "100%", background: "linear-gradient(90deg, #7C3AED, #3B82F6)", color: "white", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Open Apex Orb</button>
            </div>

            {/* Quick actions */}
            <div>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, marginTop: 0 }}>Quick Actions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[{ Icon: Camera, label: "Screenshot Analyzer" }, { Icon: Swords, label: "Battle Mode" }, { Icon: Mic, label: "Voice Chat" }, { Icon: Bot, label: "DM Automation" }].map(({ Icon, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 12, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon style={{ width: 16, height: 16, color: "rgba(255,255,255,0.6)" }} />
                      </div>
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>{label}</span>
                    </div>
                    <ChevronRight style={{ width: 16, height: 16, color: "rgba(255,255,255,0.2)" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Memory card */}
            <div style={{ marginTop: "auto", background: "linear-gradient(135deg, rgba(124,58,237,0.1), rgba(59,130,246,0.1))", border: "1px solid rgba(124,58,237,0.1)", borderRadius: 20, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Brain style={{ width: 16, height: 16, color: "#A78BFA" }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Memory</h3>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 16, marginTop: 0 }}>Apex remembers everything important to you.</p>
              <button style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 16px", color: "rgba(255,255,255,0.9)", fontSize: 12, cursor: "pointer" }}>View Memory</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
