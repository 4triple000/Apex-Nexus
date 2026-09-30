import { useState, useRef } from "react";
import type { DmMessage, PersonalityMode, SituationMode } from "../../hooks/useDM";
import {
  useGenerateReply, useFlirtyReplies, useScoreReply, useColdOpen,
  useCoachAnalyze, useVoiceCoach, useUpdateConversation,
} from "../../hooks/useDM";
import { getGlobalSystemPrompt } from "@/lib/personalityEngine";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── Personality profiles ─────────────────────────────────────────────────────
const PERSONALITIES: {
  mode: PersonalityMode; name: string; role: string; emoji: string;
  color: string; glow: string; energy: number;
}[] = [
  { mode: "smooth",    name: "Strategist",  role: "Smooth & calculated",  emoji: "😎", color: "#8B5CF6", glow: "rgba(139,92,246,0.35)",  energy: 80 },
  { mode: "funny",     name: "Friend",      role: "Warm & playful",       emoji: "😂", color: "#F59E0B", glow: "rgba(245,158,11,0.35)",  energy: 60 },
  { mode: "confident", name: "Debater",     role: "Bold & direct",        emoji: "💪", color: "#EF4444", glow: "rgba(239,68,68,0.35)",   energy: 95 },
  { mode: "chill",     name: "Mentor",      role: "Calm & wise",          emoji: "🤙", color: "#10B981", glow: "rgba(16,185,129,0.35)",  energy: 45 },
  { mode: "romantic",  name: "Innovator",   role: "Creative & expressive", emoji: "💕", color: "#EC4899", glow: "rgba(236,72,153,0.35)", energy: 70 },
  { mode: "custom",    name: "Custom",      role: "Your own vibe",        emoji: "✨", color: "#6366F1", glow: "rgba(99,102,241,0.35)",  energy: 65 },
];

// ── Situation cards ──────────────────────────────────────────────────────────
const SITUATIONS: {
  mode: SituationMode | null; label: string; emoji: string; desc: string; energy: number; color: string;
}[] = [
  { mode: null,             label: "Default",     emoji: "💬", desc: "Standard flow",       energy: 50, color: "#6C5CE7" },
  { mode: "first_message",  label: "First Move",  emoji: "👋", desc: "Initial contact",     energy: 75, color: "#10A37F" },
  { mode: "after_ghosted",  label: "Re-Engage",   emoji: "👻", desc: "After silence",       energy: 85, color: "#EF4444" },
  { mode: "late_night",     label: "Late Night",  emoji: "🌙", desc: "Night vibes",         energy: 90, color: "#8B5CF6" },
  { mode: "setting_up_date",label: "Plan a Date", emoji: "📅", desc: "Moving to IRL",       energy: 80, color: "#F59E0B" },
  { mode: "recovery",       label: "Recovery",    emoji: "🔄", desc: "Fix the situation",   energy: 70, color: "#EC4899" },
];

// ── Glowing toggle switch ────────────────────────────────────────────────────
function GlowToggle({
  enabled, onChange, label, icon, color = "#6C5CE7",
}: {
  enabled: boolean; onChange: (v: boolean) => void;
  label: string; icon: string; color?: string;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
        padding: "10px 8px", borderRadius: 14, cursor: "pointer",
        background: enabled ? `${color}15` : "rgba(255,255,255,0.03)",
        border: enabled ? `1px solid ${color}40` : "1px solid rgba(255,255,255,0.07)",
        flex: 1, minWidth: 70,
        boxShadow: enabled ? `0 0 16px ${color}25` : "none",
        transition: `all 0.22s ${IOS}`,
      }}
    >
      {/* Track */}
      <div style={{
        width: 36, height: 20, borderRadius: 99, position: "relative",
        background: enabled ? color : "rgba(255,255,255,0.10)",
        transition: `background 0.22s ${IOS}`,
        boxShadow: enabled ? `0 0 10px ${color}70` : "none",
      }}>
        <div style={{
          position: "absolute",
          top: 2, left: enabled ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.40)",
          transition: `left 0.22s ${SPRING}`,
        }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 600, color: enabled ? color : "rgba(255,255,255,0.30)", letterSpacing: "0.02em" }}>
        {icon} {label}
      </span>
    </button>
  );
}

