/**
 * The + button: "Create on Apex" grid, and the composer it opens.
 * Ready now: post (with an optional photo), poll, debate, game, challenge entry, Apex Moment answer,
 * AI Creation (Apex drafts, you edit) and Ask Apex (opens its own sheet).
 * Apex's suggestions only fill the composer; nothing posts until the person taps Post.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Video, Mic, HelpCircle, Sparkles, BarChart3, Gamepad2, Trophy, Lightbulb, Image as ImageIcon, X, Globe, Users, Lock, Plus, Loader2, Scale, Wand2, Hash } from "lucide-react";
import { socialApi, resizePhoto, endsIn, type Post, type Visibility } from "@/lib/socialApi";
import { useAuth } from "@/contexts/AuthContext";
import { S, Avatar, Sheet, primaryBtn, ghostBtn, sceneFor, ApexTag, apexCard } from "./ui";

export type ComposeMode = "text" | "poll" | "game" | "moment" | "debate" | "ai" | "challenge";
export type CreatePick = ComposeMode | "ask";

const TILES: { id: CreatePick | null; icon: typeof PenLine; title: string; sub: string }[] = [
  { id: "text", icon: PenLine, title: "Post", sub: "Share anything" },
  { id: "poll", icon: BarChart3, title: "Poll", sub: "Ask the community" },
  { id: "debate", icon: Scale, title: "Debate", sub: "Pick a side" },
  { id: "ask", icon: HelpCircle, title: "Ask Apex", sub: "Get answers" },
  { id: "ai", icon: Sparkles, title: "AI Creation", sub: "Apex drafts it" },
  { id: "challenge", icon: Trophy, title: "Challenge", sub: "Join or start one" },
  { id: "game", icon: Gamepad2, title: "Game", sub: "Share a game" },
  { id: null, icon: Video, title: "Video", sub: "Record or upload" },
  { id: null, icon: Mic, title: "Voice", sub: "Speak your mind" },
];

export function CreateSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (mode: CreatePick, idea?: string) => void }) {
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
              <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: t.id === "ask" || t.id === "ai" ? S.goldSoft : "rgba(255,255,255,0.06)", color: t.id === "ask" || t.id === "ai" ? S.gold : S.ink }}><t.icon size={18} /></span>
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

export function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  const [open, setOpen] = useState(false);
  const vis = VIS.find((v) => v.id === value)!;
  return (
    <>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} style={ghostBtn({ height: 28, padding: "0 10px", borderRadius: 14, fontSize: 12 })}><vis.icon size={13} /> {vis.label}</button>
      {open ? (
        <div role="radiogroup" aria-label="Who can see this" style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
          {VIS.map((v) => (
            <button key={v.id} role="radio" aria-checked={value === v.id} onClick={() => { onChange(v.id); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: value === v.id ? "rgba(255,255,255,0.06)" : "none", border: `1px solid ${value === v.id ? "rgba(255,255,255,0.22)" : "transparent"}`, color: S.ink, cursor: "pointer", textAlign: "left", fontFamily: "Manrope, sans-serif" }}>
              <v.icon size={17} /><span style={{ flexGrow: 1 }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>{v.label}</span><span style={{ display: "block", fontSize: 11.5, color: S.ink3 }}>{v.sub}</span></span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

interface GameEntry { id: number; name: string; creatorName: string; playCount: number }

const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", height: 42, borderRadius: 12, padding: "0 12px", background: "rgba(0,0,0,0.3)", border: `1px solid ${S.line2}`, color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 14, outline: "none" };
const hidden: React.CSSProperties = { position: "absolute", left: -9999 };
const aiBtn = (extra?: React.CSSProperties) => ghostBtn({ height: 32, padding: "0 11px", borderRadius: 16, fontSize: 12, color: S.gold, borderColor: "rgba(226,193,126,0.28)", ...extra });

export function Composer({ open, mode, idea, prompt, challengeId: startChallenge, circle, onClose, onPosted, onStartChallenge }: {
  open: boolean;
  mode: ComposeMode;
  /** Starter idea from "Surprise me" */
  idea?: string;
  /** Today's Apex Moment prompt (moment mode) */
  prompt?: string;
  /** Challenge to enter (challenge mode) */
  challengeId?: number;
  /** Posting into a circle: its members are the audience */
  circle?: { id: number; name: string; emoji: string };
  onClose: () => void;
  onPosted: (p: Post) => void;
  /** Opens "Start a challenge" (challenge mode) */
  onStartChallenge?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  // AI Creation starts with Apex's drafting panel, then switches to the kind of post Apex made
  const [m, setM] = useState<ComposeMode>(mode);
  const [body, setBody] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [gameId, setGameId] = useState<number | null>(null);
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [photo, setPhoto] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [about, setAbout] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [tagIdeas, setTagIdeas] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setM(mode); setBody(""); setOptions(["", ""]); setGameId(null); setPhoto(null); setError(null);
    setAbout(""); setSuggestion(null); setTagIdeas([]); setChallengeId(startChallenge ?? null);
  }, [open, mode, startChallenge]);

  const games = useQuery({
    queryKey: ["social-game-picker"],
    enabled: open && m === "game",
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/game-feed?limit=24`);
      return (((await res.json()) as { entries?: GameEntry[] }).entries ?? []).slice(0, 24);
    },
  });
  const challenges = useQuery({ queryKey: ["social-challenges"], enabled: open && m === "challenge", queryFn: socialApi.challenges });
  const activeChallenges = challenges.data?.active ?? [];
  const chosen = activeChallenges.find((c) => c.id === challengeId);
  useEffect(() => {
    if (m === "challenge" && !challengeId && activeChallenges[0]) setChallengeId(activeChallenges[0].id);
  }, [m, challengeId, activeChallenges]);

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setError(null);
    try { setPhoto(await resizePhoto(file)); } catch (e) { setError((e as Error).message || "Couldn't read that photo."); }
  };

  /** Run one of Apex's helpers; errors (including running out of credits) show in the composer. */
  const withAi = async (label: string, fn: () => Promise<void>) => {
    setAiBusy(label); setError(null);
    try { await fn(); void qc.invalidateQueries({ queryKey: ["credits"] }); }
    catch (e) { setError((e as Error).message); }
    finally { setAiBusy(null); }
  };
  const draft = (kind: "draft" | "poll" | "debate") => withAi(kind, async () => {
    if (kind === "draft") { const r = await socialApi.assist("draft", about.trim()); setBody(r.text); setM("text"); return; }
    const r = await socialApi.assist(kind, about.trim());
    setBody(r.question); setOptions(r.options); setM(kind);
  });
  const improve = () => withAi("improve", async () => setSuggestion((await socialApi.assist("improve", body.trim())).text));
  const hashtags = () => withAi("hashtags", async () => {
    const have = body.toLowerCase();
    const tags = (await socialApi.assist("hashtags", body.trim())).tags.filter((t) => !have.includes(`#${t}`));
    setTagIdeas(tags);
    if (!tags.length) setError("Your post already has the tags Apex would suggest.");
  });
  const suggestChoices = () => withAi("choices", async () => {
    const r = await socialApi.assist(m === "debate" ? "debate" : "poll", body.trim());
    setOptions(r.options);
  });
  const addTag = (t: string) => { setBody((b) => (b.toLowerCase().includes(`#${t}`) ? b : `${b.trimEnd()} #${t}`)); setTagIdeas((list) => list.filter((x) => x !== t)); };

  const filledOptions = options.map((o) => o.trim()).filter(Boolean);
  const canPost = !busy && !aiBusy && (
    m === "poll" ? !!body.trim() && filledOptions.length >= 2 :
    m === "debate" ? !!body.trim() && filledOptions.length === 2 :
    m === "game" ? !!gameId :
    m === "challenge" ? !!chosen && (!!body.trim() || !!photo) :
    m === "ai" ? false :
    !!body.trim() || !!photo
  );

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      let mediaId: number | undefined;
      if (photo) mediaId = (await socialApi.uploadPhoto(photo.dataUrl, photo.width, photo.height)).id;
      const kind: Post["kind"] = m === "moment" ? "moment" : m === "poll" ? "poll" : m === "debate" ? "debate" : m === "game" ? "game" : photo ? "photo" : "text";
      const created = await socialApi.create({
        kind, body: body.trim(), mediaId, visibility,
        pollOptions: m === "poll" || m === "debate" ? filledOptions : undefined,
        gameId: gameId ?? undefined,
        challengeId: m === "challenge" ? challengeId ?? undefined : undefined,
        circleId: circle?.id,
      });
      if (circle) void qc.invalidateQueries({ queryKey: ["social-circle-posts", circle.id] });
      onPosted(created);
      if (m === "challenge") void qc.invalidateQueries({ queryKey: ["social-challenges"] });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const title = circle && m === "text" ? `Post in ${circle.name}` : { poll: "New poll", debate: "New debate", game: "Share a game", moment: "Apex Moment", ai: "Create with AI", challenge: "Enter a challenge", text: "New post" }[m];
  const placeholder =
    m === "poll" ? "Ask a question…" :
    m === "debate" ? "What's the debate? e.g. Is pineapple on pizza okay?" :
    m === "game" ? "Say something about it (optional)" :
    m === "moment" ? "Your answer…" :
    m === "challenge" ? (chosen ? chosen.description || `Your entry for #${chosen.tag}` : "Your entry…") :
    idea ? idea : "What's on your mind? Use #tags to join a trend";
  const writes = m === "text" || m === "moment" || m === "challenge";

  return (
    <Sheet open={open} onClose={onClose} label={title} title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {m === "moment" && prompt ? (
          <div style={{ padding: 14, borderRadius: 16, background: "linear-gradient(135deg, #1D1D22, #141417)", border: `1px solid ${S.line}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: S.gold }}>TODAY'S PROMPT</div>
            <div style={{ fontFamily: "Sora, sans-serif", fontSize: 18, fontWeight: 700, marginTop: 6, lineHeight: 1.3 }}>{prompt}</div>
          </div>
        ) : null}
        {m === "text" && idea ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: S.gold }}><Sparkles size={14} /> Idea: <span style={{ color: S.ink2 }}>{idea}</span></div>
        ) : null}

        {m === "ai" ? (
          <div style={{ ...apexCard, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <ApexTag>Tell Apex what you want to post</ApexTag>
            <label>
              <span style={hidden}>What the post is about</span>
              <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} maxLength={500} autoFocus placeholder="e.g. I finally finished my first game after 3 months"
                style={{ ...inputStyle, height: "auto", minHeight: 76, padding: 12, resize: "vertical", lineHeight: 1.5 }} />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {([["draft", "Write a post", Wand2], ["poll", "Make a poll", BarChart3], ["debate", "Start a debate", Scale]] as const).map(([k, label, Icon]) => (
                <button key={k} onClick={() => void draft(k)} disabled={!about.trim() || !!aiBusy} style={k === "draft" ? primaryBtn({ height: 36, fontSize: 12.5, opacity: about.trim() ? 1 : 0.5 }) : ghostBtn({ height: 36, fontSize: 12.5, opacity: about.trim() ? 1 : 0.5 })}>
                  {aiBusy === k ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />} {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: S.ink3 }}>Uses credits like a chat message. You can edit everything before posting.</div>
          </div>
        ) : null}

        {m === "challenge" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {challenges.isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading challenges…</div> : null}
            {challenges.error ? <div role="alert" style={{ fontSize: 13, color: "#FF8A8A" }}>Couldn't load challenges: {(challenges.error as Error).message}</div> : null}
            {!challenges.isLoading && !challenges.error && !activeChallenges.length ? <div style={{ fontSize: 13, color: S.ink2 }}>No challenges running right now. Start one!</div> : null}
            <div role="radiogroup" aria-label="Challenge" style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
              {onStartChallenge ? (
                <button onClick={onStartChallenge}
                  style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 17, background: S.btn, border: 0, color: S.btnText, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>
                  <Plus size={14} /> Start your own
                </button>
              ) : null}
              {activeChallenges.map((c) => (
                <button key={c.id} role="radio" aria-checked={challengeId === c.id} onClick={() => setChallengeId(c.id)}
                  style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 17, background: challengeId === c.id ? S.goldSoft : S.surf, border: `1px solid ${challengeId === c.id ? S.gold : S.line}`, color: challengeId === c.id ? S.gold : S.ink2, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>
                  <Trophy size={13} /> {c.title}
                </button>
              ))}
            </div>
            {chosen ? <div style={{ fontSize: 12, color: S.ink3 }}>#{chosen.tag} is added for you · {endsIn(chosen.endsAt)}</div> : null}
          </div>
        ) : null}

        {m !== "ai" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {user ? <Avatar user={{ username: user.username, avatarUrl: (user as { avatarUrl?: string | null }).avatarUrl ?? null, avatarEmoji: null }} size={40} /> : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", flexGrow: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{user?.username ?? "You"}</span>
                {circle ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", borderRadius: 14, background: S.goldSoft, color: S.gold, fontSize: 12, fontWeight: 800 }}>{circle.emoji} Posting in {circle.name}</span>
                ) : <VisibilityPicker value={visibility} onChange={setVisibility} />}
              </div>
            </div>

            <label style={{ display: "block" }}>
              <span style={hidden}>{m === "poll" || m === "debate" ? "Question" : "Post text"}</span>
              <textarea value={body} onChange={(e) => { setBody(e.target.value); setSuggestion(null); }} placeholder={placeholder} rows={m === "game" ? 2 : 4} maxLength={2000} autoFocus
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 80, borderRadius: 14, padding: 12, background: "rgba(0,0,0,0.3)", border: `1px solid ${S.line2}`, color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 15, lineHeight: 1.5, outline: "none" }} />
            </label>

            {writes && body.trim().length >= 3 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => void improve()} disabled={!!aiBusy} style={aiBtn()}>{aiBusy === "improve" ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Improve</button>
                <button onClick={() => void hashtags()} disabled={!!aiBusy} style={aiBtn()}>{aiBusy === "hashtags" ? <Loader2 size={13} className="animate-spin" /> : <Hash size={13} />} Hashtags</button>
              </div>
            ) : null}
            {suggestion ? (
              <div style={apexCard}>
                <ApexTag>Apex suggests</ApexTag>
                <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6, whiteSpace: "pre-wrap" }}>{suggestion}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => { setBody(suggestion); setSuggestion(null); }} style={primaryBtn({ height: 32, fontSize: 12.5 })}>Use this</button>
                  <button onClick={() => setSuggestion(null)} style={ghostBtn({ height: 32, fontSize: 12.5 })}>Keep mine</button>
                </div>
              </div>
            ) : null}
            {tagIdeas.length ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11.5, color: S.ink3 }}>Tap to add:</span>
                {tagIdeas.map((t) => <button key={t} onClick={() => addTag(t)} style={ghostBtn({ height: 28, padding: "0 10px", borderRadius: 14, fontSize: 12, color: S.gold })}>#{t}</button>)}
              </div>
            ) : null}
          </>
        ) : null}

        {m === "poll" || m === "debate" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <label style={{ flexGrow: 1 }}>
                  <span style={hidden}>{m === "debate" ? `Side ${i + 1}` : `Choice ${i + 1}`}</span>
                  <input value={o} maxLength={80} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={m === "debate" ? (i === 0 ? "Side A, e.g. Yes, always" : "Side B, e.g. Never") : `Choice ${i + 1}`}
                    style={{ ...inputStyle, borderColor: m === "debate" ? (i === 0 ? "rgba(226,193,126,0.35)" : "rgba(201,205,214,0.3)") : S.line2 }} />
                </label>
                {m === "poll" && options.length > 2 ? <button aria-label={`Remove choice ${i + 1}`} onClick={() => setOptions(options.filter((_, j) => j !== i))} style={ghostBtn({ width: 42, padding: 0 })}><X size={16} /></button> : null}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {m === "poll" && options.length < 4 ? <button onClick={() => setOptions([...options, ""])} style={ghostBtn({ height: 32, fontSize: 12.5 })}><Plus size={15} /> Add choice</button> : null}
              {body.trim().length >= 3 ? (
                <button onClick={() => void suggestChoices()} disabled={!!aiBusy} style={aiBtn()}>{aiBusy === "choices" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Suggest {m === "debate" ? "sides" : "choices"}</button>
              ) : null}
            </div>
          </div>
        ) : null}

        {m === "game" ? (
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

        {m !== "ai" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {writes ? (
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
        ) : null}
      </div>
    </Sheet>
  );
}
