/**
 * Comments on a post: replies (one level), likes, delete, report.
 * On debates each comment shows the side its writer picked. "Ask Apex" answers questions about the
 * thread privately; the person can then share the answer as a comment, labelled as Apex's.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Send, Trash2, Flag, X, Loader2, Sparkles } from "lucide-react";
import { socialApi, timeAgo, type ApexAnswer, type Comment, type Post } from "@/lib/socialApi";
import { S, Avatar, Sheet, iconBtn, RichText, ApexTag, apexCard, primaryBtn, ghostBtn } from "./ui";

export function CommentsSheet({ post, onClose, onCountChange }: { post: Post | null; onClose: () => void; onCountChange: (postId: number, delta: number) => void }) {
  const qc = useQueryClient();
  const key = ["post-comments", post?.id];
  const { data, isLoading, error } = useQuery({ queryKey: key, enabled: !!post, queryFn: () => socialApi.comments(post!.id) });
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<ApexAnswer | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setText(""); setReplyTo(null); setErr(null); setAsking(false); setAnswer(null); }, [post?.id]);

  const setComments = (fn: (c: Comment[]) => Comment[]) => qc.setQueryData<Comment[]>(key, (old) => fn(old ?? []));

  const send = async () => {
    if (!post || !text.trim()) return;
    setBusy(true); setErr(null);
    if (asking) {
      try { setAnswer(await socialApi.askAboutPost(post.id, text.trim())); setText(""); }
      catch (e) { setErr((e as Error).message); }
      finally { setBusy(false); }
      return;
    }
    try {
      const c = await socialApi.comment(post.id, text.trim(), replyTo?.id);
      const parentId = (c as Comment & { parentId?: number | null }).parentId;
      setComments((list) => parentId ? list.map((x) => (x.id === parentId ? { ...x, replies: [...(x.replies ?? []), c] } : x)) : [...list, { ...c, replies: [] }]);
      onCountChange(post.id, 1);
      setText(""); setReplyTo(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const shareAnswer = async () => {
    if (!post || !answer) return;
    setBusy(true); setErr(null);
    try {
      const c = await socialApi.shareAnswer(post.id, answer);
      setComments((list) => [...list, { ...c, replies: [] }]);
      onCountChange(post.id, 1);
      setAnswer(null); setAsking(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sides = post?.debate?.sides;
  const sideBadge = (side?: number | null) => sides && side !== null && side !== undefined && sides[side] ? (
    <span style={{ display: "inline-block", marginLeft: 6, padding: "1px 7px", borderRadius: 9, fontSize: 10.5, fontWeight: 800, verticalAlign: 1, color: side === 0 ? S.gold : S.silver, background: side === 0 ? S.goldSoft : S.silverSoft }}>{sides[side]}</span>
  ) : null;

  const update = (id: number, fn: (c: Comment) => Comment | null) =>
    setComments((list) => list.flatMap((x) => {
      if (x.id === id) { const n = fn(x); return n ? [n] : []; }
      return [{ ...x, replies: (x.replies ?? []).flatMap((r) => { if (r.id !== id) return [r]; const n = fn(r); return n ? [n] : []; }) }];
    }));

  const like = async (c: Comment) => {
    update(c.id, (x) => ({ ...x, reacted: !x.reacted, reactionCount: x.reactionCount + (x.reacted ? -1 : 1) }));
    try { const r = await socialApi.reactComment(c.id); update(c.id, (x) => ({ ...x, reacted: r.reacted, reactionCount: r.reactionCount })); }
    catch { update(c.id, () => c); }
  };
  const remove = async (c: Comment) => {
    if (!post || !window.confirm("Delete this comment?")) return;
    try { await socialApi.removeComment(c.id); update(c.id, () => null); onCountChange(post.id, -1); } catch (e) { setErr((e as Error).message); }
  };
  const report = async (c: Comment) => {
    if (!window.confirm("Report this comment for review?")) return;
    try { await socialApi.report("comment", c.id, "other"); setErr("Thanks. We'll review that comment."); } catch (e) { setErr((e as Error).message); }
  };

  const row = (c: Comment, reply = false) => (
    <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingLeft: reply ? 42 : 0 }}>
      <Avatar user={c.author} size={reply ? 26 : 32} />
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5 }}><strong>{c.author.username}</strong>{sideBadge(c.side)} <span style={{ color: S.ink3 }}>· {timeAgo(c.createdAt)}</span></div>
        {c.ai ? (
          <div style={{ ...apexCard, marginTop: 6 }}>
            <ApexTag>Apex answered</ApexTag>
            {c.aiPrompt ? <div style={{ fontSize: 12, color: S.ink2, marginTop: 4 }}>“{c.aiPrompt}”</div> : null}
            <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.body}</div>
          </div>
        ) : (
          <div style={{ fontSize: 14, lineHeight: 1.45, marginTop: 2, wordBreak: "break-word" }}><RichText text={c.body} /></div>
        )}
        <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 12, fontWeight: 700, color: S.ink3 }}>
          <button onClick={() => { setReplyTo(c); inputRef.current?.focus(); }} style={{ background: "none", border: 0, padding: 0, color: S.ink3, font: "inherit", cursor: "pointer" }}>Reply</button>
          {c.canDelete ? <button onClick={() => void remove(c)} aria-label="Delete comment" style={{ background: "none", border: 0, padding: 0, color: S.ink3, cursor: "pointer", display: "flex" }}><Trash2 size={13} /></button> : null}
          {!c.mine ? <button onClick={() => void report(c)} aria-label="Report comment" style={{ background: "none", border: 0, padding: 0, color: S.ink3, cursor: "pointer", display: "flex" }}><Flag size={13} /></button> : null}
        </div>
      </div>
      <button onClick={() => void like(c)} aria-pressed={c.reacted} aria-label={c.reacted ? "Unlike comment" : "Like comment"} style={{ ...iconBtn, width: "auto", height: 28, gap: 3, fontSize: 11, color: c.reacted ? S.heart : S.ink3 }}>
        <Heart size={14} fill={c.reacted ? S.heart : "none"} />{c.reactionCount || ""}
      </button>
    </div>
  );

  return (
    <Sheet open={!!post} onClose={onClose} label="Comments" title={`Comments${post ? ` · ${post.commentCount}` : ""}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 200 }}>
        {post?.body ? (
          <div style={{ display: "flex", gap: 10, paddingBottom: 12, borderBottom: `1px solid ${S.line}` }}>
            <Avatar user={post.author} size={32} />
            <div style={{ fontSize: 14, lineHeight: 1.45 }}><strong>{post.author.username}</strong> <span style={{ color: S.ink2 }}>{post.body.length > 180 ? `${post.body.slice(0, 180)}…` : post.body}</span></div>
          </div>
        ) : null}
        {isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading comments…</div> : null}
        {error ? <div style={{ fontSize: 13, color: "#FF8A8A" }}>{(error as Error).message}</div> : null}
        {data && !data.length ? <div style={{ fontSize: 13.5, color: S.ink3, textAlign: "center", padding: "20px 0" }}>No comments yet. Start the conversation.</div> : null}
        {(data ?? []).map((c) => (
          <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>{row(c)}{(c.replies ?? []).map((r) => row(r, true))}</div>
        ))}
      </div>
      <div style={{ position: "sticky", bottom: -20, marginTop: 16, padding: "10px 0 0", background: "#121215" }}>
        {err ? <div role="status" style={{ fontSize: 12.5, color: S.ink2, marginBottom: 8 }}>{err}</div> : null}
        {answer ? (
          <div style={{ ...apexCard, marginBottom: 10 }}>
            <ApexTag>Apex · only you can see this</ApexTag>
            <div style={{ fontSize: 12, color: S.ink2, marginTop: 4 }}>“{answer.question}”</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6, whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto" }}>{answer.answer}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => void shareAnswer()} disabled={busy} style={primaryBtn({ height: 34, fontSize: 12.5 })}>Share in comments</button>
              <button onClick={() => setAnswer(null)} style={ghostBtn({ height: 34, fontSize: 12.5 })}>Dismiss</button>
            </div>
          </div>
        ) : null}
        {asking ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: S.gold, marginBottom: 8 }}>
            <Sparkles size={13} /> Asking Apex about this post · uses credits
            <button onClick={() => setAsking(false)} aria-label="Stop asking Apex" style={{ ...iconBtn, width: 24, height: 24 }}><X size={14} /></button>
          </div>
        ) : null}
        {replyTo && !asking ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: S.ink2, marginBottom: 8 }}>
            Replying to <strong style={{ color: S.ink }}>{replyTo.author.username}</strong>
            <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" style={{ ...iconBtn, width: 24, height: 24 }}><X size={14} /></button>
          </div>
        ) : null}
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: "flex", alignItems: "center", gap: 4, height: 46, padding: "0 6px 0 6px", borderRadius: 23, background: S.surf, border: `1px solid ${asking ? "rgba(226,193,126,0.4)" : S.line}` }}>
          <button type="button" onClick={() => { setAsking((a) => !a); setReplyTo(null); inputRef.current?.focus(); }} aria-pressed={asking} aria-label="Ask Apex about this post" title="Ask Apex"
            style={{ ...iconBtn, width: 34, height: 34, flexShrink: 0, color: asking ? S.btnText : S.gold, background: asking ? S.gold : S.goldSoft }}><Sparkles size={16} /></button>
          <label style={{ flexGrow: 1, paddingLeft: 6 }}>
            <span style={{ position: "absolute", left: -9999 }}>{asking ? "Question for Apex" : "Write a comment"}</span>
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={asking ? 500 : 1000} placeholder={asking ? "Ask Apex about this post…" : replyTo ? "Write a reply…" : "Add a comment…"}
              style={{ width: "100%", background: "none", border: 0, outline: "none", color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 14 }} />
          </label>
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send" style={{ ...iconBtn, width: 34, height: 34, color: text.trim() ? S.ink : S.ink3 }}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </form>
      </div>
    </Sheet>
  );
}
