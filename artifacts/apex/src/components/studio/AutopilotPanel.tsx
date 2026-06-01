/**
 * Autopilot Panel — the "describe anything → AI builds it" UI.
 *
 * Two modes:
 *   - "inline" (default): compact panel shown above project list
 *   - "modal": full-screen overlay for use inside the editor
 */
import { useState, useEffect, useRef } from "react";
import { useAutopilot, AUTOPILOT_STEPS, type AutopilotResult } from "@/hooks/useAutopilot";

const GOLD = "#ffcc33";

interface QuickPrompt {
  label: string;
  icon: string;
  prompt: string;
  color: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { label: "DM Bot", icon: "💬", prompt: "Build a flirty and funny DM bot that responds to messages with wit and charm", color: "#a78bfa" },
  { label: "Game", icon: "🎮", prompt: "Create a simple text adventure game with choices and a score system", color: "#34d399" },
  { label: "Automation", icon: "⚡", prompt: "Build an automation that takes user input, processes it with AI, and shows a result", color: "#fbbf24" },
  { label: "AI Tool", icon: "🤖", prompt: "Create an AI content generator that writes creative text based on a topic", color: "#a78bfa" },
  { label: "Quiz", icon: "🧠", prompt: "Build an AI quiz that asks trivia questions and scores the user's answers", color: "#38bdf8" },
  { label: "Story", icon: "📖", prompt: "Create an interactive story generator with AI-driven narrative branches", color: "#f87171" },
];

interface AutopilotPanelProps {
  mode?: "inline" | "modal";
  onClose?: () => void;
  onGenerated: (result: AutopilotResult) => void;
}

