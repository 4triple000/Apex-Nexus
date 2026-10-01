import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import type { DmContact, DmConversation, DmMessage, PersonalityMode } from "../../hooks/useDM";
import { ContactAvatar } from "./Avatar";
import { useSendMessage, useTypingAssist, useGenerateReply } from "../../hooks/useDM";
import { getGlobalSystemPrompt } from "@/lib/personalityEngine";
import { AIToolbar } from "./AIToolbar";
import { AISuggestBar } from "./AISuggestBar";
import { IntelligencePanel } from "./IntelligencePanel";
import { ShareMessage } from "./ShareMessage";
import { formatDistanceToNow } from "date-fns";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function PlatformBadge({ platform }: { platform: string }) {
  if (platform === "instagram") {
    return (
      <span style={{
        fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
        background: "linear-gradient(45deg, #f09433, #dc2743, #bc1888)",
        color: "white", letterSpacing: "0.03em",
      }}>Instagram</span>
    );
  }
  if (platform === "messenger") {
    return (
      <span style={{
        fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
        background: "linear-gradient(135deg, #0099FF, #A033FF)",
        color: "white", letterSpacing: "0.03em",
      }}>Messenger</span>
    );
  }
  return null;
}

// ── Long-press hook ───────────────────────────────────────────────────────────
function useLongPress(callback: () => void, ms = 480) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const start = useCallback(() => {
    timerRef.current = setTimeout(callback, ms);
  }, [callback, ms]);
  const stop = useCallback(() => clearTimeout(timerRef.current), []);
  return { onMouseDown: start, onMouseUp: stop, onMouseLeave: stop, onTouchStart: start, onTouchEnd: stop };
}

// ── Message bubble ────────────────────────────────────────────────────────────
interface BubbleProps {
  msg: DmMessage;
  contactName: string;
  conversationId: number;
  personalityMode: string;
  contextMessages: { direction: string; content: string }[];
  lastInbound: string | null;
  onShare: () => void;
  onInsertReply: (text: string) => void;
  isFirst: boolean;
}

function MessageBubble({
  msg, contactName, conversationId, personalityMode, contextMessages, lastInbound,
  onShare, onInsertReply, isFirst,
}: BubbleProps) {
  const isOut = msg.direction === "outbound";
  const [showActions, setShowActions] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const generateReply = useGenerateReply();

  const longPress = useLongPress(() => {
    if (isOut) setShowActions(true);
  });

  async function handleRegen() {
    if (!lastInbound) return;
    setRegenLoading(true);
    try {
      const result = await generateReply.mutateAsync({
        conversationId,
        lastMessage: lastInbound,
        personalityMode,
        contextMessages,
        customPrompt: getGlobalSystemPrompt(),
      });
      onInsertReply(result.reply);
    } finally {
      setRegenLoading(false);
      setShowActions(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        display: "flex",
        justifyContent: isOut ? "flex-end" : "flex-start",
      }}
    >
      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 4 }}>
        <motion.div
          whileTap={{ scale: 0.97 }}
          {...longPress}
          style={{
            padding: "11px 15px",
            borderRadius: isOut ? "20px 20px 5px 20px" : "20px 20px 20px 5px",
            fontSize: 14, lineHeight: 1.55,
            cursor: isOut ? "pointer" : "default",
            userSelect: "none",
            ...(isOut ? {
              background: "linear-gradient(135deg, #6C5CE7, #8B78F5)",
              color: "white",
              boxShadow: "0 4px 18px rgba(108,92,231,0.42), 0 2px 8px rgba(0,0,0,0.30)",
            } : {
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.11)",
              color: "rgba(255,255,255,0.92)",
              boxShadow: "0 4px 18px rgba(0,0,0,0.20)",
            }),
          }}
          onClick={() => isOut && setShowActions(p => !p)}
        >
          {msg.content}
        </motion.div>

        {/* Meta row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          justifyContent: isOut ? "flex-end" : "flex-start",
          paddingInline: 4,
        }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.20)" }}>
            {formatDistanceToNow(new Date(msg.sentAt), { addSuffix: true })}
          </span>
          {msg.aiGenerated && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              style={{
                fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 99,
                background: "rgba(108,92,231,0.20)", border: "1px solid rgba(162,155,254,0.35)",
                color: "#A29BFE", letterSpacing: "0.05em",
              }}
            >✦ AI</motion.span>
          )}
          {msg.replyScore != null && (
            <span style={{
              fontSize: 10, fontWeight: 800,
              color: msg.replyScore >= 80 ? "#10B981" : msg.replyScore >= 60 ? "#F59E0B" : "#EF4444",
            }}>{msg.replyScore}%</span>
          )}
          {isOut && (
            <button
              onClick={onShare}
              style={{
                fontSize: 10, color: "rgba(255,255,255,0.18)", cursor: "pointer",
                transition: `color 0.15s ease`, padding: "0 2px",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.18)")}
            >↗</button>
          )}
          {/* Read ticks for outbound */}
          {isOut && (
            <span style={{ fontSize: 10, color: "rgba(162,155,254,0.55)" }}>✓✓</span>
          )}
        </div>

        {/* Long-press action sheet */}
        <AnimatePresence>
          {showActions && isOut && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              transition={{ duration: 0.2 }}
              style={{
                alignSelf: "flex-end",
                display: "flex", gap: 6,
              }}
            >
              <button
                onClick={handleRegen}
                disabled={regenLoading}
                style={{
                  fontSize: 10, padding: "5px 11px", borderRadius: 99,
                  background: "rgba(108,92,231,0.20)",
                  border: "1px solid rgba(108,92,231,0.38)",
                  color: "#A29BFE", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                  transition: `all 0.15s ${IOS}`,
                }}
              >
                {regenLoading
                  ? <><span style={{ animation: "pulse 1s infinite" }}>⏳</span> Writing…</>
                  : <>🔄 Regenerate</>}
              </button>
              <button
                onClick={() => { setShowActions(false); onShare(); }}
                style={{
                  fontSize: 10, padding: "5px 11px", borderRadius: 99,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.50)", cursor: "pointer",
                  transition: `all 0.15s ${IOS}`,
                }}
              >📤 Share</button>
              <button
                onClick={() => setShowActions(false)}
                style={{
                  fontSize: 10, padding: "5px 10px", borderRadius: 99,
                  background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.25)", cursor: "pointer",
                }}
              >✕</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "11px 16px", borderRadius: "20px 20px 20px 5px",
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(16px)",
      }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.8, delay: i * 0.18, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 6, height: 6, borderRadius: "50%", background: "#A29BFE" }}
          />
        ))}
      </div>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>
        Apex thinking…
      </span>
    </motion.div>
  );
}

