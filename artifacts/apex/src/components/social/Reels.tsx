/**
 * Reels: the card in the feed, the strip on the Social home, and the full-screen vertical player.
 * In the player, the reel on screen plays (muted until you tap for sound) and the rest pause.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Heart, MessageCircle, Share2, Play, Volume2, VolumeX, X, Film, Plus } from "lucide-react";
import { socialApi, mediaSrc, compact, clock, type Post } from "@/lib/socialApi";
import { S, Avatar, RichText, SectionLabel } from "./ui";

/** A reel inside a post card: cover with a play button. Opens the player. */
export function ReelCard({ post }: { post: Post }) {
  const [, nav] = useLocation();
  const v = post.video!;
  const tall = (v.height ?? 16) >= (v.width ?? 9);
  return (
    <button onClick={() => nav(`/feed/reels?start=${post.id}`)} aria-label="Play reel"
      style={{ position: "relative", display: "block", width: tall ? "62%" : "100%", aspectRatio: tall ? "9 / 16" : "16 / 9", maxHeight: 460, borderRadius: 16, overflow: "hidden", border: `1px solid ${S.line}`, background: "#000", padding: 0, cursor: "pointer" }}>
      {v.poster
        ? <img src={mediaSrc(v.poster)} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        : <video src={`${mediaSrc(v.url)}#t=0.5`} preload="metadata" muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <span style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 60%, rgba(0,0,0,0.55))" }} />
      <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 54, height: 54, borderRadius: "50%", background: "rgba(10,10,12,0.55)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Play size={22} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
      </span>
      <span style={{ position: "absolute", left: 10, bottom: 10, display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 800, color: "#fff" }}><Film size={13} /> Reel{v.durationMs ? ` · ${clock(v.durationMs)}` : ""}</span>
    </button>
  );
}

