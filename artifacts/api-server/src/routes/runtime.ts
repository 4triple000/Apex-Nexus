/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX RUNTIME ENGINE — Multi-Language Code Execution API                ║
 * ║  JavaScript (vm sandbox) · Python (child_process) · HTML (client-side) ║
 * ║  WebSocket streaming · Project/File persistence via DevOS tables        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router, type IRouter } from "express";
import { spawn }                from "node:child_process";
import vm                       from "node:vm";
import { db, devosProjectsTable, devosFilesTable, devosLogsTable } from "@workspace/db";
import { eq, desc, and }        from "drizzle-orm";
import type { Server as SocketIOServer, Socket } from "socket.io";
import { logger }               from "../lib/logger";

const router: IRouter = Router();

// ── Constants ──────────────────────────────────────────────────────────────────
const JS_TIMEOUT_MS  = 8_000;
const PY_TIMEOUT_MS  = 10_000;
const MAX_OUTPUT     = 50_000; // chars

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

// ── JavaScript execution (Node vm sandbox) ────────────────────────────────────

const JS_BLOCKED = [
  "process","require","module","exports","__dirname","__filename",
  "global","globalThis","eval","Function","fetch","XMLHttpRequest",
  "WebSocket","Worker","setTimeout","setInterval","clearTimeout",
  "clearInterval","setImmediate","clearImmediate","queueMicrotask",
];

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

  const makeLogger = (type: string) =>
    (...args: unknown[]) => {
      const msg = args.map(a => {
        if (a === null || a === undefined) return String(a);
        try { return typeof a === "object" ? JSON.stringify(a, null, 2) : String(a); }
        catch { return String(a); }
      }).join(" ");
      emit(type === "error" ? "stderr" : "stdout", msg);
    };

  const sandbox: Record<string, unknown> = {
    console: {
      log:   makeLogger("log"),
      error: makeLogger("error"),
      warn:  makeLogger("warn"),
      info:  makeLogger("info"),
      debug: makeLogger("debug"),
      table: (d: unknown) => makeLogger("log")(JSON.stringify(d, null, 2)),
    },
    JSON, Math, Array, Object, String, Number, Boolean, BigInt,
    parseInt, parseFloat, isNaN, isFinite, Promise, Map, Set,
    WeakMap, WeakSet, Symbol, Error, TypeError, RangeError,
    SyntaxError, ReferenceError, RegExp, Date, Infinity, NaN,
    undefined,
    ...Object.fromEntries(JS_BLOCKED.map(k => [k, undefined])),
  };

  vm.createContext(sandbox);

  try {
    const wrapped = `(async () => {\n${code}\n})()`;
    const script  = new vm.Script(wrapped, {
      filename: "apex-runtime.js",
      timeout:  JS_TIMEOUT_MS,
    });

    emit("info", "▶ Running JavaScript…");
    const result = script.runInContext(sandbox, { timeout: JS_TIMEOUT_MS });

    if (result && typeof (result as Promise<unknown>).then === "function") {
      await Promise.race([
        result as Promise<unknown>,
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error(`Timed out after ${JS_TIMEOUT_MS}ms`)), JS_TIMEOUT_MS)
        ),
      ]);
    }

    const stdout = lines.filter(l => l.type === "stdout").map(l => l.text).join("\n");
    const stderr = lines.filter(l => l.type === "stderr").map(l => l.text).join("\n");
    emit("info", `✓ Done in ${Date.now() - start}ms`);

    return { success: true, language: "javascript", stdout, stderr, durationMs: Date.now() - start, exitCode: 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit("error", msg);
    return {
      success: false, language: "javascript",
      stdout: lines.filter(l => l.type === "stdout").map(l => l.text).join("\n"),
      stderr: lines.filter(l => l.type === "stderr").map(l => l.text).join("\n"),
      error: msg, durationMs: Date.now() - start, exitCode: 1,
    };
  }
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

  const pythonBin = await findPython();
  if (!pythonBin) {
    const msg = "Python 3 is not available in this environment.";
    emit("error", msg);
    return { success: false, language: "python", stdout: "", stderr: msg, error: msg, durationMs: Date.now() - start, exitCode: 1 };
  }

  emit("info", `▶ Running Python (${pythonBin})…`);

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn(pythonBin, ["-c", code], {
      timeout:   PY_TIMEOUT_MS,
      env:       { PATH: "/usr/bin:/usr/local/bin:/bin", HOME: "/tmp", PYTHONDONTWRITEBYTECODE: "1" },
      cwd:       "/tmp",
    });

    const watchdog = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, PY_TIMEOUT_MS);

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString().slice(0, MAX_OUTPUT - stdout.length);
      stdout += text;
      text.split("\n").filter(Boolean).forEach(line => emit("stdout", line));
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString().slice(0, MAX_OUTPUT - stderr.length);
      stderr += text;
      text.split("\n").filter(Boolean).forEach(line => emit("stderr", line));
    });

    proc.on("close", (code) => {
      clearTimeout(watchdog);
      const dur = Date.now() - start;
      if (timedOut) {
        const msg = `Execution timed out after ${PY_TIMEOUT_MS}ms`;
        emit("error", msg);
        resolve({ success: false, language: "python", stdout, stderr: stderr + "\n" + msg, error: msg, durationMs: dur, exitCode: 124 });
      } else {
        emit("info", `✓ Done in ${dur}ms · exit ${code}`);
        resolve({ success: code === 0, language: "python", stdout, stderr, error: code !== 0 ? stderr || "Process exited with code " + String(code) : undefined, durationMs: dur, exitCode: code ?? 0 });
      }
    });
    proc.on("error", (err) => {
      clearTimeout(watchdog);
      emit("error", err.message);
      resolve({ success: false, language: "python", stdout, stderr, error: err.message, durationMs: Date.now() - start, exitCode: 1 });
    });
  });
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
router.post("/runtime/execute", async (req, res): Promise<void> => {
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

  ns.on("connection", (socket: Socket) => {
    logger.info({ id: socket.id }, "[Runtime] client connected");

    // Client sends: { code, language, projectId?, fileId? }
    socket.on("run", async (payload: { code: string; language: string; projectId?: number; fileId?: number }) => {
      const { code, language = "javascript", projectId, fileId } = payload;

      if (!code?.trim()) {
        socket.emit("error", { message: "code required" });
        return;
      }

      socket.emit("run:start", { language, ts: Date.now() });

      const lines: LogLine[] = [];

      const result = await runCode(code, language, (line) => {
        lines.push(line);
        socket.emit("run:line", line);
      });

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
