/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX BUILDER ONBOARDING — 10-step interactive intro                   ║
 * ║  User goes from zero → shipping in under 60 seconds                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authHeaders } from "@/lib/authSession";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY   = "apex-builder-onboarded-v2";
const DEFAULT_PROMPT = "Make a simple jumping game";
const AI_EDIT_PROMPT = "Make the player jump higher and add a score counter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiFetch(path: string, opts?: RequestInit) {
  const sessionId = localStorage.getItem("apex-dev-session") ?? "onboarding";
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-session-id": sessionId,
      ...(opts?.headers ?? {}),
    },
  });
}

// ─── Design ───────────────────────────────────────────────────────────────────

const GRAD  = "linear-gradient(135deg,#6C5CE7 0%,#A29BFE 50%,#FD79A8 100%)";
const GRADH = "linear-gradient(135deg,#7C6CF7 0%,#B2ABFE 50%,#FD89B8 100%)";
const BLUE  = "#00D2FF";
const CYAN  = "#00D2D3";
const PURP  = "#A29BFE";
const PINK  = "#FD79A8";
const GOLD  = "#A29BFE";
const RED   = "#FF5F6D";
const BG = "transparent";
const BG2   = "#0D0E18";

// ─── Step types ───────────────────────────────────────────────────────────────

type Step =
  | "splash"
  | "hook"
  | "building"
  | "result"
  | "play"
  | "code"
  | "ai-edit"
  | "ai-applying"
  | "complete"
  | "limits";

// ─── Particle background ──────────────────────────────────────────────────────

function StarField() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: 40 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: Math.random() > 0.8 ? 2 : 1,
            height: Math.random() > 0.8 ? 2 : 1,
            borderRadius: "50%",
            background: `rgba(${Math.random() > 0.5 ? "162,155,254" : "0,210,211"},${0.3 + Math.random() * 0.7})`,
            left: `${Math.random() * 100}%`,
            top:  `${Math.random() * 100}%`,
            animation: `twinkle ${2 + Math.random() * 4}s ${Math.random() * 4}s ease-in-out infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50%       { opacity: 1;    transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

// ─── Animated Apex Logo ───────────────────────────────────────────────────────

function ApexLogo({ size = 96 }: { size?: number }) {
  return (
    <motion.div
      animate={{
        filter: [
          "drop-shadow(0 0 12px rgba(108,92,231,0.5)) drop-shadow(0 0 32px rgba(108,92,231,0.2))",
          "drop-shadow(0 0 24px rgba(162,155,254,0.9)) drop-shadow(0 0 56px rgba(253,121,168,0.4))",
          "drop-shadow(0 0 12px rgba(108,92,231,0.5)) drop-shadow(0 0 32px rgba(108,92,231,0.2))",
        ],
      }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      style={{ width: size, height: size }}
    >
      <img
        src="/apex-logo.png"
        alt="Apex"
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </motion.div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "8px 0" }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ y: [0, -7, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity }}
          style={{
            width: 8, height: 8, borderRadius: "50%",
            background: PURP,
            boxShadow: `0 0 8px ${PURP}`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 3,
      background: "rgba(255,255,255,0.06)",
    }}>
      <motion.div
        animate={{ width: `${(step / total) * 100}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        style={{ height: "100%", background: GRAD, borderRadius: 2 }}
      />
    </div>
  );
}

// ─── Terminal output component ─────────────────────────────────────────────────

