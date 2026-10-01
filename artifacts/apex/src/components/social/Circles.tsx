/**
 * Circles: groups people join to post together.
 * The row on the Social home, a circle's page (as a sheet, with its posts), and "Find circles"
 * (discover public ones, join with an invite code, or start your own).
 */
import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Lock, Globe, Users, Copy, Loader2, LogOut, Trash2, Search, PenLine } from "lucide-react";
import { socialApi, compact, type Circle, type Post } from "@/lib/socialApi";
import { S, card, Sheet, primaryBtn, ghostBtn, Avatar, SectionLabel } from "./ui";
import { PostCard } from "./PostCard";

function CircleBadge({ circle, size = 52 }: { circle: Pick<Circle, "emoji" | "name">; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: size * 0.32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, background: "linear-gradient(145deg, #2A2722, #16161A)", border: `1px solid ${S.line2}` }}>
      {circle.emoji}
    </span>
  );
}

export function CirclesRow({ onOpen, onFind }: { onOpen: (id: number) => void; onFind: () => void }) {
  const { data } = useQuery({ queryKey: ["social-circles"], queryFn: socialApi.circles, staleTime: 60_000 });
  const mine = data?.mine ?? [];
  const suggested = (data?.discover ?? []).slice(0, Math.max(0, 4 - mine.length));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel sub={mine.length ? "Your groups" : "Groups to post in together"}>Circles</SectionLabel>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", margin: "0 -16px", padding: "0 16px" }}>
        {[...mine, ...suggested].map((c) => (
          <button key={c.id} onClick={() => onOpen(c.id)}
            style={{ width: 132, flexShrink: 0, padding: 12, borderRadius: 16, background: S.surf, border: `1px solid ${S.line}`, color: S.ink, cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, fontFamily: "Manrope, sans-serif" }}>
            <CircleBadge circle={c} size={40} />
            <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{c.name}</span>
            <span style={{ fontSize: 11, color: S.ink3, display: "flex", alignItems: "center", gap: 4 }}>
              {c.privacy === "invite" ? <Lock size={11} /> : null}{compact(c.memberCount)} member{c.memberCount === 1 ? "" : "s"}{c.member ? "" : " · Join"}
            </span>
          </button>
        ))}
        <button onClick={onFind}
          style={{ width: 120, flexShrink: 0, borderRadius: 16, border: `1px dashed ${S.line2}`, background: "none", color: S.ink2, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, fontWeight: 800, fontFamily: "Manrope, sans-serif", minHeight: 112 }}>
          <Search size={18} /> Find circles
        </button>
      </div>
    </div>
  );
}

type Page = { posts: Post[]; nextCursor: string | null };

