/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX RUNTIME ENGINE                                                     ║
 * ║  Monaco Editor · JS / Python / HTML · WebSocket streaming output        ║
 * ║  Project & File management · Split editor/preview · Mobile-first        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link }    from "wouter";
import { io }      from "socket.io-client";
import type { Socket } from "socket.io-client";
import { DeployPanel } from "@/components/deploy/DeployPanel";
import { authHeaders, getAuthSessionId } from "@/lib/authSession";

// Monaco is loaded lazily so the bundle stays small
const MonacoEditor = lazy(() => import("@monaco-editor/react"));

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  id:          number;
  name:        string;
  description: string;
  language:    string;
  updatedAt:   string;
}
interface ProjectFile {
  id:        number;
  projectId: number;
  path:      string;
  content:   string;
  language:  string;
}
interface LogLine {
  type: "stdout" | "stderr" | "info" | "error";
  text: string;
  ts:   number;
}
interface RunResult {
  success:    boolean;
  language:   string;
  stdout:     string;
  stderr:     string;
  error?:     string;
  durationMs: number;
  exitCode:   number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_ID = (() => {
  let id = localStorage.getItem("apex-runtime-session");
  if (!id) { id = `rt-${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem("apex-runtime-session", id); }
  return id;
})();

const LANG_CONFIGS: Record<string, { label: string; icon: string; monaco: string; color: string; ext: string }> = {
  javascript: { label: "JavaScript", icon: "JS",  monaco: "javascript", color: "#f7df1e", ext: ".js"   },
  python:     { label: "Python",     icon: "PY",  monaco: "python",     color: "#3776ab", ext: ".py"   },
  html:       { label: "HTML",       icon: "HTML",monaco: "html",       color: "#e44d26", ext: ".html" },
};

const API_BASE = "/api";

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", "x-session-id": SESSION_ID },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try { message = (JSON.parse(text) as { error?: string }).error ?? text; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ── File extension → language ─────────────────────────────────────────────────
function langFromPath(path: string): string {
  if (path.endsWith(".py"))                      return "python";
  if (path.endsWith(".html") || path.endsWith(".htm")) return "html";
  return "javascript";
}

// ── Timestamp ─────────────────────────────────────────────────────────────────
function fmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ── Project Picker Modal ──────────────────────────────────────────────────────

function ProjectPickerModal({
  onSelect, onClose,
}: {
  onSelect: (project: Project) => void;
  onClose:  () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState("");
  const [newLang,  setNewLang]  = useState("javascript");

  useEffect(() => {
    api<{ projects: Project[] }>("/runtime/projects")
      .then(d => setProjects(d.projects))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const data = await api<{ project: Project }>("/runtime/projects", {
        method: "POST",
        body:   JSON.stringify({ name: newName.trim(), language: newLang }),
      });
      onSelect(data.project);
    } catch (e) { console.error(e); }
    setCreating(false);
  };

  const del = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this project?")) return;
    await api(`/runtime/projects/${id}`, { method: "DELETE" });
    setProjects(p => p.filter(x => x.id !== id));
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, backdropFilter: "blur(6px)" }}
      />
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        style={{
          position: "fixed", inset: "auto 12px", top: "50%", transform: "translateY(-50%)",
          zIndex: 201, background: "rgba(30,26,62,0.62)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20,
          padding: 20, maxHeight: "85vh", overflowY: "auto",
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", flex: 1 }}>⚡ Projects</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#636e72", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* New project form */}
        <div style={{ background: "rgba(124,92,231,0.08)", border: "1px solid rgba(124,92,231,0.2)", borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <p style={{ color: "#a29bfe", fontSize: 11, fontWeight: 700, margin: "0 0 10px", letterSpacing: "0.08em" }}>NEW PROJECT</p>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
            placeholder="Project name…"
            style={{
              width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none",
              boxSizing: "border-box", marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(LANG_CONFIGS).map(([lang, cfg]) => (
              <button key={lang} onClick={() => setNewLang(lang)} style={{
                flex: 1, padding: "7px 4px", borderRadius: 8, border: "none", cursor: "pointer",
                background: newLang === lang ? `${cfg.color}22` : "rgba(255,255,255,0.05)",
                color: newLang === lang ? cfg.color : "#636e72",
                fontWeight: 700, fontSize: 11,
              }}>
                {cfg.label}
              </button>
            ))}
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={create} disabled={!newName.trim() || creating}
            style={{
              width: "100%", marginTop: 10, padding: "12px", borderRadius: 10, border: "none",
              background: newName.trim() ? "linear-gradient(135deg, #7c5ce7, #a29bfe)" : "rgba(255,255,255,0.08)",
              color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>
            {creating ? "Creating…" : "+ Create Project"}
          </motion.button>
        </div>

        {/* Existing projects */}
        {loading ? (
          <div style={{ color: "#636e72", textAlign: "center", padding: 20 }}>Loading…</div>
        ) : projects.length === 0 ? (
          <div style={{ color: "#636e72", textAlign: "center", padding: 20, fontSize: 13 }}>No projects yet — create one above</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.map(p => {
              const cfg = LANG_CONFIGS[p.language] ?? LANG_CONFIGS["javascript"]!;
              return (
                <motion.div key={p.id} whileTap={{ scale: 0.98 }} onClick={() => onSelect(p)}
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12, padding: "12px 14px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: `${cfg.color}22`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: cfg.color, fontWeight: 800, fontSize: 10,
                  }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                    <div style={{ color: "#636e72", fontSize: 11 }}>{cfg.label} · {new Date(p.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <button onClick={e => del(p.id, e)} style={{
                    background: "rgba(214,48,49,0.12)", border: "none", color: "#ff7675",
                    borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer",
                  }}>
                    ✕
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </>
  );
}

// ── File Tree ─────────────────────────────────────────────────────────────────

function FileTree({
  files, activeId, onSelect, onAdd, onDelete, onClose,
}: {
  files:    ProjectFile[];
  activeId: number | null;
  onSelect: (f: ProjectFile) => void;
  onAdd:    (name: string) => void;
  onDelete: (id: number) => void;
  onClose?: () => void;
}) {
  const [newPath, setNewPath] = useState("");

  const icons: Record<string, string> = { js: "🟡", ts: "🔷", py: "🐍", html: "🌐", css: "🎨", md: "📝" };
  const getIcon = (path: string) => {
    const ext = path.split(".").pop() ?? "";
    return icons[ext] ?? "📄";
  };

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: "rgba(30,26,62,0.62)", borderRight: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", padding: "12px 12px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", flex: 1 }}>FILES</span>
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#636e72", cursor: "pointer", fontSize: 16 }}>×</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "6px 4px" }}>
        {files.map(f => (
          <div key={f.id}
            onClick={() => onSelect(f)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 10px", borderRadius: 8, cursor: "pointer",
              background: activeId === f.id ? "rgba(124,92,231,0.15)" : "transparent",
              border: activeId === f.id ? "1px solid rgba(124,92,231,0.25)" : "1px solid transparent",
              marginBottom: 2,
            }}
          >
            <span style={{ fontSize: 13 }}>{getIcon(f.path)}</span>
            <span style={{
              color: activeId === f.id ? "#a29bfe" : "#b2bec3",
              fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {f.path}
            </span>
            {files.length > 1 && (
              <button onClick={e => { e.stopPropagation(); onDelete(f.id); }} style={{
                background: "none", border: "none", color: "#636e72", fontSize: 12, cursor: "pointer", padding: "0 2px",
              }}>✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Add file */}
      <div style={{ padding: "8px 8px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <input value={newPath} onChange={e => setNewPath(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newPath.trim()) { onAdd(newPath.trim()); setNewPath(""); } }}
            placeholder="new-file.js"
            style={{
              flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 7, padding: "7px 8px", color: "#fff", fontSize: 11, outline: "none",
            }}
          />
          <button onClick={() => { if (newPath.trim()) { onAdd(newPath.trim()); setNewPath(""); } }}
            style={{
              padding: "7px 10px", borderRadius: 7, border: "none",
              background: "rgba(124,92,231,0.2)", color: "#a29bfe", fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Output Panel ──────────────────────────────────────────────────────────────

function OutputPanel({
  lines, result, running, htmlSrc,
  mode, onModeChange,
}: {
  lines:        LogLine[];
  result:       RunResult | null;
  running:      boolean;
  htmlSrc:      string;
  mode:         "console" | "preview";
  onModeChange: (m: "console" | "preview") => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const lineColor = (type: string) => {
    if (type === "stderr" || type === "error") return "#ff7675";
    if (type === "info")                       return "#a29bfe";
    return "#dfe6e9";
  };
  const linePrefix = (type: string) => {
    if (type === "stderr" || type === "error") return "✗ ";
    if (type === "info")                       return "› ";
    return "  ";
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "rgba(30,26,62,0.62)",
    }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 12px",
        background: "rgba(14,12,32,0.55)",
      }}>
        {(["console", "preview"] as const).map(m => (
          <button key={m} onClick={() => onModeChange(m)} style={{
            padding: "10px 14px", background: "none", border: "none",
            color:        mode === m ? "#a29bfe" : "#636e72",
            borderBottom: mode === m ? "2px solid #7c5ce7" : "2px solid transparent",
            fontWeight:   mode === m ? 700 : 500, fontSize: 12,
            cursor: "pointer", letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            {m === "console" ? "⌨ Console" : "🌐 Preview"}
          </button>
        ))}

        {running && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #a29bfe", borderTopColor: "transparent" }} />
            <span style={{ color: "#a29bfe", fontSize: 11 }}>Running…</span>
          </div>
        )}

        {result && !running && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: result.success ? "#00b894" : "#ff7675", fontSize: 11, fontWeight: 700 }}>
              {result.success ? "✓" : "✗"} {fmt(result.durationMs)}
            </span>
          </div>
        )}
      </div>

      {/* Console */}
      {mode === "console" && (
        <div style={{
          flex: 1, overflowY: "auto", padding: "10px 14px",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          fontSize: 12, lineHeight: 1.6,
        }}>
          {lines.length === 0 && !running && (
            <div style={{ color: "rgba(255,255,255,0.15)", textAlign: "center", paddingTop: 30, fontSize: 13 }}>
              Press Run to execute your code
            </div>
          )}
          {lines.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 1 }}>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, whiteSpace: "nowrap", marginTop: 2, minWidth: 36 }}>
                {l.ts < 10000 ? `+${l.ts}ms` : `${(l.ts / 1000).toFixed(1)}s`}
              </span>
              <span style={{ color: lineColor(l.type), wordBreak: "break-all" }}>
                {linePrefix(l.type)}{l.text}
              </span>
            </div>
          ))}
          {result && !running && (
            <div style={{
              marginTop: 10, padding: "6px 10px", borderRadius: 8,
              background: result.success ? "rgba(0,184,148,0.08)" : "rgba(214,48,49,0.08)",
              border: `1px solid ${result.success ? "rgba(0,184,148,0.2)" : "rgba(214,48,49,0.2)"}`,
              color: result.success ? "#00b894" : "#ff7675", fontSize: 11,
            }}>
              {result.success ? `✓ Exited 0 · ${fmt(result.durationMs)}` : `✗ Exit ${result.exitCode} · ${result.error ?? "Error"}`}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* HTML Preview */}
      {mode === "preview" && (
        <div style={{ flex: 1, position: "relative" }}>
          {htmlSrc ? (
            <iframe
              key={htmlSrc.slice(0, 40)}
              srcDoc={htmlSrc}
              sandbox="allow-scripts"
              style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
              title="HTML Preview"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
              <span style={{ fontSize: 36 }}>🌐</span>
              <span style={{ color: "#636e72", fontSize: 13 }}>Run an HTML file to see the preview here</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Runtime Page ─────────────────────────────────────────────────────────

export default function RuntimePage() {
  // Project state
  const [project,  setProject]  = useState<Project | null>(null);
  const [files,    setFiles]    = useState<ProjectFile[]>([]);
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [showProjects, setShowProjects] = useState(true);
  const [showFileTree, setShowFileTree] = useState(false);

  // Editor state
  const [code, setCode] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  // Output state
  const [lines,      setLines]      = useState<LogLine[]>([]);
  const [result,     setResult]     = useState<RunResult | null>(null);
  const [running,    setRunning]    = useState(false);
  const [outputMode, setOutputMode] = useState<"console" | "preview">("console");
  const [htmlSrc,    setHtmlSrc]    = useState("");

  // Deploy panel
  const [showDeploy, setShowDeploy] = useState(false);

  // Layout — split draggable (mobile: stacked)
  const [splitRatio, setSplitRatio] = useState(0.55); // editor 55% / output 45%
  const dragRef   = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // WebSocket
  const socketRef = useRef<Socket | null>(null);

  // ── WebSocket connect/disconnect ───────────────────────────────────────────

  useEffect(() => {
    const socket = io("/runtime", {
      path:       "/api/socket.io",
      transports: ["websocket", "polling"],
      auth:       { sessionId: getAuthSessionId() },
    });

    socket.on("run:start", () => {
      setLines([]);
      setResult(null);
      setRunning(true);
    });
    socket.on("run:line", (line: LogLine) => {
      setLines(prev => [...prev, line]);
    });
    socket.on("run:done", (res: RunResult) => {
      setResult(res);
      setRunning(false);
      if (res.language === "html" && res.success) {
        setHtmlSrc(res.stdout);
        setOutputMode("preview");
      }
    });
    socket.on("error", (err: { message: string }) => {
      setLines(prev => [...prev, { type: "error", text: err.message, ts: 0 }]);
      setRunning(false);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, []);

  // ── Load project files ─────────────────────────────────────────────────────

  const loadProject = useCallback(async (p: Project) => {
    setProject(p);
    setShowProjects(false);
    try {
      const data = await api<{ files: ProjectFile[] }>(`/runtime/projects/${p.id}/files`);
      setFiles(data.files);
      if (data.files.length > 0) {
        const first = data.files[0]!;
        setActiveFile(first);
        setCode(first.content);
      }
    } catch (e) { console.error(e); }
  }, []);

  // ── Select file ────────────────────────────────────────────────────────────

  const selectFile = useCallback(async (f: ProjectFile) => {
    // Auto-save current file before switching
    if (dirty && activeFile && project) {
      try {
        await api(`/runtime/projects/${project.id}/files/${activeFile.id}`, {
          method: "PUT",
          body:   JSON.stringify({ content: code }),
        });
        setFiles(prev => prev.map(x => x.id === activeFile.id ? { ...x, content: code } : x));
      } catch { /**/ }
    }
    setActiveFile(f);
    setCode(f.content);
    setDirty(false);
    setShowFileTree(false);
  }, [dirty, activeFile, code, project]);

  // ── Add file ───────────────────────────────────────────────────────────────

  const addFile = useCallback(async (path: string) => {
    if (!project) return;
    const language = langFromPath(path);
    const starters: Record<string, string> = {
      javascript: `// ${path}\nconsole.log("Hello from ${path}");\n`,
      python:     `# ${path}\nprint("Hello from ${path}")\n`,
      html:       `<!DOCTYPE html>\n<html>\n<head><title>${path}</title></head>\n<body><h1>${path}</h1></body>\n</html>\n`,
    };
    try {
      const data = await api<{ file: ProjectFile }>(`/runtime/projects/${project.id}/files`, {
        method: "POST",
        body:   JSON.stringify({ path, content: starters[language] ?? "", language }),
      });
      setFiles(prev => [...prev, data.file]);
      selectFile(data.file);
    } catch (e) { console.error(e); }
  }, [project, selectFile]);

