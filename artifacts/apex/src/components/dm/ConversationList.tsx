import { useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimationControls } from "framer-motion";
import { type ConversationWithContact, type PersonalityMode } from "../../hooks/useDM";
import { ContactAvatar } from "./Avatar";
import { formatDistanceToNow } from "date-fns";

const IOS = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

const PERSONALITY_META: Record<PersonalityMode, { color: string; glow: string; emoji: string; mood: string }> = {
  smooth:    { color: "#8B5CF6", glow: "rgba(139,92,246,0.30)",  emoji: "😎", mood: "Smooth"    },
  funny:     { color: "#F59E0B", glow: "rgba(245,158,11,0.30)",  emoji: "😂", mood: "Playful"   },
  confident: { color: "#EF4444", glow: "rgba(239,68,68,0.30)",   emoji: "💪", mood: "Bold"      },
  chill:     { color: "#10B981", glow: "rgba(16,185,129,0.30)",  emoji: "🤙", mood: "Chill"     },
  romantic:  { color: "#EC4899", glow: "rgba(236,72,153,0.30)",  emoji: "💕", mood: "Romantic"  },
  custom:    { color: "#6366F1", glow: "rgba(99,102,241,0.30)",  emoji: "✨", mood: "Custom"    },
};

function PlatformBadge({ platform }: { platform: string }) {
  if (platform === "instagram") {
    return (
      <div title="Instagram" style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
        background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 8px rgba(220,39,67,0.40)",
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <circle cx="12" cy="12" r="4.5"/>
          <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/>
        </svg>
      </div>
    );
  }
  if (platform === "messenger") {
    return (
      <div title="Messenger" style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
        background: "linear-gradient(135deg, #0099FF, #A033FF)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 8px rgba(0,153,255,0.40)",
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17L5 22l3.19-1.73c.85.24 1.76.37 2.81.37 5.64 0 10-4.13 10-9.7C21 6.13 16.64 2 12 2zm1.1 13.1l-2.55-2.72-4.98 2.72 5.49-5.83 2.61 2.72 4.93-2.72-5.5 5.83z"/>
        </svg>
      </div>
    );
  }
  return null;
}

type FilterPlatform = "all" | "instagram" | "messenger" | "demo";

interface ConversationListProps {
  conversations: ConversationWithContact[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [filter, setFilter] = useState<FilterPlatform>("all");
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set());

  const filtered = conversations.filter(({ dm_conversations: conv, dm_contacts: contact }) => {
    if (archivedIds.has(conv.id)) return false;
    if (filter === "all") return true;
    return (contact?.platform ?? "demo") === filter;
  });

  const platformCounts: Record<string, number> = {};
  for (const { dm_contacts: c } of conversations) {
    const p = c?.platform ?? "demo";
    platformCounts[p] = (platformCounts[p] ?? 0) + 1;
  }

