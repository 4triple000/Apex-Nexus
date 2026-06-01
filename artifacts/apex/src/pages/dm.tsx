import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConversations, useMessages } from "../hooks/useDM";
import { ConversationList } from "../components/dm/ConversationList";
import { ChatView } from "../components/dm/ChatView";
import { AnalyticsPanel } from "../components/dm/AnalyticsPanel";
import { useMetaStatus } from "../hooks/useDM";
import { MessageSquare, BarChart2, Plus, X, ChevronLeft } from "lucide-react";
import { ApexLogo } from "@/components/ui/ApexLogo";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = { type: "spring" as const, stiffness: 340, damping: 30 };

type Tab = "inbox" | "analytics";

export function DMPage() {
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [tab, setTab]                       = useState<Tab>("inbox");
  const [showMetaBanner, setShowMetaBanner] = useState(true);

  const { data: conversations = [], isLoading } = useConversations();
  const { data: messages = [] }                 = useMessages(selectedConvId);
  const { data: metaStatus }                    = useMetaStatus();

  const selectedConvData = conversations.find(c => c.dm_conversations.id === selectedConvId);
  const conversation     = selectedConvData?.dm_conversations;
  const contact          = selectedConvData?.dm_contacts;

  function goBack() { setSelectedConvId(null); }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#07080E", overflow: "hidden",
    }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{
          flexShrink: 0,
          background: "rgba(7,8,14,0.98)",
          backdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "14px 14px 10px",
        }}
      >
        <AnimatePresence mode="wait">
          {selectedConvId && conversation && contact ? (
            /* ── Chat sub-header ── */
            <motion.div
              key="chat-header"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={SPRING}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={goBack}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 13, fontWeight: 700, color: "#A29BFE",
                  cursor: "pointer", padding: "6px 10px", borderRadius: 99,
                  background: "rgba(108,92,231,0.12)",
                  border: "1px solid rgba(108,92,231,0.22)",
                  transition: `all 0.18s ${IOS}`,
                }}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
                Inbox
              </motion.button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                  {contact.displayName ?? contact.username}
                </p>
              </div>
            </motion.div>
          ) : (
            /* ── Inbox header ── */
            <motion.div
              key="inbox-header"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={SPRING}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                {/* Brand */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ApexLogo size={30} state="idle" radius={9} />
                  <div>
                    <h1 style={{ fontSize: 18, fontWeight: 900, color: "white", letterSpacing: "-0.02em", margin: 0, lineHeight: 1 }}>
                      Conversations
                    </h1>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.14em", textTransform: "uppercase", margin: "3px 0 0" }}>
                      Apex · AI Messaging
                    </p>
                  </div>
                </div>

                {/* Tab switcher */}
                <div style={{
                  display: "flex", gap: 3, padding: 4, borderRadius: 14,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  {([
                    { id: "inbox" as Tab,     icon: <MessageSquare style={{ width: 12, height: 12 }} />, label: "Inbox"  },
                    { id: "analytics" as Tab, icon: <BarChart2     style={{ width: 12, height: 12 }} />, label: "Stats"  },
                  ]).map(({ id, icon, label }) => (
                    <motion.button
                      key={id}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setTab(id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "6px 10px", borderRadius: 11,
                        fontSize: 10, fontWeight: 700,
                        background: tab === id ? "rgba(108,92,231,0.28)" : "transparent",
                        border: tab === id ? "1px solid rgba(162,155,254,0.30)" : "1px solid transparent",
                        color: tab === id ? "#A29BFE" : "rgba(255,255,255,0.32)",
                        cursor: "pointer",
                        transition: `all 0.18s ${IOS}`,
                        boxShadow: tab === id ? "0 0 12px rgba(108,92,231,0.22)" : "none",
                      }}
                    >
                      {icon}{label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Meta connection banner */}
              <AnimatePresence>
                {showMetaBanner && metaStatus && !metaStatus.configured && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 13px", borderRadius: 16,
                      background: "rgba(34,139,230,0.07)",
                      border: "1px solid rgba(34,139,230,0.20)",
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>📱</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#60A5FA", margin: 0 }}>
                        Connect Instagram or Messenger
                      </p>
                      <p style={{ fontSize: 10, color: "rgba(96,165,250,0.50)", margin: "2px 0 0", lineHeight: 1.4 }}>
                        Add META_APP_ID + META_APP_SECRET to activate real DMs
                      </p>
                    </div>
                    <button
                      onClick={() => setShowMetaBanner(false)}
                      style={{ color: "rgba(255,255,255,0.22)", cursor: "pointer", padding: 4 }}
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <AnimatePresence>
          {/* Analytics */}
          {tab === "analytics" && !selectedConvId && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: "absolute", inset: 0, overflowY: "auto" }}
            >
              <AnalyticsPanel />
            </motion.div>
          )}
        </AnimatePresence>

        {tab === "inbox" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", overflow: "hidden" }}>

            {/* ── Conversation list ─────────────────────────────── */}
            <AnimatePresence mode="popLayout">
              {!selectedConvId && (
                <motion.div
                  key="conv-list"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={SPRING}
                  style={{ width: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}
                >
                  {isLoading ? (
                    <div style={{
                      flex: 1, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 10, padding: "0 14px",
                    }}>
                      {[0.85, 1, 0.70].map((w, i) => (
                        <motion.div
                          key={i}
                          animate={{ opacity: [0.4, 0.8, 0.4] }}
                          transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
                          style={{
                            height: 72, borderRadius: 22,
                            background: "rgba(255,255,255,0.05)",
                            width: `${w * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <ConversationList
                          conversations={conversations}
                          selectedId={selectedConvId}
                          onSelect={setSelectedConvId}
                        />
                      </div>
                      <div style={{
                        flexShrink: 0,
                        padding: "10px 12px 16px",
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                      }}>
                        <AddDemoButton />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Chat view ─────────────────────────────────────── */}
            <AnimatePresence>
              {selectedConvId && conversation && contact && (
                <motion.div
                  key={`chat-${selectedConvId}`}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={SPRING}
                  style={{ position: "absolute", inset: 0 }}
                >
                  <ChatView
                    conversation={conversation}
                    contact={contact}
                    messages={messages}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Demo Button ───────────────────────────────────────────────────────────
function AddDemoButton() {
  const [loading, setLoading] = useState(false);
  const [added, setAdded]     = useState(false);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function addDemo() {
    setLoading(true);
    try {
      await fetch(`${BASE}api/dm/seed-demo`, { method: "POST" });
      setAdded(true);
      window.location.reload();
    } catch {
      setLoading(false);
    }
  }

  if (added) return null;

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={addDemo}
      disabled={loading}
      style={{
        width: "100%", padding: "12px", borderRadius: 18,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        background: "rgba(108,92,231,0.10)",
        border: "1px dashed rgba(108,92,231,0.30)",
        fontSize: 11, fontWeight: 700, color: "#A29BFE",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        transition: `all 0.20s ${IOS}`,
      }}
    >
      <Plus style={{ width: 13, height: 13 }} />
      {loading ? "Adding…" : "Add Demo Conversations"}
    </motion.button>
  );
}
