/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX FEATURE BUILDER API                                   ║
 * ║  Allows AI-driven self-upgrades to the Apex platform        ║
 * ║                                                             ║
 * ║  Endpoints:                                                 ║
 * ║    POST /api/builder/plan       — AI generates feature plan ║
 * ║    Everything except /plan is owner-only (OWNER_EMAILS).    ║
 * ║    POST /api/builder/apply      — apply code changes (dev)  ║
 * ║    POST /api/builder/snapshot   — save snapshot (dev)       ║
 * ║    GET  /api/builder/snapshots  — list snapshots (dev)      ║
 * ║    POST /api/builder/rollback   — restore snapshot (dev)    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { Router } from "express";
import {
  existsSync, readFileSync, writeFileSync,
  mkdirSync, readdirSync, rmSync,
} from "fs";
import path from "path";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireOwner } from "../shared/middleware/requireAuth";

const router = Router();

// ── Workspace paths ──────────────────────────────────────────────────────────
// API server runs from artifacts/api-server — navigate up to workspace root
const WORKSPACE    = path.resolve(process.cwd(), "..", "..");
const SNAPSHOTS_DIR = path.join(WORKSPACE, ".apex-builder", "snapshots");

// Resolve a workspace-relative path, refusing anything that escapes the workspace
function workspacePath(relPath: string): string {
  const full = path.resolve(WORKSPACE, relPath);
  if (full !== WORKSPACE && !full.startsWith(WORKSPACE + path.sep)) {
    throw new Error(`Path is outside the workspace: ${relPath}`);
  }
  return full;
}

