/** Under an Apex Agent answer: the steps it took, the pages it used, and a Social post draft to review. */
import { useState } from "react";
import { useLocation } from "wouter";
import { Check, X, ChevronDown, ExternalLink, Send, Loader2 } from "lucide-react";
import { socialApi } from "@/lib/socialApi";

export interface AgentStep { tool: string; label: string; ok: boolean }
export interface AgentSource { title: string; url: string }

const chip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "100%", padding: "5px 10px", borderRadius: 14, fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--mg-ink-2)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" };

export function AgentExtras({ steps, sources, draft }: { steps?: AgentStep[]; sources?: AgentSource[]; draft?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length && !sources?.length && !draft) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: -4, maxWidth: "92%" }}>
      {steps?.length ? (
        <div>
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: 0, padding: "2px 0", color: "var(--mg-ink-3)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {steps.length} step{steps.length === 1 ? "" : "s"} · how Apex did it
            <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
          </button>
          {open ? (
            <ol style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {steps.map((s, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--mg-ink-2)" }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: s.ok ? "rgba(134,239,172,0.15)" : "rgba(255,138,138,0.15)" }}>
                    {s.ok ? <Check size={11} color="#86EFAC" /> : <X size={11} color="#FF8A8A" />}
                  </span>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      {sources?.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {sources.slice(0, 6).map((s, i) => {
            let host = s.url;
            try { host = new URL(s.url).hostname.replace(/^www\./, ""); } catch { /* keep the raw link */ }
            return (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={chip} title={s.title}>
                <span style={{ color: "var(--mg-ink-3)" }}>{i + 1}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{host}</span>
                <ExternalLink size={11} />
              </a>
            );
          })}
        </div>
      ) : null}

      {draft ? <DraftCard text={draft} /> : null}
    </div>
  );
}

/** A Social post the agent wrote. Nothing is posted until the person taps Post. */
function DraftCard({ text }: { text: string }) {
  const [, nav] = useLocation();
  const [body, setBody] = useState(text);
  const [state, setState] = useState<"idle" | "posting" | "posted" | "error">("idle");
  const [postId, setPostId] = useState<number | null>(null);
  const post = async () => {
    setState("posting");
    try {
      const p = await socialApi.create({ kind: "text", body: body.trim(), visibility: "public" });
      setPostId(p.id);
      setState("posted");
    } catch {
      setState("error");
    }
  };
  return (
    <div style={{ padding: 12, borderRadius: 16, background: "linear-gradient(135deg, rgba(226,193,126,0.1), rgba(226,193,126,0.03))", border: "1px solid rgba(226,193,126,0.32)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "#E2C17E" }}>SOCIAL POST DRAFT</div>
      {state === "posted" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--mg-ink)" }}>
          <Check size={16} color="#86EFAC" /> Posted to Apex Social.
          {postId ? <button onClick={() => nav(`/feed/post/${postId}`)} style={{ marginLeft: "auto", background: "none", border: 0, color: "#E2C17E", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>View</button> : null}
        </div>
      ) : (
        <>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={3} aria-label="Post text"
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.2)", color: "var(--mg-ink)", fontFamily: "inherit", fontSize: 14, lineHeight: 1.45, outline: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => void post()} disabled={!body.trim() || state === "posting"}
              style={{ height: 34, padding: "0 16px", borderRadius: 17, border: 0, background: "#F5F5F7", color: "#0A0A0C", fontWeight: 800, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              {state === "posting" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Post
            </button>
            <span style={{ fontSize: 12, color: state === "error" ? "#FF8A8A" : "var(--mg-ink-3)" }}>
              {state === "error" ? "Couldn't post. Try again." : "Edit it if you like. Nothing is posted until you tap Post."}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
