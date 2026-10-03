/** A person's Social profile: cover, stats, creations, achievements and their posts. "/u/me" is yours. */
import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, MoreHorizontal, Gamepad2, Mic, Sparkles, Flame, Heart, Film, Loader2, Share2, Flag, Ban } from "lucide-react";
import { socialApi, compact, type Post } from "@/lib/socialApi";
import { S, card, Avatar, Sheet, primaryBtn, ghostBtn, COVERS } from "@/components/social/ui";
import { PostCard } from "@/components/social/PostCard";
import { goBackInTab } from "@/lib/tabHistory";

type Tab = "posts" | "moments" | "creations" | "games";
type Page = { posts: Post[]; nextCursor: string | null };

export default function SocialProfilePage() {
  const { id } = useParams<{ id: string }>();
  const who = id === "me" ? "me" : Number(id);
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const key = ["social-person", who];
  const { data: p, isLoading, error } = useQuery({ queryKey: key, queryFn: () => socialApi.person(who) });
  const [tab, setTab] = useState<Tab>("posts");
  const [edit, setEdit] = useState(false);
  const [menu, setMenu] = useState(false);
  const [list, setList] = useState<null | "followers" | "following">(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const postsKey = ["social-person-posts", who, tab];
  const posts = useInfiniteQuery({
    queryKey: postsKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => socialApi.personPosts(who, tab, pageParam),
    getNextPageParam: (last: Page) => last.nextCursor,
  });
  const items = posts.data?.pages.flatMap((pg) => pg.posts) ?? [];
  const change = (post: Post) => qc.setQueryData<{ pages: Page[]; pageParams: unknown[] }>(postsKey, (old) => old && { ...old, pages: old.pages.map((pg) => ({ ...pg, posts: pg.posts.map((x) => (x.id === post.id ? post : x)) })) });

  const follow = async () => {
    if (!p) return;
    setBusy(true);
    try { const r = await socialApi.follow(p.user.id); qc.setQueryData(key, { ...p, following: r.following, stats: { ...p.stats, followers: r.followers } }); void qc.invalidateQueries({ queryKey: ["social-feed"] }); }
    catch (e) { setNotice((e as Error).message); }
    finally { setBusy(false); }
  };
  const share = async () => {
    if (!p) return;
    const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/u/${p.user.id}`;
    try { if (navigator.share) await navigator.share({ title: `${p.user.username} on Apex`, url }); else { await navigator.clipboard.writeText(url); setNotice("Profile link copied"); } } catch { /* cancelled */ }
  };
  const block = async () => {
    if (!p || !window.confirm(`Block ${p.user.username}? You won't see each other's posts.`)) return;
    await socialApi.block(p.user.id).catch(() => undefined);
    nav("/feed");
  };

  const goBack = () => goBackInTab(nav, "/feed");
  const tile = (Icon: typeof Gamepad2, n: number, label: string) => (
    <div style={{ flex: 1, padding: "12px 6px", borderRadius: 14, background: S.surf, border: `1px solid ${S.line}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon size={18} color={S.ink2} /><span style={{ fontFamily: "Sora, sans-serif", fontSize: 18, fontWeight: 700 }}>{compact(n)}</span></span>
      <span style={{ fontSize: 11, color: S.ink3 }}>{label}</span>
    </div>
  );
  const stat = (n: number, label: string, onClick?: () => void) => (
    <button onClick={onClick} disabled={!onClick} style={{ flex: 1, textAlign: "center", background: "none", border: 0, color: S.ink, cursor: onClick ? "pointer" : "default", fontFamily: "Manrope, sans-serif" }}>
      <div style={{ fontFamily: "Sora, sans-serif", fontSize: 17, fontWeight: 700 }}>{compact(n)}</div>
      <div style={{ fontSize: 11, color: S.ink3, marginTop: 2 }}>{label}</div>
    </button>
  );

  return (
    <div className="mg-font" style={{ flex: 1, overflowY: "auto", background: "transparent", color: S.ink }}>
      <div style={{ position: "relative", height: 200, background: COVERS[p?.profile.cover ?? "city"] ?? COVERS.city }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(10,9,24,0) 40%, ${S.bg})` }} />
        <div className="profile-top" style={{ position: "absolute", top: 14, left: 10, right: 10, display: "flex", justifyContent: "space-between" }}>
          <button onClick={goBack} aria-label="Back" style={{ width: 38, height: 38, borderRadius: "50%", border: 0, background: "rgba(0,0,0,0.35)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={22} /></button>
          <button onClick={() => setMenu(true)} aria-label="More" style={{ width: 38, height: 38, borderRadius: "50%", border: 0, background: "rgba(0,0,0,0.35)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><MoreHorizontal size={20} /></button>
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: "-48px auto 0", padding: "0 16px 48px", position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
        {isLoading ? <div style={{ paddingTop: 60, fontSize: 13, color: S.ink3 }}>Loading…</div> : null}
        {error ? <div style={{ ...card, marginTop: 60, padding: 18, fontSize: 13.5, color: S.ink2 }}>{(error as Error).message}</div> : null}
        {p ? (
          <>
            <div><Avatar user={p.user} size={84} ring /></div>
            <div>
              <div style={{ fontFamily: "Sora, sans-serif", fontSize: 21, fontWeight: 700 }}>{p.user.username}</div>
              {p.profile.tagline ? <div style={{ fontSize: 12.5, color: S.ink2, marginTop: 2 }}>{p.profile.tagline}</div> : null}
              {p.profile.interests ? <div style={{ fontSize: 12, color: S.ink3, marginTop: 2 }}>{p.profile.interests}</div> : null}
              {p.user.bio ? <div style={{ fontSize: 13.5, lineHeight: 1.45, marginTop: 8 }}>{p.user.bio}</div> : null}
              {p.mine && !p.profile.tagline && !p.user.bio ? <div style={{ fontSize: 12.5, color: S.ink3, marginTop: 4 }}>Add a tagline and bio so people know what you're about.</div> : null}
            </div>
            <div style={{ display: "flex", padding: "12px 0", borderTop: `1px solid ${S.line}`, borderBottom: `1px solid ${S.line}` }}>
              {stat(p.stats.posts, "Posts")}{stat(p.stats.followers, "Followers", () => setList("followers"))}{stat(p.stats.following, "Following", () => setList("following"))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {p.mine ? (
                <>
                  <button onClick={() => setEdit(true)} style={primaryBtn({ flex: 1, height: 38, borderRadius: 12 })}>Edit profile</button>
                  <button onClick={() => void share()} style={ghostBtn({ flex: 1, height: 38, borderRadius: 12 })}><Share2 size={15} /> Share profile</button>
                </>
              ) : (
                <>
                  <button onClick={() => void follow()} disabled={busy} style={p.following ? ghostBtn({ flex: 1, height: 38, borderRadius: 12 }) : primaryBtn({ flex: 1, height: 38, borderRadius: 12 })}>
                    {busy ? <Loader2 size={15} className="animate-spin" /> : null}{p.following ? "Following" : "Follow"}
                  </button>
                  <button onClick={() => nav("/dm")} style={ghostBtn({ flex: 1, height: 38, borderRadius: 12 })}>Message</button>
                </>
              )}
            </div>
            {notice ? <div role="status" style={{ fontSize: 12.5, color: S.ink2 }}>{notice}</div> : null}
            <div style={{ fontSize: 12, fontWeight: 800, color: S.ink2 }}>Creations</div>
            <div style={{ display: "flex", gap: 8 }}>{tile(Gamepad2, p.creations.games, "Games")}{tile(Mic, p.creations.voice, "Tracks")}{tile(Film, p.creations.reels, "Reels")}{tile(Sparkles, p.creations.apex, "AI Creations")}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: S.ink2 }}>Achievements</div>
            <div style={{ display: "flex", gap: 8 }}>{tile(Flame, p.achievements.challenges, "Challenges")}{tile(Heart, p.achievements.interactions, "Interactions")}{tile(Sparkles, p.achievements.moments, "Moments")}</div>

            <div role="tablist" style={{ display: "flex", gap: 20, borderBottom: `1px solid ${S.line}`, fontSize: 13, fontWeight: 700 }}>
              {(["posts", "moments", "creations", "games"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  style={{ background: "none", border: 0, padding: "8px 0", marginBottom: -1, color: tab === t ? S.ink : S.ink3, borderBottom: `2px solid ${tab === t ? S.gold : "transparent"}`, font: "inherit", cursor: "pointer", textTransform: "capitalize" }}>{t}</button>
              ))}
            </div>
            {posts.isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading…</div> : null}
            {!posts.isLoading && !items.length ? <div style={{ ...card, padding: 18, textAlign: "center", fontSize: 13.5, color: S.ink2 }}>{p.mine ? "Nothing here yet. Your posts will show up here." : "Nothing here yet."}</div> : null}
            {items.map((post) => <PostCard key={post.id} post={post} onChange={change} onRemove={() => posts.refetch()} onTag={(t) => nav(`/feed?tag=${encodeURIComponent(t)}`)} />)}
            {posts.hasNextPage ? <button onClick={() => void posts.fetchNextPage()} style={ghostBtn({ height: 40 })}>{posts.isFetchingNextPage ? <Loader2 size={15} className="animate-spin" /> : null} Load more</button> : null}
          </>
        ) : null}
      </div>

      {p ? (
        <>
          <Sheet open={menu} onClose={() => setMenu(false)} label="Profile options" title={p.user.username} maxWidth={440}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button onClick={() => { setMenu(false); void share(); }} style={ghostBtn({ justifyContent: "flex-start", height: 48 })}><Share2 size={17} /> Share profile</button>
              {!p.mine ? (
                <>
                  <button onClick={() => { setMenu(false); void socialApi.report("user", p.user.id, "other").then(() => setNotice("Thanks. We'll review this profile.")); }} style={ghostBtn({ justifyContent: "flex-start", height: 48 })}><Flag size={17} /> Report profile</button>
                  <button onClick={() => { setMenu(false); void block(); }} style={ghostBtn({ justifyContent: "flex-start", height: 48, color: "#FF8A8A" })}><Ban size={17} /> Block {p.user.username}</button>
                </>
              ) : null}
            </div>
          </Sheet>
          <PeopleSheet who={who} which={list} onClose={() => setList(null)} />
          {p.mine ? <EditProfileSheet open={edit} onClose={() => setEdit(false)} initial={{ bio: p.user.bio, tagline: p.profile.tagline, interests: p.profile.interests, cover: p.profile.cover }} onSaved={() => { setEdit(false); void qc.invalidateQueries({ queryKey: key }); }} /> : null}
        </>
      ) : null}
    </div>
  );
}

function PeopleSheet({ who, which, onClose }: { who: number | "me"; which: null | "followers" | "following"; onClose: () => void }) {
  const [, nav] = useLocation();
  const { data, isLoading } = useQuery({ queryKey: ["social-follow-list", who, which], enabled: !!which, queryFn: () => socialApi.followList(who, which!) });
  return (
    <Sheet open={!!which} onClose={onClose} label={which ?? "People"} title={which === "followers" ? "Followers" : "Following"} maxWidth={460}>
      {isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading…</div> : null}
      {data && !data.length ? <div style={{ fontSize: 13.5, color: S.ink2 }}>Nobody yet.</div> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data?.map((u) => (
          <button key={u.id} onClick={() => { onClose(); nav(`/u/${u.id}`); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 2px", background: "none", border: 0, color: S.ink, cursor: "pointer", textAlign: "left", fontFamily: "Manrope, sans-serif" }}>
            <Avatar user={u} size={40} />
            <span style={{ flexGrow: 1, fontSize: 14, fontWeight: 800 }}>{u.username}</span>
            <span style={{ fontSize: 12, color: S.ink3 }}>{compact(u.followersCount ?? 0)} followers</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function EditProfileSheet({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial: { bio: string; tagline: string; interests: string; cover: string }; onSaved: () => void }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setF(initial); setError(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: `1px solid ${S.line2}`, color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 14, outline: "none" };
  const lab: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 800, color: S.ink2 };
  const save = async () => {
    setBusy(true); setError(null);
    try { await socialApi.saveProfile(f); onSaved(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} label="Edit profile" title="Edit profile">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div role="radiogroup" aria-label="Cover" style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
          {Object.entries(COVERS).map(([k, bg]) => (
            <button key={k} role="radio" aria-checked={f.cover === k} aria-label={`${k} cover`} onClick={() => setF({ ...f, cover: k })}
              style={{ width: 72, height: 46, flexShrink: 0, borderRadius: 10, background: bg, border: f.cover === k ? `2px solid ${S.ink}` : `1px solid ${S.line2}`, cursor: "pointer" }} />
          ))}
        </div>
        <label style={lab}>Tagline<input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} maxLength={40} placeholder="e.g. Late Night" style={field} /></label>
        <label style={lab}>What you're into<input value={f.interests} onChange={(e) => setF({ ...f, interests: e.target.value })} maxLength={60} placeholder="e.g. Creator · Gamer · Music" style={field} /></label>
        <label style={lab}>Bio<textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={160} rows={3} style={{ ...field, resize: "vertical", lineHeight: 1.5 }} /></label>
        {error ? <div role="alert" style={{ fontSize: 13, color: "#FF8A8A" }}>{error}</div> : null}
        <button onClick={() => void save()} disabled={busy} style={primaryBtn({ height: 44 })}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} Save</button>
      </div>
    </Sheet>
  );
}