export function AutopilotPanel({ mode = "inline", onClose, onGenerated }: AutopilotPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [activeStep, setActiveStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const autopilot = useAutopilot();
  const isLoading = autopilot.isPending;
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mode === "modal") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mode]);

  // Step-by-step progress animation during generation
  useEffect(() => {
    if (isLoading) {
      setActiveStep(0);
      setCompletedSteps(new Set());
      let step = 0;
      stepTimerRef.current = setInterval(() => {
        step++;
        if (step < AUTOPILOT_STEPS.length) {
          setCompletedSteps((prev) => new Set([...prev, step - 1]));
          setActiveStep(step);
        } else {
          if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        }
      }, 900);
    } else {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      if (!isLoading && autopilot.isSuccess) {
        setCompletedSteps(new Set([0, 1, 2, 3]));
        setActiveStep(-1);
      }
    }
    return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current); };
  }, [isLoading, autopilot.isSuccess]);

  const handleGenerate = (text = prompt) => {
    if (!text.trim() || isLoading) return;
    autopilot.mutate(text.trim(), {
      onSuccess: (result) => {
        onGenerated(result);
        if (mode === "modal") onClose?.();
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  if (mode === "modal") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xl p-4">
        <div
          className="w-full max-w-lg rounded-3xl border overflow-hidden"
          style={{ background: "linear-gradient(180deg, #0a0f1e, #060a15)", borderColor: "rgba(255,204,51,0.15)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h2
                  className="text-lg font-black tracking-[0.08em] uppercase"
                  style={{ color: GOLD, textShadow: "0 0 20px rgba(255,204,51,0.4)" }}
                >
                  AI Autopilot
                </h2>
              </div>
              <p className="text-white/30 text-xs mt-0.5 font-mono">Describe anything → instantly built</p>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">×</button>
          </div>

          <PromptBody
            prompt={prompt}
            setPrompt={setPrompt}
            inputRef={inputRef}
            isLoading={isLoading}
            activeStep={activeStep}
            completedSteps={completedSteps}
            handleGenerate={handleGenerate}
            handleKeyDown={handleKeyDown}
            error={autopilot.error?.message}
          />
        </div>
      </div>
    );
  }

  // Inline mode
  return (
    <div
      className="mx-4 mb-3 rounded-2xl border overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(255,204,51,0.04), rgba(167,139,250,0.04))",
        borderColor: "rgba(255,204,51,0.12)",
      }}
    >
      <div className="px-4 pt-4 pb-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">✨</span>
          <span
            className="text-xs font-black tracking-[0.1em] uppercase"
            style={{ color: GOLD }}
          >
            AI Autopilot
          </span>
          <span className="text-[9px] text-white/25 font-mono">— describe anything, AI builds it</span>
        </div>
      </div>
      <PromptBody
        prompt={prompt}
        setPrompt={setPrompt}
        inputRef={inputRef}
        isLoading={isLoading}
        activeStep={activeStep}
        completedSteps={completedSteps}
        handleGenerate={handleGenerate}
        handleKeyDown={handleKeyDown}
        error={autopilot.error?.message}
        compact
      />
    </div>
  );
}

// ─── Shared body ──────────────────────────────────────────────

interface PromptBodyProps {
  prompt: string;
  setPrompt: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isLoading: boolean;
  activeStep: number;
  completedSteps: Set<number>;
  handleGenerate: (text?: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  error?: string;
  compact?: boolean;
}

function PromptBody({
  prompt, setPrompt, inputRef, isLoading, activeStep,
  completedSteps, handleGenerate, handleKeyDown, error, compact,
}: PromptBodyProps) {
  return (
    <div className={compact ? "px-4 pb-4" : "px-6 pb-6"}>
      {/* Input area */}
      <div className="relative mb-3">
        <input
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={compact ? "What do you want to build?" : "Describe your project… e.g. \"A flirty DM bot\" or \"A quiz game about history\""}
          disabled={isLoading}
          className="w-full pr-[90px] pl-4 py-3 rounded-xl text-sm text-white placeholder:text-white/25 border focus:outline-none transition-all disabled:opacity-50"
          style={{
            background: "rgba(255,255,255,0.04)",
            borderColor: prompt ? "rgba(255,204,51,0.3)" : "rgba(255,255,255,0.08)",
            fontSize: compact ? "12px" : "14px",
          }}
        />
        <button
          onClick={() => handleGenerate()}
          disabled={isLoading || !prompt.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-[11px] font-black text-black transition-all disabled:opacity-30 hover:brightness-110 active:scale-95"
          style={{ background: GOLD }}
        >
          {isLoading ? (
            <div className="w-3 h-3 rounded-full border-2 border-black/40 border-t-black animate-spin" />
          ) : (
            "Generate ✨"
          )}
        </button>
      </div>

      {/* Step-by-step progress */}
      {isLoading && (
        <div className="mb-3 space-y-1.5 rounded-xl bg-white/3 border border-white/5 px-3 py-3">
          {AUTOPILOT_STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2.5">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: completedSteps.has(i)
                    ? "rgba(74,222,128,0.2)"
                    : activeStep === i
                    ? "rgba(255,204,51,0.2)"
                    : "rgba(255,255,255,0.05)",
                  border: `1.5px solid ${completedSteps.has(i) ? "#4ade80" : activeStep === i ? GOLD : "rgba(255,255,255,0.1)"}`,
                }}
              >
                {completedSteps.has(i) ? (
                  <span className="text-[8px] text-green-400">✓</span>
                ) : activeStep === i ? (
                  <div
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: GOLD }}
                  />
                ) : null}
              </div>
              <span
                className="text-[11px] font-mono transition-colors"
                style={{
                  color: completedSteps.has(i)
                    ? "#4ade80"
                    : activeStep === i
                    ? GOLD
                    : "rgba(255,255,255,0.2)",
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          ⚠ {error}. A fallback template was used instead.
        </div>
      )}

      {/* Quick prompts */}
      {!isLoading && (
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q.label}
              onClick={() => {
                setPrompt(q.prompt);
                handleGenerate(q.prompt);
              }}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
              style={{
                background: `${q.color}12`,
                border: `1px solid ${q.color}25`,
                color: q.color,
              }}
            >
              <span>{q.icon}</span>
              {q.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
