/**
 * ChatUI — Real-time AI chat via WebSocket push (no polling)
 * Sends messages via REST, receives AI replies via canvas:ai_reply event.
 */
import { useState, useRef, useEffect } from "react";
import { canvasApi, type Message } from "../api";
import { useCanvasRealtime, CANVAS_ROOMS, CANVAS_EVENTS } from "../useCanvasRealtime";

const GRAD = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const PURPLE = "#A29BFE";
const GREEN = "#55EFC4";
const CYAN  = "#00D2D3";

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [typing, setTyping]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const seenIds                 = useRef(new Set<number>());

  // WebSocket connection
  const { connected, on, off } = useCanvasRealtime([CANVAS_ROOMS.messages]);

  // Load initial messages via REST
  useEffect(() => {
    canvasApi.getMessages().then(msgs => {
      setMessages(msgs);
      msgs.forEach(m => seenIds.current.add(m.id));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Real-time: receive AI reply via WebSocket push
  useEffect(() => {
    const handleAiReply = (data: unknown) => {
      const msg = data as Message;
      if (!seenIds.current.has(msg.id)) {
        seenIds.current.add(msg.id);
        setMessages(prev => [...prev, msg]);
        setTyping(false);
      }
    };
    on(CANVAS_EVENTS.AI_REPLY, handleAiReply);
    return () => off(CANVAS_EVENTS.AI_REPLY, handleAiReply);
  }, [on, off]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setTyping(true);

    const tempId = Date.now();
    const userMsg: Message = { id: tempId, text, sender: "user", ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    seenIds.current.add(tempId);

    try {
      await canvasApi.sendMessage(text);
    } catch {
      setTyping(false);
    }
  };

  const statusColor = !connected ? "rgba(255,204,51,0.8)" : loading ? "rgba(255,255,255,0.3)" : GREEN;
  const statusText  = !connected ? "⚡ connecting…" : loading ? "loading…" : "● live";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 220, background: "#12131F", borderRadius: 12, overflow: "hidden" }}
         onClick={e => e.stopPropagation()}>

      {/* Header */}
      <div style={{ padding: "8px 10px", background: "rgba(162,155,254,0.08)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>🤖</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#E8EAED" }}>Apex AI</div>
          <div style={{ fontSize: 8, color: statusColor }}>{statusText}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ fontSize: 7, color: CYAN, background: "rgba(0,210,211,0.1)", borderRadius: 99, padding: "2px 6px" }}>WS</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>{messages.length}</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 4px", display: "flex", flexDirection: "column", gap: 6, scrollbarWidth: "none" }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: "flex", justifyContent: msg.sender === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", fontSize: 10, lineHeight: 1.5, padding: "6px 9px",
              borderRadius: msg.sender === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
              background: msg.sender === "user" ? GRAD : "rgba(255,255,255,0.07)",
              color: "#E8EAED", fontWeight: 500,
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", gap: 3, padding: "8px 10px", background: "rgba(255,255,255,0.05)", borderRadius: "10px 10px 10px 2px", width: "fit-content", alignItems: "center" }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: PURPLE, animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "6px 8px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 5, flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Message Apex AI…"
          style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 8px", color: "#E8EAED", fontSize: 9, outline: "none", fontFamily: "inherit" }}
        />
        <button onClick={send} disabled={!input.trim()}
          style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: input.trim() ? GRAD : "rgba(255,255,255,0.06)", color: "white", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>↑</button>
      </div>
      <style>{`@keyframes typingDot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}`}</style>
    </div>
  );
}
