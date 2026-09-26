/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX RUNTIME ENGINE — Multi-Language Code Execution API                ║
 * ║  JavaScript (vm sandbox) · Python (child_process) · HTML (client-side) ║
 * ║  WebSocket streaming · Project/File persistence via DevOS tables        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router, type IRouter } from "express";
import { spawn }                from "node:child_process";
import { db, devosProjectsTable, devosFilesTable, devosLogsTable } from "@workspace/db";
import { eq, desc, and }        from "drizzle-orm";
import type { Server as SocketIOServer, Socket } from "socket.io";
import { logger }               from "../lib/logger";
import {
  runJavaScriptIsolated, runPythonIsolated, pythonExecutionEnabled, PYTHON_DISABLED_MESSAGE,
} from "../lib/codeSandbox";
import { requireUser, resolveUserId } from "../shared/middleware/requireAuth";
import { codeExecLimiter } from "../shared/middleware/rateLimiter";

const router: IRouter = Router();

// ── Constants ──────────────────────────────────────────────────────────────────
const JS_TIMEOUT_MS  = 8_000;
const PY_TIMEOUT_MS  = 10_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RuntimeResult {
  success:    boolean;
  language:   string;
  stdout:     string;
  stderr:     string;
  error?:     string;
  durationMs: number;
  exitCode:   number;
}

interface LogLine { type: "stdout" | "stderr" | "info" | "error"; text: string; ts: number }

// ── JavaScript execution (isolated child process) ─────────────────────────────

async function runJavaScript(
  code: string,
  onLine?: (line: LogLine) => void,
): Promise<RuntimeResult> {
  const start = Date.now();
  const lines: LogLine[] = [];

  const emit = (type: LogLine["type"], text: string) => {
    const l: LogLine = { type, text, ts: Date.now() - start };
    lines.push(l);
    onLine?.(l);
  };
  const joined = (type: LogLine["type"]) => lines.filter(l => l.type === type).map(l => l.text).join("\n");

  emit("info", "▶ Running JavaScript…");
  const run = await runJavaScriptIsolated(code, {
    timeoutMs: JS_TIMEOUT_MS,
    onLine: (line) => {
      if (line.type === "result") return;
      emit(line.type === "error" ? "stderr" : "stdout", line.text);
    },
  });

  if (!run.ok) {
    const msg = run.error ?? "Execution failed";
    emit("error", msg);
    return {
      success: false, language: "javascript",
      stdout: joined("stdout"), stderr: joined("stderr"),
      error: msg, durationMs: Date.now() - start, exitCode: run.exitCode || 1,
    };
  }

  emit("info", `✓ Done in ${Date.now() - start}ms`);
  return { success: true, language: "javascript", stdout: joined("stdout"), stderr: joined("stderr"), durationMs: Date.now() - start, exitCode: 0 };
}

// ── Python execution (child_process) ──────────────────────────────────────────

const PYTHON_BINS = ["python3", "python", "/usr/bin/python3", "/usr/local/bin/python3"];

async function findPython(): Promise<string | null> {
  for (const bin of PYTHON_BINS) {
    try {
      await new Promise<void>((res, rej) => {
        const p = spawn(bin, ["--version"], { timeout: 2000 });
        p.on("close", c => c === 0 ? res() : rej());
        p.on("error", rej);
      });
      return bin;
    } catch { /**/ }
  }
  return null;
}