// ── Inline suggestion chips ────────────────────────────────────────────────────
function SuggestionChips({
  suggestions, onSelect, onDismiss,
}: { suggestions: string[]; onSelect: (s: string) => void; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{
        flexShrink: 0, padding: "6px 14px 4px",
        display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>✨</span>
      {suggestions.map((s, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => onSelect(s)}
          style={{
            flexShrink: 0, fontSize: 11, padding: "6px 13px", borderRadius: 99,
            background: "rgba(108,92,231,0.15)", border: "1px solid rgba(108,92,231,0.28)",
            color: "#A29BFE", cursor: "pointer",
            maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >{s}</motion.button>
      ))}
      <button
        onClick={onDismiss}
        style={{ flexShrink: 0, fontSize: 9, color: "rgba(255,255,255,0.22)", cursor: "pointer", padding: "0 4px" }}
      >✕</button>
    </motion.div>
  );
}

// ── ChatView ──────────────────────────────────────────────────────────────────
interface ChatViewProps {
  conversation: DmConversation;
  contact: DmContact;
  messages: DmMessage[];
}

type ChatPanel = "chat" | "intelligence" | "ai-deck";

export function ChatView({ conversation, contact, messages }: ChatViewProps) {
  const [draft, setDraft]           = useState("");
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [showSuggest, setShowSuggest]   = useState(false);
  const [aiAssist, setAiAssist]         = useState(true);
  const [activePanel, setActivePanel]   = useState<ChatPanel>("chat");
  const [shareMsg, setShareMsg]         = useState<DmMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const suggestTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const sendMessage  = useSendMessage();
  const typingAssist = useTypingAssist();

  const lastInbound    = [...messages].reverse().find(m => m.direction === "inbound");
  const isSending      = sendMessage.isPending;
  const contextMessages = messages.slice(-12).map(m => ({ direction: m.direction, content: m.content }));

  useEffect(() => {
    if (activePanel === "chat") {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [messages, activePanel]);

  async function handleSend(isAI = false) {
    if (!draft.trim()) return;
    await sendMessage.mutateAsync({ conversationId: conversation.id, content: draft.trim(), aiGenerated: isAI });
    setDraft("");
    setSuggestions([]);
    setShowSuggest(false);
    const ta = inputRef.current;
    if (ta) { ta.style.height = "auto"; }
  }

  function handleInsertReply(text: string) {
    setDraft(text);
    setShowSuggest(false);
    setActivePanel("chat");
    setTimeout(() => inputRef.current?.focus(), 50);
    const ta = inputRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  async function handleDraftChange(value: string) {
    setDraft(value);
    clearTimeout(suggestTimeout.current);
    if (!aiAssist || value.length < 4 || !lastInbound) {
      setSuggestions([]); setShowSuggest(false); return;
    }
    suggestTimeout.current = setTimeout(async () => {
      const result = await typingAssist.mutateAsync({
        draft: value, lastMessage: lastInbound.content, personalityMode: conversation.personalityMode,
        customPrompt: getGlobalSystemPrompt(),
      });
      if (result.suggestions?.length) { setSuggestions(result.suggestions); setShowSuggest(true); }
    }, 700);
  }

  const TABS = [
    { id: "chat" as ChatPanel,          icon: "💬", label: "Chat" },
    { id: "intelligence" as ChatPanel,  icon: "🧠", label: "Intel" },
    { id: "ai-deck" as ChatPanel,       icon: "✨", label: "AI Deck" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "transparent", overflow: "hidden" }}>

      {/* ── Chat Header ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          flexShrink: 0, padding: "12px 14px 10px",
          background: "rgba(14,12,32,0.55)", backdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        {/* Avatar + online status */}
        <div style={{ position: "relative" }}>
          <ContactAvatar name={contact.displayName ?? contact.username} size={42} />
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            style={{
              position: "absolute", bottom: 0, right: 0,
              width: 11, height: 11, borderRadius: "50%",
              background: "#10B981", border: "2.5px solid #08090F",
              boxShadow: "0 0 8px rgba(16,185,129,0.70)",
            }}
          />
        </div>

        {/* Name + platform */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "white", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {contact.displayName ?? contact.username}
            </span>
            <PlatformBadge platform={contact.platform} />
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>
            {contact.platform === "demo" ? "Demo contact" : `@${contact.username}`}
            {conversation.autoReplyEnabled && (
              <span style={{ marginLeft: 6, color: "#10B981" }}>· Auto ⚡</span>
            )}
          </p>
        </div>

        {/* Panel tabs */}
        <div style={{
          display: "flex", gap: 3, padding: 4, borderRadius: 14,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
        }}>
          {TABS.map(({ id, icon }) => (
            <motion.button
              key={id}
              whileTap={{ scale: 0.90 }}
              onClick={() => setActivePanel(id)}
              style={{
                padding: "5px 9px", borderRadius: 10, fontSize: 14,
                background: activePanel === id ? "rgba(108,92,231,0.30)" : "transparent",
                border: activePanel === id ? "1px solid rgba(162,155,254,0.35)" : "1px solid transparent",
                boxShadow: activePanel === id ? "0 0 12px rgba(108,92,231,0.25)" : "none",
                cursor: "pointer", transition: `all 0.18s ${IOS}`,
              }}
            >{icon}</motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Intelligence Panel ─────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activePanel === "intelligence" && (
          <motion.div
            key="intel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.24 }}
            style={{ flex: 1, overflowY: "auto" }}
          >
            <IntelligencePanel conversationId={conversation.id} messages={messages} />
          </motion.div>
        )}

        {/* ── AI Deck ──────────────────────────────────────────── */}
        {activePanel === "ai-deck" && (
          <motion.div
            key="ai-deck"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.24 }}
            style={{ flex: 1, overflowY: "auto", padding: "0 0 12px" }}
          >
            <AIToolbar
              conversationId={conversation.id}
              personalityMode={conversation.personalityMode as PersonalityMode}
              situationMode={conversation.situationMode}
              autoReplyEnabled={conversation.autoReplyEnabled}
              messages={messages}
              onInsertReply={(text) => { handleInsertReply(text); setActivePanel("chat"); }}
            />
          </motion.div>
        )}

        {/* ── Chat Panel ───────────────────────────────────────── */}
        {activePanel === "chat" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.20 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}
          >
            {/* Messages area */}
            <div style={{
              flex: 1, overflowY: "auto",
              padding: "14px 14px 8px",
              display: "flex", flexDirection: "column", gap: 8,
              scrollbarWidth: "none",
            }}>
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", height: "100%", gap: 16,
                  }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      width: 72, height: 72, borderRadius: "50%",
                      background: "linear-gradient(135deg, rgba(108,92,231,0.22), rgba(108,92,231,0.06))",
                      border: "1px solid rgba(108,92,231,0.24)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30,
                    }}
                  >💬</motion.div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: 600, margin: 0 }}>
                      No messages yet
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                      Tap ✨ AI Deck for a perfect opener
                    </p>
                  </div>
                </motion.div>
              ) : (
                messages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    contactName={contact.displayName ?? contact.username}
                    conversationId={conversation.id}
                    personalityMode={conversation.personalityMode}
                    contextMessages={contextMessages}
                    lastInbound={lastInbound?.content ?? null}
                    onShare={() => setShareMsg(msg)}
                    onInsertReply={handleInsertReply}
                    isFirst={idx === 0}
                  />
                ))
              )}
              <AnimatePresence>
                {isSending && <TypingIndicator />}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* ── AI Suggest Bar (hero feature) ─────────────────── */}
            <AISuggestBar
              conversationId={conversation.id}
              lastInboundMessage={lastInbound?.content ?? null}
              contextMessages={contextMessages}
              onInsert={handleInsertReply}
              visible={!!lastInbound && messages.length > 0}
            />

            {/* ── Typing assist chips ────────────────────────────── */}
            <AnimatePresence>
              {showSuggest && suggestions.length > 0 && (
                <SuggestionChips
                  suggestions={suggestions}
                  onSelect={(s) => { handleInsertReply(s); setShowSuggest(false); }}
                  onDismiss={() => setShowSuggest(false)}
                />
              )}
            </AnimatePresence>

            {/* ── Message Input ─────────────────────────────────── */}
            <div className="apex-dock" style={{
              flexShrink: 0, padding: "8px 12px 14px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}>
              {/* AI Assist toggle strip */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 8, paddingInline: 2,
              }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontWeight: 600, letterSpacing: "0.08em" }}>
                  {draft.length > 0 ? `${draft.length} chars` : "Message"}
                </span>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setAiAssist(p => !p)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "3px 9px", borderRadius: 99, cursor: "pointer",
                    background: aiAssist ? "rgba(108,92,231,0.18)" : "rgba(255,255,255,0.05)",
                    border: aiAssist ? "1px solid rgba(108,92,231,0.35)" : "1px solid rgba(255,255,255,0.08)",
                    fontSize: 9, fontWeight: 700,
                    color: aiAssist ? "#A29BFE" : "rgba(255,255,255,0.30)",
                    transition: `all 0.20s ${IOS}`,
                    boxShadow: aiAssist ? "0 0 10px rgba(108,92,231,0.25)" : "none",
                  }}
                >
                  <span style={{ fontSize: 10 }}>✨</span>
                  AI Assist {aiAssist ? "ON" : "OFF"}
                </motion.button>
              </div>

              {/* Input field */}
              <div style={{
                display: "flex", alignItems: "flex-end", gap: 8,
                padding: "10px 10px 10px 16px", borderRadius: 26,
                background: "rgba(20,16,36,0.98)",
                border: `1px solid ${draft.trim() ? "rgba(108,92,231,0.38)" : "rgba(255,255,255,0.09)"}`,
                boxShadow: draft.trim() ? "0 0 0 3px rgba(108,92,231,0.10)" : "none",
                transition: `all 0.25s ${IOS}`,
              }}>
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={e => handleDraftChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  rows={1}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    resize: "none", maxHeight: 120, minHeight: 32,
                    fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.92)",
                    caretColor: "#A29BFE", padding: "4px 0", fontFamily: "inherit",
                    scrollbarWidth: "none",
                  }}
                  onInput={e => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
                  }}
                />

                {/* Send button */}
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  animate={{
                    scale: draft.trim() ? 1.04 : 1,
                    boxShadow: draft.trim() ? "0 4px 18px rgba(108,92,231,0.50)" : "none",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  onClick={() => void handleSend()}
                  disabled={!draft.trim() || isSending}
                  style={{
                    flexShrink: 0, width: 40, height: 40, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: draft.trim() && !isSending
                      ? "linear-gradient(135deg, #6C5CE7, #A29BFE)"
                      : "rgba(255,255,255,0.07)",
                    border: "none",
                    cursor: draft.trim() && !isSending ? "pointer" : "not-allowed",
                    opacity: isSending ? 0.6 : 1,
                  }}
                >
                  {isSending ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      style={{
                        width: 16, height: 16, borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.30)", borderTopColor: "white",
                      }}
                    />
                  ) : (
                    <svg style={{ width: 16, height: 16, color: "white" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share modal */}
      {shareMsg && (
        <ShareMessage
          message={shareMsg.content}
          score={shareMsg.replyScore ?? undefined}
          personalityMode={conversation.personalityMode}
          contactName={contact.displayName ?? contact.username}
          onClose={() => setShareMsg(null)}
        />
      )}
    </div>
  );
}
