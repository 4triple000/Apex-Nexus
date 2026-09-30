/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  VoiceConversationPanel — slide-up full conversation view   ║
 * ║                                                              ║
 * ║  Shows:                                                      ║
 * ║   • Live transcription                                       ║
 * ║   • Conversation history (last 20 turns)                    ║
 * ║   • Mode switcher                                            ║
 * ║   • Context / project state display                         ║
 * ║   • Push-to-talk or continuous toggle                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useRef, useEffect } from "react";
import { X, Trash2, Mic, MicOff, Volume2, RefreshCw } from "lucide-react";
import { ApexLogo } from "@/components/ui/ApexLogo";
import { VoiceOrb } from "./VoiceOrb";
import type { VoiceMode, VoiceState, VoiceTurn, IntentResult } from "@/hooks/useVoiceConversation";

// ── Mode config ───────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<VoiceMode, { color: string; glow: string; label: string; emoji: string; desc: string }> = {
  builder: { color: "#A29BFE", glow: "rgba(162,155,254,0.2)", label: "Builder",  emoji: "⚙️", desc: "Code & build commands" },
  game:    { color: "#00D2D3", glow: "rgba(0,210,211,0.2)",   label: "Game",     emoji: "🎮", desc: "In-game actions"       },
  chat:    { color: "#FD79A8", glow: "rgba(253,121,168,0.2)", label: "Chat",     emoji: "💬", desc: "General conversation"  },
  command: { color: "#A29BFE", glow: "rgba(162,155,254,0.2)",  label: "Command",  emoji: "⚡", desc: "Fast execution"        },
};

