/** Debate Arena: two sides head to head, the vote split, each side's best arguments, and the thread. */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Heart, Sparkles, Loader2, Check } from "lucide-react";
import { socialApi, compact, timeAgo, type DebateSide, type Post } from "@/lib/socialApi";
import { S, card, Avatar, ApexTag, apexCard, primaryBtn, ghostBtn } from "@/components/social/ui";
import { SocialPage } from "@/components/social/Page";
import { CommentsPanel } from "@/components/social/Comments";

type Tab = "overview" | "arguments" | "comments";

export default function DebatePage() {
  const { id } = useParams<{ id: string }>();
  const postId = Number(id);
  const qc = useQueryClient();
  const key = ["social-debate", postId];
  const { data, isLoading, error } = useQuery({ queryKey: key, enabled: postId > 0, queryFn: () => socialApi.debate(postId) });
  const [tab, setTab] = useState<Tab>("overview");
  const [summarizing, setSummarizing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const post = data?.post;
  const d = post?.debate;

  const setPost = (p: Post) => qc.setQueryData<typeof data>(key, (old) => old && { ...old, post: p });
  const pick = async (side: number) => {
    if (!post || !d || d.mySide === side) return;
    const counts = [...d.counts];
    if (d.mySide !== null) counts[d.mySide] = Math.max(0, counts[d.mySide]! - 1);
    counts[side] = counts[side]! + 1;
    setPost({ ...post, debate: { ...d, counts, total: counts.reduce((a, b) => a + b, 0), mySide: side } });
    try { setPost({ ...post, debate: await socialApi.pickSide(post.id, side) }); void qc.invalidateQueries({ queryKey: key }); }
    catch { setPost(post); }
  };
  const summarize = async () => {
    if (!post || !d) return;
    setSummarizing(true); setNote(null);
    try { const r = await socialApi.summary(post.id); setPost({ ...post, debate: { ...d, summary: r.summary, summaryAt: r.summaryAt } }); }
    catch (e) { setNote((e as Error).message); }
    finally { setSummarizing(false); }
  };
  const addArgument = () => {
    if (d?.mySide === null) { setNote("Pick your side first, then make your case."); return; }
    setTab("comments");
    setTimeout(() => document.getElementById("comment-box")?.focus(), 50);
  };

  const pct = (i: number) => (d && d.total ? (d.counts[i]! / d.total) * 100 : 50);
  const sides = data?.sides ?? [];
  const args = sides.flatMap((s) => s.arguments.map((a) => ({ ...a, side: s.side })));

  return (
    <SocialPage title="Debate Arena" subtitle={post ? `Created by ${post.author.username}` : undefined}>
      {isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading…</div> : null}
      {error ? <div style={{ ...card, padding: 18, fontSize: 13.5, color: S.ink2 }}>{(error as Error).message}</div> : null}
      {post && d ? (
        <>
          <div style={{ fontFamily: "Sora, sans-serif", fontSize: 18, fontWeight: 700, lineHeight: 1.35 }}>{post.body}</div>
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 22, padding: 18, background: "linear-gradient(115deg, #1C1C21 0%, #141417 50%, #1A1A1F 100%)", border: `1px solid ${S.line2}` }}>
            <div aria-hidden style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.18), rgba(255,255,255,0))" }} />
            <div aria-hidden style={{ position: "absolute", left: "50%", top: "44%", transform: "translate(-50%, -50%)", fontFamily: "Sora, sans-serif", fontSize: 30, fontWeight: 700, fontStyle: "italic", color: "#EED9A8" }}>VS</div>
            <div style={{ position: "relative", display: "flex", gap: 40 }}>
              {d.sides.map((label, i) => <Side key={i} label={label} side={sides[i]} votes={d.counts[i] ?? 0} align={i === 0 ? "left" : "right"} mine={d.mySide === i} onPick={() => void pick(i)} />)}
            </div>
            <div style={{ position: "relative", marginTop: 16, height: 6, borderRadius: 3, overflow: "hidden", display: "flex", background: "rgba(255,255,255,0.08)" }}>
              <div style={{ width: `${pct(0)}%`, background: S.gold, transition: "width .35s ease" }} />
              <div style={{ flexGrow: 1, background: S.silver, opacity: d.total ? 0.55 : 0 }} />
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 11.5, color: S.ink3 }}>{compact(d.total)} total vote{d.total === 1 ? "" : "s"} · started {timeAgo(post.createdAt)}{timeAgo(post.createdAt) === "now" ? "" : " ago"}</div>

          <div role="tablist" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 14, background: S.surf, border: `1px solid ${S.line}` }}>
            {(["overview", "arguments", "comments"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                style={{ flex: 1, height: 34, borderRadius: 10, border: 0, background: tab === t ? "rgba(255,255,255,0.08)" : "none", color: tab === t ? S.ink : S.ink3, fontSize: 12.5, fontWeight: tab === t ? 800 : 700, cursor: "pointer", fontFamily: "Manrope, sans-serif", textTransform: "capitalize" }}>{t}</button>
            ))}
          </div>

          {note ? <div role="status" style={{ fontSize: 12.5, color: S.gold, textAlign: "center" }}>{note}</div> : null}

          {tab === "overview" ? (
            <>
              <div style={{ ...card, padding: 14 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800 }}>Recent Arguments</div>
                {args.length ? args.sort((a, b) => b.reactionCount - a.reactionCount).slice(0, 4).map((a, i) => (
                  <div key={a.id}>{i ? <div style={{ height: 1, background: S.line }} /> : null}<Argument a={a} label={d.sides[a.side]!} side={a.side} /></div>
                )) : <div style={{ fontSize: 13, color: S.ink3, padding: "10px 0 2px" }}>No arguments yet. Pick a side and make the first case.</div>}
              </div>
              {d.summary ? (
                <div style={apexCard}>
                  <ApexTag>Both sides, summed up by Apex</ApexTag>
                  <div style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 6, whiteSpace: "pre-wrap" }}>{d.summary}</div>
                </div>
              ) : null}
              <button onClick={() => void summarize()} disabled={summarizing} style={ghostBtn({ height: 40, color: S.gold, borderColor: "rgba(226,193,126,0.3)" })}>
                {summarizing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {d.summary ? "Refresh Apex summary" : "Apex summary of both sides"}
              </button>
            </>
          ) : null}

          {tab === "arguments" ? sides.map((s) => (
            <div key={s.side} style={{ ...card, padding: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: s.side === 0 ? S.gold : S.silver }}>Team {s.label}</div>
              {s.arguments.length ? s.arguments.map((a, i) => <div key={a.id}>{i ? <div style={{ height: 1, background: S.line }} /> : null}<Argument a={a} label={s.label} side={s.side} /></div>)
                : <div style={{ fontSize: 13, color: S.ink3, padding: "10px 0 2px" }}>No arguments for this side yet.</div>}
            </div>
          )) : null}

          {tab === "comments" ? <div style={{ ...card, padding: 14 }}><CommentsPanel post={post} onCountChange={(_, n) => setPost({ ...post, commentCount: Math.max(0, post.commentCount + n) })} /></div> : null}

          {tab !== "comments" ? <button onClick={addArgument} style={primaryBtn({ height: 46, borderRadius: 14, fontSize: 14 })}>Add Your Argument</button> : null}
        </>
      ) : null}
    </SocialPage>
  );
}

