import { useState } from "react";
import { useLocation } from "wouter";
import {
  Folder, File, ChevronRight, Play, Rocket, Share2,
  Terminal, Code2, Brain, MessageSquare, Users, Settings,
  Search, Bell, Sparkles, Plus, ChevronDown, X,
  ExternalLink, RefreshCw, Zap, Bot, LayoutDashboard,
  Network, Camera, Mic, Swords, PenLine, Archive,
  User, Hammer, Globe, ArrowUp,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

const SIDEBAR_ITEMS = [
  { href: "/",               icon: MessageSquare, label: "AI Chat"        },
  { href: "/dm",             icon: Bot,           label: "DM Automation"  },
  { href: "/studio",         icon: Network,       label: "Hive Mode"      },
  { href: "/screenshot",     icon: Camera,        label: "Screenshot AI"  },
  { href: "/apex-os",        icon: Mic,           label: "Voice & Audio"  },
  { href: "/workflows",      icon: Brain,         label: "AI Coach"       },
  { href: "/arena",          icon: Swords,        label: "Battle Mode"    },
  { href: "/feed",           icon: PenLine,       label: "Content Writer" },
  { href: "/profile",        icon: Archive,       label: "Memory"         },
  { href: "/avatar",         icon: User,          label: "Identity"       },
  { href: "/nexus-builder",  icon: Hammer,        label: "Nexus Builder"  },
  { href: "/dev-cockpit",    icon: Terminal,      label: "Dev Cockpit"    },
];

const MOCK_FILES = [
  { name: "src", type: "folder", expanded: true, children: [
    { name: "App.tsx",    type: "file", active: true  },
    { name: "index.tsx",  type: "file", active: false },
    { name: "components", type: "folder", expanded: false },
    { name: "hooks",      type: "folder", expanded: false },
  ]},
  { name: "package.json", type: "file", active: false },
  { name: "README.md",    type: "file", active: false },
];

type BuildStatus = "idle" | "building" | "done";

export default function NexusBuilderPage() {
  const [location] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [buildStatus, setBuildStatus] = useState<BuildStatus>("idle");
  const [aiInput, setAiInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "ai",   text: "I've generated your React app. What would you like to change?" },
    { role: "user", text: "Add a dark mode toggle" },
    { role: "ai",   text: "Adding dark mode... ✓ Done! Check the preview." },
  ]);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const handleBuild = () => {
    if (!prompt.trim()) return;
    setBuildStatus("building");
    setTimeout(() => setBuildStatus("done"), 4000);
  };

  return (
    <div
      className="flex min-h-[100dvh] w-full overflow-hidden"
      style={{ background: "#07070F", color: "white", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── LEFT SIDEBAR ─────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col shrink-0 border-r"
        style={{ width: 224, background: "#0D0D1A", borderColor: "rgba(255,255,255,0.05)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 border-b shrink-0" style={{ height: 56, borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="relative flex items-center justify-center rounded-md" style={{ width: 26, height: 26, background: "linear-gradient(135deg,#7C3AED,#3B82F6)", boxShadow: "0 0 12px rgba(124,58,237,0.55)" }}>
            <div className="absolute rounded-[5px] flex items-center justify-center" style={{ inset: 1.5, background: "#0A0A15" }}>
              <span className="font-bold text-sm" style={{ background: "linear-gradient(135deg,#fff,rgba(255,255,255,0.7))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>A</span>
            </div>
          </div>
          <span className="font-bold text-sm tracking-widest" style={{ background: "linear-gradient(90deg,#fff,rgba(255,255,255,0.6))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>APEX NEXUS</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 flex flex-col gap-0.5 px-2">
          {SIDEBAR_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm"
                  style={{ background: active ? "linear-gradient(90deg,rgba(124,58,237,0.18),rgba(59,130,246,0.10))" : "transparent", borderLeft: active ? "2px solid #A78BFA" : "2px solid transparent", color: active ? "#EDE9FE" : "rgba(255,255,255,0.55)" }}>
                  <Icon size={15} style={{ color: active ? "#A78BFA" : "rgba(255,255,255,0.45)", flexShrink: 0 }} />
                  <span style={{ fontWeight: active ? 500 : 400 }}>{label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 p-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <span style={{ fontSize: 12 }}>🔥</span>
            <span className="text-xs font-medium" style={{ color: "#FED7AA" }}>Daily Streak — 23 Days</span>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* TopBar */}
        <div className="flex items-center gap-4 px-6 shrink-0 border-b" style={{ height: 56, background: "rgba(10,10,21,0.95)", borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex-1 max-w-md mx-auto relative">
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)", pointerEvents: "none" }} />
            <input placeholder="Search anything..." className="w-full text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9999, padding: "6px 40px 6px 34px", color: "white" }} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>⌘ K</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative flex items-center justify-center rounded-full" style={{ width: 32, height: 32, color: "rgba(255,255,255,0.5)" }}>
              <Bell size={16} />
              <span className="absolute rounded-full" style={{ top: 8, right: 8, width: 6, height: 6, background: "#3B82F6" }} />
            </button>
            <div className="text-xs font-medium" style={{ color: "#4ADE80" }}>● System Online</div>
          </div>
        </div>

        {/* IDE Layout */}
        <div className="flex-1 flex overflow-hidden">

          {/* Prompt input + file explorer — collapsed on mobile, shown on desktop */}
          <div className="hidden lg:flex flex-col border-r" style={{ width: 220, borderColor: "rgba(255,255,255,0.05)", background: "#07070F" }}>
            {/* Build prompt */}
            <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: "rgba(255,255,255,0.8)" }}>Nexus Builder</h2>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to build..."
                className="w-full text-xs resize-none outline-none rounded-xl p-3 mb-3"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(124,58,237,0.35)", color: "white", minHeight: 72, caretColor: "#A78BFA" }}
              />
              <div className="flex flex-wrap gap-1.5 mb-3">
                {["📱 App", "🌐 Web", "🤖 Bot", "🎮 Game"].map((t) => (
                  <button key={t} className="px-2.5 py-1 rounded-lg text-[11px]" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>{t}</button>
                ))}
              </div>
              <button
                onClick={handleBuild}
                className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold"
                style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)", boxShadow: "0 0 16px rgba(124,58,237,0.35)", color: "white" }}
              >
                <Zap size={14} /> Build with Apex
              </button>

              {buildStatus === "building" && (
                <div className="mt-3">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <div className="h-full rounded-full" style={{ width: "45%", background: "linear-gradient(90deg,#7C3AED,#3B82F6)", animation: "pulse 1.5s ease-in-out infinite" }} />
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {["Analyzing prompt", "Generating files", "Installing deps", "Preview ready"].map((step, i) => (
                      <div key={step} className="flex items-center gap-2">
                        <div className="rounded-full" style={{ width: 6, height: 6, background: i === 0 ? "#A78BFA" : "rgba(255,255,255,0.2)", boxShadow: i === 0 ? "0 0 8px rgba(167,139,250,0.8)" : "none" }} />
                        <span className="text-[11px]" style={{ color: i === 0 ? "#A78BFA" : "rgba(255,255,255,0.35)" }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* File Explorer */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <Folder size={12} /> FILES
                </div>
                <button className="rounded flex items-center justify-center" style={{ width: 18, height: 18, color: "rgba(255,255,255,0.4)" }}>
                  <Plus size={11} />
                </button>
              </div>
              <div className="py-2 px-2">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-sm cursor-pointer" style={{ color: "rgba(255,255,255,0.75)" }}>
                  <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.35)" }} />
                  <Folder size={12} style={{ color: "#60A5FA" }} />
                  <span>src</span>
                </div>
                <div className="pl-5 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer" style={{ background: "rgba(124,58,237,0.12)", borderLeft: "2px solid #A78BFA", color: "white" }}>
                    <File size={11} style={{ color: "#93C5FD" }} /><span>App.tsx</span>
                  </div>
                  {[{ name: "index.tsx", color: "#93C5FD" }].map((f) => (
                    <div key={f.name} className="flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
                      <File size={11} style={{ color: f.color }} /><span>{f.name}</span>
                    </div>
                  ))}
                  {["components", "hooks"].map((d) => (
                    <div key={d} className="flex items-center gap-1.5 px-2 py-1 rounded text-sm cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
                      <ChevronRight size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                      <Folder size={11} style={{ color: "#60A5FA" }} />
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
                {[{ name: "package.json", color: "#FDE047" }, { name: "README.md", color: "#BAE6FD" }].map((f) => (
                  <div key={f.name} className="flex items-center gap-2 px-2 py-1 mt-0.5 rounded text-sm cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
                    <File size={11} style={{ color: f.color }} /><span>{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 flex flex-col min-w-0 border-r" style={{ background: "#0A0A16", borderColor: "rgba(255,255,255,0.05)" }}>
            {/* Tabs */}
            <div className="flex items-center border-b overflow-x-auto" style={{ height: 40, background: "#07070F", borderColor: "rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2 px-4 h-full border-r border-t-2 text-sm min-w-max cursor-pointer" style={{ background: "#0A0A16", borderColor: "rgba(255,255,255,0.05)", borderTopColor: "#7C3AED" }}>
                <File size={13} style={{ color: "#93C5FD" }} />
                <span style={{ color: "white" }}>App.tsx</span>
                <X size={13} style={{ color: "rgba(255,255,255,0.35)", marginLeft: 6 }} />
              </div>
              <div className="flex items-center gap-2 px-4 h-full border-r text-sm min-w-max cursor-pointer" style={{ borderColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                <File size={13} style={{ color: "#93C5FD", opacity: 0.5 }} />
                <span>index.tsx</span>
              </div>
            </div>

            {/* Code */}
            <div className="flex-1 overflow-auto flex font-mono" style={{ fontSize: 13, lineHeight: "1.7" }}>
              <div className="w-10 text-right pr-3 pt-3 select-none border-r shrink-0" style={{ color: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.05)" }}>
                {Array.from({ length: 15 }, (_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <div className="flex-1 pl-4 pt-3 pb-4 whitespace-pre overflow-x-auto">
                <div><span style={{ color: "#A78BFA" }}>import</span> <span style={{ color: "white" }}>React</span> <span style={{ color: "#A78BFA" }}>from</span> <span style={{ color: "#4ADE80" }}>'react'</span>;</div>
                <div><span style={{ color: "#A78BFA" }}>import</span> {"{ "}<span style={{ color: "white" }}>useState</span>{" }"} <span style={{ color: "#A78BFA" }}>from</span> <span style={{ color: "#4ADE80" }}>'react'</span>;</div>
                <div />
                <div><span style={{ color: "#A78BFA" }}>function</span> <span style={{ color: "#FDE047" }}>App</span><span style={{ color: "rgba(255,255,255,0.7)" }}>()</span> {"{"}</div>
                <div><span style={{ color: "#A78BFA" }}>{"  const"}</span> [count, setCount] = <span style={{ color: "#FDE047" }}>useState</span>(0);</div>
                <div />
                <div>{"  "}<span style={{ color: "#A78BFA" }}>return</span> (</div>
                <div>{"    "}<span style={{ color: "rgba(255,255,255,0.45)" }}>&lt;</span><span style={{ color: "#60A5FA" }}>div</span> <span style={{ color: "#93C5FD" }}>className</span>=<span style={{ color: "#4ADE80" }}>"app"</span><span style={{ color: "rgba(255,255,255,0.45)" }}>&gt;</span></div>
                <div>{"      "}<span style={{ color: "rgba(255,255,255,0.45)" }}>&lt;</span><span style={{ color: "#60A5FA" }}>h1</span><span style={{ color: "rgba(255,255,255,0.45)" }}>&gt;</span>Hello, Apex Nexus<span style={{ color: "rgba(255,255,255,0.45)" }}>&lt;/</span><span style={{ color: "#60A5FA" }}>h1</span><span style={{ color: "rgba(255,255,255,0.45)" }}>&gt;</span></div>
                <div>{"      "}<span style={{ color: "rgba(255,255,255,0.45)" }}>&lt;</span><span style={{ color: "#60A5FA" }}>button</span> <span style={{ color: "#93C5FD" }}>onClick</span>=<span style={{ color: "#A78BFA" }}>{"{"}</span>() <span style={{ color: "#A78BFA" }}>=&gt;</span> <span style={{ color: "#FDE047" }}>setCount</span>(c <span style={{ color: "#A78BFA" }}>=&gt;</span> c + 1)<span style={{ color: "#A78BFA" }}>{"}"}</span><span style={{ color: "rgba(255,255,255,0.45)" }}>&gt;</span></div>
                <div>{"        "}Count: {"{"}<span style={{ color: "white" }}>count</span>{"}"}</div>
                <div>{"      "}<span style={{ color: "rgba(255,255,255,0.45)" }}>&lt;/</span><span style={{ color: "#60A5FA" }}>button</span><span style={{ color: "rgba(255,255,255,0.45)" }}>&gt;</span></div>
                <div>{"    "}<span style={{ color: "rgba(255,255,255,0.45)" }}>&lt;/</span><span style={{ color: "#60A5FA" }}>div</span><span style={{ color: "rgba(255,255,255,0.45)" }}>&gt;</span></div>
                <div>{"  "});</div>
                <div>{"}"}</div>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between px-4 border-t shrink-0" style={{ height: 52, background: "#07070F", borderColor: "rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ADE80" }}>
                  <Play size={14} /> Run
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)", color: "white", boxShadow: "0 0 12px rgba(124,58,237,0.3)" }}>
                  <Rocket size={14} /> Deploy
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}>
                  <Share2 size={14} /> Share
                </button>
              </div>
              <div className="flex items-center gap-4 font-mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                <span>Ln 4, Col 12</span>
                <span>UTF-8</span>
                <span style={{ color: "#93C5FD" }}>TypeScript React</span>
              </div>
            </div>
          </div>

          {/* Right: Preview + AI Chat */}
          <div className="hidden lg:flex flex-col" style={{ width: 340, background: "#07070F" }}>

            {/* Live Preview */}
            <div className="flex flex-col border-b" style={{ flex: 1, borderColor: "rgba(255,255,255,0.05)" }}>
              <div className="flex items-center justify-between px-4 border-b shrink-0" style={{ height: 40, borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                  <Globe size={13} /> LIVE PREVIEW
                </div>
                <div className="flex items-center gap-1.5">
                  <button className="rounded flex items-center justify-center" style={{ width: 20, height: 20, color: "rgba(255,255,255,0.4)" }}><RefreshCw size={13} /></button>
                  <button className="rounded flex items-center justify-center" style={{ width: 20, height: 20, color: "rgba(255,255,255,0.4)" }}><ExternalLink size={13} /></button>
                </div>
              </div>
              <div className="flex-1 p-2 flex flex-col" style={{ background: "rgba(0,0,0,0.4)" }}>
                <div className="flex items-center gap-2 px-3 rounded-t-lg border border-b-0 shrink-0" style={{ height: 32, background: "#1A1A24", borderColor: "rgba(255,255,255,0.1)" }}>
                  <div className="flex gap-1.5">
                    {["rgba(255,255,255,0.2)","rgba(255,255,255,0.2)","rgba(255,255,255,0.2)"].map((c, i) => (
                      <div key={i} className="rounded-full" style={{ width: 10, height: 10, background: c }} />
                    ))}
                  </div>
                  <div className="flex-1 mx-2 rounded text-center font-mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", background: "rgba(0,0,0,0.4)", padding: "2px 8px" }}>localhost:3000</div>
                </div>
                <div className="flex-1 rounded-b-lg flex flex-col items-center justify-center gap-4" style={{ background: "white", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <h1 className="text-2xl font-bold" style={{ color: "black" }}>Hello, Apex Nexus</h1>
                  <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ background: "#2563EB" }}>Count: 0</button>
                </div>
              </div>
            </div>

            {/* AI Build Chat */}
            <div className="flex flex-col" style={{ flex: 1, background: "#0A0A16" }}>
              <div className="flex items-center gap-2 px-4 border-b shrink-0" style={{ height: 48, background: "#07070F", borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="flex items-center justify-center rounded-md" style={{ width: 24, height: 24, background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)" }}>
                  <Bot size={13} style={{ color: "#A78BFA" }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>Apex Builder AI</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-sm">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className="flex items-center justify-center rounded-md shrink-0" style={{ width: 24, height: 24, background: msg.role === "ai" ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.1)", border: msg.role === "ai" ? "1px solid rgba(124,58,237,0.35)" : "1px solid rgba(255,255,255,0.1)" }}>
                      {msg.role === "ai" ? <Bot size={12} style={{ color: "#A78BFA" }} /> : <User size={12} style={{ color: "rgba(255,255,255,0.6)" }} />}
                    </div>
                    <div className="rounded-2xl px-3 py-2 max-w-[85%]" style={{ background: msg.role === "user" ? "rgba(255,255,255,0.07)" : "transparent", color: msg.role === "ai" ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.9)", borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px" }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t shrink-0" style={{ background: "#07070F", borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-2 rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Ask Apex to modify..."
                    className="flex-1 text-sm outline-none px-4 py-2.5"
                    style={{ background: "transparent", color: "white" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && aiInput.trim()) {
                        setChatMessages((p) => [...p, { role: "user", text: aiInput }]);
                        setAiInput("");
                        setTimeout(() => setChatMessages((p) => [...p, { role: "ai", text: "Got it! Applying your changes..." }]), 800);
                      }
                    }}
                  />
                  <button className="mr-2 flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                    <Zap size={13} style={{ color: "white" }} />
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