// ── Energy bar ───────────────────────────────────────────────────────────────
function EnergyBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: 4 }}>
      <div style={{
        height: "100%", width: `${value}%`, borderRadius: 99,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        boxShadow: `0 0 6px ${color}55`,
        transition: `width 0.4s ${IOS}`,
      }} />
    </div>
  );
}

// ── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ value, label }: { value: number; label: string }) {
  const color = value >= 80 ? "#10B981" : value >= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.40)" }}>{label}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 99, transition: `width 0.5s ${IOS}` }} />
      </div>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
type Drawer = "personality" | "situation" | "actions" | null;

interface AIToolbarProps {
  conversationId: number;
  personalityMode: PersonalityMode;
  situationMode: string | null | undefined;
  autoReplyEnabled: boolean;
  messages: DmMessage[];
  onInsertReply: (text: string) => void;
}

export function AIToolbar({
  conversationId, personalityMode, situationMode, autoReplyEnabled, messages, onInsertReply,
}: AIToolbarProps) {
  const [drawer, setDrawer]       = useState<Drawer>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [memory, setMemory]       = useState(true);
  const [deepThink, setDeepThink] = useState(false);
  const [flirtyVariations, setFlirtyVariations] = useState<{ safe: string; bold: string; playful: string } | null>(null);
  const [scoreResult, setScoreResult] = useState<{
    score: number;
    breakdown: { engagement: number; toneMatch: number; originality: number; confidence: number };
    feedback: string; verdict: string;
  } | null>(null);
  const [coachResult, setCoachResult] = useState<{
    didWell: string[]; couldImprove: string[]; nextMove: string; overallRating: number; verdict: string;
  } | null>(null);
  const [voiceResult, setVoiceResult] = useState<{ advice: string; suggestedReply: string; vibeCheck: string } | null>(null);
  const [coldOpeners, setColdOpeners] = useState<{ text: string; style: string }[] | null>(null);
  const [coldContext, setColdContext] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [actionPanel, setActionPanel] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const generateReply  = useGenerateReply();
  const flirtyMutation = useFlirtyReplies();
  const scoreMutation  = useScoreReply();
  const coldOpenMutation = useColdOpen();
  const coachMutation  = useCoachAnalyze();
  const voiceMutation  = useVoiceCoach();
  const updateConv     = useUpdateConversation();

  const lastInbound    = [...messages].reverse().find((m) => m.direction === "inbound");
  const contextMessages = messages.slice(-12).map((m) => ({ direction: m.direction, content: m.content }));

  const currentPersonality = PERSONALITIES.find((p) => p.mode === personalityMode) ?? PERSONALITIES[0];
  const currentSituation   = SITUATIONS.find((s) => s.mode === (situationMode ?? null)) ?? SITUATIONS[0];

  function toggleDrawer(d: Drawer) { setDrawer((prev) => prev === d ? null : d); }
  function toggleAction(a: string) { setActionPanel((prev) => prev === a ? null : a); }

  async function handleGenerate() {
    if (!lastInbound) return;
    const result = await generateReply.mutateAsync({
      conversationId, lastMessage: lastInbound.content,
      personalityMode, situationMode: situationMode ?? undefined, contextMessages,
      customPrompt: getGlobalSystemPrompt(),
    });
    onInsertReply(result.reply);
    setScoreResult(null);
  }

  async function handleFlirty() {
    toggleAction("flirty");
    if (!lastInbound) return;
    const result = await flirtyMutation.mutateAsync({ lastMessage: lastInbound.content, contextMessages });
    setFlirtyVariations(result.variations);
  }

  async function handleColdOpen() {
    toggleAction("cold");
    const result = await coldOpenMutation.mutateAsync({ profileContext: coldContext, personalityMode });
    setColdOpeners(result.openers);
  }

  async function handleCoach() {
    toggleAction("coach");
    const result = await coachMutation.mutateAsync({ messages: contextMessages });
    setCoachResult(result);
  }

  function startVoice() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported in this browser"); return; }
    toggleAction("voice");
    setVoiceTranscript(""); setVoiceResult(null);
    const rec = new SR();
    rec.lang = "en-US"; rec.continuous = false; rec.interimResults = false;
    recognitionRef.current = rec;
    rec.onstart = () => setIsListening(true);
    rec.onerror = () => setIsListening(false);
    rec.onend   = () => setIsListening(false);
    rec.onresult = async (e) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      setVoiceTranscript(text);
      if (text) {
        const result = await voiceMutation.mutateAsync({ transcript: text, lastMessage: lastInbound?.content, contextMessages });
        setVoiceResult(result);
      }
    };
    rec.start();
  }

  const verdictColors: Record<string, string> = {
    excellent: "#10B981", good: "#6C5CE7", okay: "#F59E0B", risky: "#EF4444",
  };

  return (
    <div style={{
      background: "rgba(14,12,32,0.55)",
      borderTop: "1px solid rgba(255,255,255,0.07)",
    }}>
      {/* ── Header label ──────────────────────────────────── */}
      <div style={{
        padding: "8px 14px 6px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
          background: "linear-gradient(90deg, #6C5CE7, #A29BFE)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>AI Control Deck</span>
        <button
          onClick={() => updateConv.mutate({ id: conversationId, autoReplyEnabled: !autoReplyEnabled })}
          style={{
            fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 99, cursor: "pointer",
            background: autoReplyEnabled ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.05)",
            border: autoReplyEnabled ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(255,255,255,0.08)",
            color: autoReplyEnabled ? "#10B981" : "rgba(255,255,255,0.30)",
            transition: `all 0.22s ${IOS}`,
          }}
        >⚡ {autoReplyEnabled ? "Auto ON" : "Auto"}</button>
      </div>

      {/* ── Mode summary chips ─────────────────────────────── */}
      <div style={{ padding: "0 14px 8px", display: "flex", gap: 6 }}>
        {/* Personality chip */}
        <button
          onClick={() => toggleDrawer("personality")}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 6,
            padding: "7px 10px", borderRadius: 12, cursor: "pointer",
            background: drawer === "personality"
              ? `${currentPersonality.color}18`
              : "rgba(255,255,255,0.04)",
            border: drawer === "personality"
              ? `1px solid ${currentPersonality.color}40`
              : "1px solid rgba(255,255,255,0.07)",
            boxShadow: drawer === "personality" ? `0 0 14px ${currentPersonality.glow}` : "none",
            transition: `all 0.20s ${IOS}`,
          }}
        >
          <span style={{ fontSize: 14 }}>{currentPersonality.emoji}</span>
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: currentPersonality.color, lineHeight: 1 }}>
              {currentPersonality.name}
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", marginTop: 1 }}>personality</div>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 8, color: "rgba(255,255,255,0.25)" }}>
            {drawer === "personality" ? "▲" : "▼"}
          </span>
        </button>

        {/* Situation chip */}
        <button
          onClick={() => toggleDrawer("situation")}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 6,
            padding: "7px 10px", borderRadius: 12, cursor: "pointer",
            background: drawer === "situation"
              ? `${currentSituation.color}18`
              : "rgba(255,255,255,0.04)",
            border: drawer === "situation"
              ? `1px solid ${currentSituation.color}40`
              : "1px solid rgba(255,255,255,0.07)",
            boxShadow: drawer === "situation" ? `0 0 14px rgba(108,92,231,0.20)` : "none",
            transition: `all 0.20s ${IOS}`,
          }}
        >
          <span style={{ fontSize: 14 }}>{currentSituation.emoji}</span>
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: currentSituation.color, lineHeight: 1 }}>
              {currentSituation.label}
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", marginTop: 1 }}>situation</div>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 8, color: "rgba(255,255,255,0.25)" }}>
            {drawer === "situation" ? "▲" : "▼"}
          </span>
        </button>
      </div>

      {/* ── Personality drawer ─────────────────────────────── */}
      {drawer === "personality" && (
        <div style={{
          padding: "0 12px 12px",
          animation: "dm-drawer-enter 0.25s ease-out both",
        }}>
          <div style={{
            padding: 12, borderRadius: 18,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 10 }}>
              🎭 Personality System
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {PERSONALITIES.map((p) => {
                const isActive = personalityMode === p.mode;
                return (
                  <button
                    key={p.mode}
                    onClick={() => { updateConv.mutate({ id: conversationId, personalityMode: p.mode }); }}
                    style={{
                      padding: "9px 6px", borderRadius: 13, cursor: "pointer", textAlign: "center",
                      background: isActive ? `${p.color}20` : "rgba(255,255,255,0.03)",
                      border: isActive ? `1px solid ${p.color}50` : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: isActive ? `0 0 14px ${p.glow}` : "none",
                      transition: `all 0.20s ${SPRING}`,
                      transform: isActive ? "scale(1.04)" : "scale(1)",
                    }}
                  >
                    <div style={{
                      fontSize: 20, marginBottom: 4,
                      filter: isActive ? `drop-shadow(0 0 6px ${p.color})` : "none",
                      transition: "filter 0.20s ease",
                    }}>{p.emoji}</div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: isActive ? p.color : "rgba(255,255,255,0.55)", marginBottom: 2 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", lineHeight: 1.3, marginBottom: 5 }}>
                      {p.role}
                    </div>
                    <EnergyBar value={p.energy} color={isActive ? p.color : "rgba(255,255,255,0.25)"} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Situation drawer ───────────────────────────────── */}
      {drawer === "situation" && (
        <div style={{
          padding: "0 12px 12px",
          animation: "dm-drawer-enter 0.25s ease-out both",
        }}>
          <div style={{
            padding: 12, borderRadius: 18,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 10 }}>
              ⚔️ Situation Mode
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SITUATIONS.map((s) => {
                const isActive = (situationMode ?? null) === s.mode;
                return (
                  <button
                    key={String(s.mode)}
                    onClick={() => updateConv.mutate({ id: conversationId, situationMode: s.mode })}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 13, cursor: "pointer", textAlign: "left",
                      background: isActive ? `${s.color}15` : "rgba(255,255,255,0.03)",
                      border: isActive ? `1px solid ${s.color}40` : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: isActive ? `0 0 14px ${s.color}25` : "none",
                      transition: `all 0.20s ${IOS}`,
                    }}
                  >
                    <span style={{
                      fontSize: 18, width: 32, height: 32,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 10,
                      background: isActive ? `${s.color}20` : "rgba(255,255,255,0.04)",
                      filter: isActive ? `drop-shadow(0 0 8px ${s.color})` : "none",
                      transition: "filter 0.20s ease",
                      flexShrink: 0,
                    }}>{s.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? s.color : "rgba(255,255,255,0.70)", marginBottom: 1 }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)" }}>{s.desc}</div>
                      <EnergyBar value={isActive ? s.energy : s.energy * 0.3} color={s.color} />
                    </div>
                    {isActive && (
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, boxShadow: `0 0 8px ${s.color}`, flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Toggles ──────────────────────────────────── */}
      <div style={{ padding: "0 12px 10px", display: "flex", gap: 6 }}>
        <GlowToggle enabled={voiceMode}     onChange={setVoiceMode}  icon="🎤" label="Voice"  color="#EC4899" />
        <GlowToggle enabled={memory}        onChange={setMemory}     icon="🧠" label="Memory" color="#A29BFE" />
        <GlowToggle enabled={deepThink}     onChange={setDeepThink}  icon="🔬" label="Deep"   color="#F59E0B" />
        <GlowToggle enabled={autoReplyEnabled} onChange={(v) => updateConv.mutate({ id: conversationId, autoReplyEnabled: v })} icon="⚡" label="Auto"  color="#10B981" />
      </div>

      {/* ── AI Action Buttons ──────────────────────────────── */}
      <div style={{ padding: "0 12px 10px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.20)", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 7 }}>
          AI Actions
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {/* Primary: AI Reply */}
          <button
            onClick={handleGenerate}
            disabled={generateReply.isPending || !lastInbound}
            style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 14px", borderRadius: 12, cursor: generateReply.isPending || !lastInbound ? "not-allowed" : "pointer",
              background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
              border: "none",
              fontSize: 11, fontWeight: 800, color: "white",
              boxShadow: "0 4px 16px rgba(108,92,231,0.45)",
              opacity: generateReply.isPending || !lastInbound ? 0.55 : 1,
              transition: `all 0.22s ${IOS}`,
            }}
          >
            {generateReply.isPending ? "⏳" : "✨"} {generateReply.isPending ? "Thinking..." : "AI Reply"}
          </button>

          {/* Secondary actions */}
          {[
            { key: "flirty", label: "💕 Flirty",    color: "#EC4899", action: handleFlirty,    loading: flirtyMutation.isPending,   needsMsg: true  },
            { key: "score",  label: "📊 Score",     color: "#F59E0B", action: () => toggleAction("score"), loading: false,                     needsMsg: false },
            { key: "cold",   label: "❄️ Cold Open",  color: "#228BE6", action: handleColdOpen, loading: coldOpenMutation.isPending,  needsMsg: false },
            { key: "coach",  label: "🎯 Coach",      color: "#10B981", action: handleCoach,    loading: coachMutation.isPending,     needsMsg: false },
            { key: "voice",  label: isListening ? "🔴 Listening" : "🎙️ Voice Coach", color: "#8B5CF6", action: startVoice, loading: voiceMutation.isPending, needsMsg: false },
          ].map(({ key, label, color, action, loading, needsMsg }) => {
            const isActive = actionPanel === key;
            return (
              <button
                key={key}
                onClick={action}
                disabled={loading || (needsMsg && !lastInbound)}
                style={{
                  flexShrink: 0,
                  padding: "8px 11px", borderRadius: 12,
                  fontSize: 10, fontWeight: 700, cursor: "pointer",
                  background: isActive ? `${color}20` : "rgba(255,255,255,0.05)",
                  border: isActive ? `1px solid ${color}45` : "1px solid rgba(255,255,255,0.08)",
                  color: isActive ? color : "rgba(255,255,255,0.55)",
                  boxShadow: isActive ? `0 0 12px ${color}25` : "none",
                  opacity: (loading || (needsMsg && !lastInbound)) ? 0.45 : 1,
                  transition: `all 0.20s ${IOS}`,
                  animation: loading ? "pulse 1s ease-in-out infinite" : "none",
                }}
              >{label}</button>
            );
          })}
        </div>
      </div>

      {/* ── Action Result Panels ───────────────────────────── */}
      {actionPanel === "flirty" && (
        <div style={{ margin: "0 12px 12px", padding: 12, borderRadius: 16, background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.22)", animation: "dm-drawer-enter 0.25s ease-out both" }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: "#EC4899", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>💕 Flirty Variations</p>
          {flirtyMutation.isPending ? (
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textAlign: "center", padding: "12px 0" }}>Crafting variations…</p>
          ) : flirtyVariations ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(["safe", "bold", "playful"] as const).map((v) => {
                const meta = { safe: { label: "😊 Safe", color: "#10B981" }, bold: { label: "🔥 Bold", color: "#EF4444" }, playful: { label: "😏 Playful", color: "#F59E0B" } }[v];
                return (
                  <div key={v} style={{ padding: "9px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: meta.color }}>{meta.label}</span>
                      <button onClick={() => onInsertReply(flirtyVariations[v])} style={{ fontSize: 9, color: "rgba(255,255,255,0.40)", cursor: "pointer" }}>Use →</button>
                    </div>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.80)", margin: 0, lineHeight: 1.5 }}>{flirtyVariations[v]}</p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {actionPanel === "score" && (
        <div style={{ margin: "0 12px 12px", padding: 12, borderRadius: 16, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)", animation: "dm-drawer-enter 0.25s ease-out both" }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: "#F59E0B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>📊 Reply Scorer</p>
          {scoreResult ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: verdictColors[scoreResult.verdict] }}>{scoreResult.score}</span>
                <span style={{ fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 99, background: `${verdictColors[scoreResult.verdict]}22`, color: verdictColors[scoreResult.verdict], textTransform: "capitalize" }}>
                  {scoreResult.verdict}
                </span>
              </div>
              <ScoreBar value={scoreResult.breakdown.engagement}  label="Engagement" />
              <ScoreBar value={scoreResult.breakdown.toneMatch}   label="Tone Match" />
              <ScoreBar value={scoreResult.breakdown.originality} label="Originality" />
              <ScoreBar value={scoreResult.breakdown.confidence}  label="Confidence" />
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.50)", marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 8, lineHeight: 1.5 }}>{scoreResult.feedback}</p>
            </>
          ) : (
            <p style={{ color: "rgba(255,255,255,0.30)", fontSize: 11, textAlign: "center", padding: "8px 0" }}>Type a reply then tap Score to analyze it</p>
          )}
        </div>
      )}

      {actionPanel === "cold" && (
        <div style={{ margin: "0 12px 12px", padding: 12, borderRadius: 16, background: "rgba(34,139,230,0.08)", border: "1px solid rgba(34,139,230,0.22)", animation: "dm-drawer-enter 0.25s ease-out both" }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: "#228BE6", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>❄️ Cold Open Generator</p>
          <input
            value={coldContext}
            onChange={(e) => setColdContext(e.target.value)}
            placeholder="Their profile context (optional)…"
            style={{
              width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10, padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,0.80)",
              outline: "none", marginBottom: 8, boxSizing: "border-box",
            }}
          />
          <button onClick={handleColdOpen} disabled={coldOpenMutation.isPending}
            style={{ width: "100%", padding: "8px", borderRadius: 10, background: "#228BE6", border: "none", fontSize: 11, fontWeight: 700, color: "white", cursor: "pointer", marginBottom: 8, opacity: coldOpenMutation.isPending ? 0.6 : 1 }}>
            {coldOpenMutation.isPending ? "Generating…" : "Generate Openers"}
          </button>
          {coldOpeners?.map((o, i) => (
            <div key={i} style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "capitalize" }}>{o.style}</span>
                <button onClick={() => onInsertReply(o.text)} style={{ fontSize: 9, color: "rgba(255,255,255,0.40)", cursor: "pointer" }}>Use →</button>
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.80)", margin: 0, lineHeight: 1.5 }}>{o.text}</p>
            </div>
          ))}
        </div>
      )}

      {actionPanel === "coach" && (
        <div style={{ margin: "0 12px 12px", padding: 12, borderRadius: 16, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", animation: "dm-drawer-enter 0.25s ease-out both" }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: "#10B981", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>🎯 Conversation Coach</p>
          {coachMutation.isPending ? (
            <p style={{ color: "rgba(255,255,255,0.30)", fontSize: 11, textAlign: "center", padding: "12px 0" }}>Analyzing your conversation…</p>
          ) : coachResult ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: coachResult.overallRating >= 8 ? "#10B981" : coachResult.overallRating >= 6 ? "#F59E0B" : "#EF4444" }}>{coachResult.overallRating}/10</span>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.5 }}>{coachResult.verdict}</p>
              </div>
              <p style={{ fontSize: 8, fontWeight: 800, color: "#10B981", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>✅ Did Well</p>
              {coachResult.didWell.map((item, i) => <p key={i} style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", margin: "0 0 3px", lineHeight: 1.4 }}>• {item}</p>)}
              <p style={{ fontSize: 8, fontWeight: 800, color: "#EF4444", letterSpacing: "0.08em", textTransform: "uppercase", margin: "10px 0 4px" }}>⚠️ Improve</p>
              {coachResult.couldImprove.map((item, i) => <p key={i} style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", margin: "0 0 3px", lineHeight: 1.4 }}>• {item}</p>)}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 8, marginTop: 8 }}>
                <p style={{ fontSize: 8, fontWeight: 800, color: "#F59E0B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>👉 Next Move</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.80)", margin: 0, lineHeight: 1.5 }}>{coachResult.nextMove}</p>
              </div>
            </>
          ) : null}
        </div>
      )}

      {actionPanel === "voice" && (
        <div style={{ margin: "0 12px 12px", padding: 12, borderRadius: 16, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.22)", animation: "dm-drawer-enter 0.25s ease-out both" }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: "#8B5CF6", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>🎙️ Voice Coach</p>
          {isListening ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 36, animation: "pulse 1s ease-in-out infinite", marginBottom: 8 }}>🎙️</div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.50)" }}>Listening… ask me anything</p>
            </div>
          ) : voiceTranscript ? (
            <>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", marginBottom: 8, fontStyle: "italic" }}>"{voiceTranscript}"</p>
              {voiceMutation.isPending ? (
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", textAlign: "center", padding: "8px 0" }}>Thinking…</p>
              ) : voiceResult ? (
                <>
                  <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.22)", marginBottom: 8 }}>
                    <p style={{ fontSize: 8, fontWeight: 800, color: "#8B5CF6", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>💡 Advice</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.80)", margin: 0, lineHeight: 1.5 }}>{voiceResult.advice}</p>
                  </div>
                  <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontSize: 8, fontWeight: 800, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.06em" }}>📤 Suggested Reply</p>
                      <button onClick={() => onInsertReply(voiceResult.suggestedReply)} style={{ fontSize: 9, color: "rgba(255,255,255,0.40)", cursor: "pointer" }}>Use →</button>
                    </div>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.80)", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>"{voiceResult.suggestedReply}"</p>
                  </div>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 8 }}>Vibe: {voiceResult.vibeCheck}</p>
                </>
              ) : null}
            </>
          ) : (
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "center", padding: "8px 0" }}>Tap "🎙️ Voice Coach" then speak your question</p>
          )}
        </div>
      )}
    </div>
  );
}
