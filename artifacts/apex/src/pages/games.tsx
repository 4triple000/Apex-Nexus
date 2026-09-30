/**
 * Games — where people find and play games. Play opens the game full screen straight away;
 * Create (and Remix from the pause menu) opens the Apex Engine.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus, Search, Heart, X } from "lucide-react";
import { DEMO_GAMES } from "@/engine/demoGames";
import { consumePendingGame } from "@/data/gameRegistry";
import type { GameConfig } from "@/engine/types";
import { GamePlayer } from "@/components/engine/GamePlayer";
import { engineApi } from "@/lib/engineApi";
import { getAuthSessionId } from "@/lib/authSession";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
// Same anonymous id the game feed has always used for likes and plays
const FEED_SESSION = (() => {
  try {
    let s = localStorage.getItem("apex-session-id");
    if (!s) { s = Math.random().toString(36).slice(2); localStorage.setItem("apex-session-id", s); }
    return s;
  } catch { return "anon"; }
})();
const feedFetch = (path: string, init?: RequestInit) =>
  fetch(`${BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", "x-session-id": FEED_SESSION, ...init?.headers } });

interface FeedEntry {
  id: number;
  name: string;
  creatorName: string;
  gameConfig: GameConfig;
  likeCount: number;
  playCount: number;
  tags: string[];
  isLiked: boolean;
  createdAt: string;
}

/** Something that can be played: a community game, an Apex original, or one of your projects. */
interface Playable {
  key: string;
  name: string;
  by: string;
  config: GameConfig;
  plays?: number;
  likes?: number;
  liked?: boolean;
  feedId?: number;
}

const ART: Record<string, string> = {
  fps: "radial-gradient(60% 80% at 70% 30%, #ff4fa3 0, transparent 60%), radial-gradient(70% 90% at 20% 70%, #00c2ff 0, transparent 60%), linear-gradient(160deg, #221b55, #0d0b22)",
  openworld: "radial-gradient(80% 90% at 30% 20%, #ffb86b, transparent 60%), linear-gradient(160deg, #3b1f5e, #120d26)",
  gta: "radial-gradient(80% 90% at 30% 20%, #ffb86b, transparent 60%), linear-gradient(160deg, #3b1f5e, #120d26)",
  basketball: "radial-gradient(80% 90% at 70% 30%, #ff8a4c, transparent 60%), linear-gradient(160deg, #3a1f12, #120a08)",
  shooter: "radial-gradient(80% 90% at 30% 70%, #ff4fa3, transparent 60%), linear-gradient(160deg, #3a1236, #0d0918)",
  topdown: "radial-gradient(80% 90% at 50% 20%, #8b7bff, transparent 60%), linear-gradient(160deg, #1b1b4f, #0a0a1d)",
  platformer: "radial-gradient(80% 90% at 70% 30%, #4ade80, transparent 60%), linear-gradient(160deg, #0e3a4a, #0b0f22)",
};
const artFor = (c: GameConfig) => ART[c.gameMode ?? "platformer"] ?? ART.platformer;

const MODE_LABEL: Record<string, string> = {
  fps: "3D shooter", openworld: "Open world", gta: "Open world", basketball: "Sports",
  shooter: "Shooter", topdown: "Top-down", platformer: "Platformer",
};
const modeLabel = (c: GameConfig) => MODE_LABEL[c.gameMode ?? "platformer"] ?? "Game";

const FILTERS: { id: string; label: string; modes?: string[] }[] = [
  { id: "all", label: "For you" },
  { id: "shooters", label: "Shooters", modes: ["fps", "shooter", "topdown"] },
  { id: "sports", label: "Sports", modes: ["basketball"] },
  { id: "platform", label: "Platform", modes: ["platformer"] },
  { id: "world", label: "Open world", modes: ["openworld", "gta"] },
];

