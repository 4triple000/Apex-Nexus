/**
 * The AI helper at the bottom of the Engine: a short chat plus one-tap suggestions.
 */
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

export interface HelperMessage { from: "me" | "ai"; text: string; error?: boolean }

export function AIHelper({ messages, busy, chips, placeholder, onSend, fill }: {
  messages: HelperMessage[];
  busy: boolean;
  chips: string[];
  placeholder: string;
  onSend: (text: string) => void;
  /** Take the full height of the parent (phone sheet) instead of a short strip */
  fill?: boolean;
}) {
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [messages.length, busy]);

  const send = (t = text) => {
    const v = t.trim();
    if (!v || busy) return;
    onSend(v);
    setText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, height: fill ? "100%" : undefined }}>
      <div ref={list} aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", maxHeight: fill ? undefined : 120, flex: fill ? 1 : undefined, minHeight: 0 }}>
        {messages.length === 0 && !busy && (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--mg-ink-3)" }}>Ask for any change in plain words, or tap a suggestion.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.from === "me" ? "flex-end" : "flex-start", maxWidth: "85%", fontSize: 13, lineHeight: 1.45, padding: "7px 11px",
            borderRadius: m.from === "me" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            background: m.from === "me" ? "rgba(139,123,255,0.32)" : m.error ? "rgba(255,79,163,0.14)" : "rgba(255,255,255,0.07)",
            color: m.error ? "#FFB3CF" : m.from === "me" ? "var(--mg-ink)" : "var(--mg-ink-2)",
          }}>{m.text}</div>
        ))}
        {busy && <div style={{ alignSelf: "flex-start", fontSize: 13, padding: "7px 11px", borderRadius: 14, background: "rgba(255,255,255,0.07)", color: "var(--mg-ink-3)" }}>Working on it…</div>}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
        {chips.map((c) => (
          <button key={c} onClick={() => send(c)} disabled={busy} className="mg-press mg-focus"
            style={{ flexShrink: 0, height: 30, padding: "0 12px", borderRadius: 15, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--mg-ink-2)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
            {c}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <input id="engine-ai-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Ask the AI helper"
          style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 20, padding: "0 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "var(--mg-ink)", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="mg-cc on mg-focus" style={{ width: 40, height: 40, opacity: busy || !text.trim() ? 0.5 : 1 }}>
          <Send size={16} strokeWidth={2.4} />
        </button>
      </form>
    </div>
  );
}
