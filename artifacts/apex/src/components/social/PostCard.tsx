/**
 * Nexus card: one post of any kind (text, photo, poll, game, Apex Moment answer).
 * Likes and votes update instantly and roll back if the server says no.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Heart, MessageCircle, Share2, MoreHorizontal, Play, Lock, Users, Sparkles, Flag, Ban, Trash2, Check, Trophy, Loader2, Scale } from "lucide-react";
import { socialApi, mediaSrc, timeAgo, compact, type Post, type ReportReason } from "@/lib/socialApi";
import { S, card, Avatar, RichText, Sheet, primaryBtn, ghostBtn, iconBtn, sceneFor, ApexTag, apexCard } from "./ui";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam or scam" },
  { id: "harassment", label: "Bullying or harassment" },
  { id: "hate", label: "Hate speech" },
  { id: "violence", label: "Violence or threats" },
  { id: "nudity", label: "Nudity or sexual content" },
  { id: "self_harm", label: "Self-harm" },
  { id: "misinformation", label: "False information" },
  { id: "other", label: "Something else" },
];

export function PostCard({ post, onChange, onRemove, onOpenComments, onTag, onChallenge, onCircle }: {
  post: Post;
  onChange: (p: Post) => void;
  onRemove: (id: number, authorBlocked?: number) => void;
  onOpenComments: (p: Post) => void;
  onTag: (tag: string) => void;
  onChallenge?: (id: number) => void;
  onCircle?: (id: number) => void;
}) {
  const [, nav] = useLocation();
  const [menu, setMenu] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [report, setReport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (text: string) => { setNotice(text); setTimeout(() => setNotice(null), 2200); };

  const like = async () => {
    const optimistic = { ...post, reacted: !post.reacted, reactionCount: post.reactionCount + (post.reacted ? -1 : 1) };
    onChange(optimistic);
    try {
      const r = await socialApi.react(post.id);
      onChange({ ...optimistic, reacted: r.reacted, reactionCount: r.reactionCount });
    } catch {
      onChange(post);
    }
  };

  const vote = async (option: number) => {
    if (!post.poll) return;
    const prev = post.poll;
    const counts = [...prev.counts];
    if (prev.myVote !== null) counts[prev.myVote] = Math.max(0, counts[prev.myVote]! - 1);
    counts[option] = counts[option]! + 1;
    onChange({ ...post, poll: { ...prev, counts, total: counts.reduce((a, b) => a + b, 0), myVote: option } });
    try {
      onChange({ ...post, poll: await socialApi.vote(post.id, option) });
    } catch {
      onChange({ ...post, poll: prev });
    }
  };

  const pickSide = async (side: number) => {
    const prev = post.debate;
    if (!prev || prev.mySide === side) return;
    const counts = [...prev.counts];
    if (prev.mySide !== null) counts[prev.mySide] = Math.max(0, counts[prev.mySide]! - 1);
    counts[side] = counts[side]! + 1;
    onChange({ ...post, debate: { ...prev, counts, total: counts.reduce((a, b) => a + b, 0), mySide: side } });
    try {
      onChange({ ...post, debate: await socialApi.pickSide(post.id, side) });
    } catch {
      onChange({ ...post, debate: prev });
    }
  };

  const summarize = async () => {
    if (!post.debate) return;
    if (summaryOpen) { setSummaryOpen(false); return; }
    // A summary from the last hour is reused; otherwise ask Apex for a fresh one
    const fresh = post.debate.summary && post.debate.summaryAt && Date.now() - new Date(post.debate.summaryAt).getTime() < 3_600_000;
    if (fresh) { setSummaryOpen(true); return; }
    setSummarizing(true);
    try {
      const r = await socialApi.summary(post.id);
      onChange({ ...post, debate: { ...post.debate, summary: r.summary, summaryAt: r.summaryAt } });
      setSummaryOpen(true);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setSummarizing(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/feed?post=${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${post.author.username} on Apex`, url });
      else { await navigator.clipboard.writeText(url); flash("Link copied"); }
    } catch { /* cancelled */ }
  };

  const remove = async () => {
    setMenu(false);
    if (!window.confirm("Delete this post?")) return;
    try { await socialApi.remove(post.id); onRemove(post.id); } catch (e) { flash((e as Error).message); }
  };
  const block = async () => {
    setMenu(false);
    if (!window.confirm(`Block ${post.author.username}? You won't see each other's posts or comments.`)) return;
    try { await socialApi.block(post.author.id); onRemove(post.id, post.author.id); } catch (e) { flash((e as Error).message); }
  };
  const sendReport = async (reason: ReportReason) => {
    setReport(false);
    try { await socialApi.report("post", post.id, reason); flash("Thanks. We'll review this post."); } catch (e) { flash((e as Error).message); }
  };

  const VisIcon = post.visibility === "private" ? Lock : post.visibility === "followers" ? Users : null;

  return (
    <article style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 12 }} aria-label={`Post by ${post.author.username}`}>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar user={post.author} size={38} />
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: S.ink }}>{post.author.username}</div>
          <div style={{ fontSize: 11.5, color: S.ink3, display: "flex", alignItems: "center", gap: 5 }}>
            {timeAgo(post.createdAt)}{post.location ? ` · ${post.location}` : ""}
            {post.circle ? <> · <button onClick={() => onCircle?.(post.circle!.id)} style={{ background: "none", border: 0, padding: 0, color: S.ink2, font: "inherit", fontWeight: 700, cursor: onCircle ? "pointer" : "default" }}>{post.circle.emoji} {post.circle.name}</button></> : null}
            {VisIcon ? <VisIcon size={11} aria-label={post.visibility === "private" ? "Only you" : "Followers"} /> : null}
          </div>
        </div>
        <button onClick={() => setMenu(true)} aria-label="Post options" style={iconBtn}><MoreHorizontal size={18} /></button>
      </header>

      {post.moment ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: S.gold }}>
          <Sparkles size={13} /> Apex Moment · <span style={{ color: S.ink2, fontWeight: 600 }}>{post.moment.prompt}</span>
        </div>
      ) : null}

      {post.challenge ? (
        <button onClick={() => onChallenge?.(post.challenge!.id)} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 13, background: S.goldSoft, border: "1px solid rgba(226,193,126,0.28)", color: S.gold, fontSize: 11.5, fontWeight: 800, cursor: onChallenge ? "pointer" : "default", fontFamily: "Manrope, sans-serif" }}>
          <Trophy size={12} /> {post.challenge.title}
        </button>
      ) : null}

      {post.kind === "ask" ? <div style={{ fontSize: 11.5, fontWeight: 700, color: S.ink3, marginBottom: -6 }}>Asked Apex</div> : null}
      {post.kind === "debate" ? <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 800, color: S.ink2, marginBottom: -6 }}><Scale size={13} /> Debate</div> : null}

      {post.body ? <div style={{ fontSize: post.kind === "debate" || post.kind === "ask" ? 16 : 14.5, fontWeight: post.kind === "debate" || post.kind === "ask" ? 700 : 400, lineHeight: 1.5, color: S.ink, whiteSpace: "pre-wrap", wordBreak: "break-word" }}><RichText text={post.body} onTag={onTag} /></div> : null}

      {post.answer ? (
        <div style={apexCard}>
          <ApexTag>Apex answered</ApexTag>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: S.ink, marginTop: 6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{post.answer}</div>
        </div>
      ) : null}

      {post.debate ? (() => {
        const d = post.debate;
        const picked = d.mySide !== null;
        const pct = (i: number) => (d.total ? Math.round((d.counts[i]! / d.total) * 100) : 50);
        const tone = [{ c: S.gold, soft: S.goldSoft }, { c: S.silver, soft: S.silverSoft }];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {d.sides.map((side, i) => (
                <button key={i} onClick={() => void pickSide(i)} aria-pressed={d.mySide === i}
                  style={{ minHeight: 52, padding: "8px 10px", borderRadius: 14, background: d.mySide === i ? tone[i]!.soft : S.surf2, border: `1px solid ${d.mySide === i ? tone[i]!.c : S.line}`, color: S.ink, cursor: "pointer", fontFamily: "Manrope, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, display: "flex", alignItems: "center", gap: 5, textAlign: "center" }}>{d.mySide === i ? <Check size={14} color={tone[i]!.c} /> : null}{side}</span>
                  {picked ? <span style={{ fontSize: 12, fontWeight: 800, color: tone[i]!.c }}>{pct(i)}%</span> : null}
                </button>
              ))}
            </div>
            {picked ? (
              <div aria-hidden style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: S.surf2 }}>
                <span style={{ width: `${pct(0)}%`, background: S.gold, transition: "width .35s ease" }} />
                <span style={{ flexGrow: 1, background: S.silver, opacity: 0.7 }} />
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: S.ink3, flexGrow: 1 }}>{compact(d.total)} picked a side{picked ? "" : " · tap yours"}</span>
              <button onClick={() => void summarize()} disabled={summarizing} aria-expanded={summaryOpen} style={ghostBtn({ height: 30, padding: "0 10px", borderRadius: 15, fontSize: 12, color: S.gold, borderColor: "rgba(226,193,126,0.28)" })}>
                {summarizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {summaryOpen ? "Hide summary" : "Apex summary"}
              </button>
            </div>
            {summaryOpen && d.summary ? (
              <div style={apexCard}>
                <ApexTag>Both sides, summed up by Apex</ApexTag>
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: S.ink, marginTop: 6, whiteSpace: "pre-wrap" }}>{d.summary}</div>
                {d.summaryAt ? <div style={{ fontSize: 11, color: S.ink3, marginTop: 6 }}>Updated {timeAgo(d.summaryAt) === "now" ? "just now" : `${timeAgo(d.summaryAt)} ago`} · AI can get things wrong</div> : null}
              </div>
            ) : null}
          </div>
        );
      })() : null}

      {post.media ? (
        <img src={mediaSrc(post.media.url)} alt="" loading="lazy" decoding="async"
          style={{ width: "100%", maxHeight: 520, objectFit: "cover", borderRadius: 16, border: `1px solid ${S.line}`, background: S.surf2, aspectRatio: post.media.width && post.media.height ? `${post.media.width} / ${post.media.height}` : undefined }} />
      ) : null}

      {post.poll ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {post.poll.options.map((opt, i) => {
            const pct = post.poll!.total ? Math.round((post.poll!.counts[i]! / post.poll!.total) * 100) : 0;
            const voted = post.poll!.myVote !== null;
            const mine = post.poll!.myVote === i;
            return (
              <button key={i} onClick={() => void vote(i)} aria-pressed={mine}
                style={{ position: "relative", height: 42, borderRadius: 12, overflow: "hidden", background: S.surf2, border: `1px solid ${mine ? "rgba(255,255,255,0.35)" : S.line}`, color: S.ink, cursor: "pointer", padding: 0, textAlign: "left", fontFamily: "Manrope, sans-serif" }}>
                {voted ? <span aria-hidden style={{ position: "absolute", inset: "0 auto 0 0", width: `${pct}%`, background: mine ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)", transition: "width .35s ease" }} /> : null}
                <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", height: "100%", fontSize: 13, fontWeight: 700 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{mine ? <Check size={14} /> : null}{opt}</span>
                  {voted ? <span>{pct}%</span> : null}
                </span>
              </button>
            );
          })}
          <div style={{ fontSize: 11.5, color: S.ink3 }}>{compact(post.poll.total)} vote{post.poll.total === 1 ? "" : "s"}{post.poll.myVote === null ? " · tap to vote" : ""}</div>
        </div>
      ) : null}

      {post.game ? (
        <div style={{ display: "flex", gap: 12, padding: 10, borderRadius: 14, background: S.surf2, border: `1px solid ${S.line}` }}>
          <div aria-hidden style={{ width: 72, height: 72, borderRadius: 10, flexShrink: 0, background: sceneFor(post.game.name), border: `1px solid ${S.line}` }} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, flexGrow: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{post.game.name}</div>
            <div style={{ fontSize: 11.5, color: S.ink3 }}>by {post.game.creatorName} · {compact(post.game.playCount)} plays</div>
          </div>
          <button onClick={() => nav(`/games?play=${post.game!.id}`)} style={primaryBtn({ alignSelf: "center", height: 34, borderRadius: 10, fontSize: 12, padding: "0 14px" })}>
            <Play size={13} fill={S.btnText} /> Play now
          </button>
        </div>
      ) : null}

      <footer style={{ display: "flex", alignItems: "center", gap: 4, color: S.ink2 }}>
        <button onClick={() => void like()} aria-pressed={post.reacted} aria-label={post.reacted ? "Unlike" : "Like"}
          style={{ ...iconBtn, width: "auto", padding: "0 8px", borderRadius: 18, gap: 6, fontSize: 12.5, fontWeight: 700, color: post.reacted ? S.heart : S.ink2 }}>
          <Heart size={18} fill={post.reacted ? S.heart : "none"} /> {compact(post.reactionCount)}
        </button>
        <button onClick={() => onOpenComments(post)} aria-label="Comments" style={{ ...iconBtn, width: "auto", padding: "0 8px", borderRadius: 18, gap: 6, fontSize: 12.5, fontWeight: 700 }}>
          <MessageCircle size={18} /> {compact(post.commentCount)}
        </button>
        <button onClick={() => void share()} aria-label="Share" style={iconBtn}><Share2 size={17} /></button>
        <span style={{ flexGrow: 1 }} />
        {notice ? <span role="status" style={{ fontSize: 12, color: S.ink2 }}>{notice}</span> : null}
      </footer>

      <Sheet open={menu} onClose={() => setMenu(false)} label="Post options" title="Post options" maxWidth={440}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {post.mine ? (
            <button onClick={() => void remove()} style={ghostBtn({ justifyContent: "flex-start", height: 48, color: "#FF8A8A" })}><Trash2 size={17} /> Delete post</button>
          ) : (
            <>
              <button onClick={() => { setMenu(false); setReport(true); }} style={ghostBtn({ justifyContent: "flex-start", height: 48 })}><Flag size={17} /> Report post</button>
              <button onClick={() => void block()} style={ghostBtn({ justifyContent: "flex-start", height: 48, color: "#FF8A8A" })}><Ban size={17} /> Block {post.author.username}</button>
            </>
          )}
        </div>
      </Sheet>

      <Sheet open={report} onClose={() => setReport(false)} label="Report post" title="Why are you reporting this?" maxWidth={440}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {REASONS.map((r) => (
            <button key={r.id} onClick={() => void sendReport(r.id)} style={ghostBtn({ justifyContent: "flex-start", height: 46 })}>{r.label}</button>
          ))}
          <p style={{ margin: "6px 2px 0", fontSize: 12, color: S.ink3 }}>Reports are private. {post.author.username} won't know who reported.</p>
        </div>
      </Sheet>
    </article>
  );
}
