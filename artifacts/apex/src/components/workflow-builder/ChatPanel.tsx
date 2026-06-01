import { useRef, useEffect, useState } from "react";
import { Send, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { type ChatMessage } from "./types";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string) => void;
  onClear: () => void;
}

const SUGGESTIONS = [
  "When a user signs up, send a welcome email",
  "Add a 5-minute delay before the next action",
  "Change the trigger to when a message is received",
  "Add an AI greeting after the delay",
  "Send the response to a webhook",
];

export function ChatPanel({ messages, isLoading, onSend, onClear }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        borderRight: "1px solid #1e1e1e",
        display: "flex",
        flexDirection: "column",
        background: "#0d0d0d",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid #1e1e1e",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "rgba(255,204,51,0.15)",
              border: "1px solid rgba(255,204,51,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={14} color="#FFCC33" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              AI Builder
            </div>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: 0.5 }}>
              Describe your workflow
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onClear}
            title="Clear conversation"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#555",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#999")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {isEmpty ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 8px",
              gap: 16,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>
                Start building
              </div>
              <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>
                Describe your automation in plain English and I'll build it for you.
              </div>
            </div>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
                Try these
              </div>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  style={{
                    background: "#161616",
                    border: "1px solid #222",
                    borderRadius: 8,
                    padding: "8px 10px",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 11,
                    color: "#bbb",
                    lineHeight: 1.4,
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#1e1e1e";
                    e.currentTarget.style.borderColor = "#FFCC3333";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#161616";
                    e.currentTarget.style.borderColor = "#222";
                    e.currentTarget.style.color = "#bbb";
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {isLoading && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: "rgba(255,204,51,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Sparkles size={12} color="#FFCC33" />
            </div>
            <div
              style={{
                background: "#161616",
                border: "1px solid #252525",
                borderRadius: "4px 12px 12px 12px",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Loader2 size={12} color="#FFCC33" className="animate-spin" />
              <span style={{ fontSize: 12, color: "#666" }}>Building workflow…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid #1a1a1a" }}>
        <div
          style={{
            background: "#161616",
            border: "1px solid #252525",
            borderRadius: 12,
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            padding: "8px 10px",
            transition: "border-color 0.15s",
          }}
          onFocus={() => {}}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Describe a workflow or edit…"
            rows={1}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: 12,
              color: "#e5e5e5",
              lineHeight: 1.5,
              fontFamily: "inherit",
              minHeight: 20,
              maxHeight: 100,
              overflowY: "auto",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: input.trim() && !isLoading ? "#FFCC33" : "#1e1e1e",
              border: "none",
              cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
              flexShrink: 0,
            }}
          >
            <Send size={13} color={input.trim() && !isLoading ? "#000" : "#444"} />
          </button>
        </div>
        <div style={{ fontSize: 9, color: "#333", marginTop: 5, textAlign: "center" }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.kind === "error";
  const isWorkflow =
    message.kind === "workflow_created" || message.kind === "workflow_updated";

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: "rgba(255,204,51,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          <Sparkles size={12} color="#FFCC33" />
        </div>
      )}
      <div
        style={{
          maxWidth: "78%",
          background: isUser
            ? "rgba(255,204,51,0.12)"
            : isError
            ? "rgba(239,68,68,0.1)"
            : isWorkflow
            ? "rgba(34,197,94,0.08)"
            : "#161616",
          border: `1px solid ${
            isUser
              ? "rgba(255,204,51,0.25)"
              : isError
              ? "rgba(239,68,68,0.25)"
              : isWorkflow
              ? "rgba(34,197,94,0.2)"
              : "#222"
          }`,
          borderRadius: isUser ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
          padding: "9px 12px",
        }}
      >
        {isWorkflow && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#22c55e",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            {message.kind === "workflow_created" ? "✓ Workflow Created" : "✓ Workflow Updated"}
          </div>
        )}
        <div
          style={{
            fontSize: 12,
            color: isError ? "#f87171" : isUser ? "#ffe066" : "#ccc",
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
          }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