export function CircleSheet({ id, onClose, onPost, onOpenComments, onTag, onPostChange }: {
  id: number | null;
  onClose: () => void;
  onPost: (c: Circle) => void;
  onOpenComments: (p: Post) => void;
  onTag: (tag: string) => void;
  onPostChange: (p: Post) => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const info = useQuery({ queryKey: ["social-circle", id], enabled: !!id, queryFn: () => socialApi.circle(id!) });
  const c = info.data?.circle;
  const postsKey = ["social-circle-posts", id];
  const posts = useInfiniteQuery({
    queryKey: postsKey,
    enabled: !!id && !!c,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => socialApi.feed("foryou", pageParam, undefined, undefined, id!),
    getNextPageParam: (last: Page) => last.nextCursor,
  });
  useEffect(() => { setNotice(null); setCode(""); }, [id]);

  const refresh = () => { void qc.invalidateQueries({ queryKey: ["social-circles"] }); void qc.invalidateQueries({ queryKey: ["social-circle", id] }); void qc.invalidateQueries({ queryKey: ["social-feed"] }); };
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true); setNotice(null);
    try { await fn(); refresh(); if (done) setNotice(done); } catch (e) { setNotice((e as Error).message); } finally { setBusy(false); }
  };
  const copyInvite = async () => {
    if (!c?.inviteCode) return;
    try { await navigator.clipboard.writeText(c.inviteCode); setNotice("Invite code copied. Share it with people you want to add."); } catch { setNotice(`Invite code: ${c.inviteCode}`); }
  };
  const change = (p: Post) => {
    qc.setQueryData<{ pages: Page[]; pageParams: unknown[] }>(postsKey, (old) => old && { ...old, pages: old.pages.map((pg) => ({ ...pg, posts: pg.posts.map((x) => (x.id === p.id ? p : x)) })) });
    onPostChange(p);
  };
  const list = posts.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <Sheet open={!!id} onClose={onClose} label="Circle" title={c ? c.name : "Circle"}>
      {info.isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading…</div> : null}
      {info.error ? <div style={{ fontSize: 13, color: "#FF8A8A" }}>{(info.error as Error).message}</div> : null}
      {c ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <CircleBadge circle={c} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: S.ink3, display: "flex", alignItems: "center", gap: 5 }}>
                  {c.privacy === "invite" ? <><Lock size={12} /> Invite only</> : <><Globe size={12} /> Public</>} · <Users size={12} /> {compact(c.memberCount)}
                </div>
                {c.description ? <div style={{ fontSize: 14, lineHeight: 1.45, marginTop: 4 }}>{c.description}</div> : null}
              </div>
            </div>
            {info.data?.members.length ? (
              <div style={{ display: "flex", alignItems: "center" }}>
                {info.data.members.slice(0, 8).map((m, i) => <span key={m.id} title={m.username} style={{ marginLeft: i ? -8 : 0 }}><Avatar user={m} size={28} ring={m.role === "owner"} /></span>)}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {c.member ? (
                <>
                  <button onClick={() => onPost(c)} style={primaryBtn({ height: 40, flexGrow: 1 })}><PenLine size={15} /> Post in circle</button>
                  {c.inviteCode ? <button onClick={() => void copyInvite()} style={ghostBtn({ height: 40 })}><Copy size={15} /> Invite</button> : null}
                  {c.role === "owner"
                    ? <button onClick={() => window.confirm("Delete this circle for everyone?") && void run(() => socialApi.deleteCircle(c.id)).then(onClose)} aria-label="Delete circle" style={ghostBtn({ height: 40, width: 40, padding: 0, color: "#FF8A8A" })}><Trash2 size={16} /></button>
                    : <button onClick={() => void run(() => socialApi.leaveCircle(c.id), "You left this circle.")} disabled={busy} aria-label="Leave circle" style={ghostBtn({ height: 40, width: 40, padding: 0 })}><LogOut size={16} /></button>}
                </>
              ) : c.privacy === "public" ? (
                <button onClick={() => void run(() => socialApi.joinCircle(c.id), "You're in! Your circle's posts now show in your feed.")} disabled={busy} style={primaryBtn({ height: 40, flexGrow: 1 })}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Join circle
                </button>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); void run(() => socialApi.joinCircle(c.id, code.trim())); }} style={{ display: "flex", gap: 8, width: "100%" }}>
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code" aria-label="Invite code"
                    style={{ flexGrow: 1, height: 40, borderRadius: 12, padding: "0 12px", background: "rgba(0,0,0,0.3)", border: `1px solid ${S.line2}`, color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 14, outline: "none" }} />
                  <button type="submit" disabled={!code.trim() || busy} style={primaryBtn({ height: 40 })}>Join</button>
                </form>
              )}
            </div>
            {notice ? <div role="status" style={{ fontSize: 12.5, color: S.ink2 }}>{notice}</div> : null}
          </div>

          <SectionLabel>Posts</SectionLabel>
          {posts.isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading posts…</div> : null}
          {!posts.isLoading && !list.length ? <div style={{ ...card, padding: 18, textAlign: "center", fontSize: 13.5, color: S.ink2 }}>{c.member ? "Nothing here yet. Start the conversation." : "No posts yet."}</div> : null}
          {list.map((p) => <PostCard key={p.id} post={p} onChange={change} onRemove={() => qc.invalidateQueries({ queryKey: postsKey })} onOpenComments={onOpenComments} onTag={onTag} />)}
          {posts.hasNextPage ? <button onClick={() => void posts.fetchNextPage()} disabled={posts.isFetchingNextPage} style={ghostBtn({ height: 40 })}>{posts.isFetchingNextPage ? <Loader2 size={15} className="animate-spin" /> : null} Load more</button> : null}
        </div>
      ) : null}
    </Sheet>
  );
}

const EMOJIS = ["✨", "🎮", "🎧", "🎨", "💻", "📚", "🏀", "🦉", "🔥", "🌙", "📸", "🍳"];