function TerminalOutput({ lines, highlight = false }: { lines: string[]; highlight?: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div style={{
      background: "rgba(0,0,0,0.6)",
      borderRadius: 16,
      border: `1px solid rgba(162,155,254,${highlight ? "0.5" : "0.15"})`,
      boxShadow: highlight ? `0 0 24px rgba(162,155,254,0.2)` : "none",
      padding: "16px 14px",
      fontFamily: "'Fira Code','JetBrains Mono',monospace",
      fontSize: 12,
      lineHeight: 1.65,
      maxHeight: 220,
      overflowY: "auto",
      transition: "border-color 0.3s, box-shadow 0.3s",
    }}>
      {/* Terminal title bar */}
      <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
        {["#FF5F57","#FFBD2E","#28C840"].map((c, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
        ))}
        <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
          apex-sandbox.js
        </span>
      </div>
      {lines.map((l, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i * 0.05, 0.8) }}
          style={{ color: l.startsWith("//") ? "rgba(162,155,254,0.5)" : "#dfe6e9" }}
        >
          {l}
        </motion.div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ─── Code snippet display ──────────────────────────────────────────────────────

function CodeSnippet({ code }: { code: string }) {
  const lines = code.split("\n").slice(0, 18);
  return (
    <div style={{
      background: "rgba(0,0,0,0.5)",
      borderRadius: 16,
      border: `1px solid rgba(162,155,254,0.18)`,
      padding: "14px 16px",
      fontFamily: "'Fira Code','JetBrains Mono',monospace",
      fontSize: 11,
      lineHeight: 1.7,
      maxHeight: 200,
      overflowY: "auto",
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: "flex", gap: 12 }}>
          <span style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, width: 20, textAlign: "right" }}>
            {i + 1}
          </span>
          <span style={{ color: "#dfe6e9", whiteSpace: "pre" }}>{line}</span>
        </div>
      ))}
      {code.split("\n").length > 18 && (
        <div style={{ color: "rgba(255,255,255,0.25)", marginTop: 4, paddingLeft: 32 }}>
          …{code.split("\n").length - 18} more lines
        </div>
      )}
    </div>
  );
}

// ─── Step wrapper ─────────────────────────────────────────────────────────────

function StepWrap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "24px 20px",
        overflowY: "auto",
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Main onboarding component ─────────────────────────────────────────────────

