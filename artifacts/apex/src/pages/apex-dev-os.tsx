/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX BUILDER — Mobile-First Development Environment                    ║
 * ║  Touch-optimised IDE · AI-powered · Game Engine Integration             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import {
  useState, useEffect, useRef, useCallback,
  type CSSProperties,
} from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { BuilderOnboarding, useBuilderOnboarding } from "@/components/builder/BuilderOnboarding";
import { ApexLogo } from "@/components/ui/ApexLogo";
import { FloatingVoiceButton } from "@/components/voice/FloatingVoiceButton";

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SESSION_ID = (() => {
  const k = "apex-dev-session";
  let s = localStorage.getItem(k);
  if (!s) { s = `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(k, s); }
  return s;
})();

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-session-id": SESSION_ID,
      ...(opts?.headers ?? {}),
    },
  });
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

const T = {
  bg:       "#06070D",
  bg2:      "#0D0E18",
  bg3:      "#12131F",
  bg4:      "#1A1B2E",
  grad:     "linear-gradient(135deg,#6C5CE7 0%,#A29BFE 50%,#FD79A8 100%)",
  gradH:    "linear-gradient(135deg,#7C6CF7 0%,#B2ABFE 50%,#FD89B8 100%)",
  purple:   "#A29BFE",
  purpleD:  "#6C5CE7",
  cyan:     "#00D2D3",
  cyanD:    "#00A8A8",
  pink:     "#FD79A8",
  gold:     "#FFCC33",
  red:      "#FF5F6D",
  green:    "#00D2D3",
  border:   "rgba(162,155,254,0.14)",
  borderB:  "rgba(162,155,254,0.28)",
  text:     "#E8EAED",
  textMid:  "#9BA0B4",
  textDim:  "#4E5268",
  mono:     "'Fira Code','JetBrains Mono','Cascadia Code','SF Mono',monospace",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project { id: number; name: string; description: string; language: string; createdAt: string }
interface DevFile  { id: number; projectId: number; path: string; content: string; language: string; updatedAt: string }
interface LogEntry { id: number; type: string; message: string; durationMs: number | null; exitCode: number; createdAt: string; metadata?: unknown }
interface ConsoleLine { type: "log"|"warn"|"error"|"info"|"system"; text: string; ms?: number }
interface PipelineStage { stage: string; status: "pass"|"fail"|"running"; output?: string; durationMs?: number }

type ViewMode = "editor" | "test" | "prompt";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectLang(path: string) {
  if (/\.(ts|tsx)$/.test(path)) return "typescript";
  if (/\.html?$/.test(path))   return "html";
  if (/\.css$/.test(path))     return "css";
  if (/\.json$/.test(path))    return "json";
  if (/\.md$/.test(path))      return "markdown";
  return "javascript";
}

const LANG_COLOR: Record<string, string> = {
  javascript: T.gold, typescript: "#74B9FF",
  html: T.red, css: T.pink, json: T.cyan, markdown: T.purple,
};
const langColor = (p: string) => LANG_COLOR[detectLang(p)] ?? T.purple;

const FILE_ICON: Record<string, string> = {
  js: "◈", ts: "◈", jsx: "◈", tsx: "◈", html: "◉", css: "◎",
  json: "⬡", md: "¶",
};
function fileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICON[ext] ?? "◇";
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Shared Styles (inline-object helpers) ────────────────────────────────────

const S: Record<string, CSSProperties> = {
  glassCard: {
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    backdropFilter: "blur(12px)",
  },
  input: {
    background: "rgba(255,255,255,0.06)",
    border: `1.5px solid ${T.border}`,
    borderRadius: 14,
    color: T.text,
    fontSize: 15,
    outline: "none",
    padding: "13px 16px",
    width: "100%",
    boxSizing: "border-box" as const,
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Neon pill badge */
function Badge({ label, color = T.purple }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
      color, background: `${color}1A`,
      border: `1px solid ${color}44`,
      borderRadius: 8, padding: "2px 8px",
    }}>
      {label}
    </span>
  );
}

/** Tap-friendly icon button */
function IconBtn({
  label, icon, color = T.textMid, bg = "rgba(255,255,255,0.05)",
  onClick, disabled, size = 44, active = false,
}: {
  label: string; icon: string; color?: string; bg?: string;
  onClick?: () => void; disabled?: boolean; size?: number; active?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      style={{
        width: size, height: size, borderRadius: size / 2.5,
        background: active ? `${T.purpleD}44` : bg,
        border: active ? `1.5px solid ${T.purple}` : `1px solid ${T.border}`,
        color, fontSize: size * 0.38, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, opacity: disabled ? 0.38 : 1, transition: "all 0.18s",
      }}
    >
      {icon}
    </motion.button>
  );
}

/** Primary action button */
function PrimaryBtn({
  children, onClick, disabled, loading, small = false, color = T.grad,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  loading?: boolean; small?: boolean; color?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: color, border: "none", borderRadius: small ? 12 : 16,
        color: "#fff", fontWeight: 800, fontSize: small ? 13 : 15,
        padding: small ? "9px 18px" : "14px 24px",
        cursor: disabled || loading ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
      }}
    >
      {loading ? <SpinIcon /> : null}
      {children}
    </motion.button>
  );
}

function SpinIcon() {
  return (
    <span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>⟳</span>
  );
}

/** Bottom sheet overlay */
function BottomSheet({
  open, onClose, title, children, maxH = "82dvh",
}: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; maxH?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 400,
              background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            }}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 401,
              background: T.bg2, borderRadius: "24px 24px 0 0",
              border: `1px solid ${T.borderB}`,
              maxHeight: maxH, display: "flex", flexDirection: "column",
            }}
          >
            {/* Handle */}
            <div style={{ padding: "12px 0 4px", display: "flex", justifyContent: "center" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: T.borderB }} />
            </div>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0 20px 12px",
            }}>
              <span style={{ color: T.text, fontWeight: 800, fontSize: 17 }}>{title}</span>
              <IconBtn label="Close" icon="×" size={36} onClick={onClose} />
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Left drawer */
function LeftDrawer({
  open, onClose, children,
}: {
  open: boolean; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.7)" }}
          />
          <motion.div
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            style={{
              position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 401,
              width: 280, background: T.bg2, borderRight: `1px solid ${T.borderB}`,
              display: "flex", flexDirection: "column",
            }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Code Editor ──────────────────────────────────────────────────────────────

function CodeEditor({
  value, onChange, fontSize = 14, readOnly = false,
}: {
  value: string; onChange?: (v: string) => void;
  fontSize?: number; readOnly?: boolean;
}) {
  const taRef    = useRef<HTMLTextAreaElement>(null);
  const lineH    = fontSize * 1.7;
  const lines    = value.split("\n");
  const lineCount = Math.max(lines.length, 1);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (e.key === "Tab") {
      e.preventDefault();
      const s = ta.selectionStart, end = ta.selectionEnd;
      const nv = value.substring(0, s) + "  " + value.substring(end);
      onChange?.(nv);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
    }
    // Auto-close brackets
    const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]", "'": "'", '"': '"', "`": "`" };
    if (pairs[e.key]) {
      const s = ta.selectionStart, end = ta.selectionEnd;
      if (s === end) { // no selection
        e.preventDefault();
        const nv = value.substring(0, s) + e.key + pairs[e.key] + value.substring(end);
        onChange?.(nv);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 1; });
      }
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "auto", position: "relative" }}>
      {/* Line numbers */}
      <div
        aria-hidden
        style={{
          width: 48, flexShrink: 0,
          background: "rgba(0,0,0,0.25)",
          borderRight: `1px solid ${T.border}`,
          paddingTop: 16, paddingBottom: 16,
          userSelect: "none",
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i}
            style={{
              height: lineH, lineHeight: `${lineH}px`,
              textAlign: "right", paddingRight: 10,
              color: T.textDim, fontSize: fontSize - 1,
              fontFamily: T.mono,
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Editor */}
      <textarea
        ref={taRef}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          resize: "none",
          color: T.text,
          fontSize,
          lineHeight: `${lineH}px`,
          padding: `16px 16px 16px 12px`,
          fontFamily: T.mono,
          caretColor: T.purple,
          WebkitTextFillColor: T.text,
          minHeight: lineCount * lineH + 32,
        }}
      />
    </div>
  );
}

// ─── Console Panel ─────────────────────────────────────────────────────────────

const LINE_COLORS: Record<string, string> = {
  log: T.text, warn: T.gold, error: T.red, info: T.cyan, system: T.purple,
};

function ConsolePanel({
  lines, running, expanded, onToggle,
}: {
  lines: ConsoleLine[]; running: boolean; expanded: boolean; onToggle: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, expanded]);

  return (
    <motion.div
      initial={false}
      animate={{ height: expanded ? 240 : 44 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      style={{
        background: "rgba(0,0,0,0.55)",
        borderTop: `1px solid ${T.borderB}`,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Handle row */}
      <button
        onClick={onToggle}
        style={{
          width: "100%", height: 44, background: "none", border: "none",
          display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 11, fontFamily: T.mono,
          color: T.textDim, fontWeight: 700, letterSpacing: "0.1em" }}>
          CONSOLE
        </span>
        {running && (
          <span style={{ color: T.cyan, fontSize: 11, animation: "pulse 1s infinite" }}>
            <SpinIcon /> running
          </span>
        )}
        {lines.length > 0 && !running && (
          <Badge label={`${lines.length}`} color={lines.some(l => l.type === "error") ? T.red : T.cyan} />
        )}
        <span style={{ marginLeft: "auto", color: T.textDim, fontSize: 14 }}>
          {expanded ? "▾" : "▴"}
        </span>
      </button>

      {/* Log lines */}
      {expanded && (
        <div style={{ overflowY: "auto", height: 196, padding: "0 14px 12px" }}>
          {lines.length === 0 && !running ? (
            <p style={{ color: T.textDim, fontSize: 12, fontFamily: T.mono, margin: 0 }}>
              // Run your code to see output
            </p>
          ) : lines.map((l, i) => (
            <div key={i} style={{
              display: "flex", gap: 8, marginBottom: 3,
              fontFamily: T.mono, fontSize: 12,
            }}>
              {l.ms !== undefined && (
                <span style={{ color: T.textDim, flexShrink: 0, width: 42 }}>{l.ms}ms</span>
              )}
              <span style={{
                color: LINE_COLORS[l.type] ?? T.text,
                whiteSpace: "pre-wrap", wordBreak: "break-all",
              }}>
                {l.type === "error" && "✗ "}{l.text}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
    </motion.div>
  );
}

// ─── File Explorer Drawer ─────────────────────────────────────────────────────

function FileExplorer({
  project, files, selectedId, onSelect, onCreate, onDelete, onClose,
}: {
  project: Project | null;
  files: DevFile[];
  selectedId?: number;
  onSelect: (f: DevFile) => void;
  onCreate: (path: string) => void;
  onDelete: (f: DevFile) => void;
  onClose: () => void;
}) {
  const [newPath, setNewPath] = useState("");
  const [creating, setCreating] = useState(false);

  const submit = () => {
    if (!newPath.trim()) return;
    onCreate(newPath.trim());
    setNewPath(""); setCreating(false);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "16px 16px 10px",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ color: T.text, fontWeight: 800, fontSize: 16, margin: 0 }}>
            {project?.name ?? "Files"}
          </p>
          <p style={{ color: T.textDim, fontSize: 11, margin: "2px 0 0" }}>
            {files.length} file{files.length !== 1 ? "s" : ""}
          </p>
        </div>
        <IconBtn label="New file" icon="+" size={40} color={T.purple} onClick={() => setCreating(v => !v)} />
      </div>

      {/* New file input */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
              <input
                autoFocus
                value={newPath}
                onChange={e => setNewPath(e.target.value)}
                placeholder="filename.js"
                style={{ ...S.input, fontSize: 14, padding: "10px 12px" }}
                onKeyDown={e => {
                  if (e.key === "Enter")  submit();
                  if (e.key === "Escape") { setCreating(false); setNewPath(""); }
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {["index.js","utils.js","game.js","styles.css","config.json"].map(t => (
                  <button key={t} onClick={() => setNewPath(t)}
                    style={{
                      background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`,
                      borderRadius: 8, padding: "4px 8px", color: T.textMid,
                      fontSize: 10, cursor: "pointer",
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {files.length === 0 ? (
          <p style={{ color: T.textDim, fontSize: 13, padding: "24px 16px", textAlign: "center" }}>
            No files yet
          </p>
        ) : files.map(f => (
          <div
            key={f.id}
            onClick={() => { onSelect(f); onClose(); }}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "13px 16px",
              cursor: "pointer",
              background: selectedId === f.id ? `${T.purpleD}22` : "transparent",
              borderLeft: `3px solid ${selectedId === f.id ? T.purple : "transparent"}`,
              transition: "all 0.15s",
            }}
          >
            <span style={{ color: langColor(f.path), fontSize: 16, flexShrink: 0 }}>
              {fileIcon(f.path)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                color: selectedId === f.id ? T.text : T.textMid,
                fontSize: 14, fontWeight: 600, margin: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{f.path}</p>
              <p style={{ color: T.textDim, fontSize: 10, margin: "1px 0 0" }}>
                {timeAgo(f.updatedAt)}
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(f); }}
              style={{
                background: "none", border: "none", color: T.textDim,
                cursor: "pointer", fontSize: 18, padding: "4px 6px",
                borderRadius: 8, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Assist Panel ──────────────────────────────────────────────────────────

const AI_QUICK: Array<{ label: string; icon: string; prompt: string }> = [
  { label: "Fix Errors",        icon: "🔧", prompt: "Fix all syntax and logic errors in this code" },
  { label: "Optimize",          icon: "⚡", prompt: "Optimize this code for performance and readability" },
  { label: "Explain Code",      icon: "💬", prompt: "Add detailed comments explaining what each part does" },
  { label: "Add Error Handling",icon: "🛡️", prompt: "Add proper try/catch error handling throughout" },
  { label: "Add Tests",         icon: "🧪", prompt: "Add console.assert() tests to verify the logic" },
  { label: "Refactor",          icon: "♻️", prompt: "Refactor to be cleaner and more modular" },
  { label: "Add Logging",       icon: "📊", prompt: "Add detailed console.log statements to trace execution" },
];

function AIAssistPanel({
  code, projectId, fileId, onCodeUpdate,
}: {
  code: string; projectId?: number; fileId?: number;
  onCodeUpdate: (code: string, addLine: (l: ConsoleLine) => void) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [working, setWorking]         = useState(false);
  const [mode, setMode]               = useState<"modify"|"generate">("modify");
  const [prompt, setPrompt]           = useState("");
  const [done, setDone]               = useState(false);

  const runModify = useCallback(async (instr: string) => {
    if (!instr.trim() || working) return;
    setWorking(true); setDone(false);
    try {
      const res  = await apiFetch(`/api/devos/projects/${projectId}/ai-modify`, {
        method: "POST",
        body: JSON.stringify({ fileId, instruction: instr.trim(), currentCode: code }),
      });
      const data = await res.json();
      if (data.code) {
        onCodeUpdate(data.code, () => {});
        setDone(true);
      }
    } finally {
      setWorking(false);
    }
  }, [working, code, projectId, fileId, onCodeUpdate]);

  const runGenerate = useCallback(async () => {
    if (!prompt.trim() || working) return;
    setWorking(true); setDone(false);
    try {
      const res  = await apiFetch("/api/devos/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: prompt.trim(), projectId }),
      });
      const data = await res.json();
      if (data.code) {
        onCodeUpdate(data.code, () => {});
        setDone(true);
      }
    } finally {
      setWorking(false);
    }
  }, [working, prompt, projectId, onCodeUpdate]);

  return (
    <div style={{ padding: "0 16px 24px" }}>
      {/* Mode switcher */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 18,
        background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 4,
      }}>
        {(["modify","generate"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 11, border: "none",
              background: mode === m ? `${T.purpleD}55` : "transparent",
              color: mode === m ? T.purple : T.textMid,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
            {m === "modify" ? "✏️ Modify" : "✨ Generate"}
          </button>
        ))}
      </div>

      {mode === "modify" ? (
        <>
          {/* Quick actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {AI_QUICK.map(q => (
              <motion.button key={q.label} whileTap={{ scale: 0.92 }}
                onClick={() => runModify(q.prompt)}
                disabled={working}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(162,155,254,0.08)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 24, padding: "8px 14px",
                  color: T.purple, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", opacity: working ? 0.5 : 1,
                }}>
                <span>{q.icon}</span> {q.label}
              </motion.button>
            ))}
          </div>

          {/* Custom instruction */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="Custom instruction…"
              style={S.input}
              onKeyDown={e => { if (e.key === "Enter") runModify(instruction); }}
            />
            <PrimaryBtn onClick={() => runModify(instruction)}
              disabled={!instruction.trim()} loading={working} small>
              →
            </PrimaryBtn>
          </div>
        </>
      ) : (
        <>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={4}
            placeholder="Describe what to build…&#10;e.g. A bubble sort that logs every swap"
            style={{
              ...S.input, resize: "vertical", lineHeight: 1.6,
              fontFamily: "-apple-system, sans-serif",
            }}
          />
          <div style={{ marginTop: 10 }}>
            <PrimaryBtn onClick={runGenerate} disabled={!prompt.trim()} loading={working}>
              ✨ Generate Code
            </PrimaryBtn>
          </div>
        </>
      )}

      {/* Loading state */}
      {working && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ marginTop: 20, textAlign: "center", color: T.purple }}>
          <div style={{ fontSize: 32 }}><SpinIcon /></div>
          <p style={{ margin: "8px 0 0", fontSize: 14 }}>AI is coding…</p>
        </motion.div>
      )}

      {/* Success state */}
      {done && !working && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 16, padding: "12px 16px", borderRadius: 14,
            background: `${T.cyan}15`, border: `1px solid ${T.cyan}44`,
            color: T.cyan, fontSize: 14, fontWeight: 700, textAlign: "center",
          }}>
          ✓ Code updated — tap Editor to view changes
        </motion.div>
      )}
    </div>
  );
}

