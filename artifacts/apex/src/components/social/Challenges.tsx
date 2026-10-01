/**
 * Challenges: the row on the Social home, the challenge page (as a sheet), and "Start a challenge".
 * Apex's weekly challenge always comes first; anyone can start their own for 1 to 14 days.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Plus, Check, Loader2, Trash2 } from "lucide-react";
import { socialApi, compact, endsIn, type Challenge, type Post } from "@/lib/socialApi";
import { S, card, Sheet, primaryBtn, ghostBtn, sceneFor, SectionLabel } from "./ui";
import { PostCard } from "./PostCard";

export function ChallengesRow({ onOpen, onStart }: { onOpen: (id: number) => void; onStart: () => void }) {
  const { data } = useQuery({ queryKey: ["social-challenges"], queryFn: socialApi.challenges, staleTime: 60_000 });
  const active = data?.active ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel sub="Join in, or start your own">Challenges</SectionLabel>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", margin: "0 -16px", padding: "0 16px" }}>
        {active.map((c) => (
          <button key={c.id} onClick={() => onOpen(c.id)}
            style={{ width: 176, flexShrink: 0, borderRadius: 16, overflow: "hidden", padding: 0, textAlign: "left", cursor: "pointer", background: S.surf, border: `1px solid ${c.official ? "rgba(226,193,126,0.35)" : S.line}`, color: S.ink, fontFamily: "Manrope, sans-serif" }}>
            <span aria-hidden style={{ display: "flex", alignItems: "flex-end", height: 64, padding: "0 10px 8px", background: sceneFor(c.tag) }}>
              {c.official ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 10, background: "rgba(10,10,12,0.7)", color: S.gold, fontSize: 10.5, fontWeight: 800 }}><Trophy size={11} /> Apex weekly</span> : null}
            </span>
            <span style={{ display: "block", padding: "9px 10px 10px" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</span>
              <span style={{ display: "block", fontSize: 11, color: S.ink3, marginTop: 3 }}>{compact(c.entries)} {c.entries === 1 ? "entry" : "entries"} · {endsIn(c.endsAt)}</span>
              {c.joined ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11, fontWeight: 800, color: S.gold }}><Check size={12} /> You're in</span> : null}
            </span>
          </button>
        ))}
        <button onClick={onStart}
          style={{ width: 120, flexShrink: 0, borderRadius: 16, border: `1px dashed ${S.line2}`, background: "none", color: S.ink2, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, fontWeight: 800, fontFamily: "Manrope, sans-serif", minHeight: 130 }}>
          <Plus size={20} /> Start one
        </button>
      </div>
    </div>
  );
}

export function ChallengeSheet({ id, onClose, onJoin, onSeeAll, onPostChange, onOpenComments, onTag }: {
  id: number | null;
  onClose: () => void;
  onJoin: (c: Challenge) => void;
  onSeeAll: (c: Challenge) => void;
  onPostChange: (p: Post) => void;
  onOpenComments: (p: Post) => void;
  onTag: (tag: string) => void;
}) {
  const qc = useQueryClient();
  const key = ["social-challenge", id];
  const { data, isLoading, error } = useQuery({ queryKey: key, enabled: !!id, queryFn: () => socialApi.challenge(id!) });
  const c = data?.challenge;

  const change = (p: Post) => {
    qc.setQueryData<typeof data>(key, (old) => old && { ...old, top: old.top.map((x) => (x.id === p.id ? p : x)) });
    onPostChange(p);
  };
  const remove = async () => {
    if (!c || !window.confirm("Remove this challenge? Entries stay on people's profiles.")) return;
    await socialApi.removeChallenge(c.id).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ["social-challenges"] });
    onClose();
  };

  return (
    <Sheet open={!!id} onClose={onClose} label="Challenge" title={c ? c.title : "Challenge"}>
      {isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading…</div> : null}
      {error ? <div style={{ fontSize: 13, color: "#FF8A8A" }}>{(error as Error).message}</div> : null}
      {c ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${c.official ? "rgba(226,193,126,0.35)" : S.line}` }}>
            <div aria-hidden style={{ height: 90, background: sceneFor(c.tag) }} />
            <div style={{ padding: 14, background: S.surf, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: S.ink3 }}>
                {c.official ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: S.gold, fontWeight: 800 }}><Trophy size={12} /> Apex weekly</span> : c.creator ? <span>Started by <strong style={{ color: S.ink2 }}>{c.creator.username}</strong></span> : null}
                <span>· #{c.tag}</span>
                <span>· {endsIn(c.endsAt)}</span>
              </div>
              {c.description ? <div style={{ fontSize: 14, lineHeight: 1.5 }}>{c.description}</div> : null}
              <div style={{ fontSize: 12.5, color: S.ink2 }}>{compact(c.entries)} {c.entries === 1 ? "entry" : "entries"}{c.joined ? " · you're in" : ""}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {!c.ended ? <button onClick={() => onJoin(c)} style={primaryBtn({ height: 40, flexGrow: 1 })}>{c.joined ? "Post another entry" : "Join challenge"}</button> : null}
                {c.entries ? <button onClick={() => onSeeAll(c)} style={ghostBtn({ height: 40 })}>See all</button> : null}
                {c.mine ? <button onClick={() => void remove()} aria-label="Remove challenge" style={ghostBtn({ height: 40, width: 40, padding: 0, color: "#FF8A8A" })}><Trash2 size={16} /></button> : null}
              </div>
            </div>
          </div>
          {data.top.length ? (
            <>
              <SectionLabel>Top entries</SectionLabel>
              {data.top.map((p, i) => (
                <div key={p.id} style={{ position: "relative" }}>
                  {i < 3 ? <span aria-label={`Rank ${i + 1}`} style={{ position: "absolute", top: -8, left: -6, zIndex: 1, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: i === 0 ? S.gold : S.surf2, color: i === 0 ? S.btnText : S.ink, border: `1px solid ${S.line2}` }}>{i + 1}</span> : null}
                  <PostCard post={p} onChange={change} onRemove={() => qc.invalidateQueries({ queryKey: key })} onOpenComments={onOpenComments} onTag={onTag} />
                </div>
              ))}
            </>
          ) : (
            <div style={{ ...card, padding: 18, textAlign: "center", fontSize: 13.5, color: S.ink2 }}>No entries yet. Be the first.</div>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}

const DAYS = [1, 3, 7, 14];

export function StartChallengeSheet({ open, onClose, onStarted }: { open: boolean; onClose: () => void; onStarted: (c: Challenge) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setTitle(""); setDescription(""); setDays(7); setError(null); } }, [open]);

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const c = await socialApi.startChallenge({ title: title.trim(), description: description.trim(), days });
      void qc.invalidateQueries({ queryKey: ["social-challenges"] });
      onStarted(c);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: `1px solid ${S.line2}`, color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 14, outline: "none" };
  return (
    <Sheet open={open} onClose={onClose} label="Start a challenge" title="Start a challenge">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 800, color: S.ink2 }}>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} autoFocus placeholder="e.g. 30-second beat" style={field} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 800, color: S.ink2 }}>
          What should people post?
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} placeholder="Explain the challenge in a sentence or two" style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
        </label>
        <div role="radiogroup" aria-label="How long it runs" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: S.ink2 }}>Runs for</span>
          <div style={{ display: "flex", gap: 8 }}>
            {DAYS.map((d) => (
              <button key={d} role="radio" aria-checked={days === d} onClick={() => setDays(d)}
                style={ghostBtn({ height: 36, flexGrow: 1, ...(days === d ? { background: S.btn, color: S.btnText, borderColor: S.btn } : {}) })}>{d === 1 ? "1 day" : `${d} days`}</button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: S.ink3 }}>Apex makes a hashtag from the title so entries are easy to find.</div>
        {error ? <div role="alert" style={{ fontSize: 13, color: "#FF8A8A" }}>{error}</div> : null}
        <button onClick={() => void start()} disabled={busy || title.trim().length < 3} style={primaryBtn({ height: 44, opacity: title.trim().length < 3 ? 0.5 : 1 })}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />} Start challenge
        </button>
      </div>
    </Sheet>
  );
}
