/**
 * APEX OS DASHBOARD — /apex-os
 * A completely new parallel route. Does NOT modify any existing component.
 * User can compare this to the original Home tab and pick their preference.
 */
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  MessageSquare, Swords, Mail, GitBranch, User, Wrench,
  Mic, MicOff, Brain, Zap, ArrowLeft, ChevronRight,
  Activity, Clock, Sparkles, X, Send, Volume2, VolumeX,
} from "lucide-react";
import { useSendChat } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { useMyProfile } from "@/hooks/useSocial";
import { usePersonality } from "@/contexts/PersonalityContext";
import { PersonalityBlender } from "@/components/personality/PersonalityBlender";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── Design tokens ────────────────────────────────────────────────────────────
const BG = "transparent";
const CARD   = "rgba(18,20,30,0.90)";
const BORDER = "rgba(255,255,255,0.07)";
const PURPLE = "#6C5CE7";
const TEAL   = "#00CEC9";
const PINK   = "#FD79A8";

// ── Dock config ──────────────────────────────────────────────────────────────
const DOCK_ITEMS = [
  { id: "chat",     icon: <MessageSquare size={18} />, label: "Chat",     color: PURPLE,  route: "/" },
  { id: "arena",    icon: <Swords        size={18} />, label: "Arena",    color: "#EF4444", route: "/arena" },
  { id: "dm",       icon: <Mail          size={18} />, label: "DMs",      color: "#10B981", route: "/dm" },
  { id: "workflow", icon: <GitBranch     size={18} />, label: "Flows",    color: "#F59E0B", route: "/workflows" },
  { id: "me",       icon: <User          size={18} />, label: "Me",       color: TEAL,     route: "/profile" },
  { id: "tools",    icon: <Wrench        size={18} />, label: "Studio",   color: PINK,     route: "/ai-studio" },
];

const PERSONALITIES = [
  { id: "strategist", emoji: "🎯", label: "Strategist", color: "#A29BFE" },
  { id: "friend",     emoji: "😊", label: "Friend",     color: "#10B981" },
  { id: "mentor",     emoji: "🧠", label: "Mentor",     color: "#F59E0B" },
  { id: "debater",    emoji: "⚖️", label: "Debater",    color: "#EF4444" },
  { id: "innovator",  emoji: "✨", label: "Innovator",  color: "#EC4899" },
];

const BATTLE_MODES = [
  { id: "logic",    label: "Logic",    emoji: "🧩" },
  { id: "debate",   label: "Debate",   emoji: "⚖️" },
  { id: "creative", label: "Creative", emoji: "🎨" },
];

const MEMORY_ITEMS = [
  { icon: "💬", text: "Prefers concise, direct responses",      tag: "Style"    },
  { icon: "🤖", text: "Interested in AI, tech & future",        tag: "Topics"   },
  { icon: "🌙", text: "Most active late night (10PM–2AM)",      tag: "Behavior" },
  { icon: "⚡", text: "Enjoys Battle Mode & competitive mode",  tag: "Features" },
];

const RECENT_DMS = [
  { name: "Ashley K.", emoji: "🌸", mood: "Relaxed", snippet: "Tell me something new…", unread: 2, time: "1h" },
  { name: "Jordan M.", emoji: "🎯", mood: "Calm",    snippet: "What do you think about…", unread: 0, time: "2h" },
  { name: "Maya R.",   emoji: "🌙", mood: "Calm",    snippet: "Can you help me draft…",   unread: 1, time: "3h" },
];

const RECENT_WORKFLOWS = [
  { name: "Lead Qualifier",  icon: "🎯", status: "active",   runs: 142 },
  { name: "Email Automator", icon: "📧", status: "paused",   runs: 89  },
  { name: "Research Bot",    icon: "🔬", status: "building", runs: 0   },
];

const AI_SUGGESTIONS = [
  { icon: "⚔️", text: "Start an AI battle?",    action: "/arena"       },
  { icon: "🔄", text: "Build a workflow?",       action: "/workflows"   },
  { icon: "💬", text: "Continue last chat?",     action: "/"            },
  { icon: "🧠", text: "Update your memory?",     action: "/profile"     },
];

// ── GlowDot ──────────────────────────────────────────────────────────────────
function GlowDot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <div style={{ position: "relative", width: 8, height: 8 }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%", background: color,
        boxShadow: `0 0 8px ${color}`,
        animation: pulse ? "status-pulse 2s ease-in-out infinite" : "none",
      }} />
    </div>
  );
}