// ─── Pipeline Panel ───────────────────────────────────────────────────────────

function PipelinePanel({
  code, projectId, fileId,
}: {
  code: string; projectId?: number; fileId?: number;
}) {
  const [stages, setStages]     = useState<PipelineStage[]>([]);
  const [running, setRunning]   = useState(false);
  const [testCode, setTestCode] = useState("");

  const run = useCallback(async () => {
    if (!code.trim() || running) return;
    setRunning(true); setStages([]);
    const res  = await apiFetch("/api/devos/pipeline", {
      method: "POST",
      body: JSON.stringify({ code, projectId, fileId, testCode: testCode.trim() || undefined }),
    });
    const data = await res.json();
    setStages(data.stages ?? []);
    setRunning(false);
  }, [code, running, projectId, fileId, testCode]);

  const allPass = stages.length > 0 && stages.every(s => s.status === "pass");

  return (
    <div style={{ padding: "0 16px 24px" }}>
      {/* Test code input */}
      <p style={{ color: T.textMid, fontSize: 12, fontWeight: 700, margin: "0 0 8px" }}>
        OPTIONAL TEST CODE
      </p>
      <textarea
        value={testCode}
        onChange={e => setTestCode(e.target.value)}
        rows={3}
        placeholder={"// Assertions that run after your code\n// e.g. console.assert(add(1,2) === 3);"}
        style={{
          ...S.input, resize: "none",
          fontFamily: T.mono, fontSize: 12, lineHeight: 1.6,
        }}
      />

      {/* Run pipeline button */}
      <div style={{ marginTop: 14, marginBottom: 20 }}>
        <PrimaryBtn onClick={run} loading={running} disabled={!code.trim()}>
          ▶ Run Full Pipeline
        </PrimaryBtn>
      </div>

      {/* Stage cards */}
      {stages.map((s, i) => {
        const color = s.status === "pass" ? T.cyan : T.red;
        const icons: Record<string, string> = { validate:"✓", execute:"▶", test:"🧪", deploy:"🚀" };
        return (
          <motion.div key={s.stage}
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            style={{
              background: `${color}0E`,
              border: `1px solid ${color}44`,
              borderRadius: 14, padding: "14px 16px", marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: s.output ? 10 : 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: `${color}20`, border: `1px solid ${color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color, fontSize: 16, fontWeight: 900, flexShrink: 0,
              }}>
                {s.status === "pass" ? "✓" : s.status === "fail" ? "✗" : "⟳"}
              </div>
              <div>
                <p style={{ color: T.text, fontWeight: 800, fontSize: 14, margin: 0 }}>
                  {icons[s.stage] ?? ""} {s.stage.charAt(0).toUpperCase() + s.stage.slice(1)}
                </p>
                <p style={{ color, fontSize: 11, margin: "2px 0 0", fontWeight: 700 }}>
                  {s.status.toUpperCase()}{s.durationMs ? ` · ${s.durationMs}ms` : ""}
                </p>
              </div>
            </div>
            {s.output && (
              <div style={{
                background: "rgba(0,0,0,0.35)", borderRadius: 10, padding: "10px 12px",
                fontFamily: T.mono, fontSize: 11, color: T.textMid,
                whiteSpace: "pre-wrap", wordBreak: "break-all",
                maxHeight: 100, overflowY: "auto",
              }}>
                {s.output}
              </div>
            )}
          </motion.div>
        );
      })}

      {stages.length > 0 && (
        <div style={{
          padding: "12px 16px", borderRadius: 14, textAlign: "center",
          background: allPass ? `${T.cyan}12` : `${T.red}12`,
          border: `1px solid ${allPass ? T.cyan : T.red}44`,
          color: allPass ? T.cyan : T.red, fontWeight: 800, fontSize: 15,
        }}>
          {allPass ? "🚀 All stages passed" : "⚠ Pipeline failed"}
        </div>
      )}
    </div>
  );
}

// ─── Build Prompt Screen ──────────────────────────────────────────────────────

function BuildPromptScreen({
  onGenerate, onDismiss,
}: {
  onGenerate: (code: string) => void;
  onDismiss: () => void;
}) {
  const [prompt, setPrompt]   = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const inputRef              = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const ideas = [
    "Fibonacci sequence generator", "Bubble sort with logging",
    "Password strength checker", "Word frequency counter",
    "Simple game engine loop", "Math quiz generator",
    "Binary search tree", "Data aggregator",
  ];

  const run = useCallback(async (p: string) => {
    if (!p.trim() || loading) return;
    setLoading(true); setErr("");
    const res = await apiFetch("/api/devos/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: p.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.code) onGenerate(data.code);
    else setErr("Generation failed — try a different prompt");
  }, [loading, onGenerate]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: T.bg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-start",
        padding: "0 0 32px",
      }}
    >
      {/* Header */}
      <div style={{
        width: "100%", display: "flex", alignItems: "center",
        padding: "16px 16px 0", gap: 12,
      }}>
        <button onClick={onDismiss}
          style={{
            background: "none", border: "none", color: T.textMid,
            cursor: "pointer", fontSize: 22, padding: 4,
          }}>
          ‹
        </button>
        <p style={{ color: T.text, fontWeight: 800, fontSize: 17, margin: 0 }}>
          What do you want to build?
        </p>
      </div>

      {/* Glowing hero text */}
      <div style={{ padding: "40px 24px 24px", width: "100%", maxWidth: 480, boxSizing: "border-box" }}>
        <div style={{
          background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          fontSize: 26, fontWeight: 900, lineHeight: 1.25, marginBottom: 24, textAlign: "center",
        }}>
          Describe your idea.<br />AI will code it instantly.
        </div>

        <textarea
          ref={inputRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={4}
          placeholder="e.g. A sorting visualizer that logs each comparison step…"
          style={{
            ...S.input,
            fontSize: 16, lineHeight: 1.6, resize: "none",
            border: `2px solid ${T.borderB}`,
            marginBottom: 14,
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(prompt);
          }}
        />

        <PrimaryBtn onClick={() => run(prompt)} loading={loading} disabled={!prompt.trim()}>
          {loading ? "Building…" : "✨ Build It"}
        </PrimaryBtn>

        {err && (
          <p style={{ color: T.red, fontSize: 13, marginTop: 10, textAlign: "center" }}>{err}</p>
        )}
      </div>

      {/* Idea chips */}
      <div style={{ width: "100%", padding: "0 16px" }}>
        <p style={{ color: T.textDim, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.1em", margin: "0 0 12px", textAlign: "center" }}>
          IDEAS TO GET STARTED
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {ideas.map(idea => (
            <motion.button key={idea} whileTap={{ scale: 0.93 }}
              onClick={() => { setPrompt(idea); run(idea); }}
              disabled={loading}
              style={{
                background: "rgba(162,155,254,0.08)",
                border: `1px solid ${T.border}`,
                borderRadius: 24, padding: "9px 16px",
                color: T.purple, fontSize: 13, fontWeight: 600,
                cursor: "pointer",
              }}>
              {idea}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Project Picker ───────────────────────────────────────────────────────────

function ProjectPicker({
  projects, activeId, onSelect, onCreate,
}: {
  projects: Project[]; activeId?: number;
  onSelect: (p: Project) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim()); setName("");
  };

  return (
    <div style={{ padding: "0 16px 24px" }}>
      {/* Create new */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="New project name…"
          style={{ ...S.input, flex: 1 }}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
        />
        <PrimaryBtn onClick={submit} disabled={!name.trim()} small>+ Create</PrimaryBtn>
      </div>

      {/* Project list */}
      {projects.length === 0 ? (
        <p style={{ color: T.textDim, fontSize: 14, textAlign: "center", padding: 20 }}>
          No projects yet — create one above
        </p>
      ) : projects.map(p => (
        <button key={p.id} onClick={() => onSelect(p)}
          style={{
            width: "100%", textAlign: "left", background: activeId === p.id
              ? `${T.purpleD}22` : "rgba(255,255,255,0.03)",
            border: activeId === p.id ? `1px solid ${T.purple}` : `1px solid ${T.border}`,
            borderRadius: 14, padding: "12px 16px", marginBottom: 8,
            cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
          <div>
            <p style={{ color: T.text, fontWeight: 700, fontSize: 15, margin: 0 }}>{p.name}</p>
            <p style={{ color: T.textDim, fontSize: 11, margin: "2px 0 0" }}>
              {timeAgo(p.createdAt)} · {p.language}
            </p>
          </div>
          {activeId === p.id && <Badge label="active" color={T.cyan} />}
        </button>
      ))}
    </div>
  );
}

// ─── Logs History ─────────────────────────────────────────────────────────────

function LogsHistory({ projectId }: { projectId?: number }) {
  const [logs, setLogs]       = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const res = await apiFetch(`/api/devos/projects/${projectId}/logs`);
    const d   = await res.json();
    setLogs(d.logs ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const clear = async () => {
    if (!projectId) return;
    await apiFetch(`/api/devos/projects/${projectId}/logs`, { method: "DELETE" });
    setLogs([]);
  };

  const TYPE_COLOR: Record<string, string> = { stdout: T.cyan, error: T.red, ai: T.purple, build: T.gold };

  return (
    <div style={{ padding: "0 16px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ color: T.text, fontWeight: 800, fontSize: 15, margin: 0 }}>
          {logs.length} execution{logs.length !== 1 ? "s" : ""}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={{
            background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`,
            borderRadius: 10, padding: "6px 12px", color: T.purple, fontSize: 12, cursor: "pointer",
          }}>↻</button>
          {logs.length > 0 && (
            <button onClick={clear} style={{
              background: "rgba(255,95,109,0.1)", border: `1px solid ${T.red}44`,
              borderRadius: 10, padding: "6px 12px", color: T.red, fontSize: 12, cursor: "pointer",
            }}>Clear</button>
          )}
        </div>
      </div>

      {loading && <p style={{ color: T.textDim, textAlign: "center", padding: 20 }}>Loading…</p>}

      {!loading && logs.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
          <p style={{ color: T.textDim, fontSize: 14 }}>No executions yet</p>
        </div>
      )}

      {logs.map(log => {
        const c = TYPE_COLOR[log.type] ?? T.textMid;
        return (
          <div key={log.id} style={{
            background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
            borderRadius: 14, padding: "12px 14px", marginBottom: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: T.text, fontSize: 13, margin: "0 0 6px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{log.message}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge label={log.type.toUpperCase()} color={c} />
                  {log.durationMs !== null && (
                    <Badge label={`${log.durationMs}ms`} color={T.textDim} />
                  )}
                  <Badge label={`exit ${log.exitCode}`}
                    color={log.exitCode === 0 ? T.cyan : T.red} />
                </div>
              </div>
              <span style={{ color: T.textDim, fontSize: 10, flexShrink: 0, paddingTop: 2 }}>
                {timeAgo(log.createdAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

type Sheet = "none"|"files"|"ai"|"pipeline"|"projects"|"logs";

export default function ApexBuilderPage() {
  const { needsOnboarding, complete } = useBuilderOnboarding();

  // Show onboarding first-time; after complete, renders the full builder
  if (needsOnboarding) {
    return <BuilderOnboarding onComplete={complete} />;
  }

  return <ApexBuilderMain />;
}

function ApexBuilderMain() {
  const [projects, setProjects]           = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [files, setFiles]                 = useState<DevFile[]>([]);
  const [activeFile, setActiveFile]       = useState<DevFile | null>(null);
  const [code, setCode]                   = useState("");
  const [dirty, setDirty]                 = useState(false);

  const [consoleLines, setConsoleLines]   = useState<ConsoleLine[]>([]);
  const [consoleOpen, setConsoleOpen]     = useState(false);
  const [running, setRunning]             = useState(false);

  const [saving, setSaving]               = useState(false);
  const [savedTs, setSavedTs]             = useState<string|null>(null);

  const [sheet, setSheet]                 = useState<Sheet>("none");
  const [viewMode, setViewMode]           = useState<ViewMode>("editor");

  // For test split-screen game output
  const [gameOutput, setGameOutput]       = useState<string>("");
  const [validErr, setValidErr]           = useState<string|null>(null);

  const addLine = useCallback((l: ConsoleLine) => {
    setConsoleLines(prev => [...prev, l]);
  }, []);

  // ── Load projects ───────────────────────────────────────────────────────────
  useEffect(() => { loadProjects(); }, []);

  const loadProjects = useCallback(async () => {
    const res  = await apiFetch("/api/devos/projects");
    const data = await res.json();
    const ps: Project[] = data.projects ?? [];
    setProjects(ps);
    if (ps.length > 0 && !activeProject) {
      await selectProject(ps[0]!);
    }
  }, []);

  const selectProject = useCallback(async (p: Project) => {
    setActiveProject(p);
    setSheet("none");
    const res  = await apiFetch(`/api/devos/projects/${p.id}/files`);
    const data = await res.json();
    const fs: DevFile[] = data.files ?? [];
    setFiles(fs);
    if (fs.length > 0) selectFile(fs[0]!);
    else { setActiveFile(null); setCode(""); }
  }, []);

  const createProject = useCallback(async (name: string) => {
    const res  = await apiFetch("/api/devos/projects", {
      method: "POST", body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.project) {
      await loadProjects();
      await selectProject(data.project);
    }
  }, [loadProjects, selectProject]);

  const selectFile = useCallback((f: DevFile) => {
    setActiveFile(f);
    setCode(f.content);
    setDirty(false);
    setConsoleLines([]);
    setValidErr(null);
    setGameOutput("");
  }, []);

  const createFile = useCallback(async (path: string) => {
    if (!activeProject) return;
    const res  = await apiFetch(`/api/devos/projects/${activeProject.id}/files`, {
      method: "POST",
      body: JSON.stringify({ path, content: `// ${path}\n`, language: detectLang(path) }),
    });
    const data = await res.json();
    if (data.file) {
      setFiles(prev => [...prev, data.file]);
      selectFile(data.file);
    }
  }, [activeProject, selectFile]);

  const deleteFile = useCallback(async (f: DevFile) => {
    if (!activeProject) return;
    await apiFetch(`/api/devos/projects/${activeProject.id}/files/${f.id}`, { method: "DELETE" });
    setFiles(prev => {
      const next = prev.filter(x => x.id !== f.id);
      if (activeFile?.id === f.id && next.length > 0) selectFile(next[0]!);
      else if (next.length === 0) { setActiveFile(null); setCode(""); }
      return next;
    });
  }, [activeProject, activeFile, selectFile]);

  // Code change tracking
  const handleCodeChange = useCallback((v: string) => {
    setCode(v); setDirty(true); setValidErr(null);
  }, []);

  const saveFile = useCallback(async () => {
    if (!activeProject || !activeFile || saving) return;
    setSaving(true);
    await apiFetch(`/api/devos/projects/${activeProject.id}/files/${activeFile.id}`, {
      method: "PUT", body: JSON.stringify({ content: code }),
    });
    setSaving(false);
    setDirty(false);
    setSavedTs(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setActiveFile(f => f ? { ...f, content: code } : f);
    addLine({ type: "system", text: `✓ Saved ${activeFile.path}` });
  }, [activeProject, activeFile, saving, code, addLine]);

  // Auto-save every 20s
  useEffect(() => {
    const t = setInterval(() => { if (dirty && activeFile) saveFile(); }, 20000);
    return () => clearInterval(t);
  }, [dirty, activeFile, saveFile]);

  // ── Run code ────────────────────────────────────────────────────────────────
  const runCode = useCallback(async () => {
    if (!code.trim() || running) return;
    setRunning(true);
    setConsoleLines([{ type: "system", text: `▶ Running ${activeFile?.path ?? "code"}…` }]);
    setConsoleOpen(true);
    if (viewMode !== "test") setViewMode("editor");

    const res  = await apiFetch("/api/devos/execute", {
      method: "POST",
      body: JSON.stringify({ code, projectId: activeProject?.id, fileId: activeFile?.id }),
    });
    const data = await res.json();

    const newLines: ConsoleLine[] = (data.logs ?? []).map((l: { type: string; message: string; timeMs: number }) => ({
      type: l.type as ConsoleLine["type"],
      text: l.message,
      ms: l.timeMs,
    }));

    if (data.error) {
      newLines.push({ type: "error", text: data.error });
    }
    if (data.success) {
      newLines.push({ type: "system", text: `✓ Done in ${data.durationMs}ms` });
      // For test mode, assemble game output
      setGameOutput(newLines.filter(l => l.type === "log").map(l => l.text).join("\n"));
    }

    setConsoleLines(newLines);
    setRunning(false);
  }, [code, running, activeFile, activeProject, viewMode]);

  // ── Validate (syntax) ───────────────────────────────────────────────────────
  const validateCode = useCallback(async () => {
    const res  = await apiFetch("/api/devos/validate", {
      method: "POST", body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.valid) {
      setValidErr(null);
      addLine({ type: "system", text: "✓ Syntax valid" });
    } else {
      setValidErr(data.errors?.[0] ?? "Syntax error");
      addLine({ type: "error", text: data.errors?.[0] ?? "Syntax error" });
    }
    setConsoleOpen(true);
  }, [code, addLine]);

  // ── AI code update ──────────────────────────────────────────────────────────
  const handleAICodeUpdate = useCallback((newCode: string) => {
    setCode(newCode);
    setDirty(true);
    addLine({ type: "system", text: "🤖 AI modified code" });
  }, [addLine]);

  // ── Generate code from prompt ───────────────────────────────────────────────
  const handlePromptGenerate = useCallback((newCode: string) => {
    setCode(newCode);
    setDirty(true);
    setViewMode("editor");
    addLine({ type: "system", text: "✨ AI generated code" });
  }, [addLine]);

  // ── Voice: generate code from spoken prompt ─────────────────────────────────
  const voiceGenerateCode = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;
    addLine({ type: "system", text: `🎤 Voice: "${prompt}"` });
    try {
      const res  = await apiFetch("/api/devos/generate", {
        method: "POST",
        body:   JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (data.code) {
        setCode(data.code);
        setDirty(true);
        setViewMode("editor");
        addLine({ type: "system", text: "✨ Voice generated code" });
      }
    } catch {
      addLine({ type: "error", text: "Voice generation failed" });
    }
  }, [addLine]);

  // ── Rollback to last saved ──────────────────────────────────────────────────
  const rollback = useCallback(() => {
    if (!activeFile) return;
    setCode(activeFile.content);
    setDirty(false);
    addLine({ type: "system", text: "↩ Rolled back to last saved version" });
  }, [activeFile, addLine]);

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey)) {
        if (e.key === "s") { e.preventDefault(); saveFile(); }
        if (e.key === "Enter") { e.preventDefault(); runCode(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile, runCode]);

  // ─── No project state ───────────────────────────────────────────────────────
  const hasProject = !!activeProject;

  // ─── View Mode: Test split ───────────────────────────────────────────────────
  const isTestMode = viewMode === "test";

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: T.bg, minHeight: "100dvh", height: "100dvh",
      display: "flex", flexDirection: "column",
      color: T.text, overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(162,155,254,0.25); border-radius: 2px; }
        textarea::placeholder { color: rgba(148,153,180,0.55); }
        input::placeholder    { color: rgba(148,153,180,0.55); }
      `}</style>

      {/* ════════════════════════════════════════════════════════════════
          TOP BAR
      ════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: T.bg2, borderBottom: `1px solid ${T.border}`,
        padding: "0 12px", height: 56,
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        {/* Back */}
        <a href={`${BASE}/`}
          style={{ color: T.textMid, fontSize: 24, textDecoration: "none",
            lineHeight: 1, padding: "4px 2px", flexShrink: 0 }}>
          ‹
        </a>

        {/* Logo + Project */}
        <button onClick={() => setSheet("projects")}
          style={{ background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 9, padding: 0, flex: 1, minWidth: 0 }}>
          <ApexLogo
            size={34}
            state={running ? "building" : "idle"}
            radius={10}
          />
          <div style={{ minWidth: 0, textAlign: "left" }}>
            <div style={{
              fontWeight: 800, fontSize: 15, color: T.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {activeProject?.name ?? "Apex Builder"}
            </div>
            <div style={{ fontSize: 10, color: T.textDim }}>
              {activeFile ? activeFile.path : (hasProject ? "no file open" : "tap to open project")}
              {dirty && " •"}
            </div>
          </div>
          <span style={{ color: T.textDim, fontSize: 14, flexShrink: 0 }}>▾</span>
        </button>

        {/* Save status */}
        {saving && <span style={{ color: T.purple, fontSize: 11, flexShrink: 0 }}>saving…</span>}
        {savedTs && !saving && !dirty && (
          <span style={{ color: T.textDim, fontSize: 10, flexShrink: 0 }}>✓ {savedTs}</span>
        )}

        {/* Syntax error indicator */}
        {validErr && (
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.red, flexShrink: 0 }} />
        )}

        {/* Run button — primary CTA */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={runCode}
          disabled={running || !activeFile}
          style={{
            background: running ? `${T.purpleD}44` : T.grad,
            border: "none", borderRadius: 12, padding: "9px 18px",
            color: "#fff", fontSize: 14, fontWeight: 800,
            cursor: running || !activeFile ? "default" : "pointer",
            display: "flex", alignItems: "center", gap: 6,
            opacity: activeFile ? 1 : 0.45, flexShrink: 0,
          }}
        >
          {running ? <SpinIcon /> : "▶"} Run
        </motion.button>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          QUICK ACTION TOOLBAR
      ════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: T.bg2,
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 12px", flexShrink: 0, overflowX: "auto",
      }}>
        {/* View toggles */}
        <div style={{
          display: "flex", background: "rgba(255,255,255,0.04)",
          borderRadius: 11, padding: 3, gap: 3, flexShrink: 0,
        }}>
          {(["editor","test"] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              style={{
                padding: "6px 12px", borderRadius: 9, border: "none",
                background: viewMode === m ? `${T.purpleD}55` : "transparent",
                color: viewMode === m ? T.purple : T.textMid,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
              {m === "editor" ? "◈ Editor" : "⊞ Test"}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: T.border, flexShrink: 0 }} />

        {/* Quick actions */}
        <IconBtn label="Files" icon="📂" size={36}
          active={sheet === "files"}
          onClick={() => setSheet(s => s === "files" ? "none" : "files")} />
        <IconBtn label="AI Assist" icon="🤖" size={36}
          active={sheet === "ai"}
          color={T.purple}
          onClick={() => setSheet(s => s === "ai" ? "none" : "ai")} />
        <IconBtn label="Build Prompt" icon="✨" size={36}
          color={T.pink}
          onClick={() => setViewMode("prompt")} />
        <IconBtn label="Pipeline" icon="🏗️" size={36}
          active={sheet === "pipeline"}
          onClick={() => setSheet(s => s === "pipeline" ? "none" : "pipeline")} />
        <IconBtn label="Logs" icon="📋" size={36}
          active={sheet === "logs"}
          onClick={() => setSheet(s => s === "logs" ? "none" : "logs")} />

        <div style={{ width: 1, height: 24, background: T.border, flexShrink: 0 }} />

        <IconBtn label="Validate syntax" icon="✓" size={36} color={validErr ? T.red : T.textMid}
          onClick={validateCode} disabled={!activeFile} />
        <IconBtn label="Save" icon="💾" size={36} color={dirty ? T.gold : T.textMid}
          onClick={saveFile} disabled={!activeFile} />
        <IconBtn label="Rollback" icon="↩" size={36}
          onClick={rollback} disabled={!dirty || !activeFile} />
      </div>

      {/* ════════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
      ════════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

        {/* No project */}
        {!hasProject && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: 32,
          }}>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: 64, marginBottom: 16 }}
            >
              ⚙️
            </motion.div>
            <h2 style={{
              background: T.grad, WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontSize: 24, fontWeight: 900, margin: "0 0 8px", textAlign: "center",
            }}>
              Apex Builder
            </h2>
            <p style={{ color: T.textMid, fontSize: 15, margin: "0 0 28px", textAlign: "center", lineHeight: 1.6 }}>
              Mobile-first development environment.<br />
              Create a project to start building.
            </p>
            <button onClick={() => setSheet("projects")}
              style={{
                background: T.grad, border: "none", borderRadius: 16,
                padding: "14px 32px", color: "#fff", fontSize: 16,
                fontWeight: 800, cursor: "pointer",
              }}>
              + Create Project
            </button>
          </div>
        )}

        {/* Test mode: split screen */}
        {hasProject && isTestMode && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {/* Top: game/output preview */}
            <div style={{
              flex: 1, background: T.bg3, borderBottom: `1px solid ${T.border}`,
              display: "flex", flexDirection: "column", minHeight: 0,
            }}>
              <div style={{
                padding: "8px 14px", borderBottom: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Badge label="OUTPUT" color={T.cyan} />
                <span style={{ color: T.textDim, fontSize: 11 }}>
                  {running ? "running…" : gameOutput ? "latest output" : "run code to see output"}
                </span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={runCode} disabled={running}
                  style={{
                    marginLeft: "auto", background: T.grad, border: "none",
                    borderRadius: 10, padding: "6px 14px",
                    color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer",
                  }}>
                  {running ? "⟳" : "▶ Run"}
                </motion.button>
              </div>
              <div style={{
                flex: 1, overflowY: "auto", padding: 16,
                fontFamily: T.mono, fontSize: 13, lineHeight: 1.65, color: T.text,
                whiteSpace: "pre-wrap",
              }}>
                {gameOutput || (
                  <span style={{ color: T.textDim }}>// Output will appear here after running</span>
                )}
              </div>
            </div>

            {/* Bottom: logs */}
            <div style={{ height: 220, overflowY: "auto", padding: "10px 14px",
              fontFamily: T.mono, fontSize: 12 }}>
              <Badge label="LOGS" color={T.purple} />
              <div style={{ marginTop: 8 }}>
                {consoleLines.length === 0 ? (
                  <span style={{ color: T.textDim }}>// No logs yet</span>
                ) : consoleLines.map((l, i) => (
                  <div key={i} style={{
                    color: LINE_COLORS[l.type] ?? T.text, marginBottom: 3,
                    display: "flex", gap: 8,
                  }}>
                    {l.ms !== undefined && <span style={{ color: T.textDim }}>{l.ms}ms</span>}
                    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Editor mode */}
        {hasProject && !isTestMode && activeFile && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg3 }}>
            {/* File tab bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 0,
              borderBottom: `1px solid ${T.border}`,
              background: T.bg2, overflowX: "auto", flexShrink: 0,
              padding: "0 4px",
            }}>
              {files.slice(0, 6).map(f => (
                <button key={f.id} onClick={() => selectFile(f)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "9px 14px", border: "none", background: "none",
                    cursor: "pointer", flexShrink: 0, position: "relative",
                    borderBottom: activeFile?.id === f.id
                      ? `2px solid ${T.purple}` : "2px solid transparent",
                  }}>
                  <span style={{ color: langColor(f.path), fontSize: 13 }}>{fileIcon(f.path)}</span>
                  <span style={{
                    color: activeFile?.id === f.id ? T.text : T.textMid,
                    fontSize: 12, fontWeight: activeFile?.id === f.id ? 700 : 400,
                    maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {f.path}
                  </span>
                </button>
              ))}
              {files.length > 6 && (
                <button onClick={() => setSheet("files")}
                  style={{
                    padding: "9px 10px", border: "none", background: "none",
                    color: T.textDim, fontSize: 11, cursor: "pointer", flexShrink: 0,
                  }}>
                  +{files.length - 6} more
                </button>
              )}
            </div>

            {/* Validation error banner */}
            <AnimatePresence>
              {validErr && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{
                    background: `${T.red}15`, borderBottom: `1px solid ${T.red}44`,
                    padding: "8px 14px", flexShrink: 0,
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  <span style={{ color: T.red, fontSize: 12, flex: 1 }}>⚠ {validErr}</span>
                  <button onClick={() => setValidErr(null)}
                    style={{ background: "none", border: "none", color: T.red,
                      cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
                    ×
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* The code editor */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <CodeEditor
                value={code}
                onChange={handleCodeChange}
                fontSize={15}
              />
            </div>

            {/* Console */}
            <ConsolePanel
              lines={consoleLines}
              running={running}
              expanded={consoleOpen}
              onToggle={() => setConsoleOpen(v => !v)}
            />
          </div>
        )}

        {/* Editor mode — no file selected */}
        {hasProject && !isTestMode && !activeFile && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: 32,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <p style={{ color: T.textMid, fontSize: 15, margin: "0 0 20px", textAlign: "center" }}>
              No file open
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <PrimaryBtn onClick={() => setSheet("files")} small>
                📂 Browse Files
              </PrimaryBtn>
              <PrimaryBtn onClick={() => setViewMode("prompt")} small color={T.pink}>
                ✨ Build Prompt
              </PrimaryBtn>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          BUILD PROMPT FULLSCREEN
      ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {viewMode === "prompt" && (
          <BuildPromptScreen
            onGenerate={handlePromptGenerate}
            onDismiss={() => setViewMode("editor")}
          />
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════
          LEFT DRAWER — Files
      ════════════════════════════════════════════════════════════════ */}
      <LeftDrawer open={sheet === "files"} onClose={() => setSheet("none")}>
        <FileExplorer
          project={activeProject}
          files={files}
          selectedId={activeFile?.id}
          onSelect={selectFile}
          onCreate={createFile}
          onDelete={deleteFile}
          onClose={() => setSheet("none")}
        />
      </LeftDrawer>

      {/* ════════════════════════════════════════════════════════════════
          BOTTOM SHEETS
      ════════════════════════════════════════════════════════════════ */}

      {/* AI Assist */}
      <BottomSheet open={sheet === "ai"} onClose={() => setSheet("none")} title="🤖 AI Assist">
        <AIAssistPanel
          code={code}
          projectId={activeProject?.id}
          fileId={activeFile?.id}
          onCodeUpdate={handleAICodeUpdate}
        />
      </BottomSheet>

      {/* Pipeline */}
      <BottomSheet open={sheet === "pipeline"} onClose={() => setSheet("none")} title="🏗️ Build Pipeline">
        <PipelinePanel
          code={code}
          projectId={activeProject?.id}
          fileId={activeFile?.id}
        />
      </BottomSheet>

      {/* Projects */}
      <BottomSheet open={sheet === "projects"} onClose={() => setSheet("none")} title="📁 Projects" maxH="90dvh">
        <ProjectPicker
          projects={projects}
          activeId={activeProject?.id}
          onSelect={selectProject}
          onCreate={createProject}
        />
      </BottomSheet>

      {/* Logs */}
      <BottomSheet open={sheet === "logs"} onClose={() => setSheet("none")} title="📊 Execution Logs" maxH="90dvh">
        <LogsHistory projectId={activeProject?.id} />
      </BottomSheet>

      {/* ── Floating Voice Companion (Builder mode) ────────────────────── */}
      <FloatingVoiceButton
        initialMode="builder"
        projectContext={activeProject?.name ?? ""}
        onBuilderCommand={(action, params) => {
          const prompt = params.feature ?? params.description ?? params.text ?? action.replace(/_/g, " ");
          voiceGenerateCode(prompt);
        }}
        style={{ bottom: 96, right: 14 }}
      />
    </div>
  );
}