/** "Reels" row on the Social home. */
export function ReelsStrip({ onCreate }: { onCreate: () => void }) {
  const [, nav] = useLocation();
  const { data } = useQuery({ queryKey: ["social-reels-strip"], queryFn: () => socialApi.reels(), staleTime: 60_000 });
  const reels = data?.posts ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <SectionLabel sub="Short videos from the community">Reels</SectionLabel>
        {reels.length ? <button onClick={() => nav("/feed/reels")} style={{ background: "none", border: 0, color: S.gold, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>Watch all</button> : null}
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", margin: "0 -16px", padding: "0 16px" }}>
        <button onClick={onCreate} style={{ width: 104, height: 172, flexShrink: 0, borderRadius: 14, border: `1px dashed ${S.line2}`, background: "none", color: S.ink2, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 800, fontFamily: "Manrope, sans-serif" }}>
          <Plus size={20} /> Post a reel
        </button>
        {reels.map((r) => (
          <button key={r.id} onClick={() => nav(`/feed/reels?start=${r.id}`)} aria-label={`Reel by ${r.author.username}`}
            style={{ position: "relative", width: 104, height: 172, flexShrink: 0, borderRadius: 14, overflow: "hidden", border: `1px solid ${S.line}`, background: "#000", padding: 0, cursor: "pointer" }}>
            {r.video?.poster ? <img src={mediaSrc(r.video.poster)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <video src={`${mediaSrc(r.video!.url)}#t=0.5`} preload="metadata" muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            <span style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 55%, rgba(0,0,0,0.7))" }} />
            <span style={{ position: "absolute", left: 8, right: 8, bottom: 8, display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "left" }}>
              <Avatar user={r.author} size={20} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.author.username}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

type Page = { posts: Post[]; nextCursor: string | null };

/** Full-screen vertical reels. `startId` plays that reel first. */
export function ReelsViewer({ startId, onClose }: { startId?: number | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const [muted, setMuted] = useState(true);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const start = useQuery({ queryKey: ["social-reel", startId], enabled: !!startId, queryFn: () => socialApi.get(startId!).catch(() => null) });
  const feed = useInfiniteQuery({
    queryKey: ["social-reels"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => socialApi.reels(pageParam),
    getNextPageParam: (last: Page) => last.nextCursor,
  });
  const reels = useMemo(() => {
    const all = [...(start.data?.video ? [start.data] : []), ...(feed.data?.pages.flatMap((p) => p.posts) ?? [])];
    const seen = new Set<number>();
    return all.filter((p) => p.video && !seen.has(p.id) && seen.add(p.id));
  }, [start.data, feed.data]);

  // Which reel fills the screen
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
    }, { root, threshold: 0.6 });
    root.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [reels.length]);
  useEffect(() => { if (active >= reels.length - 2 && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }, [active, reels.length, feed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const update = useCallback((p: Post) => {
    qc.setQueryData<{ pages: Page[]; pageParams: unknown[] }>(["social-reels"], (old) => old && { ...old, pages: old.pages.map((pg) => ({ ...pg, posts: pg.posts.map((x) => (x.id === p.id ? p : x)) })) });
    if (start.data?.id === p.id) qc.setQueryData(["social-reel", startId], p);
  }, [qc, start.data, startId]);

  const loading = feed.isLoading || (!!startId && start.isLoading);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Reels" className="mg-font" style={{ position: "fixed", inset: 0, zIndex: 9400, background: "#000", display: "flex", justifyContent: "center" }}>
      <div ref={listRef} style={{ width: "100%", maxWidth: 480, height: "100%", overflowY: "auto", scrollSnapType: "y mandatory", scrollbarWidth: "none" }}>
        {reels.map((p, i) => (
          <Reel key={p.id} post={p} index={i} active={i === active} muted={muted} onToggleMute={() => setMuted((m) => !m)} onChange={update}
            onComments={() => nav(`/feed/post/${p.id}`)} onProfile={() => nav(`/u/${p.author.id}`)} />
        ))}
        {!loading && !reels.length ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#fff", textAlign: "center", padding: 24 }}>
            <Film size={32} color={S.gold} />
            <div style={{ fontFamily: "Sora, sans-serif", fontSize: 18, fontWeight: 700 }}>No reels yet</div>
            <div style={{ fontSize: 13.5, color: S.ink2 }}>Be the first to post one from Create → Video.</div>
          </div>
        ) : null}
      </div>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ width: "100%", maxWidth: 480, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(12px + env(safe-area-inset-top, 0px)) 14px 0" }}>
          <span style={{ fontFamily: "Sora, sans-serif", fontSize: 18, fontWeight: 700, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>Reels</span>
          <button onClick={onClose} aria-label="Close reels" style={{ pointerEvents: "auto", width: 38, height: 38, borderRadius: "50%", border: 0, background: "rgba(0,0,0,0.4)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={20} /></button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Reel({ post, index, active, muted, onToggleMute, onChange, onComments, onProfile }: {
  post: Post; index: number; active: boolean; muted: boolean;
  onToggleMute: () => void; onChange: (p: Post) => void; onComments: () => void; onProfile: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active && !paused) void v.play().catch(() => setPaused(true));
    else v.pause();
    if (!active) { v.currentTime = 0; setPaused(false); }
  }, [active, paused]);

  const like = async () => {
    const optimistic = { ...post, reacted: !post.reacted, reactionCount: post.reactionCount + (post.reacted ? -1 : 1) };
    onChange(optimistic);
    try { const r = await socialApi.react(post.id); onChange({ ...optimistic, reacted: r.reacted, reactionCount: r.reactionCount }); } catch { onChange(post); }
  };
  const share = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/feed/reels?start=${post.id}`;
    try { if (navigator.share) await navigator.share({ title: `${post.author.username} on Apex`, url }); else await navigator.clipboard.writeText(url); } catch { /* cancelled */ }
  };
  const side = (icon: React.ReactNode, label: string, n: string | null, onClick: () => void, pressed?: boolean) => (
    <button onClick={onClick} aria-label={label} aria-pressed={pressed} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: 0, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 800, fontFamily: "Manrope, sans-serif", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
      <span style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>{n}
    </button>
  );

  return (
    <section data-index={index} aria-label={`Reel by ${post.author.username}`} style={{ position: "relative", height: "100dvh", scrollSnapAlign: "start", scrollSnapStop: "always", background: "#000", overflow: "hidden" }}>
      <video ref={ref} src={mediaSrc(post.video!.url)} poster={post.video!.poster ? mediaSrc(post.video!.poster) : undefined} loop playsInline muted={muted} preload={active ? "auto" : "metadata"}
        onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
        onClick={() => setPaused((p) => !p)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", cursor: "pointer" }} />
      {paused ? <span aria-hidden style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 70, height: 70, borderRadius: "50%", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><Play size={30} fill="#fff" color="#fff" style={{ marginLeft: 4 }} /></span> : null}
      <button onClick={onToggleMute} aria-label={muted ? "Turn sound on" : "Mute"} style={{ position: "absolute", top: "calc(60px + env(safe-area-inset-top, 0px))", right: 14, width: 38, height: 38, borderRadius: "50%", border: 0, background: "rgba(0,0,0,0.4)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <div style={{ position: "absolute", right: 10, bottom: "calc(110px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <button onClick={onProfile} aria-label={`${post.author.username}'s profile`} style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}><Avatar user={post.author} size={44} ring /></button>
        {side(<Heart size={24} fill={post.reacted ? S.heart : "none"} color={post.reacted ? S.heart : "#fff"} />, post.reacted ? "Unlike" : "Like", compact(post.reactionCount), () => void like(), post.reacted)}
        {side(<MessageCircle size={23} />, "Comments", compact(post.commentCount), onComments)}
        {side(<Share2 size={22} />, "Share", null, () => void share())}
      </div>
      <div style={{ position: "absolute", left: 14, right: 76, bottom: "calc(28px + env(safe-area-inset-bottom, 0px))", color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={onProfile} style={{ alignSelf: "flex-start", background: "none", border: 0, padding: 0, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>{post.author.username}</button>
        {post.body ? <div style={{ fontSize: 14, lineHeight: 1.45, maxHeight: 84, overflow: "hidden" }}><RichText text={post.body} /></div> : null}
      </div>
      <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "rgba(255,255,255,0.2)" }}><div style={{ height: "100%", width: `${progress * 100}%`, background: S.gold }} /></div>
    </section>
  );
}