async function runPython(
  code: string,
  onLine?: (line: LogLine) => void,
): Promise<RuntimeResult> {
  const start = Date.now();
  const lines: LogLine[] = [];
  const emit = (type: LogLine["type"], text: string) => {
    const l: LogLine = { type, text, ts: Date.now() - start };
    lines.push(l);
    onLine?.(l);
  };

  if (!pythonExecutionEnabled()) {
    emit("error", PYTHON_DISABLED_MESSAGE);
    return { success: false, language: "python", stdout: "", stderr: PYTHON_DISABLED_MESSAGE, error: PYTHON_DISABLED_MESSAGE, durationMs: 0, exitCode: 1 };
  }

  const pythonBin = await findPython();
  if (!pythonBin) {
    const msg = "Python 3 is not available in this environment.";
    emit("error", msg);
    return { success: false, language: "python", stdout: "", stderr: msg, error: msg, durationMs: Date.now() - start, exitCode: 1 };
  }

  emit("info", `▶ Running Python (${pythonBin})…`);

  const run = await runPythonIsolated(pythonBin, code, {
    timeoutMs: PY_TIMEOUT_MS,
    onStdout: (text) => text.split("\n").filter(Boolean).forEach(line => emit("stdout", line)),
    onStderr: (text) => text.split("\n").filter(Boolean).forEach(line => emit("stderr", line)),
  });

  if (run.timedOut) {
    const msg = `Execution timed out after ${PY_TIMEOUT_MS}ms`;
    emit("error", msg);
    return { success: false, language: "python", stdout: run.stdout, stderr: run.stderr + "\n" + msg, error: msg, durationMs: run.durationMs, exitCode: 124 };
  }
  emit("info", `✓ Done in ${run.durationMs}ms · exit ${run.exitCode}`);
  return {
    success: run.exitCode === 0, language: "python", stdout: run.stdout, stderr: run.stderr,
    error: run.exitCode !== 0 ? run.stderr || "Process exited with code " + String(run.exitCode) : undefined,
    durationMs: run.durationMs, exitCode: run.exitCode,
  };
}

// ── Dispatch by language ──────────────────────────────────────────────────────

async function runCode(
  code: string,
  language: string,
  onLine?: (line: LogLine) => void,
): Promise<RuntimeResult> {
  switch (language.toLowerCase()) {
    case "javascript":
    case "js":
    case "typescript":
    case "ts":
      return runJavaScript(code, onLine);
    case "python":
    case "py":
      return runPython(code, onLine);
    case "html":
    case "css":
      // HTML/CSS executes client-side — server just echoes it back
      onLine?.({ type: "info", text: "▶ HTML preview rendered in browser.", ts: 0 });
      return { success: true, language: "html", stdout: code, stderr: "", durationMs: 0, exitCode: 0 };
    default:
      return { success: false, language, stdout: "", stderr: "", error: `Unsupported language: ${language}`, durationMs: 0, exitCode: 1 };
  }
}

// ── REST Endpoint ─────────────────────────────────────────────────────────────

// POST /api/runtime/execute
router.post("/runtime/execute", requireUser, codeExecLimiter, async (req, res): Promise<void> => {
  const { code, language = "javascript", projectId, fileId } = req.body as {
    code?: string; language?: string; projectId?: number; fileId?: number;
  };

  if (!code?.trim()) { res.status(400).json({ error: "code required" }); return; }

  try {
    const result = await runCode(code, language);

    // Persist log
    if (projectId) {
      await db.insert(devosLogsTable).values({
        projectId,
        fileId:    fileId ?? null,
        type:      result.success ? "stdout" : "error",
        message:   result.success ? `✓ ${language} OK in ${result.durationMs}ms` : `✗ ${result.error?.slice(0, 200)}`,
        durationMs: result.durationMs,
        exitCode:  result.exitCode,
      });
    }

    res.json(result);
  } catch (err) {
    logger.error({ err }, "[Runtime] execute error");
    res.status(500).json({ error: "Execution engine failed" });
  }
});