export function BuilderOnboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep]               = useState<Step>("splash");
  const [prompt, setPrompt]           = useState(DEFAULT_PROMPT);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [editedCode, setEditedCode]       = useState("");
  const [execLines, setExecLines]         = useState<string[]>([]);
  const [buildProgress, setBuildProgress] = useState(0);
  const [projectId, setProjectId]         = useState<number | null>(null);
  const [error, setError]                 = useState("");
  const [usageCount] = useState(1);

  const STEPS: Step[] = ["splash","hook","building","result","play","code","ai-edit","ai-applying","complete","limits"];
  const stepNum = STEPS.indexOf(step) + 1;

  // ── Step 0: Splash — auto-advance after 2.2s ─────────────────────────────
  useEffect(() => {
    if (step === "splash") {
      const t = setTimeout(() => setStep("hook"), 2200);
      return () => clearTimeout(t);
    }
  }, [step]);

  // ── Step 2: Building — AI generate ──────────────────────────────────────
  const startBuilding = useCallback(async () => {
    setStep("building");
    setBuildProgress(0);
    setError("");

    // Simulate build progress
    const prog = setInterval(() => {
      setBuildProgress(p => Math.min(p + Math.random() * 15, 90));
    }, 300);

    try {
      // Create a project
      const projRes  = await apiFetch("/api/devos/projects", {
        method: "POST",
        body: JSON.stringify({ name: "My First Build", description: prompt }),
      });
      const projData = await projRes.json();
      const pid      = projData.project?.id as number | undefined;
      setProjectId(pid ?? null);

      // Generate code
      const genRes  = await apiFetch("/api/devos/generate", {
        method: "POST",
        body: JSON.stringify({ prompt, projectId: pid }),
      });
      const genData = await genRes.json();
      const code    = genData.code ?? "";
      setGeneratedCode(code);

      // Save to the project's index.js file
      if (pid) {
        const filesRes  = await apiFetch(`/api/devos/projects/${pid}/files`);
        const filesData = await filesRes.json();
        const file      = filesData.files?.[0];
        if (file) {
          await apiFetch(`/api/devos/projects/${pid}/files/${file.id}`, {
            method: "PUT",
            body: JSON.stringify({ content: code }),
          });
        }
      }

      // Execute the code and collect output
      const execRes  = await apiFetch("/api/devos/execute", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ code, projectId: pid }),
      });
      const execData = await execRes.json();
      const lines    = (execData.logs ?? []).map((l: { message: string }) => l.message);
      if (execData.error) lines.push(`Error: ${execData.error}`);
      setExecLines(lines.length ? lines : ["// Game initialized", "// Ready to play!"]);

      clearInterval(prog);
      setBuildProgress(100);
      await new Promise(r => setTimeout(r, 600));
      setStep("result");
    } catch (_) {
      clearInterval(prog);
      setError("Generation failed — please try again");
      setStep("hook");
    }
  }, [prompt]);

  // ── Step 6: AI Edit ──────────────────────────────────────────────────────
  const applyAiEdit = useCallback(async () => {
    setStep("ai-applying");
    try {
      const res  = await apiFetch(`/api/devos/projects/${projectId}/ai-modify`, {
        method: "POST",
        body: JSON.stringify({
          instruction: AI_EDIT_PROMPT,
          currentCode: generatedCode,
        }),
      });
      const data = await res.json();
      setEditedCode(data.code ?? generatedCode);
    } catch (_) {
      setEditedCode(generatedCode); // fallback
    }
    await new Promise(r => setTimeout(r, 800));
    setStep("complete");
  }, [projectId, generatedCode]);

  // ── Complete ─────────────────────────────────────────────────────────────
  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    onComplete();
  }, [onComplete]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: BG,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      color: "#fff",
    }}>
      <StarField />

      {/* Progress bar (hidden on splash) */}
      {step !== "splash" && (
        <ProgressBar step={stepNum - 1} total={STEPS.length - 1} />
      )}

      {/* Skip button (hidden on splash/building) */}
      {step !== "splash" && step !== "building" && (
        <button
          onClick={finish}
          style={{
            position: "absolute", top: 16, right: 16, zIndex: 10,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20, padding: "6px 14px",
            color: "rgba(255,255,255,0.45)", fontSize: 12,
            cursor: "pointer",
          }}
        >
          Skip
        </button>
      )}

      <AnimatePresence mode="wait">

        {/* ════ STEP 0: SPLASH ════ */}
        {step === "splash" && (
          <StepWrap key="splash">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 22 }}
              style={{ marginBottom: 28 }}
            >
              <ApexLogo size={120} />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              style={{
                fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em",
                textAlign: "center", margin: "0 0 10px",
                background: GRAD, WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Apex Builder
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              style={{ color: "rgba(255,255,255,0.55)", fontSize: 17, textAlign: "center", margin: 0 }}
            >
              Build anything with AI
            </motion.p>
          </StepWrap>
        )}

        {/* ════ STEP 1: HOOK ════ */}
        {step === "hook" && (
          <StepWrap key="hook">
            <ApexLogo size={52} />

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ width: "100%", maxWidth: 380, marginTop: 24 }}
            >
              <p style={{
                color: "rgba(255,255,255,0.5)", fontSize: 12,
                fontWeight: 700, letterSpacing: "0.1em",
                marginBottom: 8, textAlign: "center",
              }}>
                YOUR FIRST BUILD
              </p>
              <h2 style={{
                fontSize: 22, fontWeight: 900, textAlign: "center",
                margin: "0 0 20px", lineHeight: 1.3,
              }}>
                What do you want to build?
              </h2>

              {editingPrompt ? (
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  autoFocus
                  rows={3}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.07)",
                    border: `2px solid ${PURP}`,
                    borderRadius: 16, padding: "14px 16px",
                    color: "#fff", fontSize: 16, outline: "none",
                    resize: "none", lineHeight: 1.5,
                    fontFamily: "-apple-system, sans-serif",
                    boxSizing: "border-box",
                  }}
                />
              ) : (
                <div
                  onClick={() => setEditingPrompt(true)}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1.5px solid rgba(162,155,254,0.3)`,
                    borderRadius: 16, padding: "16px 18px",
                    fontSize: 17, fontWeight: 600, color: "#fff",
                    cursor: "pointer", lineHeight: 1.4,
                    marginBottom: 2,
                  }}
                >
                  {prompt}
                </div>
              )}

              <p style={{
                color: "rgba(255,255,255,0.3)", fontSize: 12,
                textAlign: editingPrompt ? "right" : "center",
                marginTop: 8, marginBottom: 20,
                cursor: "pointer",
              }}
                onClick={() => setEditingPrompt(v => !v)}
              >
                {editingPrompt ? "← Use suggestion" : "✎ Edit prompt"}
              </p>

              {error && (
                <p style={{ color: RED, fontSize: 13, textAlign: "center", marginBottom: 12 }}>{error}</p>
              )}

              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={startBuilding}
                style={{
                  width: "100%",
                  background: GRAD,
                  border: "none", borderRadius: 18,
                  padding: "17px 0", fontSize: 18, fontWeight: 900,
                  color: "#fff", cursor: "pointer",
                  boxShadow: "0 8px 32px rgba(108,92,231,0.45)",
                  letterSpacing: "-0.01em",
                }}
              >
                ⚡ Build Now
              </motion.button>
            </motion.div>

            {/* Idea chips */}
            <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 380 }}>
              {["Snake game", "Math quiz", "Fibonacci", "Word counter"].map(idea => (
                <button
                  key={idea}
                  onClick={() => { setPrompt(idea); setEditingPrompt(false); }}
                  style={{
                    background: "rgba(162,155,254,0.08)",
                    border: `1px solid rgba(162,155,254,0.2)`,
                    borderRadius: 20, padding: "7px 14px",
                    color: PURP, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {idea}
                </button>
              ))}
            </div>
          </StepWrap>
        )}

        {/* ════ STEP 2: BUILDING ════ */}
        {step === "building" && (
          <StepWrap key="building">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ApexLogo size={80} />
            </motion.div>

            <div style={{ marginTop: 32, textAlign: "center" }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>
                Building your project…
              </h2>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, margin: "0 0 24px" }}>
                AI is writing your code
              </p>
              <TypingDots />
            </div>

            {/* Progress bar */}
            <div style={{
              width: "100%", maxWidth: 300, marginTop: 28,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 10, height: 6, overflow: "hidden",
            }}>
              <motion.div
                animate={{ width: `${buildProgress}%` }}
                transition={{ duration: 0.4 }}
                style={{ height: "100%", background: GRAD, borderRadius: 10 }}
              />
            </div>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 10 }}>
              {buildProgress < 30 ? "Setting up project…"
                : buildProgress < 60 ? "Generating code…"
                : buildProgress < 85 ? "Running sandbox…"
                : "Almost done…"}
            </p>

            {/* Animated build steps */}
            <div style={{ marginTop: 24, width: "100%", maxWidth: 300 }}>
              {[
                { label: "Create project",    done: buildProgress > 20 },
                { label: "Generate code",     done: buildProgress > 55 },
                { label: "Run in sandbox",    done: buildProgress > 80 },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: buildProgress > i * 25 ? 1 : 0.2, x: 0 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <motion.div
                    animate={{ scale: s.done ? [1, 1.3, 1] : 1 }}
                    style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: s.done ? CYAN : "rgba(255,255,255,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, color: "#fff", fontWeight: 800,
                      transition: "background 0.3s",
                    }}
                  >
                    {s.done ? "✓" : (i + 1)}
                  </motion.div>
                  <span style={{
                    color: s.done ? "#fff" : "rgba(255,255,255,0.35)",
                    fontSize: 14, fontWeight: s.done ? 600 : 400,
                    transition: "color 0.3s",
                  }}>
                    {s.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </StepWrap>
        )}

        {/* ════ STEP 3: RESULT ════ */}
        {step === "result" && (
          <StepWrap key="result">
            <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
              {/* Success badge */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.1 }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: `${CYAN}18`,
                  border: `1.5px solid ${CYAN}55`,
                  borderRadius: 14, padding: "10px 16px",
                  marginBottom: 16,
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: `${CYAN}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14,
                }}>
                  ✓
                </div>
                <div>
                  <p style={{ color: CYAN, fontWeight: 800, fontSize: 15, margin: 0 }}>
                    You just built this
                  </p>
                  <p style={{ color: "rgba(0,210,211,0.6)", fontSize: 11, margin: "1px 0 0" }}>
                    {generatedCode.split("\n").length} lines of code generated
                  </p>
                </div>
              </motion.div>

              {/* Output preview */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <TerminalOutput lines={execLines} highlight />
              </motion.div>

              {/* CTA buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                style={{ display: "flex", gap: 10, marginTop: 16 }}
              >
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setStep("play")}
                  style={{
                    flex: 1, background: GRAD, border: "none",
                    borderRadius: 16, padding: "15px 0",
                    color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer",
                    boxShadow: "0 6px 24px rgba(108,92,231,0.4)",
                  }}
                >
                  ▶ Play
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setStep("code")}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.06)",
                    border: `1.5px solid rgba(162,155,254,0.25)`,
                    borderRadius: 16, padding: "15px 0",
                    color: PURP, fontSize: 16, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {"<>"} View Code
                </motion.button>
              </motion.div>
            </div>
          </StepWrap>
        )}

        {/* ════ STEP 4: PLAY / INTERACT ════ */}
        {step === "play" && (
          <StepWrap key="play">
            <div style={{ width: "100%", maxWidth: 400 }}>
              <div style={{ marginBottom: 14, textAlign: "center" }}>
                <span style={{
                  background: `${GOLD}18`, border: `1px solid ${GOLD}44`,
                  borderRadius: 20, padding: "6px 16px",
                  color: GOLD, fontSize: 12, fontWeight: 700,
                }}>
                  🎮 Your game is running
                </span>
              </div>

              <TerminalOutput lines={execLines} />

              {/* Tooltip */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
                style={{
                  marginTop: 14,
                  background: "rgba(253,121,168,0.12)",
                  border: `1px solid ${PINK}44`,
                  borderRadius: 14, padding: "12px 16px",
                  display: "flex", gap: 10, alignItems: "center",
                }}
              >
                <span style={{ fontSize: 20 }}>💡</span>
                <p style={{ color: "#fff", fontSize: 14, margin: 0, fontWeight: 600 }}>
                  You can change anything in this project
                </p>
              </motion.div>

              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setStep("code")}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                style={{
                  width: "100%", marginTop: 16,
                  background: GRAD, border: "none",
                  borderRadius: 16, padding: "15px 0",
                  color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer",
                }}
              >
                See the code →
              </motion.button>
            </div>
          </StepWrap>
        )}

        {/* ════ STEP 5: CODE VIEW ════ */}
        {step === "code" && (
          <StepWrap key="code">
            <div style={{ width: "100%", maxWidth: 400 }}>
              {/* File tree */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid rgba(162,155,254,0.15)`,
                  borderRadius: "16px 16px 0 0",
                  padding: "12px 14px",
                  display: "flex", gap: 10, alignItems: "center",
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: GRAD,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14,
                }}>
                  📁
                </div>
                <div>
                  <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: 0 }}>My First Build</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, margin: "1px 0 0" }}>
                    1 file · JavaScript
                  </p>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: GOLD, fontSize: 11, fontWeight: 600 }}>◈</span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>index.js</span>
                </div>
              </motion.div>

              {/* Code */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{ borderRadius: "0 0 16px 16px", overflow: "hidden" }}
              >
                <CodeSnippet code={generatedCode} />
              </motion.div>

              {/* Overlay explanation */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                style={{
                  marginTop: 14,
                  background: "rgba(108,92,231,0.15)",
                  border: `1px solid rgba(162,155,254,0.3)`,
                  borderRadius: 14, padding: "12px 16px",
                  display: "flex", gap: 10, alignItems: "center",
                }}
              >
                <span style={{ fontSize: 20 }}>🗂️</span>
                <p style={{ color: "#fff", fontSize: 14, margin: 0, fontWeight: 600, lineHeight: 1.4 }}>
                  This is your project — every line is editable
                </p>
              </motion.div>

              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setStep("ai-edit")}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                style={{
                  width: "100%", marginTop: 14,
                  background: GRAD, border: "none",
                  borderRadius: 16, padding: "15px 0",
                  color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer",
                }}
              >
                Try editing with AI →
              </motion.button>
            </div>
          </StepWrap>
        )}

        {/* ════ STEP 6: AI EDIT ════ */}
        {step === "ai-edit" && (
          <StepWrap key="ai-edit">
            <div style={{ width: "100%", maxWidth: 400 }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 6px" }}>
                  AI can edit your code
                </h2>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, margin: 0 }}>
                  Try this suggestion:
                </p>
              </div>

              {/* Suggestion chip */}
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  background: "rgba(253,121,168,0.12)",
                  border: `2px solid ${PINK}55`,
                  borderRadius: 16, padding: "16px 18px",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>✨</span>
                  <p style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: 0 }}>
                    "{AI_EDIT_PROMPT}"
                  </p>
                </div>
              </motion.div>

              {/* Before snippet */}
              <div style={{ marginBottom: 10 }}>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.08em", margin: "0 0 6px" }}>
                  CURRENT CODE
                </p>
                <CodeSnippet code={generatedCode.split("\n").slice(0, 6).join("\n")} />
              </div>

              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={applyAiEdit}
                style={{
                  width: "100%",
                  background: GRAD,
                  border: "none", borderRadius: 18,
                  padding: "17px 0", fontSize: 18, fontWeight: 900,
                  color: "#fff", cursor: "pointer",
                  boxShadow: "0 8px 32px rgba(108,92,231,0.45)",
                }}
              >
                🤖 Apply Change
              </motion.button>
            </div>
          </StepWrap>
        )}

        {/* ════ STEP 6b: AI APPLYING ════ */}
        {step === "ai-applying" && (
          <StepWrap key="ai-applying">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <ApexLogo size={72} />
            </motion.div>
            <div style={{ marginTop: 28, textAlign: "center" }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
                Applying AI edit…
              </h2>
              <TypingDots />
            </div>
          </StepWrap>
        )}

        {/* ════ STEP 7: COMPLETE ════ */}
        {step === "complete" && (
          <StepWrap key="complete">
            <div style={{ width: "100%", maxWidth: 400 }}>
              {/* Confetti-style burst */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                style={{
                  width: 88, height: 88, borderRadius: 24,
                  background: GRAD, margin: "0 auto 20px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 40,
                  boxShadow: `0 0 40px rgba(108,92,231,0.5), 0 0 80px rgba(253,121,168,0.2)`,
                }}
              >
                🎉
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                  fontSize: 24, fontWeight: 900, textAlign: "center",
                  margin: "0 0 10px", lineHeight: 1.25,
                }}
              >
                You just edited your first project
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                style={{
                  color: "rgba(255,255,255,0.5)", fontSize: 15,
                  textAlign: "center", margin: "0 0 24px",
                }}
              >
                The full builder is now unlocked
              </motion.p>

              {/* Before / After */}
              {editedCode && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  style={{ marginBottom: 20 }}
                >
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700,
                    letterSpacing: "0.08em", margin: "0 0 8px" }}>
                    AI MODIFIED CODE
                  </p>
                  <CodeSnippet code={editedCode.split("\n").slice(0, 8).join("\n")} />
                </motion.div>
              )}

              <motion.button
                whileTap={{ scale: 0.93 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                onClick={() => setStep("limits")}
                style={{
                  width: "100%", background: GRAD,
                  border: "none", borderRadius: 18,
                  padding: "17px 0", fontSize: 18, fontWeight: 900,
                  color: "#fff", cursor: "pointer",
                  boxShadow: "0 8px 32px rgba(108,92,231,0.45)",
                }}
              >
                Continue →
              </motion.button>
            </div>
          </StepWrap>
        )}

        {/* ════ STEP 9: LIMITS ════ */}
        {step === "limits" && (
          <StepWrap key="limits">
            <div style={{ width: "100%", maxWidth: 400 }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <ApexLogo size={56} />
                <h2 style={{ fontSize: 22, fontWeight: 900, margin: "16px 0 8px" }}>
                  You're ready to build
                </h2>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, margin: 0 }}>
                  Here's what's included:
                </p>
              </div>

              {/* Usage meter */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid rgba(162,155,254,0.2)`,
                  borderRadius: 18, padding: "18px 20px", marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <p style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: 0 }}>Daily builds</p>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: "2px 0 0" }}>
                      Resets every 24 hours
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: PURP }}>{usageCount}</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}> / 20</span>
                  </div>
                </div>
                {/* Usage bar */}
                <div style={{
                  background: "rgba(255,255,255,0.07)",
                  borderRadius: 8, height: 8, overflow: "hidden",
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(usageCount / 20) * 100}%` }}
                    transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                    style={{ height: "100%", background: GRAD, borderRadius: 8 }}
                  />
                </div>
              </motion.div>

              {/* Features */}
              {[
                { icon: "⚡", label: "AI code generation",   desc: "From any prompt" },
                { icon: "📁", label: "Virtual file system",  desc: "Projects & files stored" },
                { icon: "🤖", label: "AI code editor",       desc: "Edit with instructions" },
                { icon: "🏗️", label: "Build pipeline",       desc: "Validate & deploy" },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 0",
                    borderBottom: i < 3 ? `1px solid rgba(255,255,255,0.06)` : "none",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "rgba(162,155,254,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {f.icon}
                  </div>
                  <div>
                    <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: 0 }}>{f.label}</p>
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: "1px 0 0" }}>{f.desc}</p>
                  </div>
                  <div style={{ marginLeft: "auto", color: CYAN, fontSize: 14 }}>✓</div>
                </motion.div>
              ))}

              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={finish}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                style={{
                  width: "100%", marginTop: 20,
                  background: GRAD,
                  border: "none", borderRadius: 18,
                  padding: "18px 0", fontSize: 18, fontWeight: 900,
                  color: "#fff", cursor: "pointer",
                  boxShadow: "0 8px 40px rgba(108,92,231,0.5)",
                  letterSpacing: "-0.01em",
                }}
              >
                🚀 Start Building
              </motion.button>
            </div>
          </StepWrap>
        )}

      </AnimatePresence>
    </div>
  );
}

// ─── Gate helper ──────────────────────────────────────────────────────────────

export function useBuilderOnboarding() {
  const [done, setDone] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDone(true);
  }, []);
  return { needsOnboarding: !done, complete };
}