const RECENT_KEY = "apex_recent_games";
interface Recent { key: string; name: string; mode?: string; at: number }
const readRecent = (): Recent[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; } };
const pushRecent = (p: Playable) => {
  try {
    const list = [{ key: p.key, name: p.name, mode: p.config.gameMode, at: Date.now() }, ...readRecent().filter((r) => r.key !== p.key)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* private mode */ }
};

export default function GamesPage() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [playing, setPlaying] = useState<Playable | null>(null);
  const [recent, setRecent] = useState<Recent[]>(readRecent);
  const [remixError, setRemixError] = useState<string | null>(null);

  const feed = useQuery({
    queryKey: ["game-feed-web"],
    queryFn: async () => {
      const res = await feedFetch("/api/game-feed");
      const data = await res.json();
      return (data.entries ?? []) as FeedEntry[];
    },
  });
  const signedIn = !!getAuthSessionId();
  const mine = useQuery({ queryKey: ["engine-projects"], queryFn: engineApi.list, enabled: signedIn });

  const originals: Playable[] = useMemo(() => DEMO_GAMES.map((g) => ({ key: `demo:${g.name}`, name: g.name, by: "Apex", config: g as GameConfig })), []);
  const community: Playable[] = useMemo(() => (feed.data ?? []).filter((e) => e.gameConfig?.player).map((e) => ({
    key: `feed:${e.id}`, name: e.name, by: e.creatorName, config: e.gameConfig, plays: e.playCount, likes: e.likeCount, liked: e.isLiked, feedId: e.id,
  })), [feed.data]);

  const all = useMemo(() => [...community, ...originals], [community, originals]);
  const byKey = (key: string) => all.find((p) => p.key === key);

  const matches = (p: Playable) => {
    const f = FILTERS.find((x) => x.id === filter);
    if (f?.modes && !f.modes.includes(p.config.gameMode ?? "platformer")) return false;
    return !query.trim() || `${p.name} ${p.by} ${modeLabel(p.config)}`.toLowerCase().includes(query.trim().toLowerCase());
  };

  const featured = useMemo(() => {
    const top = [...community].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))[0];
    return top && (top.plays ?? 0) > 0 ? top : originals.find((o) => o.config.gameMode === "fps") ?? originals[0];
  }, [community, originals]);

  const play = (p: Playable) => {
    pushRecent(p);
    setRecent(readRecent());
    if (p.feedId) void feedFetch(`/api/game-feed/${p.feedId}/play`, { method: "POST" }).catch(() => undefined);
    setPlaying(p);
  };

  // A game sent from elsewhere: ?play=<feed id> (from the phone app) or the You tab's Play button
  useEffect(() => {
    const pending = consumePendingGame();
    if (pending) { play({ key: `mine:${pending.name}`, name: pending.name, by: "You", config: pending }); return; }
    const id = new URLSearchParams(window.location.search).get("play");
    if (id && feed.data) {
      const p = byKey(`feed:${id}`);
      if (p) play(p);
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.data]);

  const like = async (p: Playable) => {
    if (!p.feedId) return;
    await feedFetch(`/api/game-feed/${p.feedId}/like`, { method: "POST" }).catch(() => undefined);
    qc.setQueryData<FeedEntry[]>(["game-feed-web"], (old) => old?.map((e) => e.id === p.feedId ? { ...e, isLiked: !e.isLiked, likeCount: e.likeCount + (e.isLiked ? -1 : 1) } : e));
    setPlaying((cur) => cur && cur.key === p.key ? { ...cur, liked: !cur.liked } : cur);
  };

  const remix = async (p: Playable) => {
    if (!signedIn) { nav("/login"); return; }
    try {
      const { project } = await engineApi.create({ target: "apex", title: `${p.name} Remix`.slice(0, 80), config: { ...p.config, name: `${p.name} Remix` }, prompt: `A remix of ${p.name}` });
      setPlaying(null);
      nav(`/game-engine/${project.id}`);
    } catch (e) {
      setRemixError(e instanceof Error ? e.message : "Couldn't make a copy. Try again.");
    }
  };

  const continueList = recent.map((r) => byKey(r.key)).filter((p): p is Playable => !!p).slice(0, 2);
  const shown = community.filter(matches);
  const shownOriginals = originals.filter(matches);
  const myApexGames = (mine.data ?? []).filter((m) => m.target === "apex").slice(0, 4);

  return (
    <div className="mg-font" style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h1 className="mg-display" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--mg-ink)" }}>Games</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setSearching((v) => !v); if (searching) setQuery(""); }} aria-label={searching ? "Close search" : "Search games"} className="mg-cc mg-focus" style={{ width: 40, height: 40 }}>
              {searching ? <X size={17} strokeWidth={2.4} /> : <Search size={17} strokeWidth={2.4} />}
            </button>
            <button onClick={() => nav("/game-engine")} className="mg-cc on mg-focus" style={{ height: 40, width: "auto", borderRadius: 20, padding: "0 14px", gap: 6, display: "inline-flex", fontWeight: 700, fontSize: 13.5 }}>
              <Plus size={16} strokeWidth={2.6} /> Create
            </button>
          </div>
        </header>

        {searching && (
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games" aria-label="Search games"
            style={{ height: 44, borderRadius: 22, padding: "0 16px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)", color: "var(--mg-ink)", fontSize: 15, outline: "none", fontFamily: "inherit" }} />
        )}

        {featured && !query && (
          <button onClick={() => play(featured)} className="mg-press mg-focus" aria-label={`Play ${featured.name}`}
            style={{ position: "relative", height: 220, borderRadius: 28, overflow: "hidden", border: "1px solid rgba(255,255,255,0.16)", background: artFor(featured.config), cursor: "pointer", textAlign: "left", padding: 0 }}>
            <span aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)", backgroundSize: "26px 26px", transform: "perspective(300px) rotateX(58deg) translateY(70px) scale(1.7)", transformOrigin: "bottom" }} />
            <span aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(8,7,20,0.88))" }} />
            <span style={{ position: "absolute", left: 16, bottom: 14, right: 130, display: "grid", gap: 2 }}>
              <span style={{ fontSize: 11, letterSpacing: "0.12em", fontWeight: 700, color: "var(--mg-ink-2)" }}>FEATURED · {modeLabel(featured.config).toUpperCase()}</span>
              <span className="mg-display" style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{featured.name}</span>
              <span style={{ fontSize: 12.5, color: "var(--mg-ink-2)" }}>by {featured.by}{featured.plays ? ` · ${featured.plays.toLocaleString()} plays` : ""}</span>
            </span>
            <span style={{ position: "absolute", right: 16, bottom: 16, height: 40, padding: "0 16px", borderRadius: 20, background: "#fff", color: "#1C1640", fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Play size={15} fill="currentColor" /> Play
            </span>
          </button>
        )}

        <div role="radiogroup" aria-label="Filter games" style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
          {FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <button key={f.id} role="radio" aria-checked={on} onClick={() => setFilter(f.id)} className="mg-press mg-focus"
                style={{ flexShrink: 0, height: 34, padding: "0 14px", borderRadius: 17, fontSize: 13, fontWeight: 600, cursor: "pointer", color: on ? "#1C1640" : "var(--mg-ink-2)", background: on ? "#fff" : "rgba(255,255,255,0.08)", border: `1px solid ${on ? "#fff" : "rgba(255,255,255,0.14)"}` }}>
                {f.label}
              </button>
            );
          })}
        </div>

        {continueList.length > 0 && !query && (
          <section style={{ display: "grid", gap: 8 }}>
            <Label>Continue playing</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
              {continueList.map((p) => (
                <button key={p.key} onClick={() => play(p)} className="mg-press mg-focus mg-cc-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, cursor: "pointer", textAlign: "left", color: "var(--mg-ink)", borderRadius: 20, borderWidth: 1 }}>
                  <span style={{ width: 48, height: 48, borderRadius: 14, background: artFor(p.config), flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: "var(--mg-ink-3)" }}>{modeLabel(p.config)} · by {p.by}</span>
                  </span>
                  <span className="mg-cc on" style={{ width: 36, height: 36 }}><Play size={14} fill="currentColor" /></span>
                </button>
              ))}
            </div>
          </section>
        )}

        {myApexGames.length > 0 && !query && (
          <section style={{ display: "grid", gap: 8 }}>
            <Label>Your games</Label>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
              {myApexGames.map((m) => (
                <button key={m.id} onClick={() => nav(`/game-engine/${m.id}`)} className="mg-press mg-focus mg-cc-card" style={{ flexShrink: 0, padding: "10px 14px", borderRadius: 18, borderWidth: 1, color: "var(--mg-ink)", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 13.5 }}>{m.title}</span>
                  <span style={{ fontSize: 11.5, color: "var(--mg-ink-3)" }}>Open in Engine</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section style={{ display: "grid", gap: 8 }}>
          <Label>Community</Label>
          {feed.isLoading ? (
            <Grid>{[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 150, borderRadius: 22, background: "rgba(255,255,255,0.06)" }} />)}</Grid>
          ) : shown.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--mg-ink-3)" }}>
              {query || filter !== "all" ? "No community games match." : "No community games yet. Make one with Create and publish it."}
            </p>
          ) : (
            <Grid>{shown.map((p) => <Tile key={p.key} p={p} onPlay={() => play(p)} onLike={() => like(p)} />)}</Grid>
          )}
        </section>

        {shownOriginals.length > 0 && (
          <section style={{ display: "grid", gap: 8 }}>
            <Label>Apex originals</Label>
            <Grid>{shownOriginals.map((p) => <Tile key={p.key} p={p} onPlay={() => play(p)} />)}</Grid>
          </section>
        )}
      </div>

      {playing && (
        <GamePlayer
          config={playing.config}
          title={playing.name}
          creator={playing.by}
          liked={playing.liked}
          onLike={playing.feedId ? () => like(playing) : undefined}
          onRemix={() => remix(playing)}
          onQuit={() => { setPlaying(null); setRemixError(null); }}
          shareUrl={playing.feedId ? `${window.location.origin}${BASE}/games?play=${playing.feedId}` : undefined}
        />
      )}
      {remixError && playing && (
        <p role="alert" style={{ position: "fixed", left: 16, right: 16, top: 16, zIndex: 210, margin: 0, padding: "10px 14px", borderRadius: 14, background: "#2a1030", color: "#FFB3CF", fontSize: 13.5, textAlign: "center" }}>{remixError}</p>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mg-ink-3)" }}>{children}</span>;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>{children}</div>;
}

function Tile({ p, onPlay, onLike }: { p: Playable; onPlay: () => void; onLike?: () => void }) {
  return (
    <div style={{ position: "relative" }}>
      <button onClick={onPlay} aria-label={`Play ${p.name}`} className="mg-press mg-focus"
        style={{ position: "relative", width: "100%", height: 150, borderRadius: 22, overflow: "hidden", border: "1px solid rgba(255,255,255,0.14)", background: artFor(p.config), cursor: "pointer", padding: 0, textAlign: "left" }}>
        <span aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 35%, rgba(8,7,20,0.9))" }} />
        <span style={{ position: "absolute", left: 12, right: 12, bottom: 10, display: "grid", gap: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
          <span style={{ fontSize: 11.5, color: "var(--mg-ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.plays !== undefined ? `${p.plays.toLocaleString()} plays · ` : ""}{modeLabel(p.config)}
          </span>
        </span>
      </button>
      {onLike && (
        <button onClick={onLike} aria-label={p.liked ? "Unlike" : "Like"} aria-pressed={!!p.liked} className="mg-cc mg-focus"
          style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, color: p.liked ? "#FF4FA3" : "#fff", background: "rgba(8,7,20,0.4)" }}>
          <Heart size={14} strokeWidth={2.4} fill={p.liked ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}
