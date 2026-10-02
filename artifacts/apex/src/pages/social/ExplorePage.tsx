/**
 * /feed/explore — Social's Explore tab: search, filter pills, Trending Now, Popular People and an Apex Moments poll.
 * Each pill narrows the page to one kind of thing (people, reels, games, music, AI, hashtags).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Hash, Heart, Play, Users } from "lucide-react";
import { SearchSheet } from "@/components/social/Search";
import { S, card, Avatar, primaryBtn, ghostBtn, sceneFor } from "@/components/social/ui";
import { socialApi, mediaSrc, compact, type Post } from "@/lib/socialApi";
import { useExplore, useFollow, useMyProfile } from "@/hooks/useSocial";

type Filter = "all" | "people" | "reels" | "games" | "music" | "ai" | "tags";
const PILLS: [Filter, string][] = [["all", "All"], ["people", "People"], ["reels", "Reels"], ["games", "Games"], ["music", "Music"], ["ai", "AI"], ["tags", "# Tags"]];

const src = (url: string) => (url.startsWith("/api/") ? mediaSrc(url) : url);

/** What a trending post is, for its label and picture. */
function describe(p: Post) {
  const firstLine = (p.body.split("\n")[0] ?? "").trim();
  const label = p.game ? "GAME" : p.audio ? "MUSIC" : p.video ? "REEL" : p.kind === "ask" || p.tags.includes("aiart") ? "AI" : p.poll ? "POLL" : p.debate ? "DEBATE" : p.media ? "PHOTO" : "POST";
  const title = p.game?.name ?? (firstLine || ({ REEL: "Reel", MUSIC: "Voice note", PHOTO: "Photo", AI: "AI creation" } as Record<string, string>)[label] || "Post");
  const picture = p.video?.poster ? `center / cover no-repeat url("${src(p.video.poster)}")` : p.media ? `center / cover no-repeat url("${src(p.media.url)}")` : sceneFor(p.game?.name ?? p.id);
  const stat = p.game ? `${compact(p.game.playCount)} plays` : `${compact(p.reactionCount)} likes`;
  return { title, label, picture, stat };
}

