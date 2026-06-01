/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX NEXUS IDE  —  AI-Powered Development Platform                      ║
 * ║  Monaco Editor · Real Code Execution · Live Preview · AI Agent           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { useLocation } from "wouter";

const MonacoEditor = lazy(() => import("@monaco-editor/react").then(m => ({ default: m.default })));

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectFile {
  id?: number;
  path: string;
  language: string;
  content: string;
  dirty: boolean;
}

interface Project {
  id: number;
  name: string;
  description: string;
  sessionId: string;
  language: string;
}

interface Deployment {
  id?: number;
  slug: string;
  url: string;
  status: "building" | "live" | "failed";
  version: number;
}

interface TerminalLine {
  id: string;
  type: "stdout" | "stderr" | "info" | "success" | "error" | "system";
  text: string;
  ts: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
}

type SseEvent =
  | { type: "thinking"; message: string }
  | { type: "plan"; summary: string; tech: string[]; fileCount: number; files: Array<{ path: string; language: string }> }
  | { type: "writing"; path: string; language: string; size: number; index: number; total: number }
  | { type: "saved"; path: string; fileId: number }
  | { type: "deploying"; slug: string }
  | { type: "done"; projectId: number; projectName: string; slug: string; url: string; fileCount: number }
  | { type: "error"; message: string };

type RunStatus = "idle" | "running" | "done" | "error";
type DeployStatus = "idle" | "deploying" | "live" | "error";
type AgentStatus = "idle" | "thinking" | "building" | "done" | "error";

// ── Language map ──────────────────────────────────────────────────────────────

const LANG_MONACO: Record<string, string> = {
  javascript: "javascript", python: "python", html: "html",
  css: "css", json: "json", markdown: "markdown", text: "plaintext",
};

const LANG_ICONS: Record<string, string> = {
  javascript: "⚡", python: "🐍", html: "🌐", css: "🎨",
  json: "📋", markdown: "📝", text: "📄",
};

const LANG_COLORS: Record<string, string> = {
  javascript: "#f59e0b", python: "#3b82f6", html: "#ef4444",
  css: "#a78bfa", json: "#06b6d4", markdown: "#6b7280", text: "#6b7280",
};

// ── Starter templates ─────────────────────────────────────────────────────────

