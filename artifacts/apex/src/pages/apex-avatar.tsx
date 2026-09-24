/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX AVATAR SCREEN — Visual AI Companion v1                ║
 * ║                                                              ║
 * ║  Layout:                                                     ║
 * ║   • Top bar    — logo + mode + context                      ║
 * ║   • Center     — ApexAvatarEntity (animated orb)            ║
 * ║   • Transcript — live speech / conversation display         ║
 * ║   • Bottom     — voice orb + text input                     ║
 * ║   • Nav bar                                                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Send, ChevronLeft, RotateCcw, Settings } from "lucide-react";
import { ApexLogo } from "@/components/ui/ApexLogo";
import { ApexAvatarEntity, type AvatarEntityState, type AvatarEntityMode } from "@/components/avatar/ApexAvatarEntity";
import { VoiceOrb } from "@/components/voice/VoiceOrb";
import { useVoiceConversation, type VoiceMode } from "@/hooks/useVoiceConversation";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg:      "#06070D",
  bg2:     "#0D0E18",
  text:    "#E8E8F0",
  muted:   "#6B6B80",
  grad:    "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)",
};

// ── Mode colours (shared labels with VoiceOrb) ────────────────────────────────

const MODE_META: Record<VoiceMode, { color: string; label: string; emoji: string; desc: string }> = {
  chat:    { color: "#FD79A8", label: "Chat",    emoji: "💬", desc: "General conversation" },
  builder: { color: "#A29BFE", label: "Builder", emoji: "⚙️", desc: "Code & build commands" },
  game:    { color: "#00D2D3", label: "Game",    emoji: "🎮", desc: "In-game assistant"     },
  command: { color: "#FFCC33", label: "Command", emoji: "⚡", desc: "Fast execution"        },
};

// ── Voice state → avatar state mapping ───────────────────────────────────────

function mapVoiceToAvatarState(
  voiceState: ReturnType<typeof useVoiceConversation>["state"],
  voiceMode:  VoiceMode,
): AvatarEntityState {
  if (voiceState === "listening")   return "idle";
  if (voiceState === "processing")  return "thinking";
  if (voiceState === "speaking")    return "speaking";
  if (voiceState === "error")       return "error";
  if (voiceMode   === "builder")   return "building";
  return "idle";
}

// ── Conversation text display ─────────────────────────────────────────────────

interface SpeechDisplayProps {
  history:      ReturnType<typeof useVoiceConversation>["history"];
  interimText:  string;
  modeColor:    string;
}

function SpeechDisplay({ history, interimText, modeColor }: SpeechDisplayProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, interimText]);

  const last3 = history.slice(-3);

  return (
    <div style={{
      width:         "100%",
      maxWidth:      340,
      minHeight:     90,
      display:       "flex",
      flexDirection: "column",
      alignItems:    "center",
      gap:           6,
      padding:       "0 20px",
    }}>
      {last3.map((turn) => {
        const isApex = turn.role === "apex";
        return (
          <div key={turn.id} style={{
            textAlign:  "center",
            maxWidth:   "100%",
          }}>
            <p style={{
              margin:     0,
              fontSize:   isApex ? 15 : 13,
              fontWeight: isApex ? 600 : 400,
              color:      isApex ? T.text : T.muted,
              lineHeight: 1.5,
              transition: "opacity 0.3s ease",
            }}>
              {!isApex && (
                <span style={{ color: modeColor, marginRight: 4, fontSize: 11 }}>YOU</span>
              )}
              {turn.text}
            </p>
          </div>
        );
      })}

      {/* Live interim transcript */}
      {interimText && (
        <p style={{
          margin:    0,
          fontSize:  13,
          color:     T.muted,
          fontStyle: "italic",
          textAlign: "center",
        }}>
          <span style={{ color: modeColor, marginRight: 4, fontSize: 10 }}>YOU</span>
          {interimText}…
        </p>
      )}

      {/* Empty state hint */}
      {last3.length === 0 && !interimText && (
        <p style={{
          margin:    0,
          fontSize:  14,
          color:     T.muted,
          textAlign: "center",
          lineHeight: 1.6,
        }}>
          Tap the orb to start talking<br/>
          <span style={{ fontSize: 11, opacity: 0.6 }}>or type a message below</span>
        </p>
      )}

      <div ref={endRef} />
    </div>
  );
}

// ── Text input bar ────────────────────────────────────────────────────────────

interface TextBarProps {
  modeColor:  string;
  onSend:     (text: string) => void;
  disabled?:  boolean;
}

