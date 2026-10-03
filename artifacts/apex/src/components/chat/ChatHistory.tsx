/**
 * Your saved AI conversations: open one to keep going, start a new chat, rename or delete.
 * Conversations are stored on your account (GET /api/chat/conversations), so they follow you between devices.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, Trash2, Pencil, Loader2, History } from "lucide-react";
import { Sheet } from "@/components/social/ui";
import { authHeaders } from "@/lib/authSession";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface SavedMessage { id: number; role: string; content: string; provider: string | null; model: string | null; createdAt: string }
interface ConversationRow { id: number; title: string; updatedAt: string; preview: string }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers: { "Content-Type": "application/json", ...authHeaders(), ...init?.headers } });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Something went wrong (${res.status})`);
  return json.data as T;
}

export const loadConversation = (id: number) => api<{ conversation: { id: number; title: string }; messages: SavedMessage[] }>(`/chat/conversations/${id}`);

/** "5 min ago", "Yesterday", "Mar 4" */
function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Round glass button that opens the history. */
export function HistoryButton({ onClick, size = 40 }: { onClick: () => void; size?: number }) {
  return (
    <button onClick={onClick} aria-label="Chat history" className="mg-glass mg-press mg-focus"
      style={{ width: size, height: size, borderRadius: "50%", cursor: "pointer", display: "grid", placeItems: "center", padding: 0, color: "var(--mg-ink)", flexShrink: 0 }}>
      <History size={17} />
    </button>
  );
}

export function ChatHistorySheet({ open, onClose, activeId, onOpenConversation, onNewChat }: {
  open: boolean;
  onClose: () => void;
  activeId: number | null;
  onOpenConversation: (id: number) => void;
  onNewChat: () => void;
}) {
  const qc = useQueryClient();
  const [renaming, setRenaming] = useState<{ id: number; title: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const list = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: () => api<{ conversations: ConversationRow[] }>("/chat/conversations").then((d) => d.conversations),
    enabled: open,
    staleTime: 10_000,
  });

  const remove = async (c: ConversationRow) => {
    if (!window.confirm(`Delete "${c.title}"? This can't be undone.`)) return;
    setBusy(c.id);
    try {
      await api(`/chat/conversations/${c.id}`, { method: "DELETE" });
      qc.setQueryData<ConversationRow[]>(["chat-conversations"], (old) => old?.filter((x) => x.id !== c.id));
      if (c.id === activeId) onNewChat();
    } finally { setBusy(null); }
  };

  const saveName = async () => {
    if (!renaming?.title.trim()) { setRenaming(null); return; }
    const { id, title } = renaming;
    setRenaming(null);
    qc.setQueryData<ConversationRow[]>(["chat-conversations"], (old) => old?.map((x) => (x.id === id ? { ...x, title } : x)));
    await api(`/chat/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }).catch(() => qc.invalidateQueries({ queryKey: ["chat-conversations"] }));
  };

  const rows = list.data ?? [];
  return (
    <Sheet open={open} onClose={onClose} label="Chat history" title="Chat history" maxWidth={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => { onNewChat(); onClose(); }} className="mg-press"
          style={{ height: 46, borderRadius: 23, border: 0, background: "#F5F5F7", color: "#0A0A0C", fontFamily: "Manrope, sans-serif", fontSize: 14.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
          <MessageSquarePlus size={18} /> New chat
        </button>

        {list.isLoading ? <div style={{ display: "flex", justifyContent: "center", padding: 20, color: "rgba(243,240,255,0.5)" }}><Loader2 size={20} className="animate-spin" /></div> : null}
        {list.error ? <div style={{ fontSize: 13.5, color: "#FF8A8A" }}>{(list.error as Error).message}</div> : null}
        {!list.isLoading && !list.error && !rows.length ? (
          <div style={{ padding: "18px 4px", fontSize: 14, color: "rgba(243,240,255,0.65)", textAlign: "center", lineHeight: 1.5 }}>
            No saved chats yet. Your conversations will show up here.
          </div>
        ) : null}

        {rows.map((c) => {
          const active = c.id === activeId;
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 8px 10px 12px", borderRadius: 16, background: active ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${active ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)"}` }}>
              {renaming?.id === c.id ? (
                <input autoFocus value={renaming.title} maxLength={80} aria-label="Conversation name"
                  onChange={(e) => setRenaming({ id: c.id, title: e.target.value })}
                  onBlur={() => void saveName()}
                  onKeyDown={(e) => { if (e.key === "Enter") void saveName(); if (e.key === "Escape") setRenaming(null); }}
                  style={{ flex: 1, minWidth: 0, height: 34, padding: "0 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.25)", color: "#F3F0FF", fontFamily: "Manrope, sans-serif", fontSize: 14, outline: "none" }} />
              ) : (
                <button onClick={() => { onOpenConversation(c.id); onClose(); }}
                  style={{ flex: 1, minWidth: 0, background: "none", border: 0, padding: 0, color: "#F3F0FF", textAlign: "left", cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</span>
                    <span style={{ fontSize: 11.5, color: "rgba(243,240,255,0.45)", whiteSpace: "nowrap" }}>{when(c.updatedAt)}</span>
                  </span>
                  {c.preview ? <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: "rgba(243,240,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.preview}</span> : null}
                </button>
              )}
              <button onClick={() => setRenaming({ id: c.id, title: c.title })} aria-label={`Rename ${c.title}`}
                style={{ width: 34, height: 34, borderRadius: "50%", border: 0, background: "none", color: "rgba(243,240,255,0.55)", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}><Pencil size={15} /></button>
              <button onClick={() => void remove(c)} disabled={busy === c.id} aria-label={`Delete ${c.title}`}
                style={{ width: 34, height: 34, borderRadius: "50%", border: 0, background: "none", color: "rgba(255,138,138,0.8)", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
                {busy === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              </button>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