const TEMPLATES: Array<{ id: string; label: string; icon: string; language: string; files: Array<{ path: string; language: string; content: string }> }> = [
  {
    id: "blank-js",
    label: "JavaScript",
    icon: "⚡",
    language: "javascript",
    files: [
      { path: "index.js", language: "javascript", content: `// Welcome to Apex Nexus IDE
// Write JavaScript below and click ▶ Run to execute

const greet = (name) => {
  console.log(\`Hello, \${name}! Welcome to Apex Nexus.\`);
  return name;
};

const result = greet("World");
console.log("Result:", result);

// Try some math
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log("Sum:", sum);
console.log("Average:", sum / numbers.length);
` },
    ],
  },
  {
    id: "react-app",
    label: "React App",
    icon: "⚛",
    language: "javascript",
    files: [
      { path: "index.html", language: "html", content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>React App</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-white">
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;

    function Counter() {
      const [count, setCount] = useState(0);
      const [history, setHistory] = useState([]);

      const increment = () => {
        setCount(c => c + 1);
        setHistory(h => [...h, \`+1 → \${count + 1}\`]);
      };
      const decrement = () => {
        setCount(c => c - 1);
        setHistory(h => [...h, \`-1 → \${count - 1}\`]);
      };
      const reset = () => {
        setCount(0);
        setHistory(h => [...h, "reset → 0"]);
      };

      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Apex Counter
          </h1>
          <div className="text-8xl font-bold tabular-nums" style={{ color: count >= 0 ? '#22c55e' : '#ef4444' }}>
            {count}
          </div>
          <div className="flex gap-4">
            <button onClick={decrement}
              className="px-8 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xl transition">
              −
            </button>
            <button onClick={reset}
              className="px-8 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl transition">
              ↺
            </button>
            <button onClick={increment}
              className="px-8 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xl transition">
              +
            </button>
          </div>
          {history.length > 0 && (
            <div className="w-64 max-h-40 overflow-y-auto bg-gray-900 rounded-lg p-3 text-sm text-gray-400">
              {[...history].reverse().map((h, i) => (
                <div key={i} className="py-0.5 border-b border-gray-800">{h}</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById("root")).render(<Counter />);
  </script>
</body>
</html>` },
    ],
  },
  {
    id: "todo-app",
    label: "Todo App",
    icon: "✅",
    language: "javascript",
    files: [
      { path: "index.html", language: "html", content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Todo App</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white">
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useRef } = React;

    const FILTERS = ["All", "Active", "Done"];

    function TodoApp() {
      const [todos, setTodos] = useState([
        { id: 1, text: "Build something amazing", done: false, priority: "high" },
        { id: 2, text: "Deploy with Apex Nexus", done: false, priority: "medium" },
        { id: 3, text: "Ship it!", done: false, priority: "high" },
      ]);
      const [input, setInput] = useState("");
      const [filter, setFilter] = useState("All");
      const [priority, setPriority] = useState("medium");
      const inputRef = useRef(null);

      const add = () => {
        const text = input.trim();
        if (!text) return;
        setTodos(t => [...t, { id: Date.now(), text, done: false, priority }]);
        setInput("");
        inputRef.current?.focus();
      };

      const toggle = (id) => setTodos(t => t.map(x => x.id === id ? {...x, done: !x.done} : x));
      const remove = (id) => setTodos(t => t.filter(x => x.id !== id));

      const filtered = todos.filter(t =>
        filter === "All" ? true : filter === "Done" ? t.done : !t.done
      );

      const PRIORITY_COLORS = { high: "text-red-400", medium: "text-yellow-400", low: "text-green-400" };

      return (
        <div className="min-h-screen p-6 max-w-lg mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-center">
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Apex Todo
            </span>
            <span className="ml-2 text-lg text-gray-500">{todos.filter(t=>!t.done).length} left</span>
          </h1>
          <div className="flex gap-2 mb-4">
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&add()}
              placeholder="What needs to be done?"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:border-violet-500"/>
            <select value={priority} onChange={e=>setPriority(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm outline-none">
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Med</option>
              <option value="low">🟢 Low</option>
            </select>
            <button onClick={add}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-semibold transition">
              Add
            </button>
          </div>
          <div className="flex gap-1 mb-4">
            {FILTERS.map(f => (
              <button key={f} onClick={()=>setFilter(f)}
                className={\`px-3 py-1 rounded text-xs font-semibold transition \${filter===f ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"}\`}>
                {f}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filtered.map(todo => (
              <div key={todo.id} className={\`flex items-center gap-3 p-3 rounded-lg border transition \${todo.done ? "bg-slate-900 border-slate-800 opacity-60" : "bg-slate-800 border-slate-700"}\`}>
                <button onClick={()=>toggle(todo.id)}
                  className={\`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition \${todo.done ? "bg-violet-600 border-violet-600" : "border-slate-500 hover:border-violet-500"}\`}>
                  {todo.done && <span className="text-white text-xs">✓</span>}
                </button>
                <span className={\`flex-1 text-sm \${todo.done ? "line-through text-gray-500" : ""}\`}>{todo.text}</span>
                <span className={\`text-xs font-semibold \${PRIORITY_COLORS[todo.priority]}\`}>{todo.priority}</span>
                <button onClick={()=>remove(todo.id)} className="text-gray-600 hover:text-red-400 text-xs transition">✕</button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-gray-600 py-8">No {filter.toLowerCase()} todos</div>
            )}
          </div>
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById("root")).render(<TodoApp />);
  </script>
</body>
</html>` },
    ],
  },
];

// ── Utilities ─────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const m: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "javascript", tsx: "javascript",
    py: "python", html: "html", htm: "html", css: "css",
    json: "json", md: "markdown", mdx: "markdown",
  };
  return m[ext] ?? "text";
}

function getSessionId(): string {
  let id = sessionStorage.getItem("nexus-ide-session");
  if (!id) {
    id = `nexus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("nexus-ide-session", id);
  }
  return id;
}

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
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try { onEvent(JSON.parse(line.slice(6)) as SseEvent); } catch { /* skip */ }
      }
    }
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NexusIDE() {
  const [, setLocation]     = useLocation();
  const sessionId           = getSessionId();

  // Project state
  const [project, setProject]           = useState<Project | null>(null);
  const [files, setFiles]               = useState<ProjectFile[]>([]);
  const [activeFile, setActiveFile]     = useState<string | null>(null);
  const [deployment, setDeployment]     = useState<Deployment | null>(null);

  // UI state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      content: "Welcome to Apex Nexus IDE — an AI-powered development platform. I can generate complete apps from your prompts, edit code, and deploy live. Choose a template or describe what you want to build.",
    },
  ]);
  const [chatInput, setChatInput]       = useState("");
  const [terminal, setTerminal]         = useState<TerminalLine[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<"preview" | "output">("preview");

  // Status
  const [runStatus, setRunStatus]       = useState<RunStatus>("idle");
  const [deployStatus, setDeployStatus] = useState<DeployStatus>("idle");
  const [agentStatus, setAgentStatus]   = useState<AgentStatus>("idle");
  const [agentMsg, setAgentMsg]         = useState("");
  const [writeProgress, setWriteProgress] = useState({ done: 0, total: 0 });

  // Panels
  const [leftWidth, setLeftWidth]       = useState(280);
  const [rightWidth, setRightWidth]     = useState(400);
  const [termHeight, setTermHeight]     = useState(180);
  const isDraggingLeft                  = useRef(false);
  const isDraggingRight                 = useRef(false);
  const isDraggingTerm                  = useRef(false);

  // Refs
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const termEndRef    = useRef<HTMLDivElement>(null);
  const abortRef      = useRef<AbortController | null>(null);

  // Current file helpers
  const currentFile = files.find(f => f.path === activeFile) ?? null;
  const currentCode = currentFile?.content ?? "";

  // Auto-scroll
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  useEffect(() => { termEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [terminal]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const addChat = useCallback((role: "user" | "agent" | "system", content: string) => {
    setChatMessages(prev => [...prev, { id: uid(), role, content }]);
  }, []);

  const addTerm = useCallback((type: TerminalLine["type"], text: string) => {
    setTerminal(prev => [...prev, { id: uid(), type, text, ts: Date.now() }]);
  }, []);

  const setFileContent = useCallback((path: string, content: string, dirty = true) => {
    setFiles(prev => prev.map(f => f.path === path ? { ...f, content, dirty } : f));
  }, []);

  const upsertFile = useCallback((path: string, language: string, content: string, id?: number) => {
    setFiles(prev => {
      const existing = prev.find(f => f.path === path);
      if (existing) {
        return prev.map(f => f.path === path ? { ...f, content, language, id, dirty: false } : f);
      }
      return [...prev, { path, language, content, dirty: false, id }];
    });
  }, []);

  // ── Load a template ───────────────────────────────────────────────────────

  const loadTemplate = useCallback((tpl: typeof TEMPLATES[0]) => {
    const now = Date.now();
    const proj: Project = {
      id: -now,   // Negative = local-only until AI creates real project
      name: tpl.label,
      description: `${tpl.label} template`,
      sessionId,
      language: tpl.language,
    };
    setProject(proj);
    setFiles(tpl.files.map(f => ({ ...f, dirty: false })));
    setActiveFile(tpl.files[0]?.path ?? null);
    setDeployment(null);
    setPreviewUrl(null);
    setTerminal([{ id: uid(), type: "system", text: `✦ Loaded ${tpl.label} template — ${tpl.files.length} file(s)`, ts: 0 }]);
    setChatMessages([{ id: uid(), role: "agent", content: `**${tpl.label}** template loaded. Click ▶ Run to execute, 🚀 Deploy for a live URL, or describe edits in the chat.` }]);
    // Auto-preview HTML files
    const htmlFile = tpl.files.find(f => f.language === "html");
    if (htmlFile) {
      const blob = new Blob([htmlFile.content], { type: "text/html" });
      setPreviewUrl(URL.createObjectURL(blob));
      setActiveTab("preview");
    }
  }, [sessionId]);

  // ── Run code ──────────────────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    if (!currentFile || runStatus === "running") return;
    const { language, content, path } = currentFile;

    if (language === "html") {
      // Render HTML inline as blob URL
      const blob = new Blob([content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setActiveTab("preview");
      addTerm("success", `✓ HTML rendered in preview`);
      return;
    }

    setRunStatus("running");
    setTerminalOpen(true);
    setActiveTab("output");
    addTerm("system", `▶ Running ${path} (${language})…`);

    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE}/api/runtime/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: content, language }),
      });
      const data = await res.json();
      const elapsed = Date.now() - t0;

      if (data.stdout) {
        for (const line of data.stdout.split("\n")) {
          if (line !== "") addTerm("stdout", line);
        }
      }
      if (data.stderr) {
        for (const line of data.stderr.split("\n")) {
          if (line !== "") addTerm("stderr", line);
        }
      }
      if (data.error) {
        addTerm("error", `Error: ${data.error}`);
      }

      const statusType = data.success ? "success" : "error";
      addTerm(statusType, `${data.success ? "✓" : "✕"} Exited (${data.exitCode}) in ${data.durationMs ?? elapsed}ms`);
      setRunStatus(data.success ? "done" : "error");
    } catch (err: any) {
      addTerm("error", `Failed to reach runtime: ${err.message}`);
      setRunStatus("error");
    }
  }, [currentFile, runStatus, addTerm]);

  // ── Save active file to DB ────────────────────────────────────────────────

  const saveFile = useCallback(async (file: ProjectFile) => {
    if (!project || project.id < 0) return; // Local-only project
    try {
      const res = await fetch(`${BASE}/api/projects/${project.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": sessionId },
        body: JSON.stringify({ path: file.path, content: file.content, language: file.language }),
      });
      if (res.ok) {
        setFiles(prev => prev.map(f => f.path === file.path ? { ...f, dirty: false } : f));
      }
    } catch { /* silent */ }
  }, [project, sessionId]);

  // Ctrl+S saves
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (currentFile?.dirty) saveFile(currentFile);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentFile, saveFile]);

  // ── Deploy ────────────────────────────────────────────────────────────────

  const handleDeploy = useCallback(async () => {
    if (deployStatus === "deploying") return;
    setDeployStatus("deploying");
    setTerminalOpen(true);
    addTerm("system", "🚀 Starting deployment…");

    try {
      // If local project or no DB project, create it first via builder agent
      let pid = project?.id ?? -1;

      if (!project || project.id < 0) {
        // Create project in DB first
        const createRes = await fetch(`${BASE}/api/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-session-id": sessionId },
          body: JSON.stringify({
            name: project?.name ?? "Nexus App",
            description: project?.description ?? "Built with Apex Nexus IDE",
            language: project?.language ?? "javascript",
          }),
        });
        const createData = await createRes.json();
        pid = createData?.data?.project?.id;
        if (!pid) throw new Error("Failed to create project");

        setProject(prev => prev ? { ...prev, id: pid } : null);

        // Upload all files
        for (const file of files) {
          await fetch(`${BASE}/api/projects/${pid}/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-session-id": sessionId },
            body: JSON.stringify({ path: file.path, content: file.content, language: file.language }),
          });
          addTerm("info", `  ↑ Uploaded ${file.path}`);
        }
      } else {
        // Save any dirty files
        for (const file of files.filter(f => f.dirty)) {
          await fetch(`${BASE}/api/projects/${pid}/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-session-id": sessionId },
            body: JSON.stringify({ path: file.path, content: file.content, language: file.language }),
          });
          addTerm("info", `  ↑ Saved ${file.path}`);
        }
      }

      addTerm("info", "  ⚙ Building deployment…");
      const deployRes = await fetch(`${BASE}/api/deploy/projects/${pid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": sessionId },
        body: JSON.stringify({}),
      });
      const deployData = await deployRes.json();
      const slug = deployData?.slug ?? deployData?.data?.slug;

      if (!slug) throw new Error("No deployment slug returned");

      // Poll for live status
      const domain = window.location.host;
      const proto  = window.location.protocol;
      const url    = `${proto}//${domain}${BASE}/api/apps/${slug}/`;

      // Poll up to 15s
      let live = false;
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
          const check = await fetch(url, { method: "HEAD" });
          if (check.ok) { live = true; break; }
        } catch { /* keep polling */ }
      }

      if (!live) {
        // Still set it — might be building
        addTerm("info", "  ℹ Deployment may still be building");
      }

      setDeployment({ slug, url, status: live ? "live" : "building", version: deployData.version ?? 1 });
      setPreviewUrl(url);
      setActiveTab("preview");
      setDeployStatus("live");
      addTerm("success", `✓ Deployed! → ${url}`);
      addChat("agent", `**Deployed!** Your app is live at:\n\`${url}\`\n\nThe preview has been loaded. Click **↗ Open** to view in a new tab.`);
    } catch (err: any) {
      setDeployStatus("error");
      addTerm("error", `✕ Deploy failed: ${err.message}`);
      addChat("system", `Deploy failed: ${err.message}`);
    }
  }, [project, files, sessionId, deployStatus, addTerm, addChat]);

  // ── AI Agent ──────────────────────────────────────────────────────────────

  const handleAgentSubmit = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || agentStatus === "thinking" || agentStatus === "building") return;
    setChatInput("");
    addChat("user", text);

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setAgentStatus("thinking");
    setWriteProgress({ done: 0, total: 0 });

    const onEvent = (event: SseEvent) => {
      switch (event.type) {
        case "thinking":
          setAgentMsg(event.message);
          setAgentStatus("thinking");
          break;
        case "plan":
          setAgentStatus("building");
          setAgentMsg(`Writing ${event.fileCount} files…`);
          setWriteProgress({ done: 0, total: event.fileCount });
          addChat("agent", `**Plan ready:** ${event.summary}\n**Tech:** ${event.tech.join(", ")}\n**Generating ${event.fileCount} files…**`);
          break;
        case "writing":
          setAgentMsg(`Writing ${event.path} (${event.index}/${event.total})`);
          setWriteProgress(p => ({ ...p }));
          break;
        case "saved":
          setWriteProgress(p => ({ ...p, done: p.done + 1 }));
          // We'll load from API after done
          break;
        case "deploying":
          setAgentMsg(`Deploying as ${event.slug}…`);
          break;
        case "done": {
          setAgentStatus("done");
          setAgentMsg("Done!");
          setProject({
            id: event.projectId,
            name: event.projectName,
            description: "",
            sessionId,
            language: "javascript",
          });
          const domain = window.location.host;
          const proto  = window.location.protocol;
          const url    = `${proto}//${domain}${BASE}/api/apps/${event.slug}/`;
          setDeployment({ slug: event.slug, url, status: "live", version: 1 });
          setPreviewUrl(url);
          setActiveTab("preview");
          setDeployStatus("live");
          addChat("agent", `**App ready!** Built ${event.fileCount} files and deployed live.\n\nPreview loaded — you can now say things like:\n- "add dark mode"\n- "add a search bar"\n- "fix the navigation"`);
          // Load file list + contents from API
          fetch(`${BASE}/api/builder-agent/project/${event.projectId}`)
            .then(r => r.json())
            .then(data => {
              if (data?.data?.files) {
                const newFiles: ProjectFile[] = data.data.files.map((f: any) => ({
                  path: f.path,
                  language: f.language,
                  content: f.content,
                  dirty: false,
                  id: f.id,
                }));
                setFiles(newFiles);
                if (newFiles.length > 0) setActiveFile(newFiles[0]!.path);
              }
            })
            .catch(() => { /* silent */ });
          setTimeout(() => setAgentStatus("idle"), 2000);
          break;
        }
        case "error":
          setAgentStatus("error");
          setAgentMsg(event.message);
          addChat("system", `Error: ${event.message}`);
          setTimeout(() => setAgentStatus("idle"), 3000);
          break;
      }
    };

    try {
      if (project && project.id > 0) {
        // Edit existing project
        await streamSse(
          `${BASE}/api/builder-agent/edit`,
          { projectId: project.id, instruction: text, sessionId },
          onEvent,
          abortRef.current.signal,
        );
        // Reload files
        const data = await fetch(`${BASE}/api/builder-agent/project/${project.id}`).then(r => r.json());
        if (data?.data?.files) {
          const updatedFiles: ProjectFile[] = data.data.files.map((f: any) => ({
            path: f.path, language: f.language, content: f.content, dirty: false, id: f.id,
          }));
          setFiles(updatedFiles);
        }
      } else {
        // Generate new app
        await streamSse(
          `${BASE}/api/builder-agent/generate`,
          { prompt: text, sessionId },
          onEvent,
          abortRef.current.signal,
        );
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setAgentStatus("error");
        addChat("system", `Connection error: ${err.message}`);
        setTimeout(() => setAgentStatus("idle"), 3000);
      } else {
        setAgentStatus("idle");
      }
    }
  }, [chatInput, agentStatus, project, sessionId, addChat]);

  // ── Panel resize drag handlers ────────────────────────────────────────────

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDraggingLeft.current) {
        setLeftWidth(w => Math.min(480, Math.max(200, w + e.movementX)));
      }
      if (isDraggingRight.current) {
        setRightWidth(w => Math.min(600, Math.max(240, w - e.movementX)));
      }
      if (isDraggingTerm.current) {
        setTermHeight(h => Math.min(500, Math.max(80, h - e.movementY)));
      }
    };
    const onUp = () => {
      isDraggingLeft.current = false;
      isDraggingRight.current = false;
      isDraggingTerm.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const isAgentBusy = agentStatus === "thinking" || agentStatus === "building";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", width: "100vw",
      background: "#060810", color: "#e2e8f0",
      fontFamily: "'Inter', system-ui, sans-serif",
      overflow: "hidden",
    }}>

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <TopBar
        project={project}
        currentFile={currentFile}
        runStatus={runStatus}
        deployStatus={deployStatus}
        agentStatus={agentStatus}
        agentMsg={agentMsg}
        deployment={deployment}
        onRun={handleRun}
        onDeploy={handleDeploy}
        onBack={() => setLocation("/")}
      />

      {/* ══ MAIN LAYOUT ══════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT: AI Chat + File Tree ─────────────────────────────────── */}
        <div style={{ width: leftWidth, display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid #1a1d2e" }}>
          <LeftPanel
            chatMessages={chatMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            onSubmit={handleAgentSubmit}
            isAgentBusy={isAgentBusy}
            agentStatus={agentStatus}
            agentMsg={agentMsg}
            writeProgress={writeProgress}
            files={files}
            activeFile={activeFile}
            onFileSelect={setActiveFile}
            templates={TEMPLATES}
            onLoadTemplate={loadTemplate}
            project={project}
            chatEndRef={chatEndRef}
          />
        </div>

        {/* ── LEFT RESIZE HANDLE ─────────────────────────────────────────── */}
        <div
          onMouseDown={() => { isDraggingLeft.current = true; }}
          style={{ width: 4, cursor: "col-resize", background: "transparent", flexShrink: 0, transition: "background 0.1s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#6366f160")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        />

        {/* ── CENTER: Editor + Terminal ──────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* File tabs */}
          <FileTabs
            files={files}
            activeFile={activeFile}
            onSelect={setActiveFile}
            onClose={(path) => {
              const remaining = files.filter(f => f.path !== path);
              setFiles(remaining);
              if (activeFile === path) setActiveFile(remaining[0]?.path ?? null);
            }}
          />

          {/* Monaco Editor */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {currentFile ? (
              <Suspense fallback={<EditorSkeleton />}>
                <MonacoEditor
                  height="100%"
                  language={LANG_MONACO[currentFile.language] ?? "plaintext"}
                  value={currentCode}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineHeight: 22,
                    fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace",
                    fontLigatures: true,
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    automaticLayout: true,
                    tabSize: 2,
                    padding: { top: 12, bottom: 12 },
                    renderLineHighlight: "gutter",
                    smoothScrolling: true,
                    cursorBlinking: "smooth",
                    bracketPairColorization: { enabled: true },
                  }}
                  onChange={value => { if (value !== undefined) setFileContent(currentFile.path, value, true); }}
                />
              </Suspense>
            ) : (
              <EditorEmpty
                templates={TEMPLATES}
                onLoadTemplate={loadTemplate}
                onPromptFocus={() => document.getElementById("nexus-chat-input")?.focus()}
              />
            )}
          </div>

          {/* Terminal resize handle */}
          {terminalOpen && (
            <div
              onMouseDown={() => { isDraggingTerm.current = true; }}
              style={{
                height: 4, cursor: "row-resize", background: "transparent",
                transition: "background 0.1s", flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#6366f160")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            />
          )}

          {/* Terminal */}
          <TerminalPanel
            lines={terminal}
            open={terminalOpen}
            height={termHeight}
            onToggle={() => setTerminalOpen(o => !o)}
            onClear={() => setTerminal([])}
            termEndRef={termEndRef}
          />
        </div>

        {/* ── RIGHT RESIZE HANDLE ────────────────────────────────────────── */}
        <div
          onMouseDown={() => { isDraggingRight.current = true; }}
          style={{ width: 4, cursor: "col-resize", background: "transparent", flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = "#6366f160")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        />

        {/* ── RIGHT: Preview ─────────────────────────────────────────────── */}
        <div style={{ width: rightWidth, display: "flex", flexDirection: "column", flexShrink: 0, borderLeft: "1px solid #1a1d2e" }}>
          <PreviewPanel
            previewUrl={previewUrl}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            deployment={deployment}
          />
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d3149; border-radius: 99px; }
      `}</style>
    </div>
  );
}

// ══ TOP BAR ═══════════════════════════════════════════════════════════════════

function TopBar({
  project, currentFile, runStatus, deployStatus, agentStatus, agentMsg,
  deployment, onRun, onDeploy, onBack,
}: {
  project: Project | null; currentFile: ProjectFile | null;
  runStatus: RunStatus; deployStatus: DeployStatus;
  agentStatus: AgentStatus; agentMsg: string;
  deployment: Deployment | null;
  onRun: () => void; onDeploy: () => void; onBack: () => void;
}) {
  const canRun = !!currentFile && runStatus !== "running";
  const canDeploy = deployStatus !== "deploying";
  const isRunning = runStatus === "running";
  const isDeploying = deployStatus === "deploying";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 12px", height: 44,
      background: "#08091180",
      borderBottom: "1px solid #1a1d2e",
      backdropFilter: "blur(12px)",
      flexShrink: 0, zIndex: 20,
    }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 12, padding: "4px 8px", borderRadius: 5 }}>← Back</button>

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16 }}>⚡</span>
        <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "#e2e8f0" }}>APEX NEXUS</span>
        <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#6366f120", color: "#818cf8", border: "1px solid #6366f140", letterSpacing: "0.08em", fontWeight: 700 }}>IDE</span>
      </div>

      {/* Project name */}
      {project && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "#12131f", border: "1px solid #1a1d2e", borderRadius: 5, fontSize: 12, color: "#94a3b8", maxWidth: 200, overflow: "hidden" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</span>
          {project.id < 0 && <span style={{ fontSize: 9, color: "#6b7280" }}>local</span>}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Agent status */}
      {agentStatus !== "idle" && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#a78bfa", maxWidth: 240, overflow: "hidden" }}>
          <span style={{ animation: agentStatus === "thinking" || agentStatus === "building" ? "spin 1s linear infinite" : "none", display: "inline-block", fontSize: 10 }}>◌</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#94a3b8" }}>{agentMsg}</span>
        </div>
      )}

      {/* Deployment URL */}
      {deployment?.status === "live" && (
        <a href={deployment.url} target="_blank" rel="noopener noreferrer" style={{
          fontSize: 11, color: "#22c55e", textDecoration: "none",
          padding: "3px 8px", background: "#22c55e10", border: "1px solid #22c55e30",
          borderRadius: 5, whiteSpace: "nowrap",
        }}>
          ● Live ↗
        </a>
      )}

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={!canRun}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 14px", borderRadius: 7, border: "none",
          cursor: canRun ? "pointer" : "not-allowed",
          background: canRun ? "linear-gradient(135deg, #059669, #10b981)" : "#1a1d2e",
          color: canRun ? "#fff" : "#4b5563",
          fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
          transition: "all 0.15s",
        }}
      >
        {isRunning ? (
          <><span style={{ animation: "spin 1s linear infinite", display: "inline-block", fontSize: 10 }}>◌</span> Running…</>
        ) : (
          <>▶ Run</>
        )}
      </button>

      {/* Deploy button */}
      <button
        onClick={onDeploy}
        disabled={!canDeploy}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 14px", borderRadius: 7, border: "none",
          cursor: canDeploy ? "pointer" : "not-allowed",
          background: isDeploying
            ? "#1a1d2e"
            : deployStatus === "live"
            ? "linear-gradient(135deg, #16a34a, #22c55e)"
            : "linear-gradient(135deg, #6366f1, #818cf8)",
          color: canDeploy ? "#fff" : "#4b5563",
          fontSize: 12, fontWeight: 700,
          transition: "all 0.15s",
        }}
      >
        {isDeploying ? (
          <><span style={{ animation: "spin 1s linear infinite", display: "inline-block", fontSize: 10 }}>◌</span> Deploying…</>
        ) : deployStatus === "live" ? (
          <>✓ Redeploy</>
        ) : (
          <>🚀 Deploy</>
        )}
      </button>
    </div>
  );
}

// ══ LEFT PANEL ════════════════════════════════════════════════════════════════

function LeftPanel({
  chatMessages, chatInput, setChatInput, onSubmit, isAgentBusy,
  agentStatus, agentMsg, writeProgress, files, activeFile, onFileSelect,
  templates, onLoadTemplate, project, chatEndRef,
}: any) {
  const [tab, setTab] = useState<"chat" | "files">("chat");
  const progressPct = writeProgress.total > 0
    ? Math.round((writeProgress.done / writeProgress.total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#08091180" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #1a1d2e", flexShrink: 0 }}>
        {(["chat", "files"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "8px 4px", border: "none", cursor: "pointer",
            background: tab === t ? "#12131f" : "none",
            color: tab === t ? "#818cf8" : "#6b7280",
            fontSize: 11, fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
            textTransform: "capitalize",
            transition: "all 0.15s",
          }}>
            {t === "chat" ? "🤖 AI Agent" : `📁 Files ${files.length > 0 ? `(${files.length})` : ""}`}
          </button>
        ))}
      </div>

      {tab === "chat" ? (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {chatMessages.map((msg: ChatMessage) => (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "92%", padding: "7px 11px",
                  borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: msg.role === "user" ? "linear-gradient(135deg,#6366f1,#818cf8)" : msg.role === "system" ? "#ef444418" : "#12131f",
                  border: msg.role === "user" ? "none" : msg.role === "system" ? "1px solid #ef444430" : "1px solid #1a1d2e",
                  fontSize: 12, lineHeight: 1.55, color: msg.role === "system" ? "#ef4444" : "#e2e8f0",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  <MiniMarkdown text={msg.content} />
                </div>
              </div>
            ))}
            {isAgentBusy && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#12131f", borderRadius: "12px 12px 12px 2px", border: "1px solid #1a1d2e", fontSize: 12, color: "#a78bfa" }}>
                <span style={{ animation: "pulse 1s ease-in-out infinite" }}>●</span>
                <span style={{ color: "#94a3b8" }}>{agentMsg || "Working…"}</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Build progress */}
          {agentStatus === "building" && writeProgress.total > 0 && (
            <div style={{ padding: "0 10px 6px", flexShrink: 0 }}>
              <div style={{ height: 3, background: "#1a1d2e", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg,#6366f1,#06b6d4)", transition: "width 0.3s", borderRadius: 99 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4b5563", marginTop: 3 }}>
                <span>{writeProgress.done}/{writeProgress.total} files</span><span>{progressPct}%</span>
              </div>
            </div>
          )}

          {/* Templates (when no project) */}
          {!project && chatMessages.length <= 1 && (
            <div style={{ padding: "0 10px 8px", flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 5 }}>QUICK START</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {templates.map((tpl: typeof TEMPLATES[0]) => (
                  <button key={tpl.id} onClick={() => onLoadTemplate(tpl)} style={{
                    background: "#12131f", border: "1px solid #1a1d2e", borderRadius: 6,
                    padding: "5px 9px", cursor: "pointer", fontSize: 11,
                    color: "#94a3b8", textAlign: "left", display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.15s",
                  }}>
                    <span>{tpl.icon}</span><span>{tpl.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "8px 10px", borderTop: "1px solid #1a1d2e", flexShrink: 0 }}>
            <div style={{
              display: "flex", gap: 6, alignItems: "flex-end",
              background: "#12131f", border: `1px solid ${isAgentBusy ? "#6366f160" : "#1a1d2e"}`,
              borderRadius: 9, padding: "6px 8px", transition: "border-color 0.2s",
            }}>
              <textarea
                id="nexus-chat-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
                placeholder={project && project.id > 0 ? "Describe a change…" : "Describe an app to build…"}
                disabled={isAgentBusy}
                rows={2}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "#e2e8f0", fontSize: 12, resize: "none", lineHeight: 1.5, fontFamily: "inherit",
                }}
              />
              <button onClick={onSubmit} disabled={isAgentBusy || !chatInput.trim()} style={{
                width: 28, height: 28, flexShrink: 0, borderRadius: 7, border: "none",
                cursor: isAgentBusy || !chatInput.trim() ? "not-allowed" : "pointer",
                background: isAgentBusy || !chatInput.trim() ? "#1a1d2e" : "linear-gradient(135deg,#6366f1,#818cf8)",
                color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}>
                {isAgentBusy ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block", fontSize: 9 }}>◌</span> : "▶"}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* File tree */
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {files.length === 0 ? (
            <div style={{ padding: "24px 12px", textAlign: "center", color: "#374151", fontSize: 12 }}>
              No files yet. Load a template or describe an app.
            </div>
          ) : (
            files.map((f: ProjectFile) => (
              <button key={f.path} onClick={() => onFileSelect(f.path)} style={{
                width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 6,
                padding: "5px 8px", borderRadius: 6, border: `1px solid ${activeFile === f.path ? "#6366f140" : "transparent"}`,
                background: activeFile === f.path ? "#6366f115" : "none",
                cursor: "pointer", marginBottom: 2, transition: "all 0.12s",
              }}>
                <span style={{ fontSize: 13 }}>{LANG_ICONS[f.language] ?? "📄"}</span>
                <span style={{ flex: 1, fontSize: 11, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.path}</span>
                {f.dirty && <span style={{ fontSize: 9, color: "#f59e0b" }}>●</span>}
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: LANG_COLORS[f.language] ?? "#6b7280", flexShrink: 0 }} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ══ FILE TABS ═════════════════════════════════════════════════════════════════

function FileTabs({ files, activeFile, onSelect, onClose }: {
  files: ProjectFile[]; activeFile: string | null;
  onSelect: (p: string) => void; onClose: (p: string) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", overflowX: "auto",
      background: "#0a0b14", borderBottom: "1px solid #1a1d2e",
      flexShrink: 0, height: 34,
    }}>
      {files.map(f => (
        <div
          key={f.path}
          onClick={() => onSelect(f.path)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "0 12px", height: "100%", cursor: "pointer", flexShrink: 0,
            borderRight: "1px solid #1a1d2e",
            background: activeFile === f.path ? "#12131f" : "transparent",
            borderBottom: activeFile === f.path ? "2px solid #6366f1" : "2px solid transparent",
            transition: "all 0.12s",
          }}
        >
          <span style={{ fontSize: 11 }}>{LANG_ICONS[f.language] ?? "📄"}</span>
          <span style={{ fontSize: 11, color: activeFile === f.path ? "#e2e8f0" : "#6b7280", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {f.path.split("/").pop()}
          </span>
          {f.dirty && <span style={{ fontSize: 8, color: "#f59e0b" }}>●</span>}
          <button
            onClick={e => { e.stopPropagation(); onClose(f.path); }}
            style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 11, padding: "0 2px", lineHeight: 1, marginLeft: 2 }}
          >×</button>
        </div>
      ))}
    </div>
  );
}

// ══ EDITOR EMPTY STATE ════════════════════════════════════════════════════════

function EditorEmpty({ templates, onLoadTemplate, onPromptFocus }: any) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#4b5563", gap: 16 }}>
      <div style={{ fontSize: 48, opacity: 0.4 }}>⚡</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Apex Nexus IDE</div>
        <div style={{ fontSize: 12, color: "#374151" }}>Pick a template or describe your app in the AI chat</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {templates.map((tpl: any) => (
          <button key={tpl.id} onClick={() => onLoadTemplate(tpl)} style={{
            padding: "8px 16px", background: "#12131f", border: "1px solid #1a1d2e",
            borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#94a3b8",
            display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
          }}>
            <span>{tpl.icon}</span><span>{tpl.label}</span>
          </button>
        ))}
      </div>
      <button onClick={onPromptFocus} style={{
        padding: "8px 20px", background: "linear-gradient(135deg,#6366f1,#818cf8)",
        border: "none", borderRadius: 8, cursor: "pointer",
        fontSize: 12, color: "#fff", fontWeight: 600,
      }}>
        Describe an app with AI →
      </button>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div style={{ height: "100%", background: "#1e1e1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 12, color: "#4b5563" }}>Loading editor…</div>
    </div>
  );
}

// ══ TERMINAL PANEL ════════════════════════════════════════════════════════════

function TerminalPanel({ lines, open, height, onToggle, onClear, termEndRef }: {
  lines: TerminalLine[]; open: boolean; height: number;
  onToggle: () => void; onClear: () => void;
  termEndRef: React.RefObject<HTMLDivElement>;
}) {
  const COLORS: Record<string, string> = {
    stdout: "#22c55e", stderr: "#ef4444", info: "#06b6d4",
    success: "#10b981", error: "#f87171", system: "#818cf8",
  };

  return (
    <div style={{ background: "#06070c", borderTop: "1px solid #1a1d2e", flexShrink: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "0 12px",
        height: 28, borderBottom: open ? "1px solid #1a1d2e" : "none",
        background: "#0a0b14",
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: "0.08em" }}>TERMINAL</span>
        <span style={{ fontSize: 10, color: "#2d3149" }}>{lines.length} lines</span>
        <div style={{ flex: 1 }} />
        <button onClick={onClear} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 11 }}>✕ Clear</button>
        <button onClick={onToggle} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
          {open ? "▼" : "▲"}
        </button>
      </div>

      {/* Output */}
      {open && (
        <div style={{ height, overflowY: "auto", padding: "8px 12px", fontFamily: "'Fira Code', 'Cascadia Code', monospace", fontSize: 12 }}>
          {lines.length === 0 ? (
            <span style={{ color: "#2d3149" }}>$ Ready — click ▶ Run to execute code</span>
          ) : (
            lines.map(line => (
              <div key={line.id} style={{ color: COLORS[line.type] ?? "#e2e8f0", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {line.text}
              </div>
            ))
          )}
          <div ref={termEndRef} />
        </div>
      )}
    </div>
  );
}

// ══ PREVIEW PANEL ════════════════════════════════════════════════════════════

function PreviewPanel({ previewUrl, activeTab, setActiveTab, deployment }: {
  previewUrl: string | null; activeTab: "preview" | "output";
  setActiveTab: (t: "preview" | "output") => void;
  deployment: Deployment | null;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#08091180" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 4, padding: "0 10px",
        height: 34, background: "#0a0b14", borderBottom: "1px solid #1a1d2e",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: "0.08em", marginRight: 6 }}>PREVIEW</span>
        {previewUrl && (
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            title="Refresh preview"
            style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13, lineHeight: 1 }}
          >⟳</button>
        )}
        <div style={{ flex: 1 }} />
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 11, color: "#6366f1", textDecoration: "none",
            padding: "2px 8px", background: "#6366f110", border: "1px solid #6366f130", borderRadius: 5,
          }}>↗ Open</a>
        )}
        {deployment && (
          <div style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "#22c55e10", color: "#22c55e", border: "1px solid #22c55e20", marginLeft: 4 }}>
            v{deployment.version}
          </div>
        )}
      </div>

      {/* Preview iframe */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {previewUrl ? (
          <iframe
            key={`${previewUrl}-${refreshKey}`}
            src={previewUrl}
            style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title="Live Preview"
          />
        ) : (
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", color: "#374151", gap: 12,
          }}>
            <span style={{ fontSize: 40, opacity: 0.4 }}>🌐</span>
            <span style={{ fontSize: 13, color: "#374151" }}>Preview will appear here</span>
            <span style={{ fontSize: 11, color: "#2d3149", textAlign: "center", maxWidth: 200 }}>
              Click ▶ Run for HTML, or 🚀 Deploy for a live URL
            </span>
          </div>
        )}
      </div>

      {/* Deployment info */}
      {deployment && (
        <div style={{
          padding: "6px 10px", borderTop: "1px solid #1a1d2e",
          background: "#08091180", flexShrink: 0,
        }}>
          <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>DEPLOYED URL</div>
          <div style={{ fontSize: 10, color: "#6366f1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {deployment.url}
          </div>
        </div>
      )}
    </div>
  );
}

// ══ MINI MARKDOWN ═════════════════════════════════════════════════════════════

function MiniMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`\n]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i} style={{ color: "#c7d2fe" }}>{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return <code key={i} style={{ background: "#1a1d2e", color: "#06b6d4", padding: "1px 4px", borderRadius: 3, fontFamily: "monospace", fontSize: "0.88em" }}>{p.slice(1, -1)}</code>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