export default function ExplorePage() {
  const [, nav] = useLocation();
  const [filter, setFilter] = useState<Filter>("all");
  const [searchOpen, setSearchOpen] = useState(false);

  const trending = useQuery({ queryKey: ["social-explore-trending"], queryFn: () => socialApi.feed("trending"), staleTime: 60_000 });
  const reels = useQuery({ queryKey: ["social-reels-explore"], queryFn: () => socialApi.reels(), staleTime: 60_000, enabled: filter === "reels" });
  const tags = useQuery({ queryKey: ["social-trending"], queryFn: socialApi.trending, staleTime: 120_000 });
  const moment = useQuery({ queryKey: ["social-moment"], queryFn: socialApi.moment, staleTime: 60_000 });

  const posts = trending.data?.posts ?? [];
  const open = (p: Post) => (p.game ? nav(`/games?play=${p.game.id}`) : p.video ? nav(`/feed/reels?start=${p.id}`) : nav(`/feed/post/${p.id}`));
  const ofKind: Record<"games" | "music" | "ai", Post[]> = {
    games: posts.filter((p) => p.game),
    music: posts.filter((p) => p.audio),
    ai: posts.filter((p) => p.kind === "ask" || p.tags.includes("aiart")),
  };
  // Trending Now leads with posts that have a picture or a game
  const showcase = [...posts].sort((a, b) => Number(!!(b.media || b.video || b.game)) - Number(!!(a.media || a.video || a.game))).slice(0, 10);
  const poll = posts.find((p) => p.poll && p.poll.options.length >= 2);

  return (
    <div className="mg-font" style={{ flex: 1, overflowY: "auto", background: "transparent", color: S.ink }}>
      <div className="social-bar" style={{ padding: "10px 0 0" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 32 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
            <h1 className="mg-display" style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Explore</h1>
            <button onClick={() => setSearchOpen(true)} aria-label="Search" style={{ width: 40, height: 40, borderRadius: "50%", border: 0, background: "none", color: S.ink, display: "grid", placeItems: "center", cursor: "pointer" }}><Search size={22} /></button>
          </header>

          <button onClick={() => setSearchOpen(true)} style={{ margin: "0 16px", display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 16px", borderRadius: 23, background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))", border: `1px solid ${S.line}`, color: S.ink3, fontFamily: "Manrope, sans-serif", fontSize: 14, cursor: "text", textAlign: "left" }}>
            <Search size={17} /> Search people, posts, games…
          </button>

          <div role="tablist" aria-label="Show" style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: "0 16px" }}>
            {PILLS.map(([id, label]) => {
              const on = filter === id;
              return (
                <button key={id} role="tab" aria-selected={on} onClick={() => setFilter(id)} className="mg-press"
                  style={{ height: 34, padding: "0 16px", flexShrink: 0, borderRadius: 17, border: on ? "1px solid transparent" : `1px solid ${S.line}`, background: on ? S.btn : "rgba(255,255,255,0.07)", color: on ? S.btnText : S.ink, fontFamily: "Manrope, sans-serif", fontSize: 13, fontWeight: on ? 800 : 700, cursor: "pointer" }}>
                  {label}
                </button>
              );
            })}
          </div>

          {filter === "all" ? (
            <>
              <SectionHead title="Trending Now" onSeeAll={() => nav("/feed?tab=trending")} />
              {trending.isLoading ? <Row>{[0, 1, 2].map((i) => <div key={i} style={{ ...card, width: 150, height: 232, flexShrink: 0, opacity: 0.5 }} />)}</Row> : null}
              {!trending.isLoading && !showcase.length ? <Empty text="Nothing trending yet this week. Post something and start a trend." /> : null}
              {showcase.length ? <Row>{showcase.map((p) => <TrendCard key={p.id} post={p} onOpen={() => open(p)} />)}</Row> : null}

              <SectionHead title="Popular People" onSeeAll={() => setFilter("people")} />
              <PeopleRow />

              <SectionHead title="Apex Moments" onSeeAll={() => nav("/feed/moments")} />
              <div style={{ padding: "0 16px" }}>
                {poll ? <PollCard post={poll} /> : (
                  <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{moment.data?.prompt ?? " "}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => nav("/feed/moments")} style={primaryBtn({ height: 36, borderRadius: 18, fontSize: 13 })}>{moment.data?.answered ? "See answers" : "Respond"}</button>
                      {moment.data?.answers ? <span style={{ fontSize: 12, color: S.ink3 }}>{compact(moment.data.answers)} shared today</span> : null}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}

          {filter === "people" ? <PeopleList /> : null}

          {filter === "reels" ? (
            reels.isLoading ? <Grid>{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ aspectRatio: "9 / 16", borderRadius: 14, background: S.surf }} />)}</Grid>
              : reels.data?.posts.length ? (
                <Grid>
                  {reels.data.posts.map((p) => (
                    <button key={p.id} onClick={() => nav(`/feed/reels?start=${p.id}`)} aria-label={`Play reel by ${p.author.username}`}
                      style={{ position: "relative", aspectRatio: "9 / 16", borderRadius: 14, overflow: "hidden", border: `1px solid ${S.line}`, padding: 0, cursor: "pointer", background: describe(p).picture }}>
                      <span style={{ position: "absolute", left: 6, bottom: 6, display: "flex", alignItems: "center", gap: 3, color: "#fff", fontSize: 11, fontWeight: 800, textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}><Play size={11} fill="#fff" /> {compact(p.reactionCount)}</span>
                    </button>
                  ))}
                </Grid>
              ) : <Empty text="No reels yet. Tap + to post the first one." />
          ) : null}

          {filter === "games" || filter === "music" || filter === "ai" ? (
            trending.isLoading ? null : ofKind[filter].length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, padding: "0 16px" }}>
                {ofKind[filter].map((p) => <TrendCard key={p.id} post={p} onOpen={() => open(p)} wide />)}
              </div>
            ) : <Empty text={filter === "games" ? "No games trending this week yet." : filter === "music" ? "No music or voice notes trending this week yet." : "No AI creations trending this week yet."} />
          ) : null}

          {filter === "tags" ? (
            tags.data?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
                {tags.data.map((t) => (
                  <button key={t.tag} onClick={() => nav(`/feed?tag=${encodeURIComponent(t.tag)}`)}
                    style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", color: S.ink, cursor: "pointer", textAlign: "left", fontFamily: "Manrope, sans-serif" }}>
                    <span style={{ width: 40, height: 40, borderRadius: "50%", background: S.goldSoft, display: "grid", placeItems: "center" }}><Hash size={18} color={S.gold} /></span>
                    <span style={{ flexGrow: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>#{t.tag}</span><span style={{ display: "block", fontSize: 12, color: S.ink3 }}>{compact(t.count)} posts this week</span></span>
                  </button>
                ))}
              </div>
            ) : <Empty text={tags.isLoading ? "Loading…" : "No hashtags trending yet. Add a #tag to your next post."} />
          ) : null}
        </div>
      </div>

      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} onTag={(t) => nav(`/feed?tag=${encodeURIComponent(t)}`)} onCircle={(id) => nav(`/feed?circle=${id}`)} />
    </div>
  );
}

