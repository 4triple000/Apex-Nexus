/**
 * AISuggestBar — The Hero Feature
 *
 * Three styled AI reply buttons (Smooth / Funny / Bold) that slide up above the input.
 * Tapping any inserts the generated reply into the draft — never auto-sends.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGenerateReply } from "../../hooks/useDM";
import { getGlobalSystemPrompt } from "@/lib/personalityEngine";

const IOS = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

const REPLY_STYLES = [
  { mode: "smooth",    label: "Smooth",  emoji: "😏", color: "#8B5CF6", glow: "rgba(139,92,246,0.50)" },
  { mode: "funny",     label: "Funny",   emoji: "😂", color: "#F59E0B", glow: "rgba(245,158,11,0.50)" },
  { mode: "confident", label: "Bold",    emoji: "🔥", color: "#EF4444", glow: "rgba(239,68,68,0.50)"  },
] as const;

interface AISuggestBarProps {
  conversationId: number;
  lastInboundMessage: string | null;
  contextMessages: { direction: string; content: string }[];
  onInsert: (text: string) => void;
  visible: boolean;
}

export function AISuggestBar({
  conversationId, lastInboundMessage, contextMessages, onInsert, visible,
}: AISuggestBarProps) {
  const [loadingMode, setLoadingMode] = useState<string | null>(null);
  const [lastReply, setLastReply] = useState<{ mode: string; text: string } | null>(null);

  const generateReply = useGenerateReply();

  async function handleGenerate(mode: typeof REPLY_STYLES[number]["mode"]) {
    if (!lastInboundMessage || loadingMode) return;
    setLoadingMode(mode);
    try {
      const result = await generateReply.mutateAsync({
        conversationId,
        lastMessage: lastInboundMessage,
        personalityMode: mode,
        contextMessages,
        customPrompt: getGlobalSystemPrompt(),
      });
      setLastReply({ mode, text: result.reply });
      onInsert(result.reply);
    } finally {
      setLoadingMode(null);
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="ai-suggest-bar"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.26, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ flexShrink: 0, padding: "10px 14px 8px" }}
        >
          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
                boxShadow: "0 0 8px rgba(108,92,231,0.80)",
              }}
            />
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
              background: "linear-gradient(90deg, #A29BFE, #FD79A8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>AI Reply Suggestions</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.20)", marginLeft: "auto" }}>
              tap to insert
            </span>
          </div>

          {/* 3 Suggestion Buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {REPLY_STYLES.map(({ mode, label, emoji, color, glow }) => {
              const isLoading = loadingMode === mode;
              const wasUsed = lastReply?.mode === mode;

              return (
                <motion.button
                  key={mode}
                  whileTap={{ scale: 0.93 }}
                  whileHover={{ scale: 1.03 }}
                  onClick={() => void handleGenerate(mode)}
                  disabled={!!loadingMode || !lastInboundMessage}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    padding: "11px 8px", borderRadius: 16,
                    background: wasUsed
                      ? `${color}18`
                      : isLoading
                        ? `${color}12`
                        : "rgba(255,255,255,0.04)",
                    border: wasUsed
                      ? `1px solid ${color}45`
                      : isLoading
                        ? `1px solid ${color}30`
                        : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: wasUsed ? `0 0 18px ${glow}` : isLoading ? `0 0 10px ${glow}` : "none",
                    cursor: loadingMode || !lastInboundMessage ? "not-allowed" : "pointer",
                    opacity: !lastInboundMessage ? 0.4 : 1,
                    transition: `all 0.22s ${IOS}`,
                  }}
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                      style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        border: `2px solid ${color}30`,
                        borderTopColor: color,
                      }} />
                    </motion.div>
                  ) : (
                    <span style={{ fontSize: 22, filter: wasUsed ? `drop-shadow(0 0 8px ${color})` : "none" }}>
                      {emoji}
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    color: wasUsed ? color : isLoading ? color : "rgba(255,255,255,0.60)",
                    letterSpacing: "0.02em",
                  }}>{isLoading ? "Writing…" : label}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{
            marginTop: 10,
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
