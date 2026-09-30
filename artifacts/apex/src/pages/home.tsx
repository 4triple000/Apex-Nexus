import { useState, useEffect, useRef } from "react";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble, MessageSkeleton, HiveBubble, PROVIDER_CONFIG } from "@/components/chat/message-bubble";
import { ApexLogo, ApexLogoToggle } from "@/components/ui/ApexLogo";
import { useSendChat, useCastVote } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { useAvatar } from "@/contexts/AvatarContext";
import { buildPersonalityPrompt } from "@/lib/personalityEngine";
import { usePersonality } from "@/contexts/PersonalityContext";
import { GlobalPersonalityBadge } from "@/components/personality/GlobalPersonalityBadge";
import { detectEmotion, detectContextPersonality, getEmotionGesture, type Emotion, type Gesture } from "@/lib/emotionController";
import { SmartRecommendations } from "@/components/ai/SmartRecommendations";
import { PersonalizationBadge } from "@/components/ai/PersonalizationBadge";
import { useCharacter } from "@/hooks/useCharacter";
import { ProactiveSuggestions } from "@/components/character/ProactiveSuggestions";
import { useVoiceToneAnalysis, VOICE_EMOTION_LABELS, VOICE_EMOTION_EMOJI, VOICE_EMOTION_COLOR, type VoiceEmotion } from "@/hooks/useVoiceToneAnalysis";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { useCharacterSwitch } from "@/contexts/CharacterContext";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { HubHeader, ModelSearch, ModeChips, ModelCarousel, ModeCard, ModelLogo, modelById, useProviderStatus } from "@/components/home/HomeHub";
import { Volume2, VolumeX, ShieldOff } from "lucide-react";
import { ApexAvatar3D } from "@/components/avatar/ApexAvatar3D";
import { useSpeechOutput } from "@/hooks/useSpeechOutput";
import { AvatarGreetingGate } from "@/components/avatar/AvatarGreeting";
import { ReturnBanner } from "@/components/memory/ReturnBanner";

import { StreakMilestone } from "@/components/streak/StreakMilestone";
import { useStreak } from "@/hooks/useStreak";
import { AvatarReengagement } from "@/components/avatar/AvatarReengagement";
import { useReengagement } from "@/hooks/useReengagement";

// ── Types ───────────────────────────────────────────────────────────────────────
type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
  provider?: "openai" | "claude" | "perplexity" | "hive" | "auto";
  timestamp: number;
  responseTime?: number;
  error?: string;
  isBattleContainer?: boolean;
  battleResponses?: {
    provider: "openai" | "claude" | "perplexity";
    content: string;
    responseTime: number;
    error?: string;
  }[];
  prompt?: string;
};

type ChatMode     = "chat" | "battle" | "hive";
type AiPreference = "auto" | "openai" | "claude" | "perplexity";

// ── Provider config ─────────────────────────────────────────────────────────────
const PROVIDERS: { id: AiPreference; label: string; emoji: string; color: string; glow: string }[] = [
  { id: "auto",       label: "Auto-Route", emoji: "⚡", color: "#A29BFE", glow: "rgba(162,155,254,0.35)" },
  { id: "openai",     label: "GPT-4",      emoji: "✦",  color: "#10A37F", glow: "rgba(16,163,127,0.35)"  },
  { id: "claude",     label: "Claude 3",   emoji: "◆",  color: "#D97757", glow: "rgba(217,119,87,0.35)"  },
  { id: "perplexity", label: "Perplexity", emoji: "◎",  color: "#228BE6", glow: "rgba(34,139,230,0.35)"  },
];

// ── Mode config ─────────────────────────────────────────────────────────────────
const MODES: { id: ChatMode; label: string; desc: string }[] = [
  { id: "chat",   label: "Chat",   desc: "Single AI response" },
  { id: "battle", label: "Battle", desc: "All AIs compete"    },
  { id: "hive",   label: "Hive",   desc: "AI collaboration"   },
];

