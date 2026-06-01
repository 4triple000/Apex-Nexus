/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX BUILDER AGENT  —  AI Software Engineer                             ║
 * ║  Prompt → Plan → Write Files → Deploy → Edit                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

type SseEvent =
  | { type: "thinking";  message: string }
  | { type: "plan";      summary: string; tech: string[]; fileCount: number; files: Array<{ path: string; language: string }> }
  | { type: "writing";   path: string; language: string; size: number; index: number; total: number }
  | { type: "saved";     path: string; fileId: number }
  | { type: "deploying"; slug: string }
  | { type: "done";      projectId: number; projectName: string; slug: string; url: string; fileCount: number }
  | { type: "error";     message: string };

type MessageRole = "user" | "agent" | "system";
interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  step?: string;
}

interface FileEntry {
  path: string;
  language: string;
  fileId?: number;
  saved: boolean;
  writing: boolean;
}

type AgentPhase = "idle" | "thinking" | "planning" | "writing" | "deploying" | "done" | "error";

interface ProjectState {
  id: number;
  name: string;
  slug: string;
  url: string;
  fileCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_ICONS: Record<AgentPhase, string> = {
  idle:      "✦",
  thinking:  "◌",
  planning:  "◈",
  writing:   "◆",
  deploying: "◉",
  done:      "✓",
  error:     "✕",
};

const STEP_COLORS: Record<AgentPhase, string> = {
  idle:      "#6366f1",
  thinking:  "#a78bfa",
  planning:  "#06b6d4",
  writing:   "#f59e0b",
  deploying: "#10b981",
  done:      "#22c55e",
  error:     "#ef4444",
};

const LANGUAGE_COLORS: Record<string, string> = {
  javascript: "#f59e0b",
  python:     "#3b82f6",
  html:       "#ef4444",
  css:        "#a78bfa",
  json:       "#06b6d4",
  markdown:   "#6b7280",
  text:       "#6b7280",
};

const EXAMPLE_PROMPTS = [
  "A todo app with drag-and-drop, categories, and local storage",
  "A weather dashboard showing forecasts with animated icons",
  "A quiz game with scores, timer, and leaderboard",
  "A recipe finder with search, favorites, and meal planning",
  "A budget tracker with charts, categories, and monthly reports",
  "A real-time chat interface with emoji reactions",
];

// ── SSE consumer (POST-based, not EventSource) ────────────────────────────────

async function streamSse(
  url: string,
  body: object,
  onEvent: (e: SseEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const evt = JSON.parse(line.slice(6)) as SseEvent;
          onEvent(evt);
        } catch { /* skip malformed */ }
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function getSessionId(): string {
  let id = sessionStorage.getItem("apex-builder-session");
  if (!id) {
    id = `builder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("apex-builder-session", id);
  }
  return id;
}

function fileIcon(lang: string): string {
  const icons: Record<string, string> = {
    javascript: "⚡", python: "🐍", html: "🌐", css: "🎨",
    json: "📋", markdown: "📝", text: "📄",
  };
  return icons[lang] ?? "📄";
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ApexBuilderAgent() {
  const [, setLocation] = useLocation();

  // Chat state
  const [messages, setMessages]   = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      content: "Hi! I'm the Apex Builder Agent — a real AI software engineer. Describe any app you want to build and I'll generate the complete codebase, write every file, and deploy it live. What shall we build?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput]         = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Agent state
  const [phase, setPhase]         = useState<AgentPhase>("idle");
  const [phaseMsg, setPhaseMsg]   = useState("");
  const [files, setFiles]         = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [project, setProject]     = useState<ProjectState | null>(null);
  const [writeProgress, setWriteProgress] = useState({ done: 0, total: 0 });

  // Panel state
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Refs
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const abortRef      = useRef<AbortController | null>(null);
  const inputRef      = useRef<HTMLTextAreaElement>(null);

  const sessionId = getSessionId();

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((role: MessageRole, content: string, step?: string) => {
    setMessages(prev => [...prev, { id: uid(), role, content, timestamp: new Date(), step }]);
  }, []);

  // ── Event handler ──────────────────────────────────────────────────────────

  const handleSseEvent = useCallback((event: SseEvent) => {
    switch (event.type) {
      case "thinking":
        setPhase("thinking");
        setPhaseMsg(event.message);
        break;

      case "plan":
        setPhase("planning");
        setPhaseMsg(`Planning ${event.fileCount} files…`);
        setFiles(event.files.map(f => ({ path: f.path, language: f.language, saved: false, writing: false })));
        setWriteProgress({ done: 0, total: event.fileCount });
        addMessage("agent",
          `**Plan ready:** ${event.summary}\n\n**Tech stack:** ${event.tech.join(", ")}\n\n**Files to generate:** ${event.fileCount} files`,
          "plan"
        );
        break;

      case "writing":
        setPhase("writing");
        setPhaseMsg(`Writing ${event.path} (${event.index}/${event.total})…`);
        setFiles(prev => prev.map(f =>
          f.path === event.path ? { ...f, writing: true } : f
        ));
        break;

      case "saved":
        setWriteProgress(p => ({ ...p, done: p.done + 1 }));
        setFiles(prev => prev.map(f =>
          f.path === event.path ? { ...f, saved: true, writing: false, fileId: event.fileId } : f
        ));
        // Auto-select first file
        setSelectedFile(prev => prev ?? event.path);
        break;

      case "deploying":
        setPhase("deploying");
        setPhaseMsg(`Deploying as "${event.slug}"…`);
        addMessage("agent", `Deploying your app as \`${event.slug}\`…`, "deploy");
        break;

      case "done":
        setPhase("done");
        setPhaseMsg("Done!");
        setProject({
          id: event.projectId,
          name: event.projectName,
          slug: event.slug,
          url: event.url,
          fileCount: event.fileCount,
        });
        addMessage("agent",
          `**Your app is live!** ✓\n\nProject **"${event.projectName}"** is ready with ${event.fileCount} files.\n\nYou can now say things like:\n- "add user authentication"\n- "change the color scheme to dark mode"\n- "add a search feature"\n- "fix the navigation"`,
          "done"
        );
        setActiveTab("preview");
        break;

      case "error":
        setPhase("error");
        setPhaseMsg(event.message);
        addMessage("system", `Error: ${event.message}`);
        break;
    }
  }, [addMessage]);

  // ── Fetch file content from API ────────────────────────────────────────────

  const loadProjectFiles = useCallback(async (projectId: number) => {
    try {
      const res = await fetch(`${BASE}/api/builder-agent/project/${projectId}`);
      const data = await res.json();
      if (data.ok && data.data.files) {
        const contents: Record<string, string> = {};
        for (const f of data.data.files) {
          contents[f.path] = f.content;
        }
        setFileContents(contents);
      }
    } catch { /* silent */ }
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    addMessage("user", text);

    abortRef.current = new AbortController();

    try {
      if (project) {
        // Edit mode
        addMessage("agent", `Got it! Editing your app: "${text}"`, "edit");
        await streamSse(
          `${BASE}/api/builder-agent/edit`,
          { projectId: project.id, instruction: text, sessionId },
          handleSseEvent,
          abortRef.current.signal,
        );
        // Reload file contents
        await loadProjectFiles(project.id);
      } else {
        // Generate mode
        addMessage("agent", `Building your app: "${text}"\n\nStarting up the AI engineer…`, "start");
        setFiles([]);
        setFileContents({});
        setSelectedFile(null);
        setProject(null);
        await streamSse(
          `${BASE}/api/builder-agent/generate`,
          { prompt: text, sessionId },
          handleSseEvent,
          abortRef.current.signal,
        );
        // After done event fires, load contents
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        addMessage("system", "Connection error. Please try again.");
        setPhase("error");
      }
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, project, sessionId, handleSseEvent, loadProjectFiles, addMessage]);

  // After done, load file contents
  useEffect(() => {
    if (phase === "done" && project) {
      loadProjectFiles(project.id);
    }
  }, [phase, project, loadProjectFiles]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setPhase("idle");
  };

  const handleNewProject = () => {
    setProject(null);
    setFiles([]);
    setFileContents({});
    setSelectedFile(null);
    setPhase("idle");
    setPhaseMsg("");
    setMessages([{
      id: uid(),
      role: "agent",
      content: "Ready to build something new! What would you like to create?",
      timestamp: new Date(),
    }]);
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const progressPct = writeProgress.total > 0
    ? Math.round((writeProgress.done / writeProgress.total) * 100)
    : 0;

  const selectedContent = selectedFile ? (fileContents[selectedFile] ?? "") : "";
  const selectedLang = files.find(f => f.path === selectedFile)?.language ?? "text";

  // ── Build the preview URL for the iframe ──────────────────────────────────
  // The /api/apps/:slug/ endpoint serves the deployed app
  const previewUrl = project
    ? `${BASE}/api/apps/${project.slug}/`
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100vw",
      background: "#06070D",
      color: "#e2e8f0",
      fontFamily: "'Inter', system-ui, sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid #1e2030",
        background: "#08091180",
        backdropFilter: "blur(12px)",
        flexShrink: 0,
        zIndex: 10,
      }}>
        {/* Back */}
        <button
          onClick={() => setLocation("/")}
          style={{
            background: "none", border: "none", color: "#6366f1",
            cursor: "pointer", fontSize: 13, padding: "4px 8px",
            borderRadius: 6, display: "flex", alignItems: "center", gap: 4,
          }}
        >
          ← Back
        </button>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.04em" }}>
            APEX BUILDER AGENT
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 6px",
            borderRadius: 4, background: "#6366f120", color: "#818cf8",
            border: "1px solid #6366f140", letterSpacing: "0.08em",
          }}>
            AI ENGINEER
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Phase indicator */}
        {phase !== "idle" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, color: STEP_COLORS[phase],
          }}>
            <span style={{
              display: "inline-block",
              animation: ["thinking", "planning", "writing", "deploying"].includes(phase)
                ? "spin 1s linear infinite" : "none",
            }}>
              {STEP_ICONS[phase]}
            </span>
            <span style={{ color: "#94a3b8", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {phaseMsg}
            </span>
          </div>
        )}

        {project && (
          <button
            onClick={handleNewProject}
            style={{
              background: "#6366f120", border: "1px solid #6366f140",
              color: "#818cf8", cursor: "pointer", fontSize: 12,
              padding: "5px 12px", borderRadius: 6,
            }}
          >
            + New App
          </button>
        )}

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          title="Toggle file tree"
          style={{
            background: "#1e2030", border: "1px solid #2d3149",
            color: "#6366f1", cursor: "pointer", width: 28, height: 28,
            borderRadius: 6, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {sidebarOpen ? "⊟" : "⊞"}
        </button>
      </div>

      {/* ── Main Layout ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Left: Chat ─────────────────────────────────────────────────── */}
        <div style={{
          width: 340,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #1e2030",
          background: "#080911",
        }}>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "90%",
                  padding: "8px 12px",
                  borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, #6366f1, #818cf8)"
                    : msg.role === "system"
                    ? "#ef444420"
                    : "#12131f",
                  border: msg.role === "user"
                    ? "none"
                    : msg.role === "system"
                    ? "1px solid #ef444440"
                    : "1px solid #1e2030",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: msg.role === "system" ? "#ef4444" : "#e2e8f0",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  <FormattedMessage content={msg.content} />
                </div>
                {msg.step === "plan" && (
                  <div style={{ marginTop: 2, fontSize: 10, color: "#4b5563" }}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Progress bar (during writing) */}
          {phase === "writing" && writeProgress.total > 0 && (
            <div style={{ padding: "0 12px 8px" }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 11, color: "#6b7280", marginBottom: 4,
              }}>
                <span>Writing files…</span>
                <span>{writeProgress.done}/{writeProgress.total}</span>
              </div>
              <div style={{ height: 3, background: "#1e2030", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: "linear-gradient(90deg, #6366f1, #06b6d4)",
                  transition: "width 0.3s ease",
                  borderRadius: 99,
                }} />
              </div>
            </div>
          )}

          {/* Example prompts (idle, no project) */}
          {phase === "idle" && !project && messages.length <= 1 && (
            <div style={{ padding: "0 12px 10px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Try an example:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {EXAMPLE_PROMPTS.slice(0, 3).map(ex => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    style={{
                      background: "#12131f", border: "1px solid #1e2030",
                      borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                      fontSize: 11, color: "#94a3b8", textAlign: "left",
                      transition: "all 0.15s",
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid #1e2030",
            background: "#08091180",
          }}>
            <div style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              background: "#12131f",
              border: `1px solid ${isStreaming ? "#6366f160" : "#1e2030"}`,
              borderRadius: 10,
              padding: "8px 10px",
              transition: "border-color 0.2s",
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={project
                  ? "Describe what to change… (e.g. add login, fix bug)"
                  : "Describe the app you want to build…"
                }
                disabled={isStreaming}
                rows={2}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "#e2e8f0", fontSize: 13, resize: "none",
                  lineHeight: 1.5, fontFamily: "inherit",
                }}
              />
              <button
                onClick={isStreaming ? handleStop : handleSubmit}
                disabled={!isStreaming && !input.trim()}
                style={{
                  width: 32, height: 32, flexShrink: 0,
                  borderRadius: 8, border: "none", cursor: "pointer",
                  background: isStreaming
                    ? "#ef444420"
                    : input.trim()
                    ? "linear-gradient(135deg, #6366f1, #818cf8)"
                    : "#1e2030",
                  color: isStreaming ? "#ef4444" : "#fff",
                  fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                }}
              >
                {isStreaming ? "■" : "▶"}
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#374151", marginTop: 4, textAlign: "center" }}>
              {isStreaming ? "AI is building… click ■ to stop" : "Enter to send · Shift+Enter for new line"}
            </div>
          </div>
        </div>

        {/* ── Middle: File Tree (collapsible) ─────────────────────────────── */}
        {sidebarOpen && (
          <div style={{
            width: 220,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #1e2030",
            background: "#0a0b14",
          }}>
            <div style={{
              padding: "10px 12px",
              borderBottom: "1px solid #1e2030",
              fontSize: 11,
              fontWeight: 600,
              color: "#6b7280",
              letterSpacing: "0.08em",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span>FILES</span>
              {files.length > 0 && (
                <span style={{
                  background: "#6366f120", color: "#818cf8",
                  padding: "1px 6px", borderRadius: 99, fontSize: 10,
                }}>
                  {files.filter(f => f.saved).length}/{files.length}
                </span>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
              {files.length === 0 ? (
                <div style={{
                  padding: "24px 12px", textAlign: "center",
                  color: "#374151", fontSize: 12,
                }}>
                  {phase === "idle" ? "No files yet.\nDescribe an app to get started." : "Waiting for plan…"}
                </div>
              ) : (
                files.map(file => (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(file.path)}
                    style={{
                      width: "100%", textAlign: "left",
                      background: selectedFile === file.path ? "#6366f120" : "none",
                      border: `1px solid ${selectedFile === file.path ? "#6366f140" : "transparent"}`,
                      borderRadius: 6, padding: "5px 8px",
                      cursor: "pointer", marginBottom: 2,
                      display: "flex", alignItems: "center", gap: 6,
                      transition: "all 0.15s",
                    }}
                  >
                    {/* Status dot */}
                    <span style={{ fontSize: 8, color: file.writing ? "#f59e0b" : file.saved ? "#22c55e" : "#374151" }}>
                      {file.writing ? "◆" : file.saved ? "●" : "○"}
                    </span>
                    {/* Icon */}
                    <span style={{ fontSize: 13 }}>{fileIcon(file.language)}</span>
                    {/* Path */}
                    <span style={{
                      fontSize: 11, color: file.saved ? "#e2e8f0" : "#6b7280",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {file.path}
                    </span>
                    {/* Lang dot */}
                    <span style={{
                      marginLeft: "auto", flexShrink: 0,
                      width: 6, height: 6, borderRadius: "50%",
                      background: LANGUAGE_COLORS[file.language] ?? "#6b7280",
                    }} />
                  </button>
                ))
              )}
            </div>

            {/* Project info */}
            {project && (
              <div style={{
                padding: "10px 12px",
                borderTop: "1px solid #1e2030",
                fontSize: 11,
              }}>
                <div style={{ color: "#6b7280", marginBottom: 4 }}>PROJECT</div>
                <div style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {project.name}
                </div>
                <div style={{ color: "#6366f1", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {project.slug}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Right: Code + Preview ────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Tab bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "6px 12px",
            borderBottom: "1px solid #1e2030",
            background: "#08091180",
            flexShrink: 0,
          }}>
            {(["preview", "code"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: activeTab === tab ? 600 : 400,
                  background: activeTab === tab ? "#6366f120" : "none",
                  color: activeTab === tab ? "#818cf8" : "#6b7280",
                  transition: "all 0.15s",
                  textTransform: "capitalize",
                }}
              >
                {tab === "preview" ? "🌐 Preview" : "📝 Code"}
              </button>
            ))}

            <div style={{ flex: 1 }} />

            {/* Step tracker */}
            <StepTracker phase={phase} />

            {/* Open in new tab */}
            {project && previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 11, color: "#6366f1",
                  textDecoration: "none",
                  padding: "4px 10px",
                  background: "#6366f110",
                  borderRadius: 6,
                  border: "1px solid #6366f130",
                  marginLeft: 8,
                }}
              >
                ↗ Open
              </a>
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>

            {/* Preview iframe */}
            {activeTab === "preview" && (
              <div style={{ width: "100%", height: "100%", position: "relative" }}>
                {previewUrl ? (
                  <iframe
                    key={project?.slug}
                    src={previewUrl}
                    style={{
                      width: "100%", height: "100%",
                      border: "none",
                      background: "#fff",
                    }}
                    title="App Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                ) : (
                  <EmptyPreview phase={phase} phaseMsg={phaseMsg} progressPct={progressPct} writeProgress={writeProgress} />
                )}
              </div>
            )}

            {/* Code viewer */}
            {activeTab === "code" && (
              <div style={{ width: "100%", height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {selectedFile && selectedContent ? (
                  <>
                    {/* File header */}
                    <div style={{
                      padding: "6px 16px",
                      borderBottom: "1px solid #1e2030",
                      display: "flex", alignItems: "center", gap: 8,
                      background: "#0a0b14",
                      fontSize: 12, color: "#94a3b8",
                    }}>
                      <span>{fileIcon(selectedLang)}</span>
                      <span>{selectedFile}</span>
                      <span style={{
                        marginLeft: "auto", fontSize: 10, color: "#4b5563",
                      }}>
                        {selectedContent.length.toLocaleString()} chars
                      </span>
                    </div>
                    {/* Code */}
                    <div style={{
                      flex: 1, overflowY: "auto", overflowX: "auto",
                      padding: "16px",
                      background: "#06070D",
                    }}>
                      <pre style={{
                        margin: 0, fontSize: 12, lineHeight: 1.7,
                        color: "#e2e8f0",
                        fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                        whiteSpace: "pre",
                        tabSize: 2,
                      }}>
                        {selectedContent}
                      </pre>
                    </div>
                  </>
                ) : (
                  <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#374151", fontSize: 13,
                  }}>
                    {files.length > 0 ? "Select a file from the tree to view its code" : "No files generated yet"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d3149; border-radius: 99px; }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FormattedMessage({ content }: { content: string }) {
  // Simple markdown-ish rendering
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} style={{ color: "#c7d2fe" }}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} style={{
              background: "#1e2030", color: "#06b6d4",
              padding: "1px 5px", borderRadius: 4,
              fontFamily: "monospace", fontSize: "0.9em",
            }}>
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function StepTracker({ phase }: { phase: AgentPhase }) {
  const steps: { id: AgentPhase; label: string }[] = [
    { id: "thinking",  label: "Think" },
    { id: "planning",  label: "Plan" },
    { id: "writing",   label: "Write" },
    { id: "deploying", label: "Deploy" },
    { id: "done",      label: "Live" },
  ];

  const activeIdx = steps.findIndex(s => s.id === phase);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {steps.map((step, idx) => {
        const isActive  = step.id === phase;
        const isPast    = activeIdx > idx && phase !== "idle" && phase !== "error";
        const isFuture  = !isActive && !isPast;

        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 3,
              padding: "2px 7px", borderRadius: 99,
              background: isActive
                ? `${STEP_COLORS[step.id]}20`
                : isPast
                ? "#22c55e10"
                : "transparent",
              border: `1px solid ${isActive ? STEP_COLORS[step.id] + "60" : isPast ? "#22c55e30" : "#1e2030"}`,
              transition: "all 0.3s",
            }}>
              <span style={{
                fontSize: 9,
                color: isActive ? STEP_COLORS[step.id] : isPast ? "#22c55e" : "#374151",
                animation: isActive ? "pulse 1.5s ease-in-out infinite" : "none",
              }}>
                {isPast ? "✓" : STEP_ICONS[step.id]}
              </span>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 600 : 400,
                color: isActive ? STEP_COLORS[step.id] : isPast ? "#22c55e" : "#374151",
              }}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div style={{
                width: 12, height: 1,
                background: isPast ? "#22c55e40" : "#1e2030",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyPreview({ phase, phaseMsg, progressPct, writeProgress }: {
  phase: AgentPhase; phaseMsg: string; progressPct: number;
  writeProgress: { done: number; total: number };
}) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      color: "#4b5563", userSelect: "none",
    }}>
      {phase === "idle" ? (
        <>
          <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.4 }}>⚡</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
            Apex Builder Agent
          </div>
          <div style={{ fontSize: 14, color: "#374151", textAlign: "center", maxWidth: 320 }}>
            Describe your app in the chat. The AI engineer will generate the full codebase and deploy it live here.
          </div>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 6, width: 320 }}>
            {EXAMPLE_PROMPTS.map(ex => (
              <div key={ex} style={{
                padding: "6px 12px", background: "#12131f",
                border: "1px solid #1e2030", borderRadius: 6,
                fontSize: 12, color: "#6b7280",
              }}>
                → {ex}
              </div>
            ))}
          </div>
        </>
      ) : phase === "error" ? (
        <>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✕</div>
          <div style={{ fontSize: 16, color: "#ef4444" }}>Build failed</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, maxWidth: 280, textAlign: "center" }}>
            {phaseMsg}
          </div>
        </>
      ) : (
        <>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            border: `3px solid ${STEP_COLORS[phase]}40`,
            borderTopColor: STEP_COLORS[phase],
            animation: "spin 1s linear infinite",
            marginBottom: 20,
          }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: STEP_COLORS[phase], marginBottom: 6 }}>
            {phase === "thinking"  && "AI is thinking…"}
            {phase === "planning"  && "Planning architecture…"}
            {phase === "writing"   && "Writing files…"}
            {phase === "deploying" && "Deploying your app…"}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", maxWidth: 240, textAlign: "center", marginBottom: 16 }}>
            {phaseMsg}
          </div>
          {phase === "writing" && writeProgress.total > 0 && (
            <div style={{ width: 240 }}>
              <div style={{ height: 4, background: "#1e2030", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${progressPct}%`,
                  background: `linear-gradient(90deg, ${STEP_COLORS.writing}, ${STEP_COLORS.deploying})`,
                  transition: "width 0.4s ease", borderRadius: 99,
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "#4b5563" }}>
                <span>{writeProgress.done} files written</span>
                <span>{writeProgress.total} total</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
