import React from 'react';
import {
  Folder, File, ChevronRight, Play, Rocket, Share2,
  Terminal, Code2, Brain, MessageSquare, Users, Settings,
  Search, Bell, Sparkles, Plus, ChevronDown, X,
  ExternalLink, RefreshCw, Zap, Bot, LayoutDashboard,
  Network, Camera, Mic, Swords, PenLine, Archive,
  User, Hammer, Globe
} from 'lucide-react';

const NAV_ITEMS = [
  { icon: MessageSquare, label: "AI Chat"       },
  { icon: Bot,           label: "DM Automation" },
  { icon: Network,       label: "Hive Mode"     },
  { icon: Camera,        label: "Screenshot AI" },
  { icon: Mic,           label: "Voice & Audio" },
  { icon: Brain,         label: "AI Coach"      },
  { icon: Swords,        label: "Battle Mode"   },
  { icon: PenLine,       label: "Content Writer"},
  { icon: Archive,       label: "Memory"        },
  { icon: User,          label: "Identity"      },
  { icon: Terminal,      label: "Dev Cockpit"   },
];

export function WebBuilder() {
  return (
    <div style={{ width: 1280, height: 900, display: "flex", overflow: "hidden", background: "#07070F", color: "white", fontFamily: "Inter, sans-serif" }}>

      {/* LEFT SIDEBAR */}
      <div style={{ width: 216, borderRight: "1px solid rgba(255,255,255,0.05)", background: "#0D0D1A", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ height: 56, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #7C3AED, #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>A</div>
          <span style={{ fontWeight: 800, letterSpacing: 3, fontSize: 12, background: "linear-gradient(90deg, white, rgba(255,255,255,0.6))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>APEX NEXUS</span>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 0", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", margin: "0 8px", borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13 }}>
              <Icon style={{ width: 15, height: 15 }} />
              <span>{label}</span>
            </div>
          ))}

          {/* Active: Nexus Builder */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", margin: "0 8px", borderRadius: 8, background: "linear-gradient(90deg, rgba(124,58,237,0.2), rgba(59,130,246,0.1))", borderLeft: "2px solid #A78BFA", cursor: "pointer" }}>
            <Hammer style={{ width: 15, height: 15, color: "#A78BFA" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#EDE9FE" }}>Nexus Builder</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", margin: "0 8px", borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13 }}>
            <LayoutDashboard style={{ width: 15, height: 15 }} />
            <span>Dev Cockpit</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "rgba(249,115,22,0.15)", borderRadius: 8, border: "1px solid rgba(249,115,22,0.2)", marginBottom: 8 }}>
            <span style={{ fontSize: 11 }}>🔥</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#FED7AA" }}>Daily Streak — 23 Days</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "rgba(10,10,21,0.8)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, width: 256 }}>
              <Search style={{ width: 16, height: 16, color: "rgba(255,255,255,0.4)" }} />
              <input type="text" placeholder="Search anything..." style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "white", width: "100%" }} />
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>⌘K</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative" }}>
              <Bell style={{ width: 16, height: 16, color: "rgba(255,255,255,0.6)" }} />
              <div style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, background: "#EC4899", borderRadius: 3 }} />
            </div>
            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
            <div style={{ fontSize: 12, color: "#4ADE80", fontWeight: 600 }}>● System Online</div>
          </div>
        </div>

        {/* Builder IDE */}
        <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#07070F" }}>

          {/* Nexus Builder sidebar */}
          <div style={{ width: 200, borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nexus Builder</div>
              <textarea style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 10, padding: 10, fontSize: 12, color: "rgba(255,255,255,0.7)", outline: "none", resize: "none", height: 60, fontFamily: "inherit", boxSizing: "border-box" }} placeholder="Describe what you want to build..." readOnly />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {[["📱","App"],["🌐","Web"],["🤖","Bot"],["🎮","Game"]].map(([icon, label]) => (
                  <button key={label} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>{icon} {label}</button>
                ))}
              </div>
              <button style={{ width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10, background: "linear-gradient(135deg, #7C3AED, #3B82F6)", border: "none", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                ⚡ Build with Apex
              </button>
            </div>
            {/* File explorer */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Folder style={{ width: 12, height: 12 }} /> FILES
                </span>
                <Plus style={{ width: 12, height: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer" }} />
              </div>
              <div style={{ padding: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", fontSize: 13, color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>
                  <ChevronDown style={{ width: 12, height: 12, color: "rgba(255,255,255,0.4)" }} />
                  <Folder style={{ width: 12, height: 12, color: "#60A5FA" }} />
                  <span>src</span>
                </div>
                <div style={{ paddingLeft: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", fontSize: 13, background: "rgba(124,58,237,0.1)", borderLeft: "2px solid #A78BFA", color: "white", cursor: "pointer", marginBottom: 2 }}>
                    <File style={{ width: 11, height: 11, color: "#93C5FD" }} /> <span>App.tsx</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", fontSize: 13, color: "rgba(255,255,255,0.55)", cursor: "pointer", marginBottom: 2 }}>
                    <File style={{ width: 11, height: 11, color: "#93C5FD" }} /> <span>index.tsx</span>
                  </div>
                  {[["components"], ["hooks"]].map(([name]) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", fontSize: 13, color: "rgba(255,255,255,0.55)", cursor: "pointer", marginBottom: 2 }}>
                      <ChevronRight style={{ width: 11, height: 11, color: "rgba(255,255,255,0.35)" }} />
                      <Folder style={{ width: 11, height: 11, color: "#60A5FA" }} /> <span>{name}</span>
                    </div>
                  ))}
                </div>
                {["package.json","README.md"].map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 24px", fontSize: 13, color: "rgba(255,255,255,0.55)", cursor: "pointer" }}>
                    <File style={{ width: 11, height: 11, color: f.endsWith("json") ? "#FCD34D" : "#93C5FD" }} /> <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monaco Code Editor */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0A0A16", minWidth: 0, borderRight: "1px solid rgba(255,255,255,0.05)" }}>
            {/* Editor tabs */}
            <div style={{ height: 40, display: "flex", alignItems: "center", background: "#07070F", borderBottom: "1px solid rgba(255,255,255,0.05)", overflowX: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", height: "100%", background: "#0A0A16", borderRight: "1px solid rgba(255,255,255,0.05)", borderTop: "2px solid #7C3AED", fontSize: 13 }}>
                <File style={{ width: 13, height: 13, color: "#93C5FD" }} />
                <span style={{ color: "white" }}>App.tsx</span>
                <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.4)", cursor: "pointer" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", height: "100%", borderRight: "1px solid rgba(255,255,255,0.05)", fontSize: 13, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                <File style={{ width: 13, height: 13, color: "#93C5FD", opacity: 0.5 }} />
                <span>index.tsx</span>
              </div>
            </div>

            {/* Code */}
            <div style={{ flex: 1, display: "flex", overflow: "auto", fontFamily: "monospace", fontSize: 13, lineHeight: "1.6" }}>
              <div style={{ width: 48, textAlign: "right", paddingRight: 16, color: "rgba(255,255,255,0.2)", paddingTop: 8, borderRight: "1px solid rgba(255,255,255,0.05)", userSelect: "none", flexShrink: 0 }}>
                {Array.from({ length: 15 }, (_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <div style={{ flex: 1, padding: "8px 16px 16px", whiteSpace: "pre", overflowX: "auto" }}>
                <div><span style={{ color: "#C084FC" }}>import</span> <span style={{ color: "rgba(255,255,255,0.85)" }}>React </span><span style={{ color: "#C084FC" }}>from</span> <span style={{ color: "#4ADE80" }}>'react'</span>;</div>
                <div><span style={{ color: "#C084FC" }}>import</span> <span style={{ color: "rgba(255,255,255,0.85)" }}>{"{ useState }"} </span><span style={{ color: "#C084FC" }}>from</span> <span style={{ color: "#4ADE80" }}>'react'</span>;</div>
                <div></div>
                <div><span style={{ color: "#C084FC" }}>function</span> <span style={{ color: "#FDE68A" }}>App</span><span style={{ color: "rgba(255,255,255,0.7)" }}>() {"{"}</span></div>
                <div><span style={{ color: "rgba(255,255,255,0.7)" }}>{"  "}</span><span style={{ color: "#C084FC" }}>const</span><span style={{ color: "rgba(255,255,255,0.7)" }}> [count, setCount] = </span><span style={{ color: "#FDE68A" }}>useState</span><span style={{ color: "rgba(255,255,255,0.7)" }}>(0);</span></div>
                <div></div>
                <div><span style={{ color: "rgba(255,255,255,0.7)" }}>{"  "}</span><span style={{ color: "#C084FC" }}>return</span><span style={{ color: "rgba(255,255,255,0.7)" }}> (</span></div>
                <div><span style={{ color: "rgba(255,255,255,0.7)" }}>{"    "}</span><span style={{ color: "rgba(255,255,255,0.5)" }}>&lt;</span><span style={{ color: "#60A5FA" }}>div</span><span style={{ color: "rgba(255,255,255,0.5)" }}>&gt;</span></div>
                <div><span style={{ color: "rgba(255,255,255,0.7)" }}>{"      "}</span><span style={{ color: "rgba(255,255,255,0.5)" }}>&lt;</span><span style={{ color: "#60A5FA" }}>h1</span><span style={{ color: "rgba(255,255,255,0.5)" }}>&gt;</span><span style={{ color: "rgba(255,255,255,0.8)" }}>Hello, Apex Nexus</span><span style={{ color: "rgba(255,255,255,0.5)" }}>&lt;/</span><span style={{ color: "#60A5FA" }}>h1</span><span style={{ color: "rgba(255,255,255,0.5)" }}>&gt;</span></div>
                <div><span style={{ color: "rgba(255,255,255,0.7)" }}>{"      "}</span><span style={{ color: "rgba(255,255,255,0.5)" }}>&lt;</span><span style={{ color: "#60A5FA" }}>button</span><span style={{ color: "#93C5FD" }}> onClick</span><span style={{ color: "rgba(255,255,255,0.5)" }}>={`{`}</span><span style={{ color: "#C084FC" }}>() =&gt; </span><span style={{ color: "#FDE68A" }}>setCount</span><span style={{ color: "rgba(255,255,255,0.7)" }}>(c =&gt; c + 1)</span><span style={{ color: "rgba(255,255,255,0.5)" }}>{`}`}&gt;</span></div>
                <div><span style={{ color: "rgba(255,255,255,0.7)" }}>{"        "}Count: </span><span style={{ color: "rgba(255,255,255,0.5)" }}>{`{`}count{`}`}</span></div>
                <div><span style={{ color: "rgba(255,255,255,0.5)" }}>{"      "}&lt;/</span><span style={{ color: "#60A5FA" }}>button</span><span style={{ color: "rgba(255,255,255,0.5)" }}>&gt;</span></div>
                <div><span style={{ color: "rgba(255,255,255,0.5)" }}>{"    "}&lt;/</span><span style={{ color: "#60A5FA" }}>div</span><span style={{ color: "rgba(255,255,255,0.5)" }}>&gt;</span></div>
                <div><span style={{ color: "rgba(255,255,255,0.7)" }}>{"  "});</span></div>
                <div><span style={{ color: "rgba(255,255,255,0.7)" }}>{"}"}</span></div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div style={{ height: 56, background: "#07070F", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <button style={{ padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, rgba(74,222,128,0.2), rgba(16,185,129,0.2))", border: "1px solid rgba(74,222,128,0.3)", color: "#4ADE80", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <Play style={{ width: 16, height: 16 }} /> Run
                </button>
                <button style={{ padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #3B82F6)", border: "none", color: "white", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <Rocket style={{ width: 16, height: 16 }} /> Deploy
                </button>
                <button style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <Share2 style={{ width: 16, height: 16 }} /> Share
                </button>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", display: "flex", gap: 16 }}>
                <span>Ln 4, Col 12</span><span>UTF-8</span><span style={{ color: "#93C5FD" }}>TypeScript React</span>
              </div>
            </div>
          </div>

          {/* Right panel (Preview + Chat) */}
          <div style={{ width: 360, display: "flex", flexDirection: "column", background: "#07070F", flexShrink: 0 }}>

            {/* Live Preview */}
            <div style={{ height: "50%", display: "flex", flexDirection: "column", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Globe style={{ width: 13, height: 13 }} /> LIVE PREVIEW
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <RefreshCw style={{ width: 13, height: 13, color: "rgba(255,255,255,0.4)", cursor: "pointer" }} />
                  <ExternalLink style={{ width: 13, height: 13, color: "rgba(255,255,255,0.4)", cursor: "pointer" }} />
                </div>
              </div>
              <div style={{ flex: 1, padding: 8, background: "rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
                <div style={{ height: 32, background: "#1A1A24", borderRadius: "8px 8px 0 0", border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none", display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1,2,3].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: 5, background: "rgba(255,255,255,0.2)" }} />)}
                  </div>
                  <div style={{ flex: 1, textAlign: "center", background: "rgba(0,0,0,0.4)", borderRadius: 4, padding: "2px 8px", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>localhost:3000</div>
                </div>
                <div style={{ flex: 1, background: "white", borderRadius: "0 0 8px 8px", border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, fontFamily: "sans-serif" }}>Hello, Apex Nexus</h1>
                  <button style={{ padding: "8px 16px", background: "#2563EB", color: "white", border: "none", borderRadius: 8, fontWeight: 500, fontSize: 14, cursor: "pointer", fontFamily: "sans-serif" }}>Count: 0</button>
                </div>
              </div>
            </div>

            {/* AI Chat */}
            <div style={{ height: "50%", display: "flex", flexDirection: "column", background: "#0A0A16" }}>
              <div style={{ height: 2, background: "linear-gradient(90deg, rgba(124,58,237,0.3), rgba(59,130,246,0.3), transparent)" }} />
              <div style={{ height: 48, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#07070F" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(59,130,246,0.2))", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot style={{ width: 13, height: 13, color: "#A78BFA" }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Apex Builder AI</span>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16, fontSize: 13 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Bot style={{ width: 13, height: 13, color: "#A78BFA" }} />
                  </div>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>I've generated your React app. What would you like to change?</p>
                </div>
                <div style={{ display: "flex", flexDirection: "row-reverse", gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 12, background: "linear-gradient(135deg, #374151, #1F2937)", flexShrink: 0 }} />
                  <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px 12px 4px 12px", padding: "8px 12px", maxWidth: "85%" }}>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.9)" }}>Add a dark mode toggle</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Bot style={{ width: 13, height: 13, color: "#A78BFA" }} />
                  </div>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>Adding dark mode... <span style={{ color: "#4ADE80" }}>✓ Done!</span> Check the preview.</p>
                </div>
              </div>
              <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.05)", background: "#07070F" }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input type="text" placeholder="Ask Apex to modify..." style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 44px 10px 16px", fontSize: 13, color: "white", outline: "none", boxSizing: "border-box" }} />
                  <button style={{ position: "absolute", right: 8, padding: 6, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #3B82F6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Zap style={{ width: 13, height: 13, color: "white" }} />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