const EASE_IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const EASE_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export default function Home() {
  const sessionId    = useSession();
  const avatar       = useAvatar();
  const [, nav]      = useLocation();
  const [messages, setMessages]         = useState<Message[]>([]);
  const [mode, setMode]                 = useState<ChatMode>("chat");
  const [aiPreference, setAiPreference] = useState<AiPreference>("auto");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendChat  = useSendChat();
  const { user }  = useAuth();
  const providerStatus = useProviderStatus();
  const castVote  = useCastVote();
  const tts       = useSpeechOutput();
  const { privacyMode, togglePrivacyMode } = usePrivacy();
  const { activeCharacter } = useCharacterSwitch();
  const character = useCharacter();
  const voiceTone = useVoiceToneAnalysis();
  const { systemPrompt: globalSystemPrompt, avatarBehavior, voiceStyle } = usePersonality();
  const { streak, glowIntensity, milestone, isMilestoneNew, dismissMilestone } = useStreak();
  const { message: reengagementMsg, dismiss: dismissReengagement } = useReengagement();

  // ── Map voice emotion → Apex avatar emotion ──────────────────────────────────
  function voiceToApexEmotion(ve: VoiceEmotion): Emotion {
    switch (ve) {
      case 'excited':    return 'excited';
      case 'confident':  return 'happy';
      case 'frustrated': return 'serious';
      case 'stressed':   return 'concerned';
      case 'calm':       return 'neutral';
      case 'tired':      return 'thinking';
      default:           return 'neutral';
    }
  }
  const [avatar3DEnabled, setAvatar3DEnabled] = useState(true);
  const [gesture, setGesture] = useState<Gesture>("none");
  const lastSpokenIdRef = useRef<string | null>(null);
  const lastEmotionRef  = useRef<Emotion>("neutral");
  const gestureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerGesture = (emotion: Emotion) => {
    const g = getEmotionGesture(emotion);
    if (g === "none") return;
    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    setGesture(g);
    gestureTimerRef.current = setTimeout(() => setGesture("none"), 2000);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, sendChat.isPending]);

  // Sync idle avatar emotion with personality blend
  useEffect(() => {
    if (!avatar.isThinking) {
      avatar.setEmotion(avatarBehavior.emotion);
    }
  }, [avatarBehavior.emotion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time avatar reaction to voice tone ───────────────────────────────────
  useEffect(() => {
    if (!voiceTone.isActive || voiceTone.voiceEmotion === 'neutral') return;
    const apexEmotion = voiceToApexEmotion(voiceTone.voiceEmotion);
    if (!avatar.isThinking) {
      avatar.setEmotion(apexEmotion);
      triggerGesture(apexEmotion);
    }
    // Store emotional pattern in character memory when privacy allows
    if (voiceTone.storeHistory && !privacyMode) {
      const pattern = `Voice: ${voiceTone.voiceEmotion} (${new Date().toLocaleDateString()})`;
      // We add it to the character memory via a lightweight call — character.onInteraction
      // is only called on message send, so we store it in localStorage directly
      try {
        const key = 'apex_memory_store';
        const stored = JSON.parse(localStorage.getItem(key) || '{}');
        const prev = stored.emotionalPatterns ?? [];
        if (!prev.includes(pattern)) {
          const updated = [pattern, ...prev].slice(0, 20);
          localStorage.setItem(key, JSON.stringify({ ...stored, emotionalPatterns: updated }));
        }
      } catch {}
    }
  }, [voiceTone.voiceEmotion, voiceTone.isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-speak AI responses when TTS is enabled — includes emotion-modulated voice
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "ai" || last.id === lastSpokenIdRef.current) return;
    lastSpokenIdRef.current = last.id;
    if (!tts.isEnabled) return;
    let text: string | undefined;
    if (last.isBattleContainer && last.battleResponses?.length) {
      text = last.battleResponses[0].content;
    } else if (last.content) {
      text = last.content;
    }
    if (text) tts.speak(text, voiceStyle, lastEmotionRef.current);
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (content: string) => {
    if (!content.trim() || !sessionId) return;
    avatar.setIsThinking(true);
    avatar.setEmotion("thinking");
    const contextMode = detectContextPersonality(content);
    if (contextMode && avatar.avatarVisible) {
      const p = avatar.personalities.find((p) => p.id === contextMode);
      if (p) avatar.setActivePersonalityId(contextMode);
    }
    // Use global personality system — falls back to avatar personality if no global set
    const personalityPrompt = globalSystemPrompt || buildPersonalityPrompt(avatar.activePersonality);
    const characterContext  = character.getContextForPrompt();
    const enrichedMessage   = `${personalityPrompt}${characterContext}\n\nUser message: ${content}`;
    const userMsg: Message  = { id: crypto.randomUUID(), role: "user", content, timestamp: Date.now(), prompt: content };
    setMessages((prev) => [...prev, userMsg]);
    try {
      const response = await sendChat.mutateAsync({
        data: { message: enrichedMessage, mode, sessionId, preferredProvider: aiPreference === "auto" ? undefined : aiPreference },
      });
      if (mode === "battle" && response.messages.length > 0) {
        const battleMsg: Message = {
          id: crypto.randomUUID(), role: "ai", content: "", isBattleContainer: true,
          battleResponses: response.messages.map((m) => ({
            provider: m.provider as "openai" | "claude" | "perplexity",
            content: m.content, responseTime: m.responseTime, error: m.error,
          })),
          timestamp: Date.now(), prompt: content,
        };
        const battleText = response.messages[0]?.content || "";
        setMessages((prev) => [...prev, battleMsg]);
        character.onInteraction(content, battleText);
        const battleEmotion = detectEmotion(battleText);
        lastEmotionRef.current = battleEmotion;
        avatar.setEmotion(battleEmotion);
        triggerGesture(battleEmotion);
      } else if (mode === "hive" && response.combinedAnswer) {
        const hiveMsg: Message = { id: crypto.randomUUID(), role: "ai", content: response.combinedAnswer, provider: "hive", timestamp: Date.now() };
        setMessages((prev) => [...prev, hiveMsg]);
        character.onInteraction(content, response.combinedAnswer);
        const hiveEmotion = detectEmotion(response.combinedAnswer);
        lastEmotionRef.current = hiveEmotion;
        avatar.setEmotion(hiveEmotion);
        triggerGesture(hiveEmotion);
      } else {
        const aiError   = response.messages[0]?.error;
        const aiContent = response.messages[0]?.content || aiError || "No response received.";
        const aiMsg: Message = {
          id: crypto.randomUUID(), role: "ai", content: aiContent, error: aiError,
          provider: (response.messages[0]?.provider as any) || "auto",
          responseTime: response.messages[0]?.responseTime, timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        character.onInteraction(content, aiContent);
        const aiEmotion = detectEmotion(aiContent);
        lastEmotionRef.current = aiEmotion;
        avatar.setEmotion(aiEmotion);
        triggerGesture(aiEmotion);
      }
    } catch {
      const errorMsg: Message = { id: crypto.randomUUID(), role: "ai", content: "Failed to connect to AI routing core.", error: "Connection Error", timestamp: Date.now() };
      setMessages((prev) => [...prev, errorMsg]);
      lastEmotionRef.current = "concerned";
      avatar.setEmotion("concerned");
      triggerGesture("concerned");
    } finally {
      avatar.setIsThinking(false);
    }
  };

  const handleVote = (provider: "openai" | "claude" | "perplexity", prompt?: string) => {
    if (!sessionId) return;
    castVote.mutate({ data: { provider, sessionId, prompt: prompt ?? undefined } });
  };

  return (
    <>
    {/* ── Avatar greeting (returning users only, once per session) ─── */}
    <AvatarGreetingGate />
    {/* ── Streak milestone celebration (fires once per milestone) ─────────── */}
    {isMilestoneNew && milestone !== null && (
      <StreakMilestone
        streak={streak}
        milestone={milestone}
        onDismiss={dismissMilestone}
      />
    )}

    {/* ── Avatar re-engagement (behavioral, session-gated, bottom slide-up) ─ */}
    {reengagementMsg && (
      <AvatarReengagement
        message={reengagementMsg}
        onDismiss={dismissReengagement}
      />
    )}

    {/* ── Return message banner (inactivity-based personalized message) ─── */}
    <ReturnBanner />

    {/* ═══ DESKTOP CHAT VIEW (hidden on mobile) ═══════════════════════════ */}
    <div
      className="hidden lg:flex flex-col"
      style={{ height: "100%", flex: 1, minHeight: 0, background: "transparent", position: "relative", overflow: "hidden" }}
    >
      {/* Desktop header */}
      <div style={{ flexShrink: 0, padding: "20px 28px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.04em", margin: 0 }}>AI Chat</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: sendChat.isPending ? "#FACC15" : "#4ADE80", boxShadow: sendChat.isPending ? "0 0 8px rgba(250,204,21,0.8)" : "0 0 8px rgba(74,222,128,0.8)" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
                {sendChat.isPending ? "Apex is thinking…" : "All systems online"}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Mode selector pills */}
            {MODES.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{ padding: "6px 14px", borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer", background: mode === m.id ? "linear-gradient(135deg,#6C5CE7,#8B5CF6)" : "rgba(255,255,255,0.05)", color: mode === m.id ? "white" : "rgba(255,255,255,0.4)", border: mode === m.id ? "1px solid rgba(162,155,254,0.35)" : "1px solid rgba(255,255,255,0.08)", boxShadow: mode === m.id ? "0 0 12px rgba(108,92,231,0.4)" : "none" }}>
                {m.label}
              </button>
            ))}
            {/* TTS toggle */}
            <button onClick={() => { tts.toggle(); if (tts.isEnabled) tts.stop(); }} style={{ width: 34, height: 34, borderRadius: "50%", border: tts.isEnabled ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.1)", background: tts.isEnabled ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: tts.isEnabled ? "#4ADE80" : "rgba(255,255,255,0.3)" }}>
              {tts.isEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          </div>
        </div>
        {/* Provider row (the home hub's model cards cover this before the first message) */}
        {mode === "chat" && messages.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
            {PROVIDERS.map((p) => {
              const active = aiPreference === p.id;
              return (
                <button key={p.id} data-testid={`button-provider-${p.id}`} onClick={() => setAiPreference(p.id)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 99, fontSize: 11, fontWeight: 700, color: active ? "white" : "rgba(255,255,255,0.4)", background: active ? `linear-gradient(135deg,${p.color}33,${p.color}18)` : "rgba(255,255,255,0.04)", border: active ? `1px solid ${p.color}55` : "1px solid rgba(255,255,255,0.07)", boxShadow: active ? `0 0 14px ${p.glow}` : "none", cursor: "pointer" }}>
                  <span style={{ fontSize: 12 }}>{p.emoji}</span>
                  {p.label}
                  {active && <span style={{ width: 5, height: 5, borderRadius: "50%", background: p.color, boxShadow: `0 0 8px ${p.glow}` }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Messages scroll area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 28px 16px", display: "flex", flexDirection: "column", gap: 16, scrollBehavior: "smooth" }}>
        {messages.length === 0 && (
          <div style={{ width: "100%", maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18, paddingTop: 8 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--mg-ink-3)", fontWeight: 500 }}>
                {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: "var(--mg-ink)", letterSpacing: "-0.03em", margin: "2px 0 0" }}>
                Hey, {user?.username?.trim() || "Creator"}
              </h2>
            </div>
            <ModelSearch
              onPickModel={(id) => { setMode("chat"); setAiPreference(id); }}
              onPickMode={setMode}
              onAsk={handleSend}
            />
            <ModeChips mode={mode} onChange={setMode} />
            {mode === "chat"
              ? <ModelCarousel value={aiPreference} onChange={setAiPreference} status={providerStatus} />
              : <ModeCard mode={mode} status={providerStatus} />}
          </div>
        )}
        {messages.map((msg) => {
          if (msg.isBattleContainer && msg.battleResponses) {
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 14, background: "linear-gradient(135deg,rgba(239,68,68,0.1),rgba(251,191,36,0.08))", border: "1px solid rgba(239,68,68,0.22)" }}>
                  <span>⚔️</span>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", background: "linear-gradient(90deg,#EF4444,#FBBF24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Battle Royale — {msg.battleResponses.length} AIs</span>
                </div>
                {[...msg.battleResponses].sort((a, b) => (a.error ? 1 : 0) - (b.error ? 1 : 0) || (a.responseTime ?? 99999) - (b.responseTime ?? 99999)).map((r, i) => (
                  <div key={i} style={{ borderRadius: 18, border: `1px solid ${i === 0 ? "rgba(255,204,51,0.35)" : "rgba(255,255,255,0.08)"}`, background: i === 0 ? "rgba(255,204,51,0.06)" : "rgba(255,255,255,0.04)", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ["#FFCC33","rgba(255,255,255,0.5)","rgba(205,124,62,0.8)"][i] ?? "rgba(255,255,255,0.4)" }}>
                        {["🥇 Winner","🥈 2nd","🥉 3rd"][i] ?? `#${i+1}`} · {r.provider?.toUpperCase()}
                      </span>
                      {r.responseTime && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{r.responseTime}ms</span>}
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.65, color: r.error ? "#FCA5A5" : "rgba(255,255,255,0.85)", margin: 0, whiteSpace: "pre-wrap" }}>{r.error || r.content}</p>
                  </div>
                ))}
              </div>
            );
          }
          if (msg.role === "user") {
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ maxWidth: "65%", padding: "12px 18px", borderRadius: "20px 4px 20px 20px", background: "linear-gradient(135deg,rgba(124,58,237,0.85),rgba(59,130,246,0.75))", color: "white", fontSize: 14, lineHeight: 1.62, backdropFilter: "blur(8px)", border: "1px solid rgba(167,139,250,0.35)" }}>
                  {msg.content}
                </div>
              </div>
            );
          }
          return (
            <div key={msg.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", maxWidth: "75%" }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg,#7C3AED,#3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, boxShadow: "0 0 14px rgba(124,58,237,0.4)" }}>◆</div>
              <div style={{ padding: "12px 16px", borderRadius: "4px 20px 20px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.88)", fontSize: 14, lineHeight: 1.65, backdropFilter: "blur(12px)", whiteSpace: "pre-wrap" }}>
                {msg.error ? <span style={{ color: "#FCA5A5" }}>{msg.content || msg.error}</span> : msg.content}
              </div>
            </div>
          );
        })}
        {sendChat.isPending && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg,#7C3AED,#3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>◆</div>
            <div style={{ padding: "14px 18px", borderRadius: "4px 20px 20px 20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 5, alignItems: "center" }}>
              {[0,1,2].map((i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#A78BFA", animation: `live-dot-pulse 1.2s ease-in-out ${i*0.18}s infinite` }} />)}
            </div>
          </div>
        )}
        <div style={{ height: 80, flexShrink: 0 }} />
      </div>

      {/* Desktop input bar */}
      <div style={{ flexShrink: 0, padding: "12px 24px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(14,12,32,0.45)", backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)" }}>
        {privacyMode && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: 10 }}>
            <ShieldOff size={13} style={{ color: "#10B981" }} />
            <span style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>Privacy Mode — conversations won't be remembered</span>
            <button onClick={togglePrivacyMode} style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "3px 10px", cursor: "pointer" }}>Disable</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1, borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <textarea
              placeholder="Ask Apex anything…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontSize: 14, resize: "none", maxHeight: 120, overflowY: "auto", caretColor: "#A78BFA" }}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const v = (e.currentTarget as HTMLTextAreaElement).value.trim();
                  if (v && !sendChat.isPending) { handleSend(v); (e.currentTarget as HTMLTextAreaElement).value = ""; }
                }
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button onClick={() => togglePrivacyMode()} style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 99, color: privacyMode ? "#10B981" : "rgba(255,255,255,0.35)", background: privacyMode ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)", border: privacyMode ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                <ShieldOff size={10} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />Memory
              </button>
            </div>
          </div>
          <button
            onClick={() => {
              const ta = document.querySelector<HTMLTextAreaElement>('.lg\\:flex textarea');
              if (ta && ta.value.trim() && !sendChat.isPending) { handleSend(ta.value.trim()); ta.value = ""; }
            }}
            style={{ width: 44, height: 44, borderRadius: 14, background: sendChat.isPending ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg,#7C3AED,#3B82F6)", border: "none", cursor: sendChat.isPending ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: sendChat.isPending ? "none" : "0 4px 14px rgba(124,58,237,0.4)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          </button>
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 8, marginBottom: 0 }}>Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>

    {/* ═══ MOBILE CHAT VIEW (hidden on desktop) ════════════════════════════ */}
    <div
      className="flex flex-col lg:hidden"
      style={{
        height: "100%",
        flex: 1,
        minHeight: 0,
        background: "transparent",
        position: "relative",
        overflow: "hidden",
      }}
    >

      {/* ── Header ───────────────────────────────────────────── */}
      {messages.length === 0 ? (
        <div style={{ flexShrink: 0, padding: "10px 16px 0", position: "relative", zIndex: 10 }}>
          <HubHeader name={user?.username} onAvatar={() => nav("/profile")} />
        </div>
      ) : (
        <div style={{ flexShrink: 0, padding: "10px 16px 10px", position: "relative", zIndex: 10, display: "flex", alignItems: "center", gap: 10 }}>
          {/* The fixed ☰ menu button (ApexControlPanel) sits in this space */}
          <div style={{ width: 42, flexShrink: 0 }} aria-hidden />
          <button
            onClick={() => setMessages([])}
            className="mg-glass mg-press mg-focus"
            aria-label="Back to home"
            style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 14px 0 10px", borderRadius: 20, color: "var(--mg-ink)", cursor: "pointer", minWidth: 0 }}
          >
            {mode === "chat"
              ? <ModelLogo id={aiPreference} size={18} />
              : <span style={{ fontSize: 15 }}>{mode === "battle" ? "⚔️" : "🐝"}</span>}
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
              {mode === "chat" ? modelById(aiPreference).name : mode === "battle" ? "Battle" : "Hive"}
            </span>
            <span style={{ fontSize: 11, color: "var(--mg-ink-3)", fontWeight: 600 }}>
              {sendChat.isPending ? "thinking…" : "New chat"}
            </span>
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => { tts.toggle(); if (tts.isEnabled) tts.stop(); }}
            className="mg-glass mg-press mg-focus"
            aria-label={tts.isEnabled ? "Turn voice off" : "Turn voice on"}
            style={{ width: 40, height: 40, borderRadius: "50%", cursor: "pointer", display: "grid", placeItems: "center", padding: 0, boxShadow: tts.isSpeaking ? "0 0 14px rgba(74,222,128,0.45)" : undefined }}
          >
            {tts.isEnabled
              ? <Volume2 style={{ width: 16, height: 16, color: "#4ADE80" }} />
              : <VolumeX style={{ width: 16, height: 16, color: "var(--mg-ink-3)" }} />}
          </button>
        </div>
      )}

      {/* ── 3D Avatar Panel ────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          overflow: "hidden",
          maxHeight: avatar3DEnabled && messages.length > 0 ? 200 : 0,
          opacity: avatar3DEnabled && messages.length > 0 ? 1 : 0,
          transition: `max-height 0.40s ${EASE_IOS}, opacity 0.30s ${EASE_IOS}`,
          borderBottom: "none",
          background: "transparent",
          position: "relative",
          zIndex: 5,
          // Personality-driven animation CSS vars
          ["--avatar-anim-speed" as string]: `${(1 / avatarBehavior.animationSpeed).toFixed(2)}s`,
          ["--avatar-bounce" as string]: `${(avatarBehavior.bounceIntensity * 12).toFixed(1)}px`,
        }}
      >
        <div
          style={{
            height: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Ambient glow behind avatar */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(ellipse at center, ${
                avatar.emotion === "happy" ? "rgba(245,158,11,0.08)"
                : avatar.emotion === "serious" ? "rgba(239,68,68,0.08)"
                : avatar.emotion === "concerned" ? "rgba(249,115,22,0.08)"
                : "rgba(108,92,231,0.08)"
              } 0%, transparent 70%)`,
              pointerEvents: "none",
              transition: "background 0.6s ease",
            }}
          />

          {/* 3D Avatar canvas */}
          <ApexAvatar3D
            emotion={avatar.emotion}
            isThinking={avatar.isThinking}
            isSpeaking={tts.isSpeaking}
            amplitude={tts.amplitude}
            size={180}
            gesture={gesture}
          />

          {/* Status overlay */}
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              pointerEvents: "none",
            }}
          >
            {tts.isSpeaking && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 3,
                      height: 3 + i * 2,
                      borderRadius: 2,
                      background: "#A29BFE",
                      animation: `voice-bar 0.7s ease-in-out ${i * 0.12}s infinite alternate`,
                    }}
                  />
                ))}
                <span style={{ fontSize: 9, color: "rgba(162,155,254,0.65)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginLeft: 2 }}>
                  speaking
                </span>
              </div>
            )}
            {avatar.isThinking && !tts.isSpeaking && (
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", fontWeight: 500, letterSpacing: "0.04em" }}>
                thinking...
              </span>
            )}
            {!tts.isSpeaking && !avatar.isThinking && (
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", letterSpacing: "0.04em" }}>
                {avatar.emotion !== "neutral" ? `feeling ${avatar.emotion}` : "idle"}
              </span>
            )}
          </div>

          {/* Emotion color accent bar at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "20%",
              right: "20%",
              height: 1,
              borderRadius: 1,
              background: `linear-gradient(90deg, transparent, ${
                avatar.emotion === "happy" ? "#F59E0B"
                : avatar.emotion === "serious" ? "#EF4444"
                : avatar.emotion === "concerned" ? "#F97316"
                : avatar.emotion === "thinking" ? "#4834D4"
                : "#6C5CE7"
              }, transparent)`,
              opacity: 0.45,
              transition: "background 0.6s ease",
            }}
          />
        </div>
      </div>

      {/* ── Message area ─────────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 16px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          scrollBehavior: "smooth",
          position: "relative",
          zIndex: 1,
        }}
        onClick={() => {}}
      >
        {/* Empty state: the home hub */}
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4, paddingBottom: 150 }}>
            <ModelSearch
              onPickModel={(id) => { setMode("chat"); setAiPreference(id); }}
              onPickMode={setMode}
              onAsk={handleSend}
            />
            <ModeChips mode={mode} onChange={setMode} />
            {mode === "chat"
              ? <ModelCarousel value={aiPreference} onChange={setAiPreference} status={providerStatus} />
              : <ModeCard mode={mode} status={providerStatus} />}
            <SmartRecommendations compact showTitle maxItems={3} />
          </div>
        )}

        {/* Privacy Mode Banner */}
        {privacyMode && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            margin: "0 14px 10px",
            padding: "10px 14px", borderRadius: 14,
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.22)",
            animation: "pm-badge-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: "rgba(16,185,129,0.15)",
              border: "1px solid rgba(16,185,129,0.30)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#10B981",
            }}>
              <ShieldOff size={14} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#10B981" }}>
                Privacy Mode Active
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", marginTop: 1 }}>
                Your conversations will not be remembered
              </div>
            </div>
            <button
              onClick={togglePrivacyMode}
              style={{
                padding: "4px 10px", borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.40)", fontSize: 9,
                fontWeight: 700, cursor: "pointer",
                letterSpacing: "0.04em",
              }}
            >
              Disable
            </button>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => {
          /* ── BATTLE MODE CONTAINER ─────────────────────────── */
          if (msg.isBattleContainer && msg.battleResponses) {
            const RANK_META = [
              { emoji: "🥇", label: "WINNER",  borderColor: "#FFCC33", glow: "rgba(255,204,51,0.30)", badge: "linear-gradient(135deg, #FFCC33, #F59E0B)" },
              { emoji: "🥈", label: "2ND",     borderColor: "#94A3B8", glow: "rgba(148,163,184,0.18)", badge: "linear-gradient(135deg, #94A3B8, #64748B)" },
              { emoji: "🥉", label: "3RD",     borderColor: "#CD7C3E", glow: "rgba(205,124,62,0.18)",  badge: "linear-gradient(135deg, #CD7C3E, #92400E)" },
            ];
            const sorted = [...msg.battleResponses].sort((a, b) => {
              if (a.error && !b.error) return 1;
              if (!a.error && b.error) return -1;
              return (a.responseTime ?? Infinity) - (b.responseTime ?? Infinity);
            });
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 4 }}>
                {/* ── Battle Arena Header ── */}
                <div
                  style={{
                    borderRadius: 16,
                    padding: "10px 14px",
                    background: "linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(251,191,36,0.08) 50%, rgba(239,68,68,0.06) 100%)",
                    border: "1px solid rgba(239,68,68,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    animation: "battle-header-glow 2.8s ease-in-out infinite",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>⚔️</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", background: "linear-gradient(90deg, #EF4444, #FBBF24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                        Battle Royale
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", fontWeight: 600, letterSpacing: "0.04em" }}>
                        {sorted.length} AIs · ranked by speed
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {sorted.map((_, i) => (
                      <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: RANK_META[i]?.badge ?? "rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
                        {RANK_META[i]?.emoji ?? "·"}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Battle Cards ── */}
                {sorted.map((r, i) => {
                  const rank = RANK_META[i] ?? RANK_META[2];
                  const cfg  = PROVIDER_CONFIG[(r.provider in PROVIDER_CONFIG ? r.provider : "auto") as keyof typeof PROVIDER_CONFIG];
                  const isWinner = i === 0 && !r.error;
                  return (
                    <div
                      key={i}
                      style={{
                        position: "relative",
                        animation: `battle-card-enter 0.35s cubic-bezier(0.25,0.46,0.45,0.94) ${i * 0.10}s both`,
                        borderRadius: 18,
                        border: `1px solid ${isWinner ? rank.borderColor + "55" : "rgba(255,255,255,0.08)"}`,
                        borderLeft: `3px solid ${isWinner ? rank.borderColor : cfg.rankBorder}`,
                        background: isWinner
                          ? `linear-gradient(135deg, ${rank.borderColor}0D 0%, rgba(255,204,51,0.04) 100%)`
                          : "rgba(20,22,30,0.70)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        boxShadow: isWinner
                          ? `0 0 24px ${rank.glow}, 0 4px 16px rgba(0,0,0,0.30)`
                          : "0 2px 12px rgba(0,0,0,0.22)",
                        overflow: "hidden",
                        padding: "12px 14px 12px 14px",
                      }}
                    >
                      {/* Rank badge */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13 }}>{rank.emoji}</span>
                          {isWinner && (
                            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 99, background: rank.badge, color: "#0F1115" }}>
                              Winner
                            </span>
                          )}
                          <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {cfg.name}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          {r.responseTime && (
                            <span style={{ fontSize: 9, color: isWinner ? rank.borderColor : "rgba(255,255,255,0.28)", fontWeight: 700 }}>
                              {r.responseTime}ms
                            </span>
                          )}
                          <button
                            data-testid={`button-vote-${r.provider}`}
                            onClick={() => handleVote(r.provider, msg.prompt)}
                            className="haptic-sm"
                            style={{
                              fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.50)",
                              padding: "3px 8px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.12)",
                              background: "rgba(255,255,255,0.06)", cursor: "pointer",
                            }}
                          >
                            Vote
                          </button>
                        </div>
                      </div>
                      {/* Divider */}
                      <div style={{ height: 1, background: `linear-gradient(90deg, ${cfg.color}30, transparent)`, marginBottom: 10 }} />
                      {/* Content with streaming */}
                      <div style={{ fontSize: 14, lineHeight: 1.62, color: r.error ? "#FCA5A5" : "rgba(255,255,255,0.88)", whiteSpace: "pre-wrap", letterSpacing: "0.005em" }}>
                        {r.error || r.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          /* ── HIVE MIND MESSAGE ────────────────────────────── */
          if (msg.role === "ai" && msg.provider === "hive") {
            return (
              <HiveBubble key={msg.id} content={msg.content} />
            );
          }

          /* ── STANDARD MESSAGE ────────────────────────────── */
          return (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              provider={msg.provider}
              responseTime={msg.responseTime}
              error={msg.error}
            />
          );
        })}
        {sendChat.isPending && <MessageSkeleton />}

        {/* Bottom spacer */}
        <div style={{ height: 100, flexShrink: 0 }} />
      </div>

      {/* ── Floating input ────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "8px 12px 16px",
          background: messages.length === 0 ? "transparent" : "linear-gradient(to top, rgba(10,9,24,0.9) 45%, transparent 100%)",
          zIndex: 10,
        }}
      >
        <ProactiveSuggestions
          suggestions={character.proactiveSuggestions}
          relationshipLevel={character.state.relationshipLevel}
          onSelect={handleSend}
        />

        {/* ── Voice Tone Indicator ────────────────────────────────────── */}
        {voiceTone.isActive && voiceTone.voiceEmotion !== 'neutral' && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "5px 14px",
            animation: "dm-drawer-enter 0.25s ease-out both",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 11px", borderRadius: 99,
              background: `${VOICE_EMOTION_COLOR[voiceTone.voiceEmotion]}12`,
              border: `1px solid ${VOICE_EMOTION_COLOR[voiceTone.voiceEmotion]}30`,
            }}>
              {/* Live dot */}
              <div style={{
                width: 5, height: 5, borderRadius: "50%",
                background: VOICE_EMOTION_COLOR[voiceTone.voiceEmotion],
                animation: "hf-capture-pulse 1.2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>
                Apex detects:
              </span>
              <span style={{
                fontSize: 10, fontWeight: 800,
                color: VOICE_EMOTION_COLOR[voiceTone.voiceEmotion],
              }}>
                {VOICE_EMOTION_EMOJI[voiceTone.voiceEmotion]} {VOICE_EMOTION_LABELS[voiceTone.voiceEmotion]}
              </span>
            </div>

            {/* Privacy toggle */}
            <button
              onClick={voiceTone.toggle}
              style={{
                fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 99,
                color: "rgba(255,255,255,0.30)", border: "1px solid rgba(255,255,255,0.10)",
                background: "transparent", cursor: "pointer", letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Turn off
            </button>
          </div>
        )}

        <ChatInput
          onSend={handleSend}
          disabled={sendChat.isPending}
          onVoiceStart={voiceTone.enabled ? voiceTone.start : undefined}
          onVoiceStop={voiceTone.stop}
        />
      </div>
    </div>
    </>
  );
}
