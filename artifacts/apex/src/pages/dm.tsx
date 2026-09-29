import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConversations, useMessages } from "../hooks/useDM";
import { ConversationList } from "../components/dm/ConversationList";
import { ChatView } from "../components/dm/ChatView";
import { AnalyticsPanel } from "../components/dm/AnalyticsPanel";
import { useMetaStatus } from "../hooks/useDM";
import { MessageSquare, BarChart2, Plus, X, ChevronLeft } from "lucide-react";
import { SiInstagram, SiMessenger } from "react-icons/si";

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
      display: "flex", flexDirection: "column", height: "100%", flex: 1, minHeight: 0,
      background: "transparent", overflow: "hidden",
    }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{
          flexShrink: 0,
          padding: "10px 16px 12px",
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
                {/* Title — the fixed ☰ menu button sits in the 42px space on the left */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 42 }}>
                  <div style={{ width: 42, flexShrink: 0 }} aria-hidden />
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--mg-ink)", letterSpacing: "-0.02em", margin: 0, lineHeight: 1.1 }}>
                      Messages
                    </h1>
                    <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--mg-ink-3)", margin: "3px 0 0" }}>
                      <SiInstagram size={11} color="#E1306C" /> Instagram
                      <span aria-hidden>·</span>
                      <SiMessenger size={11} color="#0A7CFF" /> Messenger
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
                    { id: "inbox" as Tab,     icon: <MessageSquare style={{ width: 16, height: 16 }} />, label: "Inbox"  },
                    { id: "analytics" as Tab, icon: <BarChart2     style={{ width: 16, height: 16 }} />, label: "Stats"  },
                  ]).map(({ id, icon, label }) => (
                    <motion.button
                      key={id}
                      aria-label={label}
                      title={label}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setTab(id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: 8, borderRadius: 11,
                        fontSize: 10, fontWeight: 700,
                        background: tab === id ? "rgba(108,92,231,0.28)" : "transparent",
                        border: tab === id ? "1px solid rgba(162,155,254,0.30)" : "1px solid transparent",
                        color: tab === id ? "#A29BFE" : "rgba(255,255,255,0.32)",
                        cursor: "pointer",
                        transition: `all 0.18s ${IOS}`,
                        boxShadow: tab === id ? "0 0 12px rgba(108,92,231,0.22)" : "none",
                      }}
                    >
                      {icon}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Account connection card */}
              <AnimatePresence>
                {showMetaBanner && metaStatus && !metaStatus.configured && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mg-glass"
                    style={{ borderRadius: 22, padding: 14, display: "grid", gap: 10 }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--mg-ink)", margin: 0 }}>
                          Connect your inboxes
                        </p>
                        <p style={{ fontSize: 12, color: "var(--mg-ink-2)", margin: "3px 0 0", lineHeight: 1.45 }}>
                          Bring your Instagram and Facebook Messenger DMs into Apex. Until then, you can try it with demo conversations.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowMetaBanner(false)}
                        aria-label="Hide"
                        style={{ color: "var(--mg-ink-3)", cursor: "pointer", padding: 4, background: "none", border: "none" }}
                      >
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { name: "Instagram", Icon: SiInstagram, color: "#E1306C" },
                        { name: "Messenger", Icon: SiMessenger, color: "#0A7CFF" },
                      ].map(({ name, Icon, color }) => (
                        <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <Icon size={18} color={color} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--mg-ink)" }}>{name}</div>
                            <div style={{ fontSize: 11, color: "var(--mg-ink-3)" }}>Coming soon</div>
                          </div>
                        </div>
                      ))}
                    </div>
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