function Side({ label, side, votes, align, mine, onPick }: { label: string; side?: DebateSide; votes: number; align: "left" | "right"; mine: boolean; onPick: () => void }) {
  const lead = side?.supporters[0];
  return (
    <button onClick={onPick} aria-pressed={mine} aria-label={`Vote ${label}`}
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: align === "left" ? "flex-start" : "flex-end", gap: 6, textAlign: align, background: "none", border: 0, color: S.ink, cursor: "pointer", padding: 0, fontFamily: "Manrope, sans-serif", minWidth: 0 }}>
      {lead ? <Avatar user={lead} size={46} ring /> : <span style={{ width: 46, height: 46, borderRadius: "50%", border: `1px dashed ${S.line2}` }} />}
      <span style={{ fontFamily: "Sora, sans-serif", fontSize: 19, fontWeight: 700, marginTop: 4, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 11.5, color: S.ink3 }}>Team {label.split(" ")[0]}</span>
      <span style={{ fontSize: 11.5, color: S.ink2, minHeight: 15 }}>{lead ? lead.username : "Be the first"}</span>
      <span style={{ fontFamily: "Sora, sans-serif", fontSize: 24, fontWeight: 700, marginTop: 10 }}>{compact(votes)}</span>
      <span style={{ fontSize: 11, color: S.ink3 }}>votes</span>
      <span style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, height: 26, padding: "0 10px", borderRadius: 13, fontSize: 11, fontWeight: 800, background: mine ? (align === "left" ? S.gold : S.silver) : "rgba(255,255,255,0.06)", color: mine ? S.btnText : S.ink2, border: mine ? 0 : `1px solid ${S.line2}` }}>
        {mine ? <><Check size={12} /> Your side</> : "Vote"}
      </span>
    </button>
  );
}

function Argument({ a, label, side }: { a: DebateSide["arguments"][number]; label: string; side: number }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0" }}>
      <Avatar user={a.author} size={32} />
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{a.author.username} <span style={{ marginLeft: 4, padding: "1px 7px", borderRadius: 9, fontSize: 10, color: side === 0 ? S.gold : S.silver, background: side === 0 ? S.goldSoft : S.silverSoft }}>{label}</span></div>
        <div style={{ fontSize: 12.5, color: S.ink2, marginTop: 2, wordBreak: "break-word" }}>{a.body}</div>
      </div>
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: S.ink3 }}><Heart size={14} />{a.reactionCount}</span>
    </div>
  );
}
