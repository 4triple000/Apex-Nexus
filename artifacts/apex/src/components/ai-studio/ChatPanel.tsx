/**
 * ChatPanel — Left panel of the AI Studio.
 *
 * Shows the conversation history and input for building/editing apps.
 * During generation, shows a rich step-by-step progress tracker.
 * After generation, shows a structured plan card (features, pages, stack).
 */

import { useRef, useEffect, useState } from "react";
import type { BuildStep, AiStudioPlan } from "@/pages/ai-studio";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  buildSteps: BuildStep[];
  hasProject: boolean;
  plan?: AiStudioPlan | null;
  onSend: (message: string) => void;
  onRun?: () => void;
  onDeploy?: () => void;
}

const EXAMPLE_PROMPTS = [
  "Build me a fitness tracker with workout logging",
  "Create a SaaS dashboard for tracking sales metrics",
  "Make a social media app with posts, likes, and profiles",
  "Build a task management app like Todoist",
  "Create a crypto portfolio tracker with charts",
  "Build a restaurant ordering system with menu and cart",
];

export function ChatPanel({ messages, isGenerating, buildSteps, hasProject, plan, onSend, onRun, onDeploy }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isGenerating, buildSteps, plan]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isGenerating) return;
    setInput("");
    onSend(text);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder = hasProject
    ? 'e.g. "Add dark mode", "Fix the login form", "Make the UI more modern"'
    : 'e.g. "Build me a fitness tracker with workout logging"';

  const activeStep = buildSteps.find((s) => s.status === "active");
  const doneCount  = buildSteps.filter((s) => s.status === "done").length;
  const totalSteps = buildSteps.length;
  const progress   = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;

  return (
    <div className="flex flex-col h-full" style={{ background: "transparent" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 flex-shrink-0 border-b"
        style={{ borderColor: "#1C1C1E" }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #A29BFE, #FF8C00)", color: "#000" }}
        >
          ⚡
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">Apex AI Studio</p>
          <p className="text-white/40 text-[11px] truncate">
            {isGenerating && activeStep
              ? activeStep.label + "…"
              : hasProject
              ? "Iterative editing mode"
              : "Describe what you want to build"}
          </p>
        </div>
        {isGenerating && totalSteps > 0 && (
          <ProgressRing progress={progress} />
        )}
      </div>

      {/* Messages / welcome / generating */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isGenerating ? (
          <WelcomeScreen onPrompt={(p) => { setInput(p); inputRef.current?.focus(); }} />
        ) : (
          <>
            {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}

            {/* ── Plan card — shown after first successful generation ── */}
            {plan && !isGenerating && (
              <PlanCard plan={plan} onRun={onRun} onDeploy={onDeploy} />
            )}
          </>
        )}

        {/* ── Rich Build Progress tracker ─────────────────────────────────── */}
        {isGenerating && buildSteps.length > 0 && (
          <div className="flex items-start gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
              style={{ background: "rgba(30,26,62,0.62)", border: "1px solid #2A2A2A" }}
            >
              ⚡
            </div>

            <div
              className="rounded-2xl rounded-tl-sm p-4 flex-1"
              style={{ background: "rgba(30,26,62,0.62)", border: "1px solid #21262D" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/70 text-[11px] font-semibold tracking-wide uppercase">
                  {hasProject ? "Applying Changes" : "Building Your App"}
                </span>
                <span className="text-[#A29BFE] text-[10px] font-mono font-bold">
                  {doneCount}/{totalSteps}
                </span>
              </div>

              <div className="h-0.5 rounded-full mb-4 overflow-hidden" style={{ background: "rgba(30,26,62,0.62)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #A29BFE, #FF8C00)",
                  }}
                />
              </div>

              <div className="space-y-2.5">
                {buildSteps.map((step) => (
                  <StepRow key={step.id} step={step} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t" style={{ borderColor: "#1C1C1E" }}>
        <div
          className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-all"
          style={{
            background: "rgba(30,26,62,0.62)",
            border: isGenerating ? "1px solid rgba(162,155,254,0.2)" : "1px solid #21262D",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isGenerating ? "Please wait while Apex builds your app…" : placeholder}
            rows={1}
            disabled={isGenerating}
            className="flex-1 bg-transparent text-white text-sm resize-none outline-none placeholder-white/25 leading-relaxed"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: input.trim() && !isGenerating ? "#A29BFE" : "#2A2A2A",
            }}
          >
            {isGenerating ? (
              <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-[#A29BFE] animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "#000" : "#666"} strokeWidth="2.5">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-white/20 text-[10px] text-center mt-2">
          {hasProject ? "Edit your app" : "Press Enter to build"} · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// ── Plan Card ──────────────────────────────────────────────────────────────────

function PlanCard({ plan, onRun, onDeploy }: { plan: AiStudioPlan; onRun?: () => void; onDeploy?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl rounded-tl-sm overflow-hidden"
      style={{ border: "1px solid rgba(162,155,254,0.15)", background: "rgba(162,155,254,0.03)" }}
    >
      {/* Plan header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/3"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: "rgba(162,155,254,0.12)", border: "1px solid rgba(162,155,254,0.2)" }}
        >
          📋
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#A29BFE] text-xs font-bold truncate">{plan.project_name}</p>
          <p className="text-white/35 text-[10px] truncate">{plan.description.slice(0, 65)}</p>
        </div>
        <span className="text-white/30 text-[10px] transition-transform flex-shrink-0"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          ▼
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: "rgba(162,155,254,0.1)" }}>
          <div className="pt-3 grid grid-cols-2 gap-3">

            {/* Features */}
            {plan.features.length > 0 && (
              <div className="col-span-2">
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 font-semibold">Features</p>
                <div className="flex flex-wrap gap-1.5">
                  {plan.features.slice(0, 8).map((f, i) => (
                    <span key={i}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pages */}
            {plan.pages.length > 0 && (
              <div>
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 font-semibold">Pages</p>
                <div className="space-y-1">
                  {plan.pages.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#A29BFE" }} />
                      <span className="text-white/50 text-[11px] truncate">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tech stack */}
            {plan.tech_stack.length > 0 && (
              <div>
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 font-semibold">Stack</p>
                <div className="space-y-1">
                  {plan.tech_stack.slice(0, 5).map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#3b82f6" }} />
                      <span className="text-white/50 text-[11px] truncate">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* API routes */}
            {plan.api_routes && plan.api_routes.length > 0 && (
              <div className="col-span-2">
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 font-semibold">API Routes</p>
                <div className="flex flex-wrap gap-1.5">
                  {plan.api_routes.slice(0, 6).map((r, i) => (
                    <span key={i}
                      className="px-2 py-0.5 rounded text-[10px] font-mono"
                      style={{ background: "rgba(59,130,246,0.08)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.15)" }}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Workflows */}
            {plan.workflows && plan.workflows.length > 0 && (
              <div className="col-span-2">
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 font-semibold">
                  Workflows · {plan.workflows.length}
                </p>
                <div className="space-y-1">
                  {plan.workflows.slice(0, 4).map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-[10px]">⚡</span>
                      <span className="text-white/50 text-[11px] truncate">{w.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            {onRun && (
              <button
                onClick={onRun}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
              >
                <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor">
                  <path d="M0 0L8 5L0 10V0Z" />
                </svg>
                Run
              </button>
            )}
            {onDeploy && (
              <button
                onClick={onDeploy}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                style={{ background: "linear-gradient(135deg, rgba(162,155,254,0.15), rgba(255,140,0,0.15))", color: "#A29BFE", border: "1px solid rgba(162,155,254,0.25)" }}
              >
                🚀 Deploy
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step row ──────────────────────────────────────────────────────────────────

function StepRow({ step }: { step: BuildStep }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        {step.status === "done" && (
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "rgba(34,197,94,0.15)" }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {step.status === "active" && (
          <div
            className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "rgba(162,155,254,0.3)", borderTopColor: "#A29BFE" }}
          />
        )}
        {step.status === "pending" && (
          <div
            className="w-4 h-4 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        )}
        {step.status === "error" && (
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.15)" }}
          >
            <span style={{ color: "#ef4444", fontSize: 10, lineHeight: 1 }}>✕</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-[12px] font-medium leading-tight"
          style={{
            color:
              step.status === "done"    ? "#4ade80" :
              step.status === "active"  ? "#A29BFE" :
              step.status === "error"   ? "#f87171" :
              "rgba(255,255,255,0.3)",
          }}
        >
          {step.label}
        </p>
        {step.status === "active" && (
          <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            {step.detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ progress }: { progress: number }) {
  const r = 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;

  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="flex-shrink-0">
      <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
      <circle
        cx="14" cy="14" r={r}
        fill="none"
        stroke="#A29BFE"
        strokeWidth="2.5"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 14 14)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="14" y="18" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#A29BFE">
        {progress}%
      </text>
    </svg>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  const formatContent = (text: string) =>
    text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
          style={{ background: "rgba(30,26,62,0.62)", border: "1px solid #2A2A2A" }}
        >
          ⚡
        </div>
      )}
      <div
        className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed ${
          isUser ? "rounded-tr-sm" : "rounded-tl-sm"
        }`}
        style={{
          background: isUser ? "#2563EB" : "#161B22",
          border: isUser ? "none" : "1px solid #21262D",
          color: "#FFFFFF",
        }}
        dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
      />
    </div>
  );
}

// ── Welcome screen ─────────────────────────────────────────────────────────────

function WelcomeScreen({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8 text-center gap-6">
      <div>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
          style={{ background: "linear-gradient(135deg, #1A1A1A, #2A2A2A)", border: "1px solid #333" }}
        >
          🏗️
        </div>
        <h2 className="text-white font-bold text-lg mb-1">What do you want to build?</h2>
        <p className="text-white/40 text-sm max-w-52">
          Describe your idea and Apex will generate a complete working app in seconds.
        </p>
      </div>

      <div className="w-full space-y-2">
        <p className="text-white/30 text-[11px] mb-3 uppercase tracking-wider">Try an example</p>
        {EXAMPLE_PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => onPrompt(p)}
            className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-white/60 transition-all hover:text-white/90 hover:bg-white/5"
            style={{ border: "1px solid #1C1C1E" }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
