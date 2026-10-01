/**
 * Ask Apex: ask a question, read the answer, and choose whether to share the Q&A to the feed.
 * Only the asker sees the answer until they share it.
 */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { socialApi, type ApexAnswer, type Post, type Visibility } from "@/lib/socialApi";
import { S, Sheet, primaryBtn, ghostBtn, ApexTag, apexCard } from "./ui";
import { VisibilityPicker } from "./Create";

const STARTERS = ["How do I start making games?", "Give me a workout I can do at home", "What's a good name for my gaming channel?"];

export function AskSheet({ open, onClose, onPosted }: { open: boolean; onClose: () => void; onPosted: (p: Post) => void }) {
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ApexAnswer | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [busy, setBusy] = useState<"ask" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setQuestion(""); setAnswer(null); setError(null); } }, [open]);

  const ask = async (q = question) => {
    if (q.trim().length < 3) return;
    setBusy("ask"); setError(null); setQuestion(q);
    try { setAnswer(await socialApi.ask(q.trim())); void qc.invalidateQueries({ queryKey: ["credits"] }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const share = async () => {
    if (!answer) return;
    setBusy("share"); setError(null);
    try {
      onPosted(await socialApi.create({ kind: "ask", body: answer.question, answer: answer.answer, answerToken: answer.token, visibility }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label="Ask Apex" title="Ask Apex">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <form onSubmit={(e) => { e.preventDefault(); void ask(); }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label>
            <span style={{ position: "absolute", left: -9999 }}>Your question</span>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} maxLength={500} autoFocus placeholder="Ask Apex anything…"
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 76, borderRadius: 14, padding: 12, background: "rgba(0,0,0,0.3)", border: `1px solid ${S.line2}`, color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 15, lineHeight: 1.5, outline: "none" }} />
          </label>
          {!answer ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STARTERS.map((s) => <button key={s} type="button" onClick={() => void ask(s)} disabled={!!busy} style={ghostBtn({ height: 30, padding: "0 10px", borderRadius: 15, fontSize: 12, color: S.ink2 })}>{s}</button>)}
            </div>
          ) : null}
          <button type="submit" disabled={!!busy || question.trim().length < 3} style={primaryBtn({ height: 42, opacity: question.trim().length < 3 ? 0.5 : 1 })}>
            {busy === "ask" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={15} />} {answer ? "Ask again" : "Ask"}
          </button>
          <div style={{ fontSize: 11.5, color: S.ink3, textAlign: "center" }}>Uses credits like a chat message · only you see the answer unless you share it</div>
        </form>

        {answer ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={apexCard}>
              <ApexTag>Apex answered</ApexTag>
              <div style={{ fontSize: 12.5, color: S.ink2, marginTop: 4 }}>“{answer.question}”</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.55, marginTop: 8, whiteSpace: "pre-wrap" }}>{answer.answer}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: S.ink2 }}>Share to the feed as</span>
              <VisibilityPicker value={visibility} onChange={setVisibility} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => void share()} disabled={!!busy} style={primaryBtn({ height: 42, flexGrow: 1 })}>{busy === "share" ? <Loader2 size={16} className="animate-spin" /> : null} Share to feed</button>
              <button onClick={onClose} style={ghostBtn({ height: 42 })}>Done</button>
            </div>
          </div>
        ) : null}

        {error ? <div role="alert" style={{ fontSize: 13, color: "#FF8A8A" }}>{error}</div> : null}
      </div>
    </Sheet>
  );
}
