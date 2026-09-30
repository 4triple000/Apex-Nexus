/**
 * Social — people to follow and what the community is making: trending creations,
 * top community games, and new posts from the people you follow.
 * (Replaces the separate Social game feed and Explore pages.)
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Play, Heart, UserPlus, TrendingUp, Sparkles, Users } from "lucide-react";
import { NotificationBell } from "@/components/social/NotificationBell";
import { FeedCard } from "@/components/social/FeedCard";
import { useExplore, useFeed, useFollow, useLike, useLikedIds, useMyProfile, type SocialProject } from "@/hooks/useSocial";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface GameEntry { id: number; name: string; creatorName: string; likeCount: number; playCount: number; gameConfig?: { gameMode?: string; player?: unknown } }

const GAME_ART: Record<string, string> = {
  fps: "radial-gradient(60% 80% at 70% 30%, #ff4fa3 0, transparent 60%), radial-gradient(70% 90% at 20% 70%, #00c2ff 0, transparent 60%), linear-gradient(160deg, #221b55, #0d0b22)",
  openworld: "radial-gradient(80% 90% at 30% 20%, #ffb86b, transparent 60%), linear-gradient(160deg, #3b1f5e, #120d26)",
  basketball: "radial-gradient(80% 90% at 70% 30%, #ff8a4c, transparent 60%), linear-gradient(160deg, #3a1f12, #120a08)",
  shooter: "radial-gradient(80% 90% at 30% 70%, #ff4fa3, transparent 60%), linear-gradient(160deg, #3a1236, #0d0918)",
  topdown: "radial-gradient(80% 90% at 50% 20%, #8b7bff, transparent 60%), linear-gradient(160deg, #1b1b4f, #0a0a1d)",
  platformer: "radial-gradient(80% 90% at 70% 30%, #4ade80, transparent 60%), linear-gradient(160deg, #0e3a4a, #0b0f22)",
};

const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mg-ink-3)", display: "flex", alignItems: "center", gap: 6 };

export default function SocialPage() {
  const [, nav] = useLocation();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const explore = useExplore();
  const feed = useFeed();
  const me = useMyProfile().data?.user;
  const follow = useFollow();
  const like = useLike();
  const [followed, setFollowed] = useState<Set<number>>(new Set());

  const games = useQuery({
    queryKey: ["social-top-games"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/game-feed`);
      const data = await res.json();
      return (data.entries ?? []) as GameEntry[];
    },
  });

  const creators = (explore.data?.suggestedCreators ?? []).filter((c) => c.id !== me?.id);
  const trending = explore.data?.trendingProjects ?? [];
  const following = feed.data?.following ?? [];
  const recent = feed.data?.recent ?? [];
  const topGames = (games.data ?? []).filter((g) => g.gameConfig?.player).sort((a, b) => (b.likeCount * 2 + b.playCount) - (a.likeCount * 2 + a.playCount)).slice(0, 8);

  const allProjects = [...trending, ...following, ...recent];
  const liked = new Set(useLikedIds(allProjects.map((p) => p.id)).data?.likedIds ?? []);

  const card = (p: SocialProject) => (
    <FeedCard key={p.id} project={p} liked={liked.has(p.id)} compact
      onLike={(id) => like.mutate({ projectId: id })}
      onRun={(id) => nav(`/marketplace?run=${id}`)}
      onCreatorClick={(authorId) => nav(`/profile/${authorId}`)} />
  );

  return (
    <div className="mg-font" style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h1 className="mg-display" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--mg-ink)" }}>Social</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--mg-ink-2)" }}>Follow creators and see what everyone's making.</p>
          </div>
          <NotificationBell />
        </header>

        <div role="tablist" aria-label="Social feed" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, borderRadius: 18, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {([["foryou", "For you"], ["following", "Following"]] as const).map(([id, text]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="mg-focus"
              style={{ height: 36, borderRadius: 14, border: 0, fontSize: 13.5, fontWeight: 700, cursor: "pointer", color: tab === id ? "#1C1640" : "var(--mg-ink-2)", background: tab === id ? "#fff" : "transparent" }}>
              {text}
            </button>
          ))}
        </div>

        {/* People to follow */}
        <section style={{ display: "grid", gap: 10 }}>
          <span style={label}><UserPlus size={13} /> People to follow</span>
          {explore.isLoading ? (
            <div style={{ display: "flex", gap: 10 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="mg-cc-card" style={{ width: 118, height: 150, flexShrink: 0, borderWidth: 1, opacity: 0.5 }} />)}</div>
          ) : creators.length === 0 ? (
            <p style={empty}>No suggestions yet. Publish a game or creation and you'll show up here for others.</p>
          ) : (
            <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
              {creators.map((c) => {
                const done = followed.has(c.id);
                return (
                  <div key={c.id} className="mg-cc-card" style={{ width: 118, flexShrink: 0, borderWidth: 1, borderRadius: 22, padding: 12, display: "grid", justifyItems: "center", gap: 6, textAlign: "center" }}>
                    <button onClick={() => nav(`/profile/${c.id}`)} aria-label={`Open ${c.username}'s profile`} className="mg-cc mg-focus" style={{ width: 54, height: 54, fontSize: 26 }}>{c.avatarEmoji}</button>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--mg-ink)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.username}</span>
                    <span style={{ fontSize: 11, color: "var(--mg-ink-3)" }}>{c.followersCount} followers</span>
                    <button disabled={done} onClick={() => { follow.mutate({ targetUserId: c.id }); setFollowed((s) => new Set(s).add(c.id)); }} className="mg-press mg-focus"
                      style={{ height: 28, width: "100%", borderRadius: 14, border: 0, fontSize: 12, fontWeight: 700, cursor: done ? "default" : "pointer", color: done ? "var(--mg-ink-2)" : "#1C1640", background: done ? "rgba(255,255,255,0.1)" : "#fff" }}>
                      {done ? "Following" : "Follow"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {tab === "following" ? (
          <section style={{ display: "grid", gap: 10 }}>
            <span style={label}><Users size={13} /> From people you follow</span>
            {feed.isLoading ? <div className="mg-cc-card" style={{ height: 110, borderWidth: 1, opacity: 0.5 }} /> : following.length === 0 ? (
              <p style={empty}>Nothing yet. Follow a few creators above and their new creations show up here.</p>
            ) : <div style={{ display: "grid", gap: 10 }}>{following.map(card)}</div>}
          </section>
        ) : (
          <>
            {/* Top community games */}
            {topGames.length > 0 && (
              <section style={{ display: "grid", gap: 10 }}>
                <span style={label}><Play size={13} /> Top community games</span>
                <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
                  {topGames.map((g) => (
                    <button key={g.id} onClick={() => nav(`/games?play=${g.id}`)} aria-label={`Play ${g.name}`} className="mg-press mg-focus"
                      style={{ position: "relative", width: 150, height: 170, flexShrink: 0, borderRadius: 22, overflow: "hidden", border: "1px solid rgba(255,255,255,0.14)", background: GAME_ART[g.gameConfig?.gameMode ?? "platformer"] ?? GAME_ART.platformer, cursor: "pointer", padding: 0, textAlign: "left" }}>
                      <span aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 35%, rgba(8,7,20,0.9))" }} />
                      <span style={{ position: "absolute", left: 12, right: 12, bottom: 10, display: "grid", gap: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</span>
                        <span style={{ fontSize: 11.5, color: "var(--mg-ink-2)", display: "flex", gap: 8 }}>
                          <span>by {g.creatorName}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Heart size={11} /> {g.likeCount}</span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section style={{ display: "grid", gap: 10 }}>
              <span style={label}><TrendingUp size={13} /> Trending creations</span>
              {explore.isLoading ? <div className="mg-cc-card" style={{ height: 110, borderWidth: 1, opacity: 0.5 }} /> : trending.length === 0 ? (
                <p style={empty}>Nothing trending yet. Publish something from the Builder or the Engine to be first.</p>
              ) : <div style={{ display: "grid", gap: 10 }}>{trending.map(card)}</div>}
            </section>

            {recent.length > 0 && (
              <section style={{ display: "grid", gap: 10 }}>
                <span style={label}><Sparkles size={13} /> New</span>
                <div style={{ display: "grid", gap: 10 }}>{recent.filter((p) => !trending.some((t) => t.id === p.id)).slice(0, 10).map(card)}</div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const empty: React.CSSProperties = { margin: 0, fontSize: 13.5, color: "var(--mg-ink-3)", lineHeight: 1.5 };
