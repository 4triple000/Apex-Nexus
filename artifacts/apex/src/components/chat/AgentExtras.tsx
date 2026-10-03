/**
 * Apex Agent's work, shown the way Claude shows its own: a quiet one-line summary above the answer that
 * opens into a timeline of steps (what it searched, what it read, what it found), then the answer, then
 * compact source cards and any Social post draft.
 */
import { useState, type ComponentType } from "react";
import { useLocation } from "wouter";
import { Check, X, ChevronRight, Globe, FileText, Calculator, MessagesSquare, Wallet, PenLine, Send, Loader2 } from "lucide-react";
import { socialApi } from "@/lib/socialApi";

export interface AgentSource { title: string; url: string }
export interface AgentStep { tool: string; label: string; detail?: string; results?: AgentSource[]; ok: boolean }

const ICONS: Record<string, ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  web_search: Globe, open_url: FileText, calculator: Calculator, search_my_chats: MessagesSquare, get_my_credits: Wallet, draft_social_post: PenLine,
};

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

/** A small letter tile in place of a site icon (no requests to third-party icon services). */
function SiteMark({ url, size = 16 }: { url: string; size?: number }) {
  const h = host(url);
  const hue = [...h].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: 4, flexShrink: 0, display: "grid", placeItems: "center", fontSize: size * 0.62, fontWeight: 800, color: "#fff", background: `hsl(${hue} 45% 38%)` }}>
      {h[0]?.toUpperCase() ?? "•"}
    </span>
  );
}

/** "Searched the web, read 2 pages" */
function summary(steps: AgentStep[]): string {
  const n = (tool: string) => steps.filter((s) => s.tool === tool).length;
  const parts: string[] = [];
  if (n("web_search")) parts.push(n("web_search") > 1 ? `searched the web ${n("web_search")} times` : "searched the web");
  if (n("open_url")) parts.push(n("open_url") > 1 ? `read ${n("open_url")} pages` : "read a page");
  if (n("calculator")) parts.push("did the math");
  if (n("search_my_chats")) parts.push("searched your chats");
  if (n("get_my_credits")) parts.push("checked your credits");
  if (n("draft_social_post")) parts.push("drafted a post");
  const text = parts.join(", ") || "worked on it";
  return text[0]!.toUpperCase() + text.slice(1);
}

/** Above the answer: the collapsible record of what Apex did. */
export function AgentSteps({ steps }: { steps?: AgentStep[] }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;
  const failed = steps.some((s) => !s.ok);
  return (
    <div style={{ maxWidth: "92%" }}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mg-focus"
        style={{ display: "inline-flex", alignItems: "center", gap: 7, maxWidth: "100%", padding: "5px 10px 5px 6px", marginLeft: -6, borderRadius: 10, border: 0, background: open ? "rgba(255,255,255,0.06)" : "transparent", color: "var(--mg-ink-3)", fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left" }}>
        <span style={{ display: "inline-flex" }}>
          {steps.slice(0, 3).map((s, i) => {
            const Icon = ICONS[s.tool] ?? Globe;
            return (
              <span key={i} style={{ width: 20, height: 20, borderRadius: "50%", marginLeft: i ? -6 : 0, display: "grid", placeItems: "center", background: "rgba(30,26,58,0.95)", border: "1px solid rgba(255,255,255,0.14)" }}>
                <Icon size={11} color="var(--mg-ink-2)" />
              </span>
            );
          })}
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary(steps)}</span>
        {failed ? <span style={{ color: "#FF8A8A", opacity: 0.85, whiteSpace: "nowrap" }}>· a step didn't work</span> : null}
        <ChevronRight size={14} style={{ flexShrink: 0, transform: open ? "rotate(90deg)" : undefined, transition: "transform 0.2s" }} />
      </button>

      {open ? (
        <ol style={{ listStyle: "none", margin: "8px 0 2px", padding: 0, position: "relative" }}>
          {/* the thread running through the steps */}
          <span aria-hidden style={{ position: "absolute", left: 10, top: 12, bottom: 12, width: 1, background: "rgba(255,255,255,0.12)" }} />
          {steps.map((s, i) => {
            const Icon = ICONS[s.tool] ?? Globe;
            return (
              <li key={i} style={{ position: "relative", display: "flex", gap: 12, paddingBottom: 14 }}>
                <span style={{ position: "relative", width: 21, height: 21, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: s.ok ? "rgba(30,26,58,1)" : "rgba(80,24,32,1)", border: `1px solid ${s.ok ? "rgba(255,255,255,0.16)" : "rgba(255,138,138,0.45)"}` }}>
                  {s.ok ? <Icon size={11} color="var(--mg-ink-2)" /> : <X size={11} color="#FF8A8A" />}
                </span>
                <div style={{ minWidth: 0, flex: 1, paddingTop: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--mg-ink-2)" }}>
                    {s.label}{s.ok ? null : <span style={{ fontWeight: 500, color: "#FF8A8A" }}> · didn't work</span>}
                  </div>
                  {s.detail ? (
                    <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--mg-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: s.tool === "calculator" ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined }}>
                      {s.tool === "web_search" || s.tool === "search_my_chats" ? `"${s.detail}"` : s.detail}
                    </div>
                  ) : null}
                  {s.results?.length ? (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2, padding: 4, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {s.results.slice(0, 5).map((r) => (
                        <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, textDecoration: "none", minWidth: 0 }}>
                          <SiteMark url={r.url} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--mg-ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                          <span style={{ fontSize: 11.5, color: "var(--mg-ink-3)", whiteSpace: "nowrap" }}>{host(r.url)}</span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
          <li style={{ position: "relative", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ width: 21, height: 21, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(134,239,172,0.14)", border: "1px solid rgba(134,239,172,0.4)" }}>
              <Check size={11} color="#86EFAC" />
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mg-ink-2)" }}>Done</span>
          </li>
        </ol>
      ) : null}
    </div>
  );
}

/** Below the answer: the pages it used, and a Social post draft to review. */
export function AgentExtras({ sources, draft }: { sources?: AgentSource[]; draft?: string | null }) {
  if (!sources?.length && !draft) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: "92%" }}>
      {sources?.length ? (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--mg-ink-3)", marginBottom: 6 }}>SOURCES</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
            {sources.slice(0, 6).map((s, i) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}
                style={{ flexShrink: 0, width: 168, padding: "9px 10px", borderRadius: 12, textDecoration: "none", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--mg-ink-2)", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.title}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--mg-ink-3)", minWidth: 0 }}>
                  <SiteMark url={s.url} size={14} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host(s.url)}</span>
                  <span style={{ marginLeft: "auto", opacity: 0.7 }}>{i + 1}</span>
                </span>
              </a>
            ))}
          </div>
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