export function FindCirclesSheet({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: (id: number) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["social-circles"], enabled: open, queryFn: socialApi.circles });
  const [view, setView] = useState<"find" | "start">("find");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [privacy, setPrivacy] = useState<"public" | "invite">("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setView("find"); setCode(""); setName(""); setDescription(""); setEmoji("✨"); setPrivacy("public"); setError(null); } }, [open]);

  const go = async (fn: () => Promise<Circle>) => {
    setBusy(true); setError(null);
    try {
      const c = await fn();
      void qc.invalidateQueries({ queryKey: ["social-circles"] });
      void qc.invalidateQueries({ queryKey: ["social-feed"] });
      onOpen(c.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: `1px solid ${S.line2}`, color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 14, outline: "none" };
  const tab = (on: boolean) => ghostBtn({ height: 34, flexGrow: 1, ...(on ? { background: S.btn, color: S.btnText, borderColor: S.btn } : {}) });

  return (
    <Sheet open={open} onClose={onClose} label="Circles" title="Circles">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div role="tablist" style={{ display: "flex", gap: 8 }}>
          <button role="tab" aria-selected={view === "find"} onClick={() => setView("find")} style={tab(view === "find")}><Search size={14} /> Find</button>
          <button role="tab" aria-selected={view === "start"} onClick={() => setView("start")} style={tab(view === "start")}><Plus size={14} /> Start a circle</button>
        </div>

        {view === "find" ? (
          <>
            <form onSubmit={(e) => { e.preventDefault(); void go(() => socialApi.joinByCode(code.trim())); }} style={{ display: "flex", gap: 8 }}>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Have an invite code?" aria-label="Invite code" style={{ ...field, height: 40, padding: "0 12px" }} />
              <button type="submit" disabled={!code.trim() || busy} style={primaryBtn({ height: 40 })}>Join</button>
            </form>
            {data?.mine.length ? (
              <>
                <SectionLabel>Your circles</SectionLabel>
                {data.mine.map((c) => <CircleRowItem key={c.id} circle={c} onOpen={() => onOpen(c.id)} />)}
              </>
            ) : null}
            <SectionLabel>Discover</SectionLabel>
            {isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading…</div> : null}
            {data && !data.discover.length ? <div style={{ fontSize: 13.5, color: S.ink2 }}>No public circles to join yet. Start the first one!</div> : null}
            {data?.discover.map((c) => <CircleRowItem key={c.id} circle={c} onOpen={() => onOpen(c.id)} />)}
          </>
        ) : (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 800, color: S.ink2 }}>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus placeholder="e.g. Night Owl Builders" style={field} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 800, color: S.ink2 }}>
              What's it about?
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={2} placeholder="One line so people know if it's for them" style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
            </label>
            <div role="radiogroup" aria-label="Icon" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {EMOJIS.map((e) => (
                <button key={e} role="radio" aria-checked={emoji === e} onClick={() => setEmoji(e)}
                  style={{ width: 40, height: 40, borderRadius: 12, fontSize: 20, cursor: "pointer", background: emoji === e ? S.goldSoft : S.surf, border: `1px solid ${emoji === e ? S.gold : S.line}` }}>{e}</button>
              ))}
            </div>
            <div role="radiogroup" aria-label="Who can join" style={{ display: "flex", gap: 8 }}>
              <button role="radio" aria-checked={privacy === "public"} onClick={() => setPrivacy("public")} style={tab(privacy === "public")}><Globe size={14} /> Anyone</button>
              <button role="radio" aria-checked={privacy === "invite"} onClick={() => setPrivacy("invite")} style={tab(privacy === "invite")}><Lock size={14} /> Invite only</button>
            </div>
            <div style={{ fontSize: 12, color: S.ink3 }}>{privacy === "public" ? "Anyone can find and join. Posts can be seen by anyone who opens the circle." : "Hidden from search. People join with the invite code; only members see posts."}</div>
            <button onClick={() => void go(() => socialApi.startCircle({ name: name.trim(), description: description.trim(), emoji, privacy }))} disabled={busy || name.trim().length < 3} style={primaryBtn({ height: 44, opacity: name.trim().length < 3 ? 0.5 : 1 })}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null} Start circle
            </button>
          </>
        )}
        {error ? <div role="alert" style={{ fontSize: 13, color: "#FF8A8A" }}>{error}</div> : null}
      </div>
    </Sheet>
  );
}

function CircleRowItem({ circle, onOpen }: { circle: Circle; onOpen: () => void }) {
  return (
    <button onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, background: S.surf, border: `1px solid ${S.line}`, color: S.ink, cursor: "pointer", textAlign: "left", fontFamily: "Manrope, sans-serif" }}>
      <CircleBadge circle={circle} size={44} />
      <span style={{ flexGrow: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>{circle.name}</span>
        <span style={{ display: "block", fontSize: 12, color: S.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{compact(circle.memberCount)} member{circle.memberCount === 1 ? "" : "s"}{circle.description ? ` · ${circle.description}` : ""}</span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 800, color: circle.member ? S.ink3 : S.gold }}>{circle.member ? "Open" : "Join"}</span>
    </button>
  );
}
