/**
 * Nexus card: one post of any kind (text, photo, poll, game, Apex Moment answer).
 * Likes and votes update instantly and roll back if the server says no.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Heart, MessageCircle, Share2, MoreHorizontal, Play, Lock, Users, Sparkles, Flag, Ban, Trash2, Check } from "lucide-react";
import { socialApi, mediaSrc, timeAgo, compact, type Post, type ReportReason } from "@/lib/socialApi";
import { S, card, Avatar, RichText, Sheet, primaryBtn, ghostBtn, iconBtn, sceneFor } from "./ui";

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

export function PostCard({ post, onChange, onRemove, onOpenComments, onTag }: {
  post: Post;
  onChange: (p: Post) => void;
  onRemove: (id: number, authorBlocked?: number) => void;
  onOpenComments: (p: Post) => void;
  onTag: (tag: string) => void;
}) {
  const [, nav] = useLocation();
  const [menu, setMenu] = useState(false);
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

      {post.body ? <div style={{ fontSize: 14.5, lineHeight: 1.5, color: S.ink, whiteSpace: "pre-wrap", wordBreak: "break-word" }}><RichText text={post.body} onTag={onTag} /></div> : null}

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