function TextBar({ modeColor, onSend, disabled }: TextBarProps) {
  const [text, setText] = useState("");

  const send = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }, [text, onSend]);

  return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      gap:            8,
      background:     "rgba(255,255,255,0.04)",
      border:         `1px solid rgba(255,255,255,0.08)`,
      borderRadius:   18,
      padding:        "8px 8px 8px 16px",
      width:          "100%",
      maxWidth:       340,
    }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder="Type a message…"
        disabled={disabled}
        style={{
          flex:       1,
          background: "transparent",
          border:     "none",
          outline:    "none",
          fontSize:   14,
          color:      T.text,
          caretColor: modeColor,
        }}
      />
      <button
        onClick={send}
        disabled={!text.trim() || disabled}
        style={{
          width:          34,
          height:         34,
          borderRadius:   "50%",
          background:     text.trim()
            ? `linear-gradient(135deg, ${modeColor}, ${modeColor}aa)`
            : "rgba(255,255,255,0.06)",
          border:         "none",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          cursor:         text.trim() ? "pointer" : "default",
          transition:     "all 0.2s",
          flexShrink:     0,
        }}
      >
        <Send size={14} color={text.trim() ? "#fff" : T.muted} />
      </button>
    </div>
  );
}

// ── Mode switcher row ─────────────────────────────────────────────────────────

