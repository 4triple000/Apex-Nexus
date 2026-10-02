/**
 * Social home (the mockup's "Apex" screen): stories, today's Apex Moment, trending tags, reels,
 * challenges and circles, then the feed with For You / Following / Trending.
 * Creating happens on /feed/create (the + button); each post opens on its own page.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, X, Loader2, MessageSquareText, ChevronLeft } from "lucide-react";
import { NotificationBell } from "@/components/social/NotificationBell";
import { PostCard } from "@/components/social/PostCard";
import { ChallengesRow, ChallengeSheet } from "@/components/social/Challenges";
import { StoryTray, StoryViewer } from "@/components/social/Stories";
import { CirclesRow, CircleSheet, FindCirclesSheet } from "@/components/social/Circles";
import { ReelsStrip } from "@/components/social/Reels";
import { useCreateFlow } from "@/components/social/CreateFlow";
import { S, card, Avatar, SectionLabel, primaryBtn, sceneFor, iconBtn } from "@/components/social/ui";
import { socialApi, compact, type Challenge, type Post, type StoryGroup } from "@/lib/socialApi";
import { useExplore, useFollow, useMyProfile } from "@/hooks/useSocial";

type Page = { posts: Post[]; nextCursor: string | null };
type Tab = "foryou" | "following" | "trending";
const STARTER_TAGS = ["apexmoments", "showyoursetup", "finishthebar", "gaming", "aiart", "music"];

export default function SocialPage() {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [tab, setTab] = useState<Tab>(() => (["following", "trending"].includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "foryou"));
  const [tag, setTag] = useState<string>(() => params.get("tag") ?? "");
  const [stories, setStories] = useState<{ groups: StoryGroup[]; index: number } | null>(null);
  const [circleOpen, setCircleOpen] = useState<number | null>(null);
  const [findCircles, setFindCircles] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState<number | null>(null);
  const [challengeFilter, setChallengeFilter] = useState<{ id: number; title: string } | null>(() => (Number(params.get("challenge")) ? { id: Number(params.get("challenge")), title: "this challenge" } : null));
  const sentinel = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const create = useCreateFlow();
  // Layout renders this page for both mobile and desktop and hides one with CSS; only the shown copy gets the + button
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const check = () => setShown(!!root.current && root.current.getClientRects().length > 0);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  // /feed?circle=3 opens that circle (only in the copy of the page that's on screen)
  useEffect(() => { const id = Number(params.get("circle")); if (shown && id) setCircleOpen(id); }, [shown, params]);
  // Old share links (/feed?post=12) open the post's page
  useEffect(() => { const id = Number(params.get("post")); if (id) nav(`/feed/post/${id}`, { replace: true }); }, [params, nav]);

  const moment = useQuery({ queryKey: ["social-moment"], queryFn: socialApi.moment, staleTime: 60_000 });
  const trending = useQuery({ queryKey: ["social-trending"], queryFn: socialApi.trending, staleTime: 120_000 });

  const feedKey = ["social-feed", tab, tag, challengeFilter?.id ?? 0];
  const feed = useInfiniteQuery({
    queryKey: feedKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => socialApi.feed(tab, pageParam, tag || undefined, challengeFilter?.id),
    getNextPageParam: (last: Page) => last.nextCursor,
  });
  // Ranked pages can overlap if the order is refreshed mid-scroll; show each post once
  const posts = useMemo(() => {
    const seen = new Set<number>();
    return (feed.data?.pages.flatMap((p) => p.posts) ?? []).filter((p) => !seen.has(p.id) && seen.add(p.id));
  }, [feed.data]);

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
  const updatePost = (p: Post) => editPages((list) => list.map((x) => (x.id === p.id ? p : x)));
  const removePost = (id: number, blockedAuthor?: number) => editPages((list) => list.filter((x) => x.id !== id && x.author.id !== blockedAuthor));

  const top = () => root.current?.scrollTo({ top: 0, behavior: "smooth" });
  const pickTag = (t: string) => { setTag(t); setChallengeFilter(null); setChallengeOpen(null); setCircleOpen(null); top(); };
  const joinChallenge = (c: Challenge) => { setChallengeOpen(null); create.start("challenge", { challengeId: c.id }); };
  const seeAllEntries = (c: Challenge) => { setChallengeOpen(null); setTag(""); setChallengeFilter({ id: c.id, title: c.title }); top(); };
  const filtered = !!tag || !!challengeFilter;
  const tags = trending.data?.length ? trending.data : STARTER_TAGS.map((t) => ({ tag: t, count: 0 }));
  const headerBtn = { ...iconBtn, color: S.ink, width: 38, height: 38 };

  return (
    <div ref={root} className="mg-font" style={{ flex: 1, overflowY: "auto", background: "transparent", color: S.ink, padding: "0 16px 48px" }}>
      {/* Social is a full screen: it starts at the very top, and posts scroll under the ☰ button behind this fade */}
      <div aria-hidden style={{ position: "sticky", top: 0, zIndex: 5, height: 64, margin: "0 -16px", background: "linear-gradient(rgba(10,9,24,0.7) 40%, rgba(10,9,24,0))", pointerEvents: "none" }} />
      <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 2, marginTop: -4 }}>
          <button onClick={() => nav("/")} aria-label="Back to Apex" className="mg-press"
            style={{ height: 32, padding: "0 11px 0 6px", marginRight: 10, borderRadius: 16, display: "flex", alignItems: "center", gap: 2, color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 700, background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))", border: `1px solid ${S.line2}`, cursor: "pointer" }}>
            <ChevronLeft size={16} strokeWidth={2.4} />Apex
          </button>
          <h1 className="mg-display" style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", flexGrow: 1 }}>Social</h1>
          <NotificationBell />
          <button onClick={() => nav("/dm")} aria-label="Messages" style={headerBtn}><MessageSquareText size={20} /></button>
        </header>

        <StoryTray onOpen={(groups, index) => setStories({ groups, index })} onAdd={() => create.start("story")} />

        {/* Apex Moment */}
        <SectionLabel>APEX MOMENT</SectionLabel>
        <MomentCard
          prompt={moment.data?.prompt}
          answered={!!moment.data?.answered}
          answers={moment.data?.answers ?? 0}
          friends={moment.data?.friends ?? []}
          onRespond={() => nav("/feed/moments")}
        />

        {/* Trending */}
        <SectionLabel sub={trending.data?.length ? "See what's buzzing on Apex" : "Post with a tag to start a trend"}>TRENDING NOW</SectionLabel>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", margin: "0 -16px", padding: "0 16px" }}>
          {tags.map((t) => (
            <button key={t.tag} onClick={() => pickTag(t.tag)} aria-pressed={tag === t.tag}
              style={{ width: 112, flexShrink: 0, borderRadius: 14, overflow: "hidden", background: S.surf, border: `1px solid ${tag === t.tag ? "rgba(255,255,255,0.4)" : S.line}`, padding: 0, cursor: "pointer", textAlign: "left", color: S.ink, fontFamily: "Manrope, sans-serif" }}>
              <span aria-hidden style={{ display: "block", height: 78, background: sceneFor(t.tag) }} />
              <span style={{ display: "block", padding: "8px 9px" }}>
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>#{t.tag}</span>
                <span style={{ display: "block", fontSize: 10.5, color: S.ink3, marginTop: 2 }}>{t.count ? `${compact(t.count)} post${t.count === 1 ? "" : "s"}` : "Be the first"}</span>
              </span>
            </button>
          ))}
        </div>

        <ReelsStrip onCreate={() => create.start("video")} />
        <ChallengesRow onOpen={setChallengeOpen} onStart={create.startChallenge} onSeeAll={() => nav("/feed/challenges")} />
        <CirclesRow onOpen={setCircleOpen} onFind={() => setFindCircles(true)} />

        {/* Tabs */}
        <div role="tablist" aria-label="Feed" style={{ display: "flex", gap: 22, borderBottom: `1px solid ${S.line}`, fontSize: 13.5, fontWeight: 700 }}>
          {([["foryou", "For You"], ["following", "Following"], ["trending", "Trending"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              style={{ background: "none", border: 0, padding: "8px 0", marginBottom: -1, color: tab === id ? S.ink : S.ink3, borderBottom: `2px solid ${tab === id ? S.gold : "transparent"}`, font: "inherit", cursor: "pointer" }}>
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

        {/* Feed */}
        {feed.isLoading ? <Skeletons /> : null}
        {feed.error ? <div style={{ ...card, padding: 16, fontSize: 13.5, color: "#FF8A8A" }}>{(feed.error as Error).message}</div> : null}
        {!feed.isLoading && !posts.length && !feed.error ? (
          <div style={{ ...card, padding: 24, textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <div style={{ fontFamily: "Sora, sans-serif", fontSize: 17, fontWeight: 700 }}>{tab === "following" ? "Nothing from people you follow yet" : tab === "trending" ? "Nothing trending this week yet" : challengeFilter ? "No entries you can see yet" : tag ? `No posts tagged #${tag} yet` : "No posts yet"}</div>
            <div style={{ fontSize: 13.5, color: S.ink2 }}>{tab === "following" ? "Follow a few creators and their posts will show up here." : "Be the first. Share what you're working on."}</div>
            <button onClick={() => nav("/feed/create")} style={primaryBtn({ marginTop: 4 })}><Plus size={16} /> Create a post</button>
          </div>
        ) : null}
        {posts.map((p, i) => (
          <Fragment key={p.id}>
            <PostCard post={p} onChange={updatePost} onRemove={removePost} onTag={pickTag} onChallenge={setChallengeOpen} onCircle={setCircleOpen} />
            {i === 1 && tab === "foryou" && !filtered ? <PeopleToFollow /> : null}
          </Fragment>
        ))}
        {posts.length === 1 && tab === "foryou" && !filtered ? <PeopleToFollow /> : null}
        <div ref={sentinel} />
        {feed.isFetchingNextPage ? <div style={{ display: "flex", justifyContent: "center", padding: 12, color: S.ink3 }}><Loader2 size={20} className="animate-spin" /></div> : null}
        {!feed.hasNextPage && posts.length > 4 ? <div style={{ textAlign: "center", fontSize: 12.5, color: S.ink3, padding: 8 }}>You're all caught up</div> : null}
      </div>

      {/* Phones create from the + in Social's tab bar; wide screens (no tab bar) keep this button */}
      {shown && createPortal(
        <button onClick={() => nav("/feed/create")} aria-label="Create" className="hidden lg:flex"
          style={{ position: "fixed", right: 22, bottom: 32, zIndex: 50, width: 56, height: 56, borderRadius: "50%", border: 0, background: S.btn, color: S.btnText, alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 10px 28px rgba(0,0,0,0.55)" }}>
          <Plus size={26} strokeWidth={2.4} />
        </button>,
        document.body,
      )}

      {stories ? <StoryViewer groups={stories.groups} start={stories.index} onClose={() => setStories(null)} /> : null}
      <CircleSheet id={circleOpen} onClose={() => setCircleOpen(null)} onPost={(c) => { setCircleOpen(null); create.start("text", { circle: { id: c.id, name: c.name, emoji: c.emoji } }); }}
        onOpenComments={(p) => { setCircleOpen(null); nav(`/feed/post/${p.id}`); }} onTag={pickTag} onPostChange={updatePost} />
      <FindCirclesSheet open={findCircles} onClose={() => setFindCircles(false)} onOpen={(id) => { setFindCircles(false); setCircleOpen(id); }} />
      <ChallengeSheet id={challengeOpen} onClose={() => setChallengeOpen(null)} onJoin={joinChallenge} onSeeAll={seeAllEntries}
        onPostChange={updatePost} onOpenComments={(p) => { setChallengeOpen(null); nav(`/feed/post/${p.id}`); }} onTag={pickTag} />
      {create.ui}
    </div>
  );
}

function MomentCard({ prompt, answered, answers, friends, onRespond }: { prompt?: string; answered: boolean; answers: number; friends: { username: string; avatarUrl: string | null; avatarEmoji: string | null }[]; onRespond: () => void }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 20, padding: 18, background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))", border: `1px solid ${S.line2}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 10px 30px rgba(0,0,0,0.25)", minHeight: 150 }}>
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
            <button onClick={() => nav(`/u/${c.id}`)} aria-label={`Open ${c.username}'s profile`} style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>
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
