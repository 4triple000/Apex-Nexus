/**
 * The + button: "Create on Apex" grid, and the composer it opens.
 * Ready now: post (with an optional photo), poll, game, Apex Moment answer.
 * Coming soon tiles are shown but disabled, so nobody hits a dead end.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PenLine, Video, Mic, Smile, HelpCircle, Sparkles, BarChart3, Gamepad2, Trophy, Lightbulb, Image as ImageIcon, X, Globe, Users, Lock, Plus, Loader2 } from "lucide-react";
import { socialApi, resizePhoto, type Post, type Visibility } from "@/lib/socialApi";
import { useAuth } from "@/contexts/AuthContext";
import { S, Avatar, Sheet, primaryBtn, ghostBtn, sceneFor } from "./ui";

export type ComposeMode = "text" | "poll" | "game" | "moment";

const TILES: { id: ComposeMode | null; icon: typeof PenLine; title: string; sub: string }[] = [
  { id: "text", icon: PenLine, title: "Post", sub: "Share anything" },
  { id: null, icon: Video, title: "Video", sub: "Record or upload" },
  { id: null, icon: Mic, title: "Voice", sub: "Speak your mind" },
  { id: null, icon: Smile, title: "Meme", sub: "Make it funny" },
  { id: null, icon: HelpCircle, title: "Ask Apex", sub: "Get answers" },
  { id: null, icon: Sparkles, title: "AI Creation", sub: "Create with AI" },
  { id: "poll", icon: BarChart3, title: "Poll", sub: "Ask the community" },
  { id: "game", icon: Gamepad2, title: "Game", sub: "Share a game" },
  { id: null, icon: Trophy, title: "Challenge", sub: "Start something" },
];

export function CreateSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (mode: ComposeMode, idea?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const surprise = async () => {
    setBusy(true);
    try {
      const ideas = await socialApi.ideas();
      onPick("text", ideas[Math.floor(Math.random() * ideas.length)]);
    } catch {
      onPick("text");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} label="Create on Apex" title={<span>Create on Apex<span style={{ display: "block", fontFamily: "Manrope, sans-serif", fontSize: 13, fontWeight: 500, color: S.ink2, marginTop: 2 }}>What do you want to make?</span></span>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {TILES.map((t) => {
          const ready = !!t.id;
          return (
            <button key={t.title} disabled={!ready} onClick={() => t.id && onPick(t.id)}
              style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: "14px 12px", minHeight: 96, borderRadius: 16, background: S.surf, border: `1px solid ${S.line}`, color: S.ink, textAlign: "left", cursor: ready ? "pointer" : "default", opacity: ready ? 1 : 0.5, fontFamily: "Manrope, sans-serif" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.06)" }}><t.icon size={18} /></span>
              <span>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>{t.title}</span>
                <span style={{ display: "block", fontSize: 11, color: S.ink3, marginTop: 2 }}>{ready ? t.sub : "Coming soon"}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 16, padding: 16, borderRadius: 20, background: "linear-gradient(135deg, #1B1B20, #121215)", border: `1px solid ${S.line2}`, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: S.goldSoft, flexShrink: 0 }}><Lightbulb size={19} color={S.gold} /></span>
          <div><div style={{ fontSize: 14, fontWeight: 800 }}>Not sure what to post?</div><div style={{ fontSize: 12.5, color: S.ink2, marginTop: 3 }}>Apex can give you an idea to start from.</div></div>
        </div>
        <button onClick={() => void surprise()} disabled={busy} style={primaryBtn({ height: 44 })}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} Surprise me <Sparkles size={15} />
        </button>
      </div>
    </Sheet>
  );
}

const VIS: { id: Visibility; label: string; icon: typeof Globe; sub: string }[] = [
  { id: "public", label: "Public", icon: Globe, sub: "Anyone on Apex" },
  { id: "followers", label: "Followers", icon: Users, sub: "People who follow you" },
  { id: "private", label: "Only me", icon: Lock, sub: "Just you" },
];

interface GameEntry { id: number; name: string; creatorName: string; playCount: number }

export function Composer({ open, mode, idea, prompt, onClose, onPosted }: {
  open: boolean;
  mode: ComposeMode;
  /** Starter idea from "Surprise me" */
  idea?: string;
  /** Today's Apex Moment prompt (moment mode) */
  prompt?: string;
  onClose: () => void;
  onPosted: (p: Post) => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [gameId, setGameId] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [visOpen, setVisOpen] = useState(false);
  const [photo, setPhoto] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setBody(""); setOptions(["", ""]); setGameId(null); setPhoto(null); setError(null);
  }, [open, mode]);

  const games = useQuery({
    queryKey: ["social-game-picker"],
    enabled: open && mode === "game",
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/game-feed?limit=24`);
      return (((await res.json()) as { entries?: GameEntry[] }).entries ?? []).slice(0, 24);
    },
  });

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setError(null);
    try { setPhoto(await resizePhoto(file)); } catch (e) { setError((e as Error).message || "Couldn't read that photo."); }
  };

  const filledOptions = options.map((o) => o.trim()).filter(Boolean);
  const canPost = !busy && (
    mode === "poll" ? !!body.trim() && filledOptions.length >= 2 :
    mode === "game" ? !!gameId :
    !!body.trim() || !!photo
  );

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      let mediaId: number | undefined;
      if (photo) mediaId = (await socialApi.uploadPhoto(photo.dataUrl, photo.width, photo.height)).id;
      const kind: Post["kind"] = mode === "moment" ? "moment" : mode === "poll" ? "poll" : mode === "game" ? "game" : photo ? "photo" : "text";
      const created = await socialApi.create({ kind, body: body.trim(), mediaId, pollOptions: mode === "poll" ? filledOptions : undefined, gameId: gameId ?? undefined, visibility });
      onPosted(created);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const vis = VIS.find((v) => v.id === visibility)!;
  const title = mode === "poll" ? "New poll" : mode === "game" ? "Share a game" : mode === "moment" ? "Apex Moment" : "New post";
  const placeholder = mode === "poll" ? "Ask a question…" : mode === "game" ? "Say something about it (optional)" : mode === "moment" ? "Your answer…" : idea ? idea : "What's on your mind? Use #tags to join a trend";

  return (
    <Sheet open={open} onClose={onClose} label={title} title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {mode === "moment" && prompt ? (
          <div style={{ padding: 14, borderRadius: 16, background: "linear-gradient(135deg, #1D1D22, #141417)", border: `1px solid ${S.line}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: S.gold }}>TODAY'S PROMPT</div>
            <div style={{ fontFamily: "Sora, sans-serif", fontSize: 18, fontWeight: 700, marginTop: 6, lineHeight: 1.3 }}>{prompt}</div>
          </div>
        ) : null}
        {mode === "text" && idea ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: S.gold }}><Sparkles size={14} /> Idea: <span style={{ color: S.ink2 }}>{idea}</span></div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user ? <Avatar user={{ username: user.username, avatarUrl: (user as { avatarUrl?: string | null }).avatarUrl ?? null, avatarEmoji: null }} size={40} /> : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{user?.username ?? "You"}</span>
            <button onClick={() => setVisOpen((v) => !v)} aria-expanded={visOpen} style={ghostBtn({ height: 28, padding: "0 10px", borderRadius: 14, fontSize: 12 })}><vis.icon size={13} /> {vis.label}</button>
          </div>
        </div>
        {visOpen ? (
          <div role="radiogroup" aria-label="Who can see this" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {VIS.map((v) => (
              <button key={v.id} role="radio" aria-checked={visibility === v.id} onClick={() => { setVisibility(v.id); setVisOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: visibility === v.id ? "rgba(255,255,255,0.06)" : "none", border: `1px solid ${visibility === v.id ? "rgba(255,255,255,0.22)" : "transparent"}`, color: S.ink, cursor: "pointer", textAlign: "left", fontFamily: "Manrope, sans-serif" }}>
                <v.icon size={17} /><span style={{ flexGrow: 1 }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>{v.label}</span><span style={{ display: "block", fontSize: 11.5, color: S.ink3 }}>{v.sub}</span></span>
              </button>
            ))}
          </div>
        ) : null}

        <label style={{ display: "block" }}>
          <span style={{ position: "absolute", left: -9999 }}>{mode === "poll" ? "Question" : "Post text"}</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} rows={mode === "game" ? 2 : 4} maxLength={2000} autoFocus
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 80, borderRadius: 14, padding: 12, background: "rgba(0,0,0,0.3)", border: `1px solid ${S.line2}`, color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 15, lineHeight: 1.5, outline: "none" }} />
        </label>

        {mode === "poll" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <label style={{ flexGrow: 1 }}>
                  <span style={{ position: "absolute", left: -9999 }}>Choice {i + 1}</span>
                  <input value={o} maxLength={80} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Choice ${i + 1}`}
                    style={{ width: "100%", boxSizing: "border-box", height: 42, borderRadius: 12, padding: "0 12px", background: "rgba(0,0,0,0.3)", border: `1px solid ${S.line2}`, color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 14, outline: "none" }} />
                </label>
                {options.length > 2 ? <button aria-label={`Remove choice ${i + 1}`} onClick={() => setOptions(options.filter((_, j) => j !== i))} style={ghostBtn({ width: 42, padding: 0 })}><X size={16} /></button> : null}
              </div>
            ))}
            {options.length < 4 ? <button onClick={() => setOptions([...options, ""])} style={ghostBtn({ alignSelf: "flex-start", height: 34, fontSize: 12.5 })}><Plus size={15} /> Add choice</button> : null}
          </div>
        ) : null}

        {mode === "game" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: S.ink2 }}>Pick a game</div>
            {games.isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading games…</div> : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, maxHeight: 260, overflowY: "auto" }}>
              {(games.data ?? []).map((g) => (
                <button key={g.id} onClick={() => setGameId(g.id)} aria-pressed={gameId === g.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 12, background: S.surf, border: `1px solid ${gameId === g.id ? "rgba(255,255,255,0.4)" : S.line}`, color: S.ink, cursor: "pointer", textAlign: "left", fontFamily: "Manrope, sans-serif" }}>
                  <span aria-hidden style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: sceneFor(g.name) }} />
                  <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</span><span style={{ display: "block", fontSize: 11, color: S.ink3 }}>by {g.creatorName}</span></span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {photo ? (
          <div style={{ position: "relative" }}>
            <img src={photo.dataUrl} alt="Selected photo" style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 16, border: `1px solid ${S.line}` }} />
            <button onClick={() => setPhoto(null)} aria-label="Remove photo" style={{ position: "absolute", top: 8, right: 8, width: 34, height: 34, borderRadius: "50%", border: 0, background: "rgba(0,0,0,0.65)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={16} /></button>
          </div>
        ) : null}

        {error ? <div role="alert" style={{ fontSize: 13, color: "#FF8A8A" }}>{error}</div> : null}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {mode === "text" || mode === "moment" ? (
            <>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void pickPhoto(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} style={ghostBtn({ height: 38 })}><ImageIcon size={16} /> Photo</button>
            </>
          ) : null}
          <span style={{ flexGrow: 1, textAlign: "right", fontSize: 11.5, color: S.ink3 }}>{body.length > 1800 ? `${2000 - body.length} left` : ""}</span>
          <button onClick={() => void submit()} disabled={!canPost} style={primaryBtn({ height: 40, opacity: canPost ? 1 : 0.45, cursor: canPost ? "pointer" : "default" })}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Post
          </button>
        </div>
      </div>
    </Sheet>
  );
}