// GET /api/runtime/projects — list all projects for this session
router.get("/runtime/projects", async (req, res): Promise<void> => {
  try {
    const sessionId = req.headers["x-session-id"] as string || "runtime-default";
    const projects  = await db.select().from(devosProjectsTable)
      .where(eq(devosProjectsTable.sessionId, sessionId))
      .orderBy(desc(devosProjectsTable.updatedAt));
    res.json({ projects });
  } catch (err) {
    logger.error({ err }, "[Runtime] list projects");
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// POST /api/runtime/projects — create project
router.post("/runtime/projects", async (req, res): Promise<void> => {
  try {
    const sessionId  = req.headers["x-session-id"] as string || "runtime-default";
    const { name = "New Project", description = "", language = "javascript" } = req.body as {
      name?: string; description?: string; language?: string;
    };

    const [project] = await db.insert(devosProjectsTable)
      .values({ name, description, sessionId, language })
      .returning();

    // Seed starter file
    const starters: Record<string, { path: string; content: string; language: string }> = {
      javascript: {
        path:     "index.js",
        language: "javascript",
        content: `// Welcome to ${name} — Apex Runtime Engine\n\nconst greet = (name) => \`Hello, \${name}!\`;\nconsole.log(greet("World"));\n\n// Arrays and objects\nconst nums = [1, 2, 3, 4, 5];\nconsole.log("Sum:", nums.reduce((a, b) => a + b, 0));\n\n// Async/await works too\nconst wait = (ms) => new Promise(r => setTimeout(r, ms));\nawait wait(10);\nconsole.log("Async done!");\n`,
      },
      python: {
        path:     "main.py",
        language: "python",
        content: `# Welcome to ${name} — Apex Runtime Engine\n\ndef greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("World"))\n\n# Lists and comprehensions\nnums = [1, 2, 3, 4, 5]\nprint("Sum:", sum(nums))\nprint("Squares:", [x**2 for x in nums])\n`,
      },
      html: {
        path:     "index.html",
        language: "html",
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${name}</title>\n  <style>\n    body {\n      font-family: -apple-system, sans-serif;\n      background: #0a0b14;\n      color: #fff;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      min-height: 100vh;\n      margin: 0;\n    }\n    h1 { background: linear-gradient(135deg, #7c5ce7, #a29bfe); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }\n  </style>\n</head>\n<body>\n  <div>\n    <h1>Hello from ${name}!</h1>\n    <p>Edit this HTML and click Run to see it rendered live.</p>\n  </div>\n  <script>\n    console.log("Page loaded!");\n  </script>\n</body>\n</html>\n`,
      },
    };

    const starter = starters[language] ?? starters["javascript"]!;
    await db.insert(devosFilesTable).values({ projectId: project!.id, ...starter });

    res.json({ project });
  } catch (err) {
    logger.error({ err }, "[Runtime] create project");
    res.status(500).json({ error: "Failed to create project" });
  }
});

// DELETE /api/runtime/projects/:id
router.delete("/runtime/projects/:id", async (req, res): Promise<void> => {
  try {
    const id        = parseInt(req.params["id"]!);
    const sessionId = req.headers["x-session-id"] as string || "runtime-default";
    const [proj]    = await db.select().from(devosProjectsTable)
      .where(and(eq(devosProjectsTable.id, id), eq(devosProjectsTable.sessionId, sessionId)))
      .limit(1);
    if (!proj) { res.status(404).json({ error: "Not found" }); return; }
    await db.delete(devosFilesTable).where(eq(devosFilesTable.projectId, id));
    await db.delete(devosLogsTable).where(eq(devosLogsTable.projectId, id));
    await db.delete(devosProjectsTable).where(eq(devosProjectsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// GET /api/runtime/projects/:id/files
router.get("/runtime/projects/:id/files", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params["id"]!);
    const files = await db.select().from(devosFilesTable)
      .where(eq(devosFilesTable.projectId, projectId))
      .orderBy(devosFilesTable.path);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: "Failed to list files" });
  }
});

// POST /api/runtime/projects/:id/files
router.post("/runtime/projects/:id/files", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params["id"]!);
    const { path, content = "", language = "javascript" } = req.body as { path?: string; content?: string; language?: string };
    if (!path?.trim()) { res.status(400).json({ error: "path required" }); return; }
    const [file] = await db.insert(devosFilesTable)
      .values({ projectId, path: path.trim(), content, language })
      .returning();
    await db.update(devosProjectsTable).set({ updatedAt: new Date() }).where(eq(devosProjectsTable.id, projectId));
    res.json({ file });
  } catch (err) {
    res.status(500).json({ error: "Failed to create file" });
  }
});

// PUT /api/runtime/projects/:id/files/:fileId
router.put("/runtime/projects/:id/files/:fileId", async (req, res): Promise<void> => {
  try {
    const fileId = parseInt(req.params["fileId"]!);
    const { content, path } = req.body as { content?: string; path?: string };
    const upd: Record<string, unknown> = { updatedAt: new Date() };
    if (content !== undefined) upd["content"] = content;
    if (path !== undefined)    upd["path"]    = path;
    const [file] = await db.update(devosFilesTable).set(upd).where(eq(devosFilesTable.id, fileId)).returning();
    res.json({ file });
  } catch (err) {
    res.status(500).json({ error: "Failed to update file" });
  }
});

// DELETE /api/runtime/projects/:id/files/:fileId
router.delete("/runtime/projects/:id/files/:fileId", async (req, res): Promise<void> => {
  try {
    const fileId = parseInt(req.params["fileId"]!);
    await db.delete(devosFilesTable).where(eq(devosFilesTable.id, fileId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// GET /api/runtime/projects/:id/logs
router.get("/runtime/projects/:id/logs", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params["id"]!);
    const limit     = Math.min(Number(req.query["limit"]) || 50, 100);
    const logs = await db.select().from(devosLogsTable)
      .where(eq(devosLogsTable.projectId, projectId))
      .orderBy(desc(devosLogsTable.createdAt))
      .limit(limit);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: "Failed to load logs" });
  }
});

// ── WebSocket streaming setup ─────────────────────────────────────────────────

export function setupRuntimeSockets(io: SocketIOServer): void {
  const ns = io.of("/runtime");

  // Only signed-in users may run code over the socket
  ns.use(async (socket, next) => {
    const auth = socket.handshake.auth as { token?: string; sessionId?: string };
    const userId = await resolveUserId({
      token: auth.token,
      sessionId: auth.sessionId ?? (socket.handshake.headers["x-session-id"] as string | undefined),
    });
    if (!userId) { next(new Error("Please sign in to run code.")); return; }
    socket.data.userId = userId;
    next();
  });

  ns.on("connection", (socket: Socket) => {
    logger.info({ id: socket.id }, "[Runtime] client connected");

    // Client sends: { code, language, projectId?, fileId? }
    let running = false;
    socket.on("run", async (payload: { code: string; language: string; projectId?: number; fileId?: number }) => {
      const { code, language = "javascript", projectId, fileId } = payload ?? {};

      if (!code?.trim()) {
        socket.emit("error", { message: "code required" });
        return;
      }
      if (running) {
        socket.emit("error", { message: "A run is already in progress" });
        return;
      }
      running = true;

      socket.emit("run:start", { language, ts: Date.now() });

      const lines: LogLine[] = [];

      const result = await runCode(code, language, (line) => {
        lines.push(line);
        socket.emit("run:line", line);
      }).finally(() => { running = false; });

      socket.emit("run:done", result);

      // Persist log
      if (projectId) {
        try {
          await db.insert(devosLogsTable).values({
            projectId,
            fileId:    fileId ?? null,
            type:      result.success ? "stdout" : "error",
            message:   result.success ? `✓ ${language} OK in ${result.durationMs}ms` : `✗ ${result.error?.slice(0, 200)}`,
            durationMs: result.durationMs,
            exitCode:  result.exitCode,
          });
        } catch (e) {
          logger.warn({ e }, "[Runtime] failed to persist log");
        }
      }
    });

    socket.on("disconnect", () => {
      logger.info({ id: socket.id }, "[Runtime] client disconnected");
    });
  });

  logger.info("[Runtime] WebSocket namespace /runtime ready");
}

export default router;