// ── StatusBar ────────────────────────────────────────────────────────────────
function StatusBar({ aiThinking, voiceOn, onVoiceToggle }: {
  aiThinking: boolean; voiceOn: boolean; onVoiceToggle: () => void;
}) {
  const [, nav] = useLocation();
  const [usagePercent] = useState(23);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px",
      background: "rgba(14,12,32,0.55)", backdropFilter: "blur(24px)",
      borderBottom: "1px solid rgba(108,92,231,0.18)",
      position: "sticky", top: 0, zIndex: 50,
    }}>
      {/* Left: back + logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => nav("/")}
          style={{
            width: 30, height: 30, borderRadius: 9, cursor: "pointer",
            background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.50)", transition: `all 0.18s ${IOS}`,
          }}
        ><ArrowLeft size={13} /></button>

        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: `linear-gradient(135deg, ${PURPLE}, #A29BFE)`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: `0 0 14px rgba(108,92,231,0.55)`,
            animation: "logo-pulse 3s ease-in-out infinite",
            fontSize: 12, fontWeight: 900, color: "white",
          }}>A</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: "white", letterSpacing: "0.04em" }}>
              APEX<span style={{ color: PURPLE, marginLeft: 2 }}>OS</span>
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Command Center
            </div>
          </div>
        </div>
      </div>

      {/* Center: AI status */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 99,
        background: aiThinking ? "rgba(108,92,231,0.15)" : "rgba(16,185,129,0.10)",
        border: `1px solid ${aiThinking ? "rgba(108,92,231,0.30)" : "rgba(16,185,129,0.22)"}`,
        transition: `all 0.3s ${IOS}`,
      }}>
        <GlowDot color={aiThinking ? PURPLE : "#10B981"} pulse={aiThinking} />
        <span style={{ fontSize: 9, fontWeight: 700, color: aiThinking ? "#A29BFE" : "#10B981", letterSpacing: "0.06em" }}>
          {aiThinking ? "THINKING" : "ONLINE"}
        </span>
      </div>

      {/* Right: indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Memory sync */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Brain size={11} style={{ color: TEAL }} />
          <GlowDot color={TEAL} />
        </div>

        {/* Voice toggle */}
        <button
          onClick={onVoiceToggle}
          style={{
            width: 28, height: 28, borderRadius: 9, cursor: "pointer",
            background: voiceOn ? "rgba(108,92,231,0.18)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${voiceOn ? "rgba(108,92,231,0.35)" : BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: voiceOn ? "#A29BFE" : "rgba(255,255,255,0.35)",
            transition: `all 0.18s ${IOS}`,
          }}
        >{voiceOn ? <Volume2 size={12} /> : <VolumeX size={12} />}</button>

        {/* Usage bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 28, height: 6, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{
              width: `${usagePercent}%`, height: "100%", borderRadius: 99,
              background: `linear-gradient(90deg, #10B981, ${TEAL})`,
              boxShadow: `0 0 6px ${TEAL}70`,
              transition: `width 0.5s ${IOS}`,
            }} />
          </div>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", fontWeight: 600 }}>{usagePercent}%</span>
        </div>
      </div>
    </div>
  );
}

// ── Horizontal Dock ───────────────────────────────────────────────────────────
function HorizontalDock({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  const [, nav] = useLocation();
  return (
    <div style={{
      display: "flex", gap: 8, padding: "12px 16px",
      overflowX: "auto", scrollbarWidth: "none",
      borderBottom: `1px solid ${BORDER}`,
      background: "rgba(14,12,32,0.55)", backdropFilter: "blur(16px)",
    }}>
      {DOCK_ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              onChange(item.id);
              if (item.id !== "chat") nav(item.route);
            }}
            style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px", borderRadius: 99, cursor: "pointer",
              background: isActive ? `${item.color}20` : "rgba(255,255,255,0.04)",
              border: `1px solid ${isActive ? item.color + "45" : BORDER}`,
              color: isActive ? item.color : "rgba(255,255,255,0.40)",
              fontSize: 10, fontWeight: 700,
              boxShadow: isActive ? `0 0 12px ${item.color}30` : "none",
              transition: `all 0.22s ${IOS}`,
            }}
          >
            <span style={{ color: "inherit" }}>{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Module card wrapper ───────────────────────────────────────────────────────
function ModuleCard({
  children, glow = PURPLE, delay = 0, fullWidth = false, style = {},
}: {
  children: React.ReactNode; glow?: string; delay?: number; fullWidth?: boolean; style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        gridColumn: fullWidth ? "1 / -1" : undefined,
        borderRadius: 22, padding: "16px",
        background: CARD,
        border: `1px solid ${hovered ? glow + "40" : BORDER}`,
        boxShadow: hovered ? `0 0 24px ${glow}20, 0 8px 32px rgba(0,0,0,0.40)` : "0 4px 16px rgba(0,0,0,0.30)",
        transition: `all 0.25s ${IOS}`,
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        animation: `os-card-in 0.35s ${delay}s ease-out both`,
        ...style,
      }}
    >{children}</div>
  );
}

// ── Module label ──────────────────────────────────────────────────────────────
function ModuleLabel({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}18`, border: `1px solid ${color}30`, color,
      }}>{icon}</div>
      <span style={{ fontSize: 11, fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── APEX OS MAIN ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
export default function ApexOSPage() {
  const [, nav]       = useLocation();
  const sessionId     = useSession();
  const { data: meData } = useMyProfile();
  const sendChat      = useSendChat();

  const { systemPrompt: globalSystemPrompt } = usePersonality();
  const [dockActive, setDockActive]       = useState("chat");
  const [battleMode, setBattleMode]       = useState("logic");
  const [voiceOn, setVoiceOn]             = useState(false);
  const [askText, setAskText]             = useState("");
  const [lastResponse, setLastResponse]   = useState<string | null>(null);
  const [memory, setMemory]               = useState(MEMORY_ITEMS);
  const [aiThinking, setAiThinking]       = useState(false);
  const [insight, setInsight]             = useState<string | null>(null);
  const [insightDismissed, setInsightDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // random rotating insight
  useEffect(() => {
    const idx = Math.floor(Math.random() * AI_SUGGESTIONS.length);
    setInsight(AI_SUGGESTIONS[idx].text);
  }, []);

  async function handleQuickAsk() {
    if (!askText.trim() || sendChat.isPending) return;
    const q = askText.trim();
    setAskText("");
    setAiThinking(true);
    setLastResponse(null);
    try {
      const result = await sendChat.mutateAsync({
        data: { sessionId, message: `${globalSystemPrompt}\n\nUser message: ${q}`, mode: "chat" },
      });
      setLastResponse(result.messages[0]?.content || "Done.");
    } catch {
      setLastResponse("Something went wrong. Try again.");
    } finally {
      setAiThinking(false);
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100svh", background: BG,
      overflowY: "auto", overflowX: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
    }}>
      {/* ── Animated BG grid ─────────────────────────── */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(108,92,231,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(108,92,231,0.04) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)",
      }} />

      {/* ── Corner glow orbs ─────────────────────────── */}
      <div style={{ position: "fixed", top: 0, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(108,92,231,0.12), transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", top: 100, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,206,201,0.08), transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* ── Status Bar ───────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 10 }}>
        <StatusBar aiThinking={aiThinking} voiceOn={voiceOn} onVoiceToggle={() => setVoiceOn((v) => !v)} />
        <HorizontalDock active={dockActive} onChange={setDockActive} />
      </div>

      {/* ── AI Insight banner ────────────────────────── */}
      {insight && !insightDismissed && (
        <div style={{
          margin: "12px 14px 0",
          padding: "10px 14px", borderRadius: 14,
          background: "rgba(108,92,231,0.10)", border: "1px solid rgba(108,92,231,0.22)",
          display: "flex", alignItems: "center", gap: 10,
          animation: "os-card-in 0.35s ease-out both",
          position: "relative", zIndex: 5,
        }}>
          <Activity size={13} style={{ color: PURPLE, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
            <span style={{ color: "#A29BFE", fontWeight: 700 }}>Apex suggests: </span>{insight}
          </span>
          <button onClick={() => setInsightDismissed(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", padding: 2 }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Module grid ─────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10, padding: "12px 14px 100px",
        position: "relative", zIndex: 5,
      }}>

        {/* ══ MODULE 1: AI CHAT CORE (full width) ══════ */}
        <ModuleCard glow={PURPLE} delay={0} fullWidth style={{ gridColumn: "1 / -1" }}>
          <ModuleLabel icon={<MessageSquare size={13} />} label="AI Chat Core" color={PURPLE} />

          {/* Quick ask input */}
          <div style={{
            display: "flex", gap: 8, marginBottom: lastResponse ? 12 : 0,
            padding: "10px 12px", borderRadius: 14,
            background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
          }}>
            <input
              ref={inputRef}
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuickAsk()}
              placeholder="Ask Apex anything…"
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontSize: 12, color: "white", caretColor: "#A29BFE",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={handleQuickAsk}
              disabled={aiThinking || !askText.trim()}
              style={{
                width: 30, height: 30, borderRadius: 10, cursor: "pointer", flexShrink: 0,
                background: aiThinking ? "rgba(108,92,231,0.30)" : `linear-gradient(135deg, ${PURPLE}, #A29BFE)`,
                border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: aiThinking ? "none" : "0 4px 12px rgba(108,92,231,0.45)",
                transition: `all 0.22s ${IOS}`,
                opacity: (!askText.trim() && !aiThinking) ? 0.40 : 1,
              }}
            >
              {aiThinking
                ? <div style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.40)", borderTopColor: "white", animation: "spin 0.8s linear infinite" }} />
                : <Send size={13} style={{ color: "white" }} />}
            </button>
            <button
              style={{
                width: 30, height: 30, borderRadius: 10, cursor: "pointer", flexShrink: 0,
                background: voiceOn ? "rgba(108,92,231,0.20)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${voiceOn ? "rgba(108,92,231,0.35)" : BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: voiceOn ? "#A29BFE" : "rgba(255,255,255,0.35)",
                transition: `all 0.18s ${IOS}`,
              }}
              onClick={() => setVoiceOn((v) => !v)}
            >{voiceOn ? <Mic size={13} /> : <MicOff size={13} />}</button>
          </div>

          {/* AI Response */}
          {aiThinking && (
            <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "8px 4px" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: "50%", background: PURPLE,
                  animation: `apex-thinking-dot 1.2s ${i * 0.2}s ease-in-out infinite`,
                  boxShadow: `0 0 6px ${PURPLE}`,
                }} />
              ))}
            </div>
          )}
          {lastResponse && !aiThinking && (
            <div style={{
              marginTop: 4, padding: "10px 12px", borderRadius: 12,
              background: "rgba(108,92,231,0.08)", border: "1px solid rgba(108,92,231,0.18)",
              fontSize: 11, color: "rgba(255,255,255,0.80)", lineHeight: 1.55,
              animation: "os-card-in 0.25s ease-out both",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                <div style={{ width: 14, height: 14, borderRadius: 5, background: `linear-gradient(135deg, ${PURPLE}, #A29BFE)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 900, color: "white" }}>A</div>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#A29BFE" }}>Apex</span>
              </div>
              <p style={{ margin: 0 }}>
                {lastResponse.length > 200 ? lastResponse.slice(0, 200) + "…" : lastResponse}
              </p>
              <button onClick={() => nav("/")} style={{
                marginTop: 8, fontSize: 9, color: PURPLE, background: "none", border: "none", cursor: "pointer",
                padding: 0, fontWeight: 700, display: "flex", alignItems: "center", gap: 3,
              }}>
                Open full chat <ChevronRight size={10} />
              </button>
            </div>
          )}

          {!lastResponse && !aiThinking && (
            <button onClick={() => nav("/")} style={{
              marginTop: 8, display: "flex", alignItems: "center", gap: 5,
              fontSize: 10, color: "rgba(255,255,255,0.30)", background: "none", border: "none",
              cursor: "pointer", padding: 0, fontWeight: 600,
            }}>
              <Clock size={11} /> Continue last chat <ChevronRight size={10} />
            </button>
          )}
        </ModuleCard>

        {/* ══ MODULE 2: BATTLE ARENA ════════════════════ */}
        <ModuleCard glow="#EF4444" delay={0.06} fullWidth>
          <ModuleLabel icon={<Swords size={13} />} label="Battle Arena" color="#EF4444" />
          <div style={{
            padding: "12px", borderRadius: 14, marginBottom: 10,
            background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(253,121,168,0.06))",
            border: "1px solid rgba(239,68,68,0.20)",
            position: "relative", overflow: "hidden",
          }}>
            {/* Energy particles */}
            {["10%", "60%", "85%"].map((left, i) => (
              <div key={i} style={{
                position: "absolute", top: `${15 + i * 25}%`, left,
                width: 4, height: 4, borderRadius: "50%",
                background: "#EF4444", boxShadow: "0 0 8px #EF4444",
                animation: `status-pulse ${1.5 + i * 0.4}s ease-in-out infinite`,
              }} />
            ))}
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.60)", margin: "0 0 8px", position: "relative" }}>
              Challenge 3 AIs simultaneously. See who answers best.
            </p>
            {/* Mode chips */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {BATTLE_MODES.map((m) => (
                <button key={m.id} onClick={() => setBattleMode(m.id)} style={{
                  padding: "4px 10px", borderRadius: 99, cursor: "pointer", fontSize: 9,
                  fontWeight: 700, transition: `all 0.18s ${IOS}`,
                  background: battleMode === m.id ? "rgba(239,68,68,0.22)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${battleMode === m.id ? "rgba(239,68,68,0.45)" : BORDER}`,
                  color: battleMode === m.id ? "#FCA5A5" : "rgba(255,255,255,0.45)",
                }}>
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => nav("/arena")}
            style={{
              width: "100%", padding: "10px", borderRadius: 12, cursor: "pointer",
              background: "linear-gradient(135deg, #EF4444, #EC4899)",
              border: "none", fontSize: 11, fontWeight: 800, color: "white",
              boxShadow: "0 4px 16px rgba(239,68,68,0.40)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: `all 0.22s ${SPRING}`,
            }}
          >
            <Swords size={13} /> Start Battle · {BATTLE_MODES.find((m) => m.id === battleMode)?.emoji} {BATTLE_MODES.find((m) => m.id === battleMode)?.label}
          </button>
        </ModuleCard>

        {/* ══ MODULE 3: DM HUB ═════════════════════════ */}
        <ModuleCard glow="#10B981" delay={0.12}>
          <ModuleLabel icon={<Mail size={13} />} label="DM Hub" color="#10B981" />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {RECENT_DMS.map((dm, i) => (
              <button key={i} onClick={() => nav("/dm")} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 12, cursor: "pointer",
                background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
                transition: `all 0.18s ${IOS}`, textAlign: "left",
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 10, flexShrink: 0,
                  background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                }}>{dm.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>{dm.name}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dm.snippet}</div>
                </div>
                {dm.unread > 0 && (
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                    background: PURPLE, fontSize: 8, fontWeight: 900, color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 8px ${PURPLE}70`,
                  }}>{dm.unread}</div>
                )}
              </button>
            ))}
          </div>
          <button onClick={() => nav("/dm")} style={{
            marginTop: 8, width: "100%", padding: "7px", borderRadius: 10, cursor: "pointer",
            background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)",
            fontSize: 9, fontWeight: 700, color: "#10B981",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            Open DM Hub <ChevronRight size={10} />
          </button>
        </ModuleCard>

        {/* ══ MODULE 4: WORKFLOW ENGINE ═════════════════ */}
        <ModuleCard glow="#F59E0B" delay={0.15}>
          <ModuleLabel icon={<GitBranch size={13} />} label="Workflows" color="#F59E0B" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            {RECENT_WORKFLOWS.map((wf, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px", borderRadius: 10,
                background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: 14 }}>{wf.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.75)", marginBottom: 1 }}>{wf.name}</div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.30)" }}>{wf.runs > 0 ? `${wf.runs} runs` : "Not started"}</div>
                </div>
                <div style={{
                  fontSize: 7, padding: "2px 6px", borderRadius: 99, fontWeight: 700,
                  background: wf.status === "active" ? "rgba(16,185,129,0.15)" : wf.status === "paused" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)",
                  color: wf.status === "active" ? "#10B981" : wf.status === "paused" ? "#F59E0B" : "rgba(255,255,255,0.35)",
                  border: `1px solid ${wf.status === "active" ? "rgba(16,185,129,0.25)" : wf.status === "paused" ? "rgba(245,158,11,0.25)" : BORDER}`,
                  letterSpacing: "0.04em", textTransform: "uppercase",
                }}>{wf.status}</div>
              </div>
            ))}
          </div>
          <button onClick={() => nav("/workflows")} style={{
            width: "100%", padding: "7px", borderRadius: 10, cursor: "pointer",
            background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.22)",
            fontSize: 9, fontWeight: 700, color: "#F59E0B",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            Build Workflow <ChevronRight size={10} />
          </button>
        </ModuleCard>

        {/* ══ MODULE 5: AI MEMORY ══════════════════════ */}
        <ModuleCard glow={TEAL} delay={0.18}>
          <ModuleLabel icon={<Brain size={13} />} label="AI Memory" color={TEAL} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {memory.slice(0, 3).map((m, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px", borderRadius: 10,
                background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: 14 }}>{m.icon}</span>
                <span style={{ flex: 1, fontSize: 9, color: "rgba(255,255,255,0.65)", lineHeight: 1.4, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.text}</span>
                <button onClick={() => setMemory((prev) => prev.filter((_, idx) => idx !== i))} style={{
                  width: 20, height: 20, borderRadius: 6, cursor: "pointer", flexShrink: 0,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.25)", transition: `all 0.15s ${IOS}`,
                }}>
                  <X size={9} />
                </button>
              </div>
            ))}
            {memory.length === 0 && (
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", margin: 0, textAlign: "center", padding: "8px 0" }}>Memory cleared</p>
            )}
          </div>
          <button onClick={() => nav("/profile")} style={{
            marginTop: 8, width: "100%", padding: "7px", borderRadius: 10, cursor: "pointer",
            background: `rgba(0,206,201,0.08)`, border: `1px solid rgba(0,206,201,0.20)`,
            fontSize: 9, fontWeight: 700, color: TEAL,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            View all memory <ChevronRight size={10} />
          </button>
        </ModuleCard>

        {/* ══ MODULE 6: PERSONALITY CONTROL ════════════ */}
        <ModuleCard glow={PINK} delay={0.21}>
          <ModuleLabel icon={<Sparkles size={13} />} label="Personality" color={PINK} />
          <PersonalityBlender compact />
        </ModuleCard>

        {/* ══ AI INSIGHTS PANEL (full width) ════════════ */}
        <ModuleCard glow={PURPLE} delay={0.24} fullWidth>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <ModuleLabel icon={<Activity size={13} />} label="Live AI Insights" color={PURPLE} />
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981", animation: "status-pulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 8, color: "#10B981", fontWeight: 700 }}>LIVE</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {AI_SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => nav(s.action)} style={{
                padding: "10px 10px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
                transition: `all 0.18s ${IOS}`,
                display: "flex", alignItems: "center", gap: 7,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(108,92,231,0.10)"; e.currentTarget.style.borderColor = "rgba(108,92,231,0.30)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = BORDER; }}
              >
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.60)", fontWeight: 600, lineHeight: 1.3 }}>{s.text}</span>
              </button>
            ))}
          </div>
          <div style={{
            marginTop: 10, padding: "8px 12px", borderRadius: 10,
            background: "rgba(108,92,231,0.06)", border: "1px solid rgba(108,92,231,0.14)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {[0.5, 1, 0.7, 0.9, 0.6, 0.8, 0.4].map((h, i) => (
                <div key={i} style={{
                  width: 3, borderRadius: 99, background: PURPLE,
                  height: `${h * 20}px`, opacity: 0.60 + h * 0.40,
                  animation: `status-pulse ${1.5 + i * 0.2}s ease-in-out infinite`,
                }} />
              ))}
            </div>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.40)" }}>
              Apex thinking mode: <span style={{ color: "#A29BFE", fontWeight: 700 }}>Standard</span> · Active for {meData ? "your session" : "this session"}
            </span>
          </div>
        </ModuleCard>
      </div>

      {/* ── Floating "Back to Classic" tab ────────────── */}
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        zIndex: 100, display: "flex", alignItems: "center", gap: 8,
      }}>
        <button
          onClick={() => nav("/")}
          style={{
            padding: "10px 20px", borderRadius: 99, cursor: "pointer",
            background: "rgba(14,12,32,0.55)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)",
            fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)",
            display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 4px 20px rgba(0,0,0,0.60)",
            transition: `all 0.22s ${IOS}`,
          }}
        >
          <ArrowLeft size={12} /> Classic Home
        </button>
        <div style={{
          padding: "10px 16px", borderRadius: 99,
          background: "rgba(108,92,231,0.18)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(108,92,231,0.30)",
          fontSize: 11, fontWeight: 700, color: "#A29BFE",
          boxShadow: "0 4px 20px rgba(108,92,231,0.30)",
        }}>OS Mode Preview</div>
      </div>
    </div>
  );
}
