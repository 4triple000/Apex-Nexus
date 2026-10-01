/**
 * Social — the Apex feed. Apex Moment, trending tags, For You / Following, posts that load as you scroll,
 * and the + button that opens Create. Near-black glass with a soft gold accent.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, X, Loader2 } from "lucide-react";
import { NotificationBell } from "@/components/social/NotificationBell";
import { PostCard } from "@/components/social/PostCard";
import { CreateSheet, Composer, type ComposeMode, type CreatePick } from "@/components/social/Create";
import { CommentsSheet } from "@/components/social/Comments";
import { AskSheet } from "@/components/social/AskApex";
import { ChallengesRow, ChallengeSheet, StartChallengeSheet } from "@/components/social/Challenges";
import { S, card, Avatar, SectionLabel, primaryBtn, sceneFor } from "@/components/social/ui";
import { socialApi, compact, type Challenge, type Post } from "@/lib/socialApi";
import { useExplore, useFollow, useMyProfile } from "@/hooks/useSocial";

type Page = { posts: Post[]; nextCursor: number | null };
const STARTER_TAGS = ["apexmoments", "showyoursetup", "finishthebar", "gaming", "aiart", "music"];

export default function SocialPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [tag, setTag] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [compose, setCompose] = useState<{ mode: ComposeMode; idea?: string; challengeId?: number } | null>(null);
  const [commentsFor, setCommentsFor] = useState<Post | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState<number | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [challengeFilter, setChallengeFilter] = useState<{ id: number; title: string } | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // Layout renders this page for both mobile and desktop and hides one with CSS; only the shown copy gets the + button
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const check = () => setShown(!!root.current && root.current.getClientRects().length > 0);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const sharedId = useMemo(() => Number(new URLSearchParams(window.location.search).get("post")) || null, []);

  const moment = useQuery({ queryKey: ["social-moment"], queryFn: socialApi.moment, staleTime: 60_000 });
  const trending = useQuery({ queryKey: ["social-trending"], queryFn: socialApi.trending, staleTime: 120_000 });
  const shared = useQuery({ queryKey: ["social-shared", sharedId], enabled: !!sharedId, queryFn: () => socialApi.get(sharedId!).catch(() => null), retry: false });

  const feedKey = ["social-feed", tab, tag, challengeFilter?.id ?? 0];
  const feed = useInfiniteQuery({
    queryKey: feedKey,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => socialApi.feed(tab, pageParam, tag || undefined, challengeFilter?.id),
    getNextPageParam: (last: Page) => last.nextCursor,
  });
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  // Load the next page when the bottom of the list comes into view
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
    }, { root: root.current, rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage]);

  const editPages = useCallback((fn: (p: Post[]) => Post[]) => {
    qc.setQueriesData<InfiniteData<Page>>({ queryKey: ["social-feed"] }, (old) => old && { ...old, pages: old.pages.map((pg) => ({ ...pg, posts: fn(pg.posts) })) });
  }, [qc]);

  const updatePost = (p: Post) => {
    editPages((list) => list.map((x) => (x.id === p.id ? p : x)));
    if (shared.data?.id === p.id) qc.setQueryData(["social-shared", sharedId], p);
  };
  const removePost = (id: number, blockedAuthor?: number) => editPages((list) => list.filter((x) => x.id !== id && x.author.id !== blockedAuthor));
  const countChange = (postId: number, delta: number) => {
    editPages((list) => list.map((x) => (x.id === postId ? { ...x, commentCount: Math.max(0, x.commentCount + delta) } : x)));
    setCommentsFor((c) => (c && c.id === postId ? { ...c, commentCount: Math.max(0, c.commentCount + delta) } : c));
  };
  const posted = (p: Post) => {
    qc.setQueryData<InfiniteData<Page>>(["social-feed", tab, "", 0], (old) => old && { ...old, pages: old.pages.map((pg, i) => (i === 0 ? { ...pg, posts: [p, ...pg.posts] } : pg)) });
    if (tag) setTag("");
    if (challengeFilter) setChallengeFilter(null);
    if (p.kind === "moment") void qc.invalidateQueries({ queryKey: ["social-moment"] });
    void qc.invalidateQueries({ queryKey: ["social-trending"] });
  };

  const pickTag = (t: string) => { setTag(t); setChallengeFilter(null); setChallengeOpen(null); root.current?.scrollTo({ top: 0, behavior: "smooth" }); };
  const pick = (mode: CreatePick, idea?: string) => {
    setCreateOpen(false);
    if (mode === "ask") setAskOpen(true);
    else setCompose({ mode, idea });
  };
  const joinChallenge = (c: Challenge) => { setChallengeOpen(null); setCompose({ mode: "challenge", challengeId: c.id }); };
  const seeAllEntries = (c: Challenge) => { setChallengeOpen(null); setTag(""); setChallengeFilter({ id: c.id, title: c.title }); root.current?.scrollTo({ top: 0, behavior: "smooth" }); };
  const filtered = !!tag || !!challengeFilter;
  const tags = trending.data?.length ? trending.data : STARTER_TAGS.map((t) => ({ tag: t, count: 0 }));

  return (
    <div ref={root} className="mg-font" style={{ flex: 1, overflowY: "auto", background: S.bg, color: S.ink, padding: "0 16px 140px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6 }}>
          <h1 className="mg-display" style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Social</h1>
          <NotificationBell />
        </header>

        {/* Apex Moment */}
        <SectionLabel>Apex Moment</SectionLabel>
        <MomentCard
          prompt={moment.data?.prompt}
          answered={!!moment.data?.answered}
          answers={moment.data?.answers ?? 0}
          friends={moment.data?.friends ?? []}
          onRespond={() => setCompose({ mode: "moment" })}
        />

        {/* Trending */}
        <SectionLabel sub={trending.data?.length ? "See what's buzzing on Apex" : "Post with a tag to start a trend"}>Trending now</SectionLabel>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", margin: "0 -16px", padding: "0 16px" }}>
          {tags.map((t) => (
            <button key={t.tag} onClick={() => pickTag(t.tag)} aria-pressed={tag === t.tag}
              style={{ width: 116, flexShrink: 0, borderRadius: 14, overflow: "hidden", background: S.surf, border: `1px solid ${tag === t.tag ? "rgba(255,255,255,0.4)" : S.line}`, padding: 0, cursor: "pointer", textAlign: "left", color: S.ink, fontFamily: "Manrope, sans-serif" }}>
              <span aria-hidden style={{ display: "block", height: 74, background: sceneFor(t.tag) }} />
              <span style={{ display: "block", padding: "8px 9px" }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>#{t.tag}</span>
                <span style={{ display: "block", fontSize: 10.5, color: S.ink3, marginTop: 2 }}>{t.count ? `${compact(t.count)} post${t.count === 1 ? "" : "s"}` : "Be the first"}</span>
              </span>
            </button>
          ))}
        </div>

        <ChallengesRow onOpen={setChallengeOpen} onStart={() => setStartOpen(true)} />

        {/* Tabs */}
        <div role="tablist" aria-label="Feed" style={{ display: "flex", gap: 22, borderBottom: `1px solid ${S.line}`, fontSize: 14, fontWeight: 700 }}>
          {([["foryou", "For You"], ["following", "Following"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              style={{ background: "none", border: 0, padding: "10px 0", marginBottom: -1, color: tab === id ? S.ink : S.ink3, borderBottom: `2px solid ${tab === id ? S.gold : "transparent"}`, font: "inherit", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {filtered ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>{challengeFilter ? <>Entries for <span style={{ color: S.gold }}>{challengeFilter.title}</span></> : <>Posts tagged <span style={{ color: S.gold }}>#{tag}</span></>}</span>
            <button onClick={() => { setTag(""); setChallengeFilter(null); }} aria-label="Clear filter" style={{ display: "flex", alignItems: "center", gap: 4, height: 28, padding: "0 10px", borderRadius: 14, border: `1px solid ${S.line2}`, background: "rgba(255,255,255,0.05)", color: S.ink2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><X size={13} /> Clear</button>
          </div>
        ) : null}

        {shared.data && !filtered ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SectionLabel>Shared with you</SectionLabel>
            <PostCard post={shared.data} onChange={updatePost} onRemove={() => qc.setQueryData(["social-shared", sharedId], null)} onOpenComments={setCommentsFor} onTag={pickTag} onChallenge={setChallengeOpen} />
          </div>
        ) : null}

        {/* Feed */}
        {feed.isLoading ? <Skeletons /> : null}
        {feed.error ? <div style={{ ...card, padding: 16, fontSize: 13.5, color: "#FF8A8A" }}>{(feed.error as Error).message}</div> : null}
        {!feed.isLoading && !posts.length && !feed.error ? (
          <div style={{ ...card, padding: 24, textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <div style={{ fontFamily: "Sora, sans-serif", fontSize: 17, fontWeight: 700 }}>{tab === "following" ? "Nothing from people you follow yet" : challengeFilter ? "No entries you can see yet" : tag ? `No posts tagged #${tag} yet` : "No posts yet"}</div>
            <div style={{ fontSize: 13.5, color: S.ink2 }}>{tab === "following" ? "Follow a few creators and their posts will show up here." : "Be the first. Share what you're working on."}</div>
            <button onClick={() => setCreateOpen(true)} style={primaryBtn({ marginTop: 4 })}><Plus size={16} /> Create a post</button>
          </div>
        ) : null}
        {posts.map((p, i) => (
          <Fragment key={p.id}>
            <PostCard post={p} onChange={updatePost} onRemove={removePost} onOpenComments={setCommentsFor} onTag={pickTag} onChallenge={setChallengeOpen} />
            {i === 1 && tab === "foryou" && !filtered ? <PeopleToFollow /> : null}
          </Fragment>
        ))}
        {posts.length === 1 && tab === "foryou" && !filtered ? <PeopleToFollow /> : null}
        <div ref={sentinel} />
        {feed.isFetchingNextPage ? <div style={{ display: "flex", justifyContent: "center", padding: 12, color: S.ink3 }}><Loader2 size={20} className="animate-spin" /></div> : null}
        {!feed.hasNextPage && posts.length > 4 ? <div style={{ textAlign: "center", fontSize: 12.5, color: S.ink3, padding: 8 }}>You're all caught up</div> : null}
      </div>

      {shown && createPortal(
        <button onClick={() => setCreateOpen(true)} aria-label="Create"
          style={{ position: "fixed", right: 22, bottom: 104, zIndex: 50, width: 56, height: 56, borderRadius: "50%", border: 0, background: S.btn, color: S.btnText, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 10px 28px rgba(0,0,0,0.55)" }}>
          <Plus size={26} strokeWidth={2.4} />
        </button>,
        document.body,
      )}

      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} onPick={pick} />
      <Composer open={!!compose} mode={compose?.mode ?? "text"} idea={compose?.idea} challengeId={compose?.challengeId} prompt={moment.data?.prompt} onClose={() => setCompose(null)} onPosted={posted} />
      <AskSheet open={askOpen} onClose={() => setAskOpen(false)} onPosted={posted} />
      <ChallengeSheet id={challengeOpen} onClose={() => setChallengeOpen(null)} onJoin={joinChallenge} onSeeAll={seeAllEntries}
        onPostChange={updatePost} onOpenComments={(p) => { setChallengeOpen(null); setCommentsFor(p); }} onTag={pickTag} />
      <StartChallengeSheet open={startOpen} onClose={() => setStartOpen(false)} onStarted={(c) => { setStartOpen(false); setChallengeOpen(c.id); }} />
      <CommentsSheet post={commentsFor} onClose={() => setCommentsFor(null)} onCountChange={countChange} />
    </div>
  );

}

function MomentCard({ prompt, answered, answers, friends, onRespond }: { prompt?: string; answered: boolean; answers: number; friends: { username: string; avatarUrl: string | null; avatarEmoji: string | null }[]; onRespond: () => void }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 20, padding: 18, background: "linear-gradient(135deg, #1B1B20, #121215)", border: `1px solid ${S.line2}`, minHeight: 150 }}>
      <style>{`@keyframes apexFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes apexPulse{0%,100%{opacity:.55}50%{opacity:.9}}@media (prefers-reduced-motion: reduce){.apex-orb{animation:none!important}}`}</style>
      <div aria-hidden className="apex-orb" style={{ position: "absolute", right: -18, top: "50%", marginTop: -62, width: 124, height: 124, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, rgba(255,244,220,0.95), rgba(226,193,126,0.8) 35%, rgba(130,96,44,0.35) 65%, rgba(24,18,10,0) 72%)", animation: "apexFloat 6s ease-in-out infinite" }} />
      <div aria-hidden className="apex-orb" style={{ position: "absolute", right: -40, top: "50%", marginTop: -84, width: 168, height: 168, borderRadius: "50%", border: "1px solid rgba(226,193,126,0.22)", animation: "apexPulse 5s ease-in-out infinite" }} />
      <div style={{ position: "relative", maxWidth: "62%", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontFamily: "Sora, sans-serif", fontSize: 18, fontWeight: 700, lineHeight: 1.3, minHeight: 46 }}>{prompt ?? " "}</div>
        <div style={{ fontSize: 12.5, color: S.ink2, lineHeight: 1.45 }}>{answered ? "You shared today's Moment." : "Share a thought, photo or poll."}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          <button onClick={onRespond} style={primaryBtn({ height: 36, borderRadius: 10, fontSize: 13 })}>{answered ? "Share another" : "Respond"}</button>
          {friends.length ? (
            <span style={{ display: "flex", alignItems: "center" }}>
              {friends.slice(0, 3).map((f, i) => <span key={i} style={{ marginLeft: i ? -8 : 0 }}><Avatar user={f} size={24} /></span>)}
            </span>
          ) : null}
          {answers ? <span style={{ fontSize: 12, color: S.ink3 }}>{compact(answers)} shared today</span> : null}
        </div>
      </div>
    </div>
  );
}

function PeopleToFollow() {
  const explore = useExplore();
  const me = useMyProfile().data?.user;
  const follow = useFollow();
  const [, nav] = useLocation();
  const [done, setDone] = useState<Set<number>>(new Set());
  const people = (explore.data?.suggestedCreators ?? []).filter((c) => c.id !== me?.id).slice(0, 8);
  if (!people.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel>People to follow</SectionLabel>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", margin: "0 -16px", padding: "0 16px" }}>
        {people.map((c) => (
          <div key={c.id} style={{ ...card, width: 128, flexShrink: 0, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
            <button onClick={() => nav(`/profile/${c.id}`)} aria-label={`Open ${c.username}'s profile`} style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>
              <Avatar user={{ username: c.username, avatarUrl: null, avatarEmoji: c.avatarEmoji }} size={52} />
            </button>
            <div style={{ fontSize: 13, fontWeight: 700, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.username}</div>
            <div style={{ fontSize: 11, color: S.ink3 }}>{compact(c.followersCount)} followers</div>
            <button disabled={done.has(c.id)} onClick={() => { follow.mutate({ targetUserId: c.id }); setDone((s) => new Set(s).add(c.id)); }}
              style={primaryBtn({ height: 30, width: "100%", borderRadius: 15, fontSize: 12, ...(done.has(c.id) ? { background: "rgba(255,255,255,0.08)", color: S.ink2 } : {}) })}>
              {done.has(c.id) ? "Following" : "Follow"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Skeletons() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 12, opacity: 0.6 }} aria-hidden>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ width: 38, height: 38, borderRadius: "50%", background: S.surf2 }} /><span style={{ width: 120, height: 12, borderRadius: 6, background: S.surf2 }} /></div>
          <span style={{ height: 12, borderRadius: 6, background: S.surf2, width: "80%" }} />
          <span style={{ height: 160, borderRadius: 14, background: S.surf2 }} />
        </div>
      ))}
    </>
  );
}