  // ── Delete file ────────────────────────────────────────────────────────────

  const deleteFile = useCallback(async (fileId: number) => {
    if (!project) return;
    if (!confirm("Delete this file?")) return;
    await api(`/runtime/projects/${project.id}/files/${fileId}`, { method: "DELETE" });
    const next = files.filter(f => f.id !== fileId);
    setFiles(next);
    if (activeFile?.id === fileId) {
      const first = next[0];
      if (first) { setActiveFile(first); setCode(first.content); }
      else        { setActiveFile(null);  setCode(""); }
    }
  }, [project, files, activeFile]);

  // ── Save file ──────────────────────────────────────────────────────────────

  const saveFile = useCallback(async () => {
    if (!project || !activeFile) return;
    try {
      await api(`/runtime/projects/${project.id}/files/${activeFile.id}`, {
        method: "PUT",
        body:   JSON.stringify({ content: code }),
      });
      setFiles(prev => prev.map(x => x.id === activeFile.id ? { ...x, content: code } : x));
      setDirty(false);
    } catch (e) { console.error(e); }
  }, [project, activeFile, code]);

  // ── Run code ───────────────────────────────────────────────────────────────

  const runCode = useCallback(async () => {
    if (!code.trim() || running) return;
    const lang = activeFile ? langFromPath(activeFile.path) : "javascript";

    // Auto-save
    await saveFile();

    // Emit via WebSocket for streaming
    if (socketRef.current?.connected) {
      socketRef.current.emit("run", {
        code,
        language:  lang,
        projectId: project?.id,
        fileId:    activeFile?.id,
      });
    } else {
      // Fallback: REST
      setLines([]);
      setResult(null);
      setRunning(true);
      try {
        const res = await api<RunResult>("/runtime/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-session-id": SESSION_ID, ...authHeaders() },
          body:   JSON.stringify({ code, language: lang, projectId: project?.id, fileId: activeFile?.id }),
        });
        // Reconstruct lines from result
        const builtLines: LogLine[] = [];
        if (res.stdout) res.stdout.split("\n").filter(Boolean).forEach(t => builtLines.push({ type: "stdout", text: t, ts: 0 }));
        if (res.stderr) res.stderr.split("\n").filter(Boolean).forEach(t => builtLines.push({ type: "stderr", text: t, ts: 0 }));
        setLines(builtLines);
        setResult(res);
        if (res.language === "html" && res.success) { setHtmlSrc(res.stdout); setOutputMode("preview"); }
      } catch (e) {
        setLines([{ type: "error", text: String(e), ts: 0 }]);
      }
      setRunning(false);
    }
  }, [code, running, activeFile, project, saveFile]);

  // ── Keyboard shortcut: Ctrl/Cmd + Enter to run ────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runCode(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "s")     { e.preventDefault(); saveFile(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [runCode, saveFile]);

  // ── Drag divider ───────────────────────────────────────────────────────────

  const onDividerDrag = useCallback((clientY: number) => {
    if (!containerRef.current) return;
    const rect   = containerRef.current.getBoundingClientRect();
    const ratio  = Math.max(0.2, Math.min(0.8, (clientY - rect.top) / rect.height));
    setSplitRatio(ratio);
  }, []);

  const lang = activeFile ? langFromPath(activeFile.path) : (project?.language ?? "javascript");
  const langCfg = LANG_CONFIGS[lang] ?? LANG_CONFIGS["javascript"]!;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100dvh", maxHeight: "100dvh",
      background: "transparent",
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: "#fff", overflow: "hidden",
    }}>

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px",
        background: "rgba(14,12,32,0.55)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0, zIndex: 30,
      }}>
        {/* Back */}
        <Link href="/">
          <button style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "6px 10px", color: "#b2bec3", fontSize: 12, cursor: "pointer",
          }}>←</button>
        </Link>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>Runtime</span>
        </div>

        {/* Project name + language badge */}
        {project ? (
          <button onClick={() => setShowProjects(true)} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 8, padding: "5px 10px", cursor: "pointer",
          }}>
            <span style={{ color: langCfg.color, fontWeight: 800, fontSize: 10 }}>{langCfg.icon}</span>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>
              {project.name.length > 14 ? project.name.slice(0, 14) + "…" : project.name}
            </span>
            <span style={{ color: "#636e72", fontSize: 10 }}>▼</span>
          </button>
        ) : (
          <button onClick={() => setShowProjects(true)} style={{
            background: "rgba(124,92,231,0.15)", border: "1px solid rgba(124,92,231,0.3)",
            borderRadius: 8, padding: "6px 12px", color: "#a29bfe",
            fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}>
            Open Project
          </button>
        )}

        {/* File tree toggle (mobile) */}
        {project && (
          <button onClick={() => setShowFileTree(f => !f)} style={{
            background: showFileTree ? "rgba(124,92,231,0.15)" : "rgba(255,255,255,0.05)",
            border: showFileTree ? "1px solid rgba(124,92,231,0.3)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "6px 10px", color: showFileTree ? "#a29bfe" : "#636e72",
            fontSize: 13, cursor: "pointer",
          }}>
            📂
          </button>
        )}

        {/* Save indicator */}
        {dirty && (
          <span style={{ color: "#fdcb6e", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>●</span>
        )}

        <div style={{ flex: 1 }} />

        {/* File name tab */}
        {activeFile && (
          <span style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, padding: "3px 8px", color: "#b2bec3", fontSize: 11,
            maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {activeFile.path}
          </span>
        )}

        {/* Save */}
        {project && (
          <button onClick={saveFile} style={{
            background: dirty ? "rgba(253,203,110,0.1)" : "rgba(255,255,255,0.05)",
            border: dirty ? "1px solid rgba(253,203,110,0.3)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "6px 10px",
            color: dirty ? "#fdcb6e" : "#636e72",
            fontSize: 12, cursor: "pointer",
          }}>
            💾
          </button>
        )}

        {/* Run button */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={runCode}
          disabled={running || !code.trim()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 10, border: "none",
            background: running
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(135deg, #7c5ce7, #a29bfe)",
            color: running ? "#636e72" : "#fff",
            fontWeight: 800, fontSize: 13, cursor: running ? "not-allowed" : "pointer",
            boxShadow: running ? "none" : "0 4px 16px rgba(124,92,231,0.3)",
            transition: "all 0.2s",
          }}
        >
          {running ? (
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ display: "inline-block" }}>⟳</motion.span>
          ) : (
            <span>▶</span>
          )}
          {running ? "Running" : "Run"}
        </motion.button>

        {/* Deploy button — only show when a project is loaded */}
        {project && (
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setShowDeploy(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "8px 14px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #00b894, #00cec9)",
              color: "#fff", fontWeight: 800, fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(0,184,148,0.25)",
            }}
          >
            <span>🚀</span>
            <span>Deploy</span>
          </motion.button>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* File tree drawer (mobile overlay / desktop sidebar) */}
        <AnimatePresence>
          {showFileTree && project && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowFileTree(false)}
                style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 20 }}
              />
              <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 340, damping: 36 }}
                style={{
                  position: "absolute", top: 0, left: 0, bottom: 0,
                  width: 200, zIndex: 21,
                }}
              >
                <FileTree
                  files={files}
                  activeId={activeFile?.id ?? null}
                  onSelect={selectFile}
                  onAdd={addFile}
                  onDelete={deleteFile}
                  onClose={() => setShowFileTree(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Split panel container */}
        {project ? (
          <div ref={containerRef}
            style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}
          >
            {/* Editor panel */}
            <div style={{ height: `${splitRatio * 100}%`, flexShrink: 0, overflow: "hidden", position: "relative" }}>
              {/* Language indicator stripe */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, ${langCfg.color}88, transparent)`,
                zIndex: 5,
              }} />

              <Suspense fallback={
                <div style={{
                  height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(30,26,62,0.62)", color: "#636e72", fontSize: 13,
                }}>
                  Loading editor…
                </div>
              }>
                <MonacoEditor
                  height="100%"
                  language={langCfg.monaco}
                  value={code}
                  onChange={val => { setCode(val ?? ""); setDirty(true); }}
                  theme="vs-dark"
                  options={{
                    fontSize:            14,
                    lineHeight:          22,
                    minimap:             { enabled: false },
                    scrollBeyondLastLine:false,
                    wordWrap:            "on",
                    tabSize:             2,
                    padding:             { top: 14, bottom: 14 },
                    lineNumbers:         "on",
                    renderLineHighlight: "line",
                    cursorBlinking:      "smooth",
                    smoothScrolling:     true,
                    fontFamily:          "'JetBrains Mono', 'Fira Code', monospace",
                    renderWhitespace:    "none",
                    bracketPairColorization: { enabled: true },
                    guides:              { bracketPairs: true },
                    automaticLayout:     true,
                  }}
                />
              </Suspense>
            </div>

            {/* Draggable divider */}
            <div
              onMouseDown={() => { dragRef.current = true; }}
              onTouchStart={() => { dragRef.current = true; }}
              onMouseMove={e => dragRef.current && onDividerDrag(e.clientY)}
              onMouseUp={() => { dragRef.current = false; }}
              onTouchMove={e => dragRef.current && onDividerDrag(e.touches[0]!.clientY)}
              onTouchEnd={() => { dragRef.current = false; }}
              style={{
                height: 6, cursor: "row-resize", flexShrink: 0,
                background: "rgba(255,255,255,0.04)",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <div style={{ width: 32, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.15)" }} />
            </div>

            {/* Output panel */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <OutputPanel
                lines={lines}
                result={result}
                running={running}
                htmlSrc={htmlSrc}
                mode={outputMode}
                onModeChange={setOutputMode}
              />
            </div>
          </div>
        ) : (
          // No project selected — welcome screen
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 20, padding: 24,
          }}>
            <div style={{ fontSize: 56, lineHeight: 1 }}>⚡</div>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 8px", background: "linear-gradient(135deg, #7c5ce7, #a29bfe)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Apex Runtime Engine
              </h1>
              <p style={{ color: "#636e72", fontSize: 14, margin: 0 }}>
                Write and run JavaScript, Python, and HTML in real time
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {Object.entries(LANG_CONFIGS).map(([lang, cfg]) => (
                <div key={lang} style={{
                  padding: "8px 16px", borderRadius: 20,
                  background: `${cfg.color}15`, border: `1px solid ${cfg.color}33`,
                  color: cfg.color, fontWeight: 700, fontSize: 12,
                }}>
                  {cfg.label}
                </div>
              ))}
            </div>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => setShowProjects(true)}
              style={{
                padding: "14px 32px", borderRadius: 14, border: "none",
                background: "linear-gradient(135deg, #7c5ce7, #a29bfe)",
                color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer",
                boxShadow: "0 6px 24px rgba(124,92,231,0.35)",
              }}>
              Open or Create Project
            </motion.button>

            {/* Feature list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 280, width: "100%" }}>
              {[
                ["⚡", "Real-time execution via WebSocket streaming"],
                ["🔒", "Sandboxed JS · restricted Python subprocess"],
                ["📂", "Multi-file projects saved to database"],
                ["🌐", "HTML rendered live in browser preview"],
                ["📱", "Mobile-first split editor / output"],
              ].map(([icon, text]) => (
                <div key={text} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                  color: "#b2bec3", fontSize: 12,
                }}>
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Project picker modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showProjects && (
          <ProjectPickerModal
            onSelect={loadProject}
            onClose={() => { if (project) setShowProjects(false); }}
          />
        )}
      </AnimatePresence>

      {/* ── Deploy Panel (bottom-sheet) ───────────────────────────────── */}
      <AnimatePresence>
        {showDeploy && project && (
          <DeployPanel
            projectId={project.id}
            projectName={project.name}
            sessionId={SESSION_ID}
            onClose={() => setShowDeploy(false)}
          />
        )}
      </AnimatePresence>

      <style>{`
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .monaco-editor .overflow-guard { border-radius: 0; }
      `}</style>
    </div>
  );
}