const INTENT_LABELS: Record<string, string> = {
  builder_command:      "🔨 Builder",
  game_action:          "🎮 Game",
  ai_assistance:        "🧠 AI Help",
  general_conversation: "💬 Chat",
  system_navigation:    "🗺️ Navigate",
  code_execution:       "⚡ Execute",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface VoiceConversationPanelProps {
  open:           boolean;
  state:          VoiceState;
  mode:           VoiceMode;
  amplitude:      number;
  interimText:    string;
  transcript:     string;
  history:        VoiceTurn[];
  lastIntent:     IntentResult | null;
  isSupported:    boolean;
  pushToTalk:     boolean;
  projectContext: string;
  onClose:        () => void;
  onToggleListening: () => void;
  onPttStart:     () => void;
  onPttEnd:       () => void;
  onInterrupt:    () => void;
  onModeChange:   (m: VoiceMode) => void;
  onClearHistory: () => void;
  onTogglePtt:    () => void;
}

// ── Turn bubble ───────────────────────────────────────────────────────────────

function TurnBubble({ turn, modeColor }: { turn: VoiceTurn; modeColor: string }) {
  const isApex  = turn.role === "apex";
  const ts      = new Date(turn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      display:       "flex",
      flexDirection: isApex ? "row" : "row-reverse",
      alignItems:    "flex-end",
      gap:           8,
      marginBottom:  10,
    }}>
      {/* Avatar */}
      <div style={{
        flexShrink:     0,
        width:          28,
        height:         28,
        borderRadius:   "50%",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     isApex ? "rgba(162,155,254,0.15)" : "rgba(255,255,255,0.06)",
        border:         `1px solid ${isApex ? modeColor + "44" : "rgba(255,255,255,0.1)"}`,
      }}>
        {isApex
          ? <ApexLogo size={16} state="idle" radius={8} />
          : <span style={{ fontSize: 12 }}>👤</span>
        }
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth:       "75%",
        background:     isApex
          ? `linear-gradient(135deg, rgba(162,155,254,0.12), rgba(108,92,231,0.08))`
          : "rgba(255,255,255,0.05)",
        border:         `1px solid ${isApex ? modeColor + "33" : "rgba(255,255,255,0.08)"}`,
        borderRadius:   isApex ? "16px 16px 16px 4px" : "16px 16px 4px 16px",
        padding:        "8px 12px",
      }}>
        <p style={{ margin: 0, fontSize: 13, color: isApex ? "#e8e8f0" : "#b0b0c4", lineHeight: 1.45 }}>
          {turn.text}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          {turn.intent && isApex && (
            <span style={{
              fontSize:   9,
              color:      modeColor + "99",
              background: modeColor + "15",
              borderRadius: 4,
              padding:    "1px 5px",
            }}>
              {INTENT_LABELS[turn.intent] ?? turn.intent}
            </span>
          )}
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>{ts}</span>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoiceConversationPanel({
  open,
  state,
  mode,
  amplitude,
  interimText,
  transcript,
  history,
  lastIntent,
  isSupported,
  pushToTalk,
  projectContext,
  onClose,
  onToggleListening,
  onPttStart,
  onPttEnd,
  onInterrupt,
  onModeChange,
  onClearHistory,
  onTogglePtt,
}: VoiceConversationPanelProps) {
  const historyEndRef = useRef<HTMLDivElement>(null);
  const cfg           = MODE_CONFIG[mode];

  useEffect(() => {
    if (open && historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [history, open]);

  if (!open) return null;

  const listening  = state === "listening";
  const speaking   = state === "speaking";
  const processing = state === "processing";

  return (
    <div style={{
      position:       "fixed",
      inset:          0,
      zIndex:         1000,
      display:        "flex",
      flexDirection:  "column",
      justifyContent: "flex-end",
      background:     "rgba(0,0,0,0.72)",
      backdropFilter: "blur(4px)",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background:    "linear-gradient(180deg, rgba(34,29,70,0.94), rgba(16,13,38,0.95))",
        borderRadius:  "24px 24px 0 0",
        border:        "1px solid rgba(255,255,255,0.08)",
        borderBottom:  "none",
        maxHeight:     "85vh",
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
      }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{
          display:     "flex",
          alignItems:  "center",
          padding:     "16px 20px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink:  0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <ApexLogo
              size={28}
              state={speaking ? "active" : listening ? "thinking" : "idle"}
              radius={8}
            />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>Apex Voice</div>
              <div style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>
                {listening ? "Listening…" : speaking ? "Speaking…" : processing ? "Processing…" : "Ready"}
              </div>
            </div>
          </div>

          {/* Status indicator */}
          <div style={{
            display:     "flex",
            alignItems:  "center",
            gap:         5,
            background:  `${cfg.glow}`,
            border:      `1px solid ${cfg.color}44`,
            borderRadius: 10,
            padding:     "4px 10px",
            marginRight: 10,
          }}>
            <div style={{
              width:        6,
              height:       6,
              borderRadius: "50%",
              background:   cfg.color,
              animation:    listening || speaking ? "voiceOrbFade 1s ease-in-out infinite" : "none",
            }} />
            <span style={{ fontSize: 10, color: cfg.color, fontWeight: 700 }}>{cfg.emoji} {cfg.label}</span>
          </div>

          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)",
            border:     "1px solid rgba(255,255,255,0.1)",
            borderRadius: "50%",
            width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "white",
          }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Mode switcher ─────────────────────────────────────────────── */}
        <div style={{
          display:    "flex",
          gap:        8,
          padding:    "12px 20px",
          overflowX:  "auto",
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          {(["chat","builder","game","command"] as VoiceMode[]).map((m) => {
            const mc    = MODE_CONFIG[m];
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                style={{
                  flexShrink:     0,
                  display:        "flex",
                  alignItems:     "center",
                  gap:            5,
                  padding:        "6px 12px",
                  borderRadius:   20,
                  background:     active ? mc.glow : "rgba(255,255,255,0.04)",
                  border:         `1px solid ${active ? mc.color : "rgba(255,255,255,0.08)"}`,
                  cursor:         "pointer",
                  transition:     "all 0.2s",
                }}>
                <span style={{ fontSize: 11 }}>{mc.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? mc.color : "#888" }}>
                  {mc.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Context banner ────────────────────────────────────────────── */}
        {projectContext && (
          <div style={{
            margin:      "8px 20px 0",
            padding:     "7px 12px",
            background:  "rgba(162,155,254,0.08)",
            borderRadius: 10,
            border:       "1px solid rgba(162,155,254,0.15)",
            flexShrink:  0,
          }}>
            <span style={{ fontSize: 10, color: "#A29BFE", fontWeight: 600 }}>
              📁 Active: {projectContext}
            </span>
          </div>
        )}

        {/* ── Conversation history ──────────────────────────────────────── */}
        <div style={{
          flex:       1,
          overflowY:  "auto",
          padding:    "12px 20px",
        }}>
          {history.length === 0 ? (
            <div style={{
              display:       "flex",
              flexDirection: "column",
              alignItems:    "center",
              justifyContent: "center",
              height:        140,
              gap:           8,
              opacity:       0.5,
            }}>
              <Mic size={28} color={cfg.color} />
              <p style={{ margin: 0, fontSize: 13, color: "#888", textAlign: "center" }}>
                {pushToTalk ? "Hold the orb to speak" : "Tap the orb to start talking"}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#555", textAlign: "center" }}>
                {`${cfg.emoji} ${cfg.desc}`}
              </p>
            </div>
          ) : (
            history.map((turn) => (
              <TurnBubble key={turn.id} turn={turn} modeColor={cfg.color} />
            ))
          )}

          {/* Live interim transcript */}
          {interimText && (
            <div style={{
              display:     "flex",
              justifyContent: "flex-end",
              marginBottom: 8,
            }}>
              <div style={{
                background:   "rgba(255,255,255,0.04)",
                border:       "1px dashed rgba(255,255,255,0.1)",
                borderRadius: "16px 16px 4px 16px",
                padding:      "8px 12px",
                maxWidth:     "75%",
              }}>
                <p style={{ margin: 0, fontSize: 13, color: "#666", fontStyle: "italic" }}>
                  {interimText}
                </p>
              </div>
            </div>
          )}

          <div ref={historyEndRef} />
        </div>

        {/* ── Controls ─────────────────────────────────────────────────── */}
        <div style={{
          padding:     "16px 20px 28px",
          borderTop:   "1px solid rgba(255,255,255,0.06)",
          flexShrink:  0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

            {/* Clear + PTT toggles */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onClearHistory}
                title="Clear history"
                style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#666",
                }}>
                <Trash2 size={15} />
              </button>
              <button
                onClick={onTogglePtt}
                title={pushToTalk ? "Switch to continuous" : "Switch to push-to-talk"}
                style={{
                  display:     "flex",
                  alignItems:  "center",
                  gap:         5,
                  padding:     "0 12px",
                  height:      38,
                  borderRadius: 20,
                  background:  pushToTalk ? "rgba(162,155,254,0.1)" : "rgba(255,255,255,0.05)",
                  border:      `1px solid ${pushToTalk ? "#A29BFE66" : "rgba(255,255,255,0.1)"}`,
                  cursor:      "pointer",
                  color:       pushToTalk ? "#A29BFE" : "#666",
                  fontSize:    11,
                  fontWeight:  700,
                }}>
                {pushToTalk ? <Volume2 size={13} /> : <RefreshCw size={13} />}
                {pushToTalk ? "PTT" : "Continuous"}
              </button>
            </div>

            {/* Main orb */}
            <VoiceOrb
              state={state}
              mode={mode}
              amplitude={amplitude}
              interimText={interimText}
              isSupported={isSupported}
              pushToTalk={pushToTalk}
              onToggle={onToggleListening}
              onPttStart={onPttStart}
              onPttEnd={onPttEnd}
              onInterrupt={onInterrupt}
              size={64}
            />

            {/* Last intent badge */}
            <div style={{
              width:       80,
              textAlign:   "right",
              display:     "flex",
              flexDirection: "column",
              alignItems:  "flex-end",
              gap:         4,
            }}>
              {lastIntent && (
                <>
                  <span style={{ fontSize: 9, color: "#555" }}>Detected</span>
                  <span style={{
                    fontSize:   10,
                    color:      cfg.color,
                    background: cfg.glow,
                    padding:    "2px 7px",
                    borderRadius: 6,
                    border:     `1px solid ${cfg.color}33`,
                    fontWeight: 700,
                  }}>
                    {INTENT_LABELS[lastIntent.intent] ?? lastIntent.intent}
                  </span>
                  <span style={{ fontSize: 9, color: "#555" }}>
                    {Math.round(lastIntent.confidence * 100)}%
                  </span>
                </>
              )}
            </div>
          </div>

          {/* PTT hint */}
          {pushToTalk && (
            <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 11, color: "#555" }}>
              Hold the orb to speak · Release to send
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