function ensureSnapshotsDir() {
  if (!existsSync(SNAPSHOTS_DIR)) mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

// ── POST /api/builder/plan ────────────────────────────────────────────────────
// Generates a structured feature plan — available to ALL users.
// Dev mode returns actual file paths + TypeScript code.
// User mode returns a simulation plan + user-content extension config.
router.post("/builder/plan", async (req, res) => {
  const { prompt, devMode } = req.body as { prompt: string; devMode?: boolean };

  if (!prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const systemDev = `You are the Apex internal feature builder AI. Your job is to generate a complete, implementable feature plan for the Apex app — a mobile-first React+TypeScript+Vite application with an Express API server, game engine, AI chat, social feed, studio, and marketplace.

CRITICAL RULES FOR CODE GENERATION:
1. For "modify" actions: the "code" field MUST contain the COMPLETE, ENTIRE file content — every line from top to bottom. The system will FULLY REPLACE the existing file with your code. Never write partial snippets.
2. For "create" actions: the "code" field must contain the full new file content.
3. File paths must be relative to the workspace root (e.g. "artifacts/apex/src/..." or "artifacts/api-server/src/...").
4. When modifying game files, always export the same function/class names that already exist so the rest of the codebase keeps working.`;

  const systemUser = `You are the Apex feature builder AI. Generate a feature plan showing what COULD be built inside the Apex platform. For regular users, focus on user-controlled content: custom games, AI persona configurations, and UI theme specs — things that don't require modifying the Apex source code.`;

  const schema = `{
  "feature": "Short feature name (5 words max)",
  "description": "1-2 sentence description",
  "userValue": "Why users will love this",
  "complexity": "low|medium|high",
  "type": "game-extension|ui-component|ai-feature|engine-module|backend-api|user-content",
  "files": [
    {
      "path": "path/relative/to/workspace/root/File.tsx",
      "action": "create|modify",
      "description": "What this change does",
      "code": "// Full TypeScript code for this file or change"
    }
  ],
  "risks": ["risk 1", "risk 2"],
  "estimatedLines": 45,
  "userExtension": ${devMode ? "null" : `{
    "type": "game|persona|theme",
    "name": "Extension name",
    "config": {}
  }`}
}`;

  try {
    const completion = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0.7,
      max_tokens:  2500,
      messages: [
        { role: "system",  content: devMode ? systemDev : systemUser },
        {
          role: "user",
          content: `Feature request: "${prompt}"\n\nReturn ONLY valid JSON matching this schema exactly:\n${schema}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      plan = m ? (JSON.parse(m[0]) as Record<string, unknown>) : buildOfflinePlan(prompt, devMode);
    }

    res.json({ plan, offline: false });
  } catch {
    res.json({ plan: buildOfflinePlan(prompt, devMode), offline: true });
  }
});

// ── POST /api/builder/apply ───────────────────────────────────────────────────
// Writes generated code to the actual Apex codebase. DEV ONLY.
router.post("/builder/apply", requireOwner, async (req, res) => {
  const { plan } = req.body as {
    plan: {
      feature: string;
      files: Array<{ path: string; action: "create" | "modify"; code: string; insertAfter?: string }>;
    };
  };


  if (!plan?.files?.length) {
    res.status(400).json({ error: "No files to apply" });
    return;
  }

  try {
    // Snapshot before any changes
    const snapshotId = await createSnapshot(`Before: ${plan.feature}`, plan.files);

    const results: Array<{ path: string; status: string; message: string }> = [];

    for (const file of plan.files) {
      try {
        const fullPath = workspacePath(file.path);
        mkdirSync(path.dirname(fullPath), { recursive: true });

        if (file.action === "create") {
          writeFileSync(fullPath, file.code, "utf-8");
          results.push({ path: file.path, status: "created", message: "File created successfully" });
        } else {
          // Full file replacement — AI always generates the complete file for "modify"
          writeFileSync(fullPath, file.code, "utf-8");
          results.push({ path: file.path, status: "modified", message: "File replaced successfully" });
        }
      } catch (err) {
        results.push({ path: file.path, status: "error", message: String(err) });
      }
    }

    const hasErrors = results.some((r) => r.status === "error");
    res.json({ success: !hasErrors, snapshotId, results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /api/builder/snapshot ────────────────────────────────────────────────
router.post("/builder/snapshot", requireOwner, async (req, res) => {
  const { label, files } = req.body as {
    label?: string;
    files: Array<{ path: string }>;
  };


  try {
    const id = await createSnapshot(label ?? "Manual snapshot", files);
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/builder/snapshots ────────────────────────────────────────────────
router.get("/builder/snapshots", requireOwner, (req, res) => {
  

  try {
    ensureSnapshotsDir();
    const dirs = readdirSync(SNAPSHOTS_DIR).sort().reverse();
    const snapshots = dirs
      .map((dir) => {
        try {
          const metaPath = path.join(SNAPSHOTS_DIR, dir, "meta.json");
          return existsSync(metaPath)
            ? (JSON.parse(readFileSync(metaPath, "utf-8")) as object)
            : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    res.json({ snapshots });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /api/builder/rollback ────────────────────────────────────────────────
router.post("/builder/rollback", requireOwner, (req, res) => {
  const { snapshotId } = req.body as { snapshotId: string };
  if (!/^[\w-]+$/.test(snapshotId ?? "")) { res.status(400).json({ error: "Invalid snapshot id" }); return; }


  try {
    const snapshotDir = path.join(SNAPSHOTS_DIR, snapshotId);
    const metaPath    = path.join(snapshotDir, "meta.json");

    if (!existsSync(metaPath)) {
      res.status(404).json({ error: "Snapshot not found" });
      return;
    }

    const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as {
      files: Array<{ path: string; snapshotFile: string }>;
    };

    const results: Array<{ path: string; status: string }> = [];

    for (const file of meta.files) {
      try {
        const contentPath = path.join(snapshotDir, file.snapshotFile);
        const content     = readFileSync(contentPath, "utf-8");
        const targetPath  = workspacePath(file.path);
        mkdirSync(path.dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, content, "utf-8");
        results.push({ path: file.path, status: "restored" });
      } catch (e) {
        results.push({ path: file.path, status: `error: ${String(e)}` });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/builder/tree ─────────────────────────────────────────────────────
// Returns the file tree for apex/src or api-server/src
router.get("/builder/tree", requireOwner, (req, res) => {
  const { root } = req.query as { root?: string };

  const roots: Record<string, string> = {
    apex:   path.join(WORKSPACE, "artifacts/apex/src"),
    api:    path.join(WORKSPACE, "artifacts/api-server/src"),
    pages:  path.join(WORKSPACE, "artifacts/apex/src/pages"),
    comps:  path.join(WORKSPACE, "artifacts/apex/src/components"),
    routes: path.join(WORKSPACE, "artifacts/api-server/src/routes"),
  };

  const dir = roots[root ?? "apex"] ?? roots.apex;
  const SKIP = new Set(["node_modules", ".git", "dist", "__pycache__", ".next", ".cache"]);

  function walk(dirPath: string, depth = 0): unknown[] {
    if (depth > 4) return [];
    try {
      return readdirSync(dirPath, { withFileTypes: true })
        .filter(d => !SKIP.has(d.name))
        .map(d => ({
          name: d.name,
          type: d.isDirectory() ? "dir" : "file",
          path: path.relative(WORKSPACE, path.join(dirPath, d.name)),
          children: d.isDirectory() ? walk(path.join(dirPath, d.name), depth + 1) : undefined,
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return (a.name as string).localeCompare(b.name as string);
        });
    } catch { return []; }
  }

  res.json({ tree: walk(dir), root: root ?? "apex" });
});

// ── GET /api/builder/read ─────────────────────────────────────────────────────
router.get("/builder/read", requireOwner, (req, res) => {
  const { filePath } = req.query as { filePath?: string };
  if (!filePath) { res.status(400).json({ error: "filePath required" }); return; }

  try {
    const full = workspacePath(filePath);
    if (!existsSync(full)) { res.status(404).json({ error: "File not found" }); return; }
    const content = readFileSync(full, "utf-8");
    res.json({ content, path: filePath });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── POST /api/builder/write ───────────────────────────────────────────────────
// Direct file write — used by the code editor save button
router.post("/builder/write", requireOwner, (req, res) => {
  const { filePath, content } = req.body as { filePath: string; content: string };
  if (!filePath || content === undefined) { res.status(400).json({ error: "filePath + content required" }); return; }

  try {
    const full = workspacePath(filePath);
    // Auto-snapshot before direct write
    createSnapshot(`Manual edit: ${path.basename(filePath)}`, [{ path: filePath }]).catch(() => {});
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content, "utf-8");
    res.json({ success: true, path: filePath });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createSnapshot(
  label: string,
  files: Array<{ path: string }>,
): Promise<string> {
  ensureSnapshotsDir();

  const id  = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const dir = path.join(SNAPSHOTS_DIR, id);
  mkdirSync(dir, { recursive: true });

  const snapshotFiles: Array<{ path: string; snapshotFile: string }> = [];

  for (const file of files) {
    const fullPath = workspacePath(file.path);
    if (existsSync(fullPath)) {
      const snapshotFile = `file_${snapshotFiles.length}.bak`;
      writeFileSync(path.join(dir, snapshotFile), readFileSync(fullPath, "utf-8"));
      snapshotFiles.push({ path: file.path, snapshotFile });
    }
  }

  const meta = { id, label, timestamp: Date.now(), files: snapshotFiles };
  writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));

  // Prune to max 10 snapshots
  try {
    const all = readdirSync(SNAPSHOTS_DIR).sort();
    if (all.length > 10) {
      for (const old of all.slice(0, all.length - 10)) {
        rmSync(path.join(SNAPSHOTS_DIR, old), { recursive: true, force: true });
      }
    }
  } catch { /* non-fatal */ }

  return id;
}

function mergeCode(existing: string, newCode: string, insertAfter?: string): string {
  if (!existing) return newCode;
  if (!insertAfter) return `${existing}\n\n${newCode}`;
  const idx = existing.indexOf(insertAfter);
  if (idx === -1) return `${existing}\n\n${newCode}`;
  const at = idx + insertAfter.length;
  return `${existing.slice(0, at)}\n\n${newCode}\n${existing.slice(at)}`;
}

function buildOfflinePlan(
  prompt: string,
  devMode?: boolean,
): Record<string, unknown> {
  return {
    feature:      `Feature: ${prompt.slice(0, 48)}`,
    description:  `Adds "${prompt.toLowerCase()}" capabilities to the Apex platform.`,
    userValue:    "Enhances the overall Apex experience.",
    complexity:   "medium",
    type:         devMode ? "ui-component" : "user-content",
    files:        devMode
      ? [{
          path:        "artifacts/apex/src/components/NewFeature.tsx",
          action:      "create",
          description: "Auto-generated placeholder component",
          code:        `// Feature: ${prompt}\nimport React from "react";\n\nexport function NewFeature() {\n  return (\n    <div style={{ padding: 20 }}>\n      <h2>${prompt}</h2>\n      <p>Feature coming soon.</p>\n    </div>\n  );\n}\n`,
        }]
      : [],
    risks:         ["AI was unavailable — this is an offline-generated placeholder plan"],
    estimatedLines: 20,
    userExtension: devMode ? null : {
      type:   "game",
      name:   prompt.slice(0, 30),
      config: { name: prompt.slice(0, 30), description: prompt },
    },
  };
}

export default router;