  if (!conversations.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "100%", gap: 16, padding: 32, textAlign: "center",
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(108,92,231,0.22), rgba(162,155,254,0.08))",
            border: "1px solid rgba(108,92,231,0.28)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
          }}
        >💬</motion.div>
        <div>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, fontWeight: 700, margin: 0 }}>
            No conversations yet
          </p>
          <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
            Connect Instagram or Messenger, or add a demo below
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Filter Chips ──────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: "8px 12px 6px",
        display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none",
      }}>
        {([
          { id: "all",       label: "All",       icon: null,   count: conversations.filter(c => !archivedIds.has(c.dm_conversations.id)).length },
          { id: "instagram", label: "Instagram", icon: "📸",   count: platformCounts["instagram"] ?? 0 },
          { id: "messenger", label: "Messenger", icon: "💬",   count: platformCounts["messenger"] ?? 0 },
          { id: "demo",      label: "Demo",      icon: "🎭",   count: platformCounts["demo"] ?? 0 },
        ] as const).filter(f => f.id === "all" || (f.count ?? 0) > 0).map(({ id, label, icon, count }) => (
          <motion.button
            key={id}
            whileTap={{ scale: 0.93 }}
            onClick={() => setFilter(id as FilterPlatform)}
            style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 99,
              fontSize: 10, fontWeight: 700,
              background: filter === id ? "rgba(108,92,231,0.22)" : "rgba(255,255,255,0.05)",
              border: filter === id ? "1px solid rgba(162,155,254,0.35)" : "1px solid rgba(255,255,255,0.08)",
              color: filter === id ? "#A29BFE" : "rgba(255,255,255,0.40)",
              transition: `all 0.18s ${IOS}`,
              cursor: "pointer",
            }}
          >
            {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
            {label}
            {count > 0 && (
              <span style={{
                padding: "1px 5px", borderRadius: 99, fontSize: 8, fontWeight: 800,
                background: filter === id ? "rgba(108,92,231,0.35)" : "rgba(255,255,255,0.10)",
                color: filter === id ? "#C4BFFF" : "rgba(255,255,255,0.40)",
              }}>{count}</span>
            )}
          </motion.button>
        ))}
      </div>

      {/* ── Conversation Items ────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px 8px", scrollbarWidth: "none" }}>
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty-filter"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ padding: "40px 0", textAlign: "center", color: "rgba(255,255,255,0.28)", fontSize: 12 }}
            >
              No {filter} conversations
            </motion.div>
          ) : (
            filtered.map(({ dm_conversations: conv, dm_contacts: contact }, idx) => {
              if (!contact) return null;
              return (
                <SwipeableConvoRow
                  key={conv.id}
                  conv={conv}
                  contact={contact}
                  isSelected={selectedId === conv.id}
                  onSelect={() => onSelect(conv.id)}
                  onArchive={() => setArchivedIds(prev => new Set([...prev, conv.id]))}
                  delay={idx * 0.04}
                />
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Swipeable row ─────────────────────────────────────────────────────────────

function SwipeableConvoRow({
  conv, contact, isSelected, onSelect, onArchive, delay,
}: {
  conv: ConversationWithContact["dm_conversations"];
  contact: NonNullable<ConversationWithContact["dm_contacts"]>;
  isSelected: boolean;
  onSelect: () => void;
  onArchive: () => void;
  delay: number;
}) {
  const x = useMotionValue(0);
  const archiveOpacity = useTransform(x, [-80, -40], [1, 0]);
  const archiveBg = useTransform(x, [-80, 0], ["rgba(239,68,68,0.22)", "rgba(239,68,68,0.00)"]);
  const controls = useAnimationControls();
  const archiveThreshold = -72;

  const mode = conv.personalityMode as PersonalityMode;
  const meta = PERSONALITY_META[mode] ?? PERSONALITY_META.custom;

  const lastActive = conv.lastMessageAt
    ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })
    : "";

  // Online status requires a real-time presence system (WebSocket-based).
  // Until that is implemented, show offline rather than fabricate random state.
  const isOnline = false;

  async function handleDragEnd() {
    if (x.get() < archiveThreshold) {
      await controls.start({ x: -300, opacity: 0, transition: { duration: 0.28 } });
      onArchive();
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60, scale: 0.94 }}
      transition={{ delay, duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ position: "relative", marginBottom: 3, borderRadius: 20, overflow: "hidden" }}
    >
      {/* Archive reveal */}
      <motion.div style={{
        position: "absolute", inset: 0, borderRadius: 20,
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        paddingRight: 20, background: archiveBg, zIndex: 0,
      }}>
        <motion.div style={{ opacity: archiveOpacity, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 18 }}>🗄️</span>
          <span style={{ fontSize: 8, fontWeight: 700, color: "#EF4444" }}>Archive</span>
        </motion.div>
      </motion.div>

      {/* Row */}
      <motion.button
        drag="x"
        dragConstraints={{ right: 0, left: -100 }}
        dragElastic={{ left: 0.3, right: 0 }}
        style={{ x, position: "relative", zIndex: 1, width: "100%", textAlign: "left" }}
        animate={controls}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.985 }}
        onClick={onSelect}
        layout
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 13,
          padding: "11px 13px", borderRadius: 20,
          background: isSelected
            ? `linear-gradient(135deg, ${meta.color}14, ${meta.color}06)`
            : "rgba(255,255,255,0.03)",
          border: isSelected
            ? `1px solid ${meta.color}38`
            : "1px solid rgba(255,255,255,0.06)",
          boxShadow: isSelected
            ? `0 0 22px ${meta.glow}, 0 4px 18px rgba(0,0,0,0.25)`
            : "none",
          transition: `background 0.22s ${IOS}, border-color 0.22s ${IOS}, box-shadow 0.22s ${IOS}`,
          cursor: "pointer",
        }}>

          {/* Avatar + online dot */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              borderRadius: "50%",
              padding: isSelected ? 2.5 : 0,
              background: isSelected
                ? `linear-gradient(135deg, ${meta.color}, ${meta.color}88)`
                : "transparent",
              transition: `padding 0.22s ${IOS}`,
            }}>
              <ContactAvatar name={contact.displayName ?? contact.username} size={48} />
            </div>
            {/* Online indicator */}
            <div style={{
              position: "absolute", bottom: 0, right: isSelected ? 3 : 0,
              width: 11, height: 11, borderRadius: "50%",
              background: isOnline ? "#10B981" : "rgba(255,255,255,0.18)",
              border: "2.5px solid #08090F",
              transition: `all 0.22s ${IOS}`,
              boxShadow: isOnline ? "0 0 6px rgba(16,185,129,0.70)" : "none",
            }} />
            {/* Auto-reply bolt */}
            {conv.autoReplyEnabled && (
              <div style={{
                position: "absolute", top: -3, right: isSelected ? 3 : 0,
                width: 14, height: 14, borderRadius: "50%",
                background: "#10B981", border: "2px solid #08090F",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7,
              }}>⚡</div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                {/* Platform badge */}
                <PlatformBadge platform={contact.platform} />
                <span style={{
                  fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em",
                  color: isSelected ? "white" : "rgba(255,255,255,0.88)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {contact.displayName ?? contact.username}
                </span>
              </div>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", flexShrink: 0, marginLeft: 8 }}>
                {lastActive}
              </span>
            </div>

            {/* Preview + badges row */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1, minWidth: 0,
              }}>
                {isOnline
                  ? <span style={{ color: "#10B981", fontWeight: 500 }}>Active now</span>
                  : `${meta.emoji} ${meta.mood} mode`}
              </span>

              {/* Unread count */}
              {conv.unreadCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  style={{
                    flexShrink: 0,
                    minWidth: 18, height: 18, borderRadius: 99, padding: "0 5px",
                    background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 900, color: "white",
                    boxShadow: "0 0 10px rgba(108,92,231,0.60)",
                  }}
                >{conv.unreadCount}</motion.div>
              )}
            </div>
          </div>

          {/* Selection dot */}
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              style={{
                flexShrink: 0, width: 7, height: 7, borderRadius: "50%",
                background: meta.color, boxShadow: `0 0 8px ${meta.color}`,
              }}
            />
          )}
        </div>
      </motion.button>
    </motion.div>
  );
}