function ModeSwitcher({
  mode,
  onMode,
}: {
  mode:   VoiceMode;
  onMode: (m: VoiceMode) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {(["chat", "builder", "game", "command"] as VoiceMode[]).map((m) => {
        const meta   = MODE_META[m];
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onMode(m)}
            style={{
              display:        "flex",
              alignItems:     "center",
              gap:            4,
              padding:        "5px 10px",
              borderRadius:   14,
              background:     active ? `${meta.color}22` : "rgba(255,255,255,0.04)",
              border:         `1px solid ${active ? meta.color + "66" : "rgba(255,255,255,0.08)"}`,
              cursor:         "pointer",
              transition:     "all 0.2s",
              flexShrink:     0,
            }}
          >
            <span style={{ fontSize: 10 }}>{meta.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: active ? meta.color : T.muted }}>
              {meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Context bar (active project / game) ──────────────────────────────────────

function ContextBadge({ mode, color }: { mode: VoiceMode; color: string }) {
  const meta = MODE_META[mode];
  return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      gap:            5,
      padding:        "3px 10px",
      borderRadius:   10,
      background:     `${color}15`,
      border:         `1px solid ${color}33`,
    }}>
      <div style={{
        width:        5,
        height:       5,
        borderRadius: "50%",
        background:   color,
        boxShadow:    `0 0 4px ${color}`,
        animation:    "voiceOrbFade 1.6s ease-in-out infinite",
      }} />
      <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.05em" }}>
        {meta.emoji} {meta.label} Mode
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ApexAvatarPage() {
  const [, nav]       = useLocation();
  const [focused, setFocused] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);

  // Success flash on send
  const triggerSuccess = useCallback(() => {
    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 900);
  }, []);

  // Voice conversation hook
  const voice = useVoiceConversation({
    initialMode: "chat",
    pushToTalk:  false,
    onIntentDetected: (intent) => {
      if (intent.intent === "system_navigation" && intent.action === "home") {
        nav("/");
      }
    },
  });

  // Map to avatar entity state
  const avatarState: AvatarEntityState = successFlash
    ? "success"
    : mapVoiceToAvatarState(voice.state, voice.mode);

  const avatarMode: AvatarEntityMode = voice.mode as AvatarEntityMode;
  const meta = MODE_META[voice.mode];

  // Text send: feeds into voice conversation as a processed utterance
  const handleTextSend = useCallback((text: string) => {
    if (!text.trim()) return;
    // Simulate a user turn by feeding the text through intent + respond
    // We do this by calling the same API the voice hook uses
    const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

    (async () => {
      const intentRes = await fetch(`${API_BASE}/api/voice/intent`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, currentMode: voice.mode }),
      });
      const intentData = intentRes.ok ? await intentRes.json() : {};
      const intent = intentData.result ?? null;

      const replyRes = await fetch(`${API_BASE}/api/voice/respond`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          text,
          intent,
          mode: voice.mode,
          history: voice.history.slice(-8).map((t) => ({
            role:    t.role === "apex" ? "assistant" : "user",
            content: t.text,
          })),
        }),
      });
      const replyData = replyRes.ok ? await replyRes.json() : {};
      const reply = replyData.reply ?? "Got it.";

      voice.speak(reply);
      triggerSuccess();
    })();
  }, [voice, triggerSuccess]);

  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      height:         "100dvh",
      background:     T.bg,
      overflow:       "hidden",
      position:       "relative",
    }}>

      {/* ── Ambient background gradient ──────────────────────────────────── */}
      <div style={{
        position:   "absolute",
        inset:      0,
        background: `
          radial-gradient(ellipse 60% 40% at 50% 30%, ${meta.color}0f 0%, transparent 70%),
          radial-gradient(ellipse 80% 50% at 50% 80%, #6C5CE70a 0%, transparent 70%)
        `,
        pointerEvents: "none",
        transition:    "background 0.8s ease",
        zIndex:        0,
      }} />

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div style={{
        display:      "flex",
        alignItems:   "center",
        padding:      "12px 16px 10px",
        gap:          10,
        flexShrink:   0,
        position:     "relative",
        zIndex:       10,
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <button
          onClick={() => nav("/")}
          style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: T.muted, flexShrink: 0,
          }}
        >
          <ChevronLeft size={16} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <ApexLogo
            size={28}
            state={avatarState === "thinking" ? "thinking" : avatarState === "speaking" ? "active" : "idle"}
            radius={8}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Apex</div>
            <div style={{ fontSize: 10, color: meta.color, fontWeight: 600 }}>
              {voice.state === "listening"  ? "Listening…"
                : voice.state === "processing" ? "Processing…"
                : voice.state === "speaking"   ? "Speaking…"
                : "Voice Companion"}
            </div>
          </div>
        </div>

        <ContextBadge mode={voice.mode} color={meta.color} />

        <button
          onClick={voice.clearHistory}
          style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: T.muted, flexShrink: 0,
          }}
          title="Clear conversation"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* ── CENTER AVATAR AREA ────────────────────────────────────────────── */}
      <div style={{
        flex:           1,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            28,
        padding:        "16px 16px 8px",
        position:       "relative",
        zIndex:         1,
        minHeight:      0,
      }}>

        {/* Avatar entity */}
        <ApexAvatarEntity
          state={avatarState}
          mode={avatarMode}
          amplitude={voice.amplitude}
          size={200}
          onTap={() => {
            setFocused((f) => !f);
            if (voice.state === "speaking") voice.interrupt();
            else voice.toggleListening();
          }}
          focused={focused || voice.state === "listening"}
          showWave={true}
        />

        {/* Speech / conversation display */}
        <SpeechDisplay
          history={voice.history}
          interimText={voice.interimText}
          modeColor={meta.color}
        />
      </div>

      {/* ── BOTTOM CONTROLS ──────────────────────────────────────────────── */}
      <div style={{
        flexShrink:    0,
        padding:       "12px 20px 16px",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           14,
        borderTop:     "1px solid rgba(255,255,255,0.05)",
        position:      "relative",
        zIndex:        10,
      }}>

        {/* Voice orb + mode switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Mode switcher (scrollable) */}
          <div style={{ overflowX: "auto", flex: 1 }}>
            <ModeSwitcher mode={voice.mode} onMode={voice.setMode} />
          </div>

          {/* Voice orb */}
          <VoiceOrb
            state={voice.state}
            mode={voice.mode}
            amplitude={voice.amplitude}
            interimText={voice.interimText}
            isSupported={voice.isSupported}
            pushToTalk={false}
            onToggle={voice.toggleListening}
            onInterrupt={voice.interrupt}
            size={52}
          />
        </div>

        {/* Text input */}
        <TextBar
          modeColor={meta.color}
          onSend={handleTextSend}
          disabled={voice.state === "processing"}
        />
      </div>

      {/* ── NOT SUPPORTED fallback ────────────────────────────────────────── */}
      {!voice.isSupported && (
        <div style={{
          position:       "absolute",
          bottom:         120,
          left:           "50%",
          transform:      "translateX(-50%)",
          background:     "rgba(255,100,100,0.12)",
          border:         "1px solid rgba(255,100,100,0.3)",
          borderRadius:   12,
          padding:        "8px 16px",
          zIndex:         20,
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "#FF6B6B", textAlign: "center" }}>
            Voice not supported in this browser — use text input
          </p>
        </div>
      )}

      {/* Error banner */}
      {voice.errorMsg && (
        <div style={{
          position:       "absolute",
          bottom:         120,
          left:           "50%",
          transform:      "translateX(-50%)",
          background:     "rgba(255,100,100,0.12)",
          border:         "1px solid rgba(255,100,100,0.3)",
          borderRadius:   12,
          padding:        "8px 16px",
          zIndex:         20,
          whiteSpace:     "nowrap",
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "#FF6B6B" }}>{voice.errorMsg}</p>
        </div>
      )}
    </div>
  );
}
