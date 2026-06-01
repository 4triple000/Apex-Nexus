/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX DEV OS — Internal Development Environment API                     ║
 * ║  Projects, Files, Code Execution, AI Modifier, Logs                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router, type IRouter } from "express";
import { db, devosProjectsTable, devosFilesTable, devosLogsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import vm from "vm";

const router: IRouter = Router();

// ── Execution timeout (ms) ────────────────────────────────────────────────────
const EXEC_TIMEOUT_MS = 6000;

// ─────────────────────────────────────────────────────────────────────────────
// SANDBOX CODE EXECUTION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

interface LogEntry { type: string; message: string; timeMs: number }
interface ExecResult {
  success:    boolean;
  result?:    string;
  error?:     string;
  logs:       LogEntry[];
  durationMs: number;
}

// Blocked dangerous built-ins
const BLOCKED = [
  "process", "require", "module", "exports", "__dirname", "__filename",
  "global", "globalThis", "eval", "Function", "fetch",
  "XMLHttpRequest", "WebSocket", "Worker",
  "setTimeout", "setInterval", "clearTimeout", "clearInterval",
  "setImmediate", "clearImmediate", "queueMicrotask",
];

async function executeSandbox(code: string): Promise<ExecResult> {
  const logs: LogEntry[] = [];
  const startTime        = Date.now();

  const makeLogger = (type: string) =>
    (...args: unknown[]) => {
      const message = args
        .map(a => {
          if (a === null)      return "null";
          if (a === undefined) return "undefined";
          try { return typeof a === "object" ? JSON.stringify(a, null, 2) : String(a); }
          catch { return String(a); }
        })
        .join(" ");
      logs.push({ type, message, timeMs: Date.now() - startTime });
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
    // Safe globals
    JSON,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    BigInt,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Promise,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    ReferenceError,
    RegExp,
    Date,
    Infinity,
    NaN,
    undefined,
    // Block everything dangerous
    ...Object.fromEntries(BLOCKED.map(k => [k, undefined])),
  };

  vm.createContext(sandbox);

  try {
    // Wrap in async IIFE so users can use await at top level
    const wrapped = `(async () => {\n${code}\n})()`;
    const script  = new vm.Script(wrapped, {
      filename: "apex-sandbox.js",
      timeout:  EXEC_TIMEOUT_MS,
    });

    const result = script.runInContext(sandbox, { timeout: EXEC_TIMEOUT_MS });
    let finalResult: unknown = undefined;

    if (result && typeof (result as Promise<unknown>).then === "function") {
      finalResult = await Promise.race([
        result as Promise<unknown>,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Execution timed out after ${EXEC_TIMEOUT_MS}ms`)), EXEC_TIMEOUT_MS)
        ),
      ]);
    } else {
      finalResult = result;
    }

    return {
      success:    true,
      result:     finalResult !== undefined ? String(finalResult) : undefined,
      logs,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success:    false,
      error:      err instanceof Error ? err.message : String(err),
      logs,
      durationMs: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/devos/projects
router.get("/devos/projects", async (req, res): Promise<void> => {
  try {
    const sessionId = req.headers["x-session-id"] as string || "default";
    const projects  = await db
      .select()
      .from(devosProjectsTable)
      .where(eq(devosProjectsTable.sessionId, sessionId))
      .orderBy(desc(devosProjectsTable.updatedAt));
    res.json({ projects });
  } catch (err) {
    console.error("[DevOS] List projects error:", err);
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// POST /api/devos/projects
router.post("/devos/projects", async (req, res): Promise<void> => {
  try {
    const sessionId   = req.headers["x-session-id"] as string || "default";
    const { name = "My Project", description = "", language = "javascript" } = req.body as {
      name?: string; description?: string; language?: string;
    };

    const [project] = await db
      .insert(devosProjectsTable)
      .values({ name, description, sessionId, language })
      .returning();

    // Seed with a starter file
    const starterContent = language === "javascript"
      ? `// Welcome to ${name}\n// Apex Dev OS — JavaScript Runtime\n\nconsole.log("Hello from ${name}!");\n\nconst add = (a, b) => a + b;\nconsole.log("2 + 3 =", add(2, 3));\n\n// Try await at top-level\nconst result = await Promise.resolve("async works too!");\nconsole.log(result);\n`
      : `// ${name}\nconsole.log("Hello, World!");\n`;

    await db.insert(devosFilesTable).values({
      projectId: project!.id,
      path:      "index.js",
      content:   starterContent,
      language:  "javascript",
    });

    res.json({ project });
  } catch (err) {
    console.error("[DevOS] Create project error:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// DELETE /api/devos/projects/:id
router.delete("/devos/projects/:id", async (req, res): Promise<void> => {
  try {
    const id        = parseInt(req.params["id"]!);
    const sessionId = req.headers["x-session-id"] as string || "default";

    // Verify ownership
    const [proj] = await db.select().from(devosProjectsTable)
      .where(and(eq(devosProjectsTable.id, id), eq(devosProjectsTable.sessionId, sessionId))).limit(1);
    if (!proj) { res.status(404).json({ error: "Project not found" }); return; }

    await db.delete(devosFilesTable).where(eq(devosFilesTable.projectId, id));
    await db.delete(devosLogsTable).where(eq(devosLogsTable.projectId, id));
    await db.delete(devosProjectsTable).where(eq(devosProjectsTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    console.error("[DevOS] Delete project error:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FILES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/devos/projects/:id/files
router.get("/devos/projects/:id/files", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params["id"]!);
    const files = await db
      .select()
      .from(devosFilesTable)
      .where(eq(devosFilesTable.projectId, projectId))
      .orderBy(devosFilesTable.path);
    res.json({ files });
  } catch (err) {
    console.error("[DevOS] List files error:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
});

// POST /api/devos/projects/:id/files
router.post("/devos/projects/:id/files", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params["id"]!);
    const { path, content = "", language = "javascript" } = req.body as {
      path?: string; content?: string; language?: string;
    };
    if (!path?.trim()) { res.status(400).json({ error: "path required" }); return; }

    const [file] = await db
      .insert(devosFilesTable)
      .values({ projectId, path: path.trim(), content, language })
      .returning();

    // Update project updatedAt
    await db.update(devosProjectsTable)
      .set({ updatedAt: new Date() })
      .where(eq(devosProjectsTable.id, projectId));

    res.json({ file });
  } catch (err) {
    console.error("[DevOS] Create file error:", err);
    res.status(500).json({ error: "Failed to create file" });
  }
});

// PUT /api/devos/projects/:id/files/:fileId
router.put("/devos/projects/:id/files/:fileId", async (req, res): Promise<void> => {
  try {
    const fileId = parseInt(req.params["fileId"]!);
    const { content, path } = req.body as { content?: string; path?: string };

    const updateData: Partial<{ content: string; path: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (content !== undefined) updateData.content = content;
    if (path !== undefined)    updateData.path    = path;

    const [file] = await db
      .update(devosFilesTable)
      .set(updateData)
      .where(eq(devosFilesTable.id, fileId))
      .returning();

    res.json({ file });
  } catch (err) {
    console.error("[DevOS] Update file error:", err);
    res.status(500).json({ error: "Failed to update file" });
  }
});

// DELETE /api/devos/projects/:id/files/:fileId
router.delete("/devos/projects/:id/files/:fileId", async (req, res): Promise<void> => {
  try {
    const fileId = parseInt(req.params["fileId"]!);
    await db.delete(devosFilesTable).where(eq(devosFilesTable.id, fileId));
    res.json({ ok: true });
  } catch (err) {
    console.error("[DevOS] Delete file error:", err);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CODE EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/devos/execute
router.post("/devos/execute", async (req, res): Promise<void> => {
  try {
    const { code, projectId, fileId } = req.body as {
      code?: string; projectId?: number; fileId?: number;
    };
    if (!code?.trim()) { res.status(400).json({ error: "code required" }); return; }

    console.log(`[DevOS] Executing code (${code.length} chars)…`);
    const result = await executeSandbox(code);

    // Persist log
    if (projectId) {
      const summary = result.success
        ? `✓ OK in ${result.durationMs}ms${result.result ? ` → ${result.result.slice(0, 100)}` : ""}`
        : `✗ ${result.error?.slice(0, 200)}`;

      await db.insert(devosLogsTable).values({
        projectId,
        fileId:    fileId ?? null,
        type:      result.success ? "stdout" : "error",
        message:   summary,
        durationMs: result.durationMs,
        exitCode:  result.success ? 0 : 1,
        metadata:  { logs: result.logs.slice(0, 50) },
      });
    }

    res.json(result);
  } catch (err) {
    console.error("[DevOS] Execute error:", err);
    res.status(500).json({ error: "Execution engine failed" });
  }
});

// POST /api/devos/validate  — syntax check only (no run)
router.post("/devos/validate", async (req, res): Promise<void> => {
  try {
    const { code } = req.body as { code?: string };
    if (!code?.trim()) { res.status(400).json({ error: "code required" }); return; }

    try {
      new vm.Script(code, { filename: "apex-validate.js" });
      res.json({ valid: true, errors: [] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.json({ valid: false, errors: [msg] });
    }
  } catch (err) {
    res.status(500).json({ error: "Validation failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI CODE MODIFIER
// ─────────────────────────────────────────────────────────────────────────────

const AI_CODE_SYSTEM = `You are Apex AI, an expert JavaScript developer embedded in an internal development environment.
You will receive a file's current code and a natural-language instruction.
Your job is to modify the code according to the instruction.

Rules:
- Return ONLY the modified code — no markdown fences, no explanation, no commentary
- Preserve the exact coding style and structure where possible
- Only change what is necessary to fulfill the instruction
- Keep all existing functionality unless explicitly told to remove it
- Add useful console.log statements to show results
- Code must be valid, runnable JavaScript
- Support async/await at top level (the runtime wraps everything in an async IIFE)
- Do not use require(), import, fetch, process, or any Node.js/browser globals
- Math, JSON, Date, Array, Object, Promise, Map, Set, Error are all available`;

// POST /api/devos/projects/:id/ai-modify
router.post("/devos/projects/:id/ai-modify", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params["id"]!);
    const { fileId, instruction, currentCode } = req.body as {
      fileId?: number; instruction?: string; currentCode?: string;
    };

    if (!instruction?.trim() || currentCode === undefined) {
      res.status(400).json({ error: "instruction and currentCode required" });
      return;
    }

    const userMessage = `Current code:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nInstruction: "${instruction.trim()}"`;

    const response = await openai.chat.completions.create({
      model:                "gpt-5-mini",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: AI_CODE_SYSTEM },
        { role: "user",   content: userMessage    },
      ],
    });

    const raw     = response.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw
      .replace(/^```(?:javascript|js|ts|typescript)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Log the AI modification
    await db.insert(devosLogsTable).values({
      projectId,
      fileId:  fileId ?? null,
      type:    "ai",
      message: `AI modified code: "${instruction.trim().slice(0, 80)}"`,
      exitCode: 0,
    });

    // Optionally auto-save to file
    if (fileId) {
      await db.update(devosFilesTable)
        .set({ content: cleaned, updatedAt: new Date() })
        .where(eq(devosFilesTable.id, fileId));
    }

    res.json({ code: cleaned });
  } catch (err) {
    console.error("[DevOS] AI modify error:", err);
    res.status(500).json({ error: "AI modification failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI CODE GENERATE (new file from prompt)
// ─────────────────────────────────────────────────────────────────────────────

const AI_GEN_SYSTEM = `You are Apex AI, an expert JavaScript developer.
Generate clean, runnable JavaScript code from a natural-language description.

Rules:
- Return ONLY the code — no markdown fences, no explanation
- Use console.log extensively to show results
- Support async/await at top level
- Available: Math, JSON, Date, Array, Object, Promise, Map, Set, console
- NOT available: require, import, fetch, process, setTimeout, setInterval
- Code should be self-contained and demonstrate the concept fully
- Add helpful comments explaining what each section does`;

// POST /api/devos/generate
router.post("/devos/generate", async (req, res): Promise<void> => {
  try {
    const { prompt, projectId } = req.body as { prompt?: string; projectId?: number };
    if (!prompt?.trim()) { res.status(400).json({ error: "prompt required" }); return; }

    const response = await openai.chat.completions.create({
      model:                "gpt-5-mini",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: AI_GEN_SYSTEM },
        { role: "user",   content: prompt.trim() },
      ],
    });

    const raw     = response.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw
      .replace(/^```(?:javascript|js)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    if (projectId) {
      await db.insert(devosLogsTable).values({
        projectId,
        type:    "ai",
        message: `Generated code from: "${prompt.trim().slice(0, 80)}"`,
        exitCode: 0,
      });
    }

    res.json({ code: cleaned });
  } catch (err) {
    console.error("[DevOS] AI generate error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BUILD + TEST PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/devos/pipeline  — run edit → validate → test → report
router.post("/devos/pipeline", async (req, res): Promise<void> => {
  try {
    const { code, projectId, fileId, testCode } = req.body as {
      code?: string; projectId?: number; fileId?: number; testCode?: string;
    };
    if (!code?.trim()) { res.status(400).json({ error: "code required" }); return; }

    const stages: { stage: string; status: string; output?: string; durationMs?: number }[] = [];

    // Stage 1: Validate syntax
    const t1 = Date.now();
    let valid = true;
    let syntaxError = "";
    try {
      new vm.Script(code, { filename: "pipeline-validate.js" });
    } catch (err) {
      valid       = false;
      syntaxError = err instanceof Error ? err.message : String(err);
    }
    stages.push({
      stage:     "validate",
      status:    valid ? "pass" : "fail",
      output:    valid ? "Syntax OK" : syntaxError,
      durationMs: Date.now() - t1,
    });

    // Stage 2: Run in sandbox
    const t2  = Date.now();
    const execResult = valid ? await executeSandbox(code) : null;
    if (execResult) {
      stages.push({
        stage:     "execute",
        status:    execResult.success ? "pass" : "fail",
        output:    execResult.error ?? execResult.logs.map(l => l.message).join("\n"),
        durationMs: execResult.durationMs,
      });
    }

    // Stage 3: Run tests if provided
    if (testCode?.trim() && valid && execResult?.success) {
      const t3 = Date.now();
      const testResult = await executeSandbox(`${code}\n\n// Tests:\n${testCode}`);
      stages.push({
        stage:     "test",
        status:    testResult.success ? "pass" : "fail",
        output:    testResult.error ?? testResult.logs.map(l => l.message).join("\n"),
        durationMs: testResult.durationMs,
      });
    }

    // Stage 4: Deploy (= persist to file in DB)
    if (fileId && valid && (execResult?.success ?? false)) {
      await db.update(devosFilesTable)
        .set({ content: code, updatedAt: new Date() })
        .where(eq(devosFilesTable.id, fileId));
      stages.push({ stage: "deploy", status: "pass", output: "File saved to project" });
    }

    const allPassed = stages.every(s => s.status === "pass");

    // Persist pipeline log
    if (projectId) {
      await db.insert(devosLogsTable).values({
        projectId,
        fileId:  fileId ?? null,
        type:    "build",
        message: `Pipeline ${allPassed ? "PASSED" : "FAILED"} — ${stages.length} stages`,
        exitCode: allPassed ? 0 : 1,
        metadata: { stages },
      });
    }

    res.json({ passed: allPassed, stages });
  } catch (err) {
    console.error("[DevOS] Pipeline error:", err);
    res.status(500).json({ error: "Pipeline failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/devos/projects/:id/logs
router.get("/devos/projects/:id/logs", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params["id"]!);
    const limit     = Math.min(Number(req.query.limit) || 50, 200);
    const logs = await db
      .select()
      .from(devosLogsTable)
      .where(eq(devosLogsTable.projectId, projectId))
      .orderBy(desc(devosLogsTable.createdAt))
      .limit(limit);
    res.json({ logs });
  } catch (err) {
    console.error("[DevOS] Get logs error:", err);
    res.status(500).json({ error: "Failed to get logs" });
  }
});

// DELETE /api/devos/projects/:id/logs
router.delete("/devos/projects/:id/logs", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params["id"]!);
    await db.delete(devosLogsTable).where(eq(devosLogsTable.projectId, projectId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear logs" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GAME ENGINE HOOK
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/devos/engine-hook  — run code in game engine context
router.post("/devos/engine-hook", async (req, res): Promise<void> => {
  try {
    const { code, gameConfig } = req.body as { code?: string; gameConfig?: object };
    if (!code?.trim()) { res.status(400).json({ error: "code required" }); return; }

    // Execute with game config in scope
    const wrappedCode = gameConfig
      ? `const gameConfig = ${JSON.stringify(gameConfig)};\n${code}`
      : code;

    const result = await executeSandbox(wrappedCode);
    res.json(result);
  } catch (err) {
    console.error("[DevOS] Engine hook error:", err);
    res.status(500).json({ error: "Engine hook failed" });
  }
});

export default router;