function SectionHead({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "4px 16px 0" }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h2>
      {onSeeAll ? <button onClick={onSeeAll} style={{ background: "none", border: 0, padding: 0, color: S.gold, fontFamily: "Manrope, sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>See all</button> : null}
    </div>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", padding: "4px 16px 2px" }}>{children}</div>;
const Grid = ({ children }: { children: React.ReactNode }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, padding: "0 16px" }}>{children}</div>;
const Empty = ({ text }: { text: string }) => <div style={{ ...card, margin: "0 16px", padding: 18, fontSize: 13.5, color: S.ink2, textAlign: "center" }}>{text}</div>;

function TrendCard({ post, onOpen, wide = false }: { post: Post; onOpen: () => void; wide?: boolean }) {
  const d = describe(post);
  const music = d.label === "MUSIC";
  return (
    <button onClick={onOpen} className="mg-press"
      style={{ ...card, width: wide ? "auto" : 150, flexShrink: 0, padding: 0, overflow: "hidden", color: S.ink, cursor: "pointer", textAlign: "left", fontFamily: "Manrope, sans-serif", display: "flex", flexDirection: "column" }}>
      <span aria-hidden style={{ position: "relative", display: "block", height: 118, background: d.picture }}>
        {post.video ? <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><span style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(10,9,24,0.55)", display: "grid", placeItems: "center" }}><Play size={15} fill="#fff" color="#fff" /></span></span> : null}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 11px 12px" }}>
        <span style={{ alignSelf: "flex-start", padding: "2px 7px", borderRadius: 6, background: music ? "rgba(255,79,163,0.16)" : "rgba(255,255,255,0.1)", color: music ? "#FF9CC8" : S.ink2, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em" }}>{d.label}</span>
        <span style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</span>
        <span style={{ fontSize: 11.5, color: S.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>by {post.game?.creatorName ?? post.author.username}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11.5, color: S.ink2 }}>{post.game ? <Play size={11} /> : <Heart size={11} />} {d.stat}</span>
      </span>
    </button>
  );
}

/** Suggested creators, or (when there are none yet) the people behind this week's trending posts. */
function usePeople() {
  const explore = useExplore();
  const me = useMyProfile().data?.user;
  const trending = useQuery({ queryKey: ["social-explore-trending"], queryFn: () => socialApi.feed("trending"), staleTime: 60_000 });
  const suggested = (explore.data?.suggestedCreators ?? []).filter((c) => c.id !== me?.id).map((c) => ({ id: c.id, username: c.username, avatarEmoji: c.avatarEmoji, followersCount: c.followersCount }));
  if (suggested.length) return { loading: false, people: suggested };
  const seen = new Set<number>();
  const authors = (trending.data?.posts ?? []).map((p) => p.author).filter((a) => a.id !== me?.id && !seen.has(a.id) && seen.add(a.id));
  return { loading: explore.isLoading || trending.isLoading, people: authors.map((a) => ({ id: a.id, username: a.username, avatarEmoji: a.avatarEmoji, followersCount: null as number | null })) };
}

function FollowButton({ id, wide = false }: { id: number; wide?: boolean }) {
  const follow = useFollow();
  const [done, setDone] = useState(false);
  const style = { height: 32, width: wide ? 96 : undefined, borderRadius: 16, fontSize: 12.5 };
  return (
    <button disabled={done} onClick={() => { follow.mutate({ targetUserId: id }); setDone(true); }} style={done ? ghostBtn(style) : primaryBtn(style)}>
      {done ? "Following" : "Follow"}
    </button>
  );
}

function PeopleRow() {
  const [, nav] = useLocation();
  const { loading, people } = usePeople();
  if (loading) return null;
  if (!people.length) return <Empty text="No one to suggest yet. Invite friends to Apex." />;
  return (
    <Row>
      {people.slice(0, 10).map((c, i) => (
        <div key={c.id} style={{ width: 104, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center" }}>
          <button onClick={() => nav(`/u/${c.id}`)} aria-label={`Open ${c.username}'s profile`} style={{ background: "none", border: 0, padding: 0, marginBottom: 4, cursor: "pointer" }}>
            <Avatar user={{ username: c.username, avatarUrl: null, avatarEmoji: c.avatarEmoji }} size={66} ring={i === 0} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 800, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.username}</span>
          {c.followersCount !== null ? <span style={{ fontSize: 11, color: S.ink3 }}>{compact(c.followersCount)} followers</span> : <span style={{ fontSize: 11, color: S.ink3 }}>Trending this week</span>}
          <span style={{ marginTop: 4 }}><FollowButton id={c.id} wide /></span>
        </div>
      ))}
    </Row>
  );
}

function PeopleList() {
  const [, nav] = useLocation();
  const { loading, people } = usePeople();
  if (loading) return null;
  if (!people.length) return <Empty text="No one to suggest yet. Invite friends to Apex." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
      {people.map((c) => (
        <div key={c.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px" }}>
          <button onClick={() => nav(`/u/${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 12, flexGrow: 1, minWidth: 0, background: "none", border: 0, padding: 0, color: S.ink, cursor: "pointer", textAlign: "left", fontFamily: "Manrope, sans-serif" }}>
            <Avatar user={{ username: c.username, avatarUrl: null, avatarEmoji: c.avatarEmoji }} size={46} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.username}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: S.ink3 }}><Users size={12} /> {c.followersCount !== null ? `${compact(c.followersCount)} followers` : "Trending this week"}</span>
            </span>
          </button>
          <FollowButton id={c.id} />
        </div>
      ))}
    </div>
  );
}

function PollCard({ post }: { post: Post }) {
  const [, nav] = useLocation();
  const [poll, setPoll] = useState(post.poll!);
  const [busy, setBusy] = useState(false);
  const voted = poll.myVote !== null;
  const vote = async (i: number) => {
    if (busy || voted) return;
    setBusy(true);
    try { setPoll(await socialApi.vote(post.id, i)); } catch { /* the post page shows errors; leave the card as it was */ } finally { setBusy(false); }
  };
  const two = poll.options.length === 2;
  return (
    <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <button onClick={() => nav(`/feed/post/${post.id}`)} style={{ display: "flex", justifyContent: "space-between", gap: 12, background: "none", border: 0, padding: 0, color: S.ink, cursor: "pointer", textAlign: "left", fontFamily: "Manrope, sans-serif" }}>
        <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{post.body || "Cast your vote"}</span>
        <span style={{ fontSize: 11.5, color: S.ink3, whiteSpace: "nowrap" }}>{compact(poll.total)} {poll.total === 1 ? "vote" : "votes"}</span>
      </button>
      <div style={{ display: "flex", flexDirection: two ? "row" : "column", gap: 8 }}>
        {poll.options.map((o, i) => {
          const pct = poll.total ? Math.round((poll.counts[i]! / poll.total) * 100) : 0;
          const mine = poll.myVote === i;
          return (
            <button key={i} onClick={() => void vote(i)} disabled={voted || busy} aria-pressed={mine}
              style={{ position: "relative", flex: two ? 1 : undefined, height: 38, borderRadius: 19, overflow: "hidden", border: `1px solid ${mine ? "transparent" : S.line2}`, background: !voted && i === 0 ? S.btn : "rgba(255,255,255,0.07)", color: !voted && i === 0 ? S.btnText : S.ink, fontFamily: "Manrope, sans-serif", fontSize: 13, fontWeight: 800, cursor: voted ? "default" : "pointer" }}>
              {voted ? <span aria-hidden style={{ position: "absolute", inset: 0, width: `${pct}%`, background: mine ? "rgba(226,193,126,0.32)" : "rgba(255,255,255,0.1)" }} /> : null}
              <span style={{ position: "relative" }}>{o}{voted ? ` · ${pct}%` : ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
