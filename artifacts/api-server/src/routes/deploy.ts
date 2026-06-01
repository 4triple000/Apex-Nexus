/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX ONE-CLICK DEPLOY ENGINE                                            ║
 * ║  Self-hosted · Multi-file · Real public URLs · HTML/JS/Python            ║
 * ║  POST /api/deploy/projects/:id  →  live URL in seconds                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { db, apexDeploymentsTable, devosProjectsTable, devosFilesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import type { DeployedFile } from "@workspace/db";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Slugify: "My Cool App!" → "my-cool-app-a3f2" */
function slugify(name: string, id: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = id.toString(36).padStart(4, "0");
  return `${base}-${suffix}`;
}

/** MIME type from file extension */
function mimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm:  "text/html; charset=utf-8",
    css:  "text/css; charset=utf-8",
    js:   "application/javascript; charset=utf-8",
    mjs:  "application/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg:  "image/svg+xml",
    png:  "image/png",
    jpg:  "image/jpeg",
    jpeg: "image/jpeg",
    gif:  "image/gif",
    ico:  "image/x-icon",
    txt:  "text/plain; charset=utf-8",
    xml:  "application/xml",
    webp: "image/webp",
    woff: "font/woff",
    woff2:"font/woff2",
    ttf:  "font/ttf",
    map:  "application/json",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Build public base URL from request */
function buildBaseUrl(req: Request): string {
  const host = req.headers.host ?? process.env["REPLIT_DEV_DOMAIN"] ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] as string ?? "https";
  return `${proto}://${host}`;
}

/** Generate an HTML wrapper for JavaScript project output */
function buildJSWrapper(name: string, files: DeployedFile[], slug: string): string {
  const mainFile = files.find(f => f.path.endsWith(".js") && (f.path === "index.js" || f.path.includes("main")))
    ?? files.find(f => f.path.endsWith(".js"))
    ?? files[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(name)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #07080e; color: #fff; min-height: 100vh;
      display: flex; flex-direction: column;
    }
    header {
      padding: 12px 20px;
      background: rgba(10,11,20,0.95);
      border-bottom: 1px solid rgba(255,255,255,0.07);
      display: flex; align-items: center; gap: 10px;
    }
    .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
      background: rgba(124,92,231,0.2); color: #a29bfe; border: 1px solid rgba(124,92,231,0.3); }
    .apex-link { color: #636e72; font-size: 11px; text-decoration: none; margin-left: auto; }
    .apex-link:hover { color: #a29bfe; }
    #console-output {
      flex: 1; padding: 20px; overflow-y: auto;
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 13px; line-height: 1.7;
    }
    .line { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 2px; }
    .ts  { color: rgba(255,255,255,0.2); font-size: 10px; white-space: nowrap; margin-top: 3px; min-width: 48px; }
    .msg { word-break: break-all; white-space: pre-wrap; }
    .log  { color: #dfe6e9; }
    .err  { color: #ff7675; }
    .warn { color: #fdcb6e; }
    .info { color: #a29bfe; }
    .done-banner {
      margin: 16px 20px;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
    }
    .done-ok   { background: rgba(0,184,148,0.1); border: 1px solid rgba(0,184,148,0.3); color: #00b894; }
    .done-fail { background: rgba(214,48,49,0.1);  border: 1px solid rgba(214,48,49,0.3);  color: #ff7675; }
    .code-section {
      margin: 0 20px 20px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
      overflow: hidden;
    }
    .code-header {
      padding: 8px 14px;
      background: rgba(255,255,255,0.04);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 11px; color: #636e72; font-weight: 600;
    }
    pre { padding: 14px; overflow-x: auto; font-size: 12px; line-height: 1.5; color: #b2bec3; }
  </style>
</head>
<body>
  <header>
    <span>⚡</span>
    <strong style="font-size:14px">${escapeHtml(name)}</strong>
    <span class="badge">JavaScript</span>
    <a class="apex-link" href="/">Apex Runtime</a>
  </header>
  <div id="console-output"></div>
  <div id="result-banner"></div>
  <div class="code-section">
    <div class="code-header">📄 ${escapeHtml(mainFile?.path ?? "index.js")}</div>
    <pre>${escapeHtml(mainFile?.content ?? "")}</pre>
  </div>

<script>
(function() {
  const out = document.getElementById('console-output');
  const banner = document.getElementById('result-banner');
  const start = Date.now();
  let lineCount = 0;

  function addLine(type, msg) {
    if (lineCount++ > 500) return;
    const ts = Date.now() - start;
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML =
      '<span class="ts">+' + ts + 'ms</span>' +
      '<span class="msg ' + type + '">' + escHtml(String(msg)) + '</span>';
    out.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const origConsole = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  ['log','error','warn','info'].forEach(fn => {
    console[fn] = function(...args) {
      const cls = fn === 'error' ? 'err' : fn === 'warn' ? 'warn' : fn === 'info' ? 'info' : 'log';
      addLine(cls, args.map(a => {
        try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); } catch { return String(a); }
      }).join(' '));
      origConsole[fn].apply(console, args);
    };
  });

  window.onerror = function(msg, src, line, col, err) {
    addLine('err', (err ? err.toString() : String(msg)) + ' (line ' + line + ')');
  };
  window.onunhandledrejection = function(e) {
    addLine('err', 'Unhandled Promise rejection: ' + String(e.reason));
  };

  const t0 = performance.now();
  try {
    ${mainFile?.content ?? "// no code"}
    const dur = Math.round(performance.now() - t0);
    banner.innerHTML = '<div class="done-banner done-ok">✓ Script completed in ' + dur + 'ms</div>';
  } catch(e) {
    const dur = Math.round(performance.now() - t0);
    addLine('err', e.toString());
    banner.innerHTML = '<div class="done-banner done-fail">✗ Error: ' + escHtml(e.toString()) + '</div>';
  }
})();
</script>
</body>
</html>`;
}

/** Generate an HTML output page for Python projects (pre-executed output) */
function buildPythonOutputPage(name: string, output: string, error: string, slug: string): string {
  const hasOutput = output.trim().length > 0;
  const hasError  = error.trim().length > 0;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(name)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #07080e; color: #fff; min-height: 100vh; display: flex; flex-direction: column; }
    header { padding: 12px 20px; background: rgba(10,11,20,0.95); border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; gap: 10px; }
    .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: rgba(55,118,171,0.2); color: #74b9ff; border: 1px solid rgba(55,118,171,0.3); }
    .output { flex: 1; padding: 20px; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-all; }
    .output.ok   { color: #dfe6e9; }
    .output.err  { color: #ff7675; }
    .empty { color: rgba(255,255,255,0.2); text-align: center; padding-top: 60px; }
    .apex-link { color: #636e72; font-size: 11px; text-decoration: none; margin-left: auto; }
  </style>
</head>
<body>
  <header>
    <span>🐍</span>
    <strong style="font-size:14px">${escapeHtml(name)}</strong>
    <span class="badge">Python Output</span>
    <a class="apex-link" href="/">Apex Runtime</a>
  </header>
  ${hasOutput ? `<div class="output ok">${escapeHtml(output)}</div>` : ""}
  ${hasError  ? `<div class="output err">${escapeHtml(error)}</div>`  : ""}
  ${!hasOutput && !hasError ? `<div class="output"><div class="empty">No output produced.</div></div>` : ""}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Serve deployed apps ────────────────────────────────────────────────────────
// Matches: /api/apps/:slug, /api/apps/:slug/*, /api/apps/:slug/dir/file.css
// router.use with sub-path matching — req.path holds the file path after slug

router.use("/apps/:slug", (req: Request, res: Response) => {
  // Attach the sub-path so serveDeployedApp can read it
  (req as Request & { deployFilePath?: string }).deployFilePath = req.path.replace(/^\//, "") || "index.html";
  return serveDeployedApp(req, res);
});

async function serveDeployedApp(req: Request, res: Response): Promise<void> {
  const { slug } = req.params as { slug: string };
  const filePath = (req as Request & { deployFilePath?: string }).deployFilePath ?? "index.html";

  try {
    const [deployment] = await db
      .select()
      .from(apexDeploymentsTable)
      .where(eq(apexDeploymentsTable.slug, slug))
      .limit(1);

    if (!deployment) {
      res.status(404).send(`
        <html><body style="font-family:sans-serif;background:#07080e;color:#ff7675;padding:40px;text-align:center">
          <h2>404 — Deployment not found</h2>
          <p style="color:#636e72;margin-top:8px">No deployment found for slug: <code>${escapeHtml(slug)}</code></p>
          <a href="/" style="color:#a29bfe;margin-top:20px;display:inline-block">← Back to Apex</a>
        </body></html>`);
      return;
    }

    if (deployment.status !== "live") {
      res.status(503).send(`
        <html><body style="font-family:sans-serif;background:#07080e;color:#fdcb6e;padding:40px;text-align:center">
          <h2>⏳ Deployment ${deployment.status}</h2>
          <p style="color:#636e72;margin-top:8px">This deployment is not yet live. Check the dashboard for status.</p>
        </body></html>`);
      return;
    }

    const files = deployment.filesSnapshot as DeployedFile[];

    // For JS/Python deployments, we have a pre-built HTML wrapper
    if (deployment.language !== "html" && filePath === "index.html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.send(deployment.previewHtml ?? "<html><body>No preview available.</body></html>");
      return;
    }

    // Find the requested file
    const normalize = (p: string) => p.replace(/^\/+/, "").toLowerCase();
    const target    = normalize(filePath);

    let file = files.find(f => normalize(f.path) === target)
      ?? files.find(f => normalize(f.path).endsWith("/" + target))
      ?? (target === "index.html" ? files.find(f => f.path.endsWith(".html")) : null)
      ?? null;

    if (!file) {
      res.status(404).send(`
        <html><body style="font-family:sans-serif;background:#07080e;color:#ff7675;padding:40px">
          <h2>File not found: ${escapeHtml(filePath)}</h2>
        </body></html>`);
      return;
    }

    res.setHeader("Content-Type", mimeType(file.path));
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(file.content);
  } catch (err) {
    logger.error({ err }, "[Deploy] serve error");
    res.status(500).send("Internal server error");
  }
}

// ── Deploy endpoint ────────────────────────────────────────────────────────────

// POST /api/deploy/projects/:id
router.post("/deploy/projects/:id", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params["id"]!);
  const sessionId = req.headers["x-session-id"] as string || "runtime-default";

  try {
    // Load project
    const [project] = await db.select().from(devosProjectsTable)
      .where(eq(devosProjectsTable.id, projectId)).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    // Load files
    const files = await db.select().from(devosFilesTable)
      .where(eq(devosFilesTable.projectId, projectId))
      .orderBy(devosFilesTable.path);

    if (files.length === 0) {
      res.status(400).json({ error: "Project has no files to deploy" });
      return;
    }

    const filesSnapshot: DeployedFile[] = files.map(f => ({
      path:     f.path,
      content:  f.content,
      language: f.language,
    }));

    // Check for existing deployment to get version number
    const existing = await db.select()
      .from(apexDeploymentsTable)
      .where(eq(apexDeploymentsTable.projectId, projectId))
      .orderBy(desc(apexDeploymentsTable.version))
      .limit(1);

    const version = (existing[0]?.version ?? 0) + 1;
    const slug    = existing[0]?.slug ?? slugify(project.name, project.id);

    // Create/update deployment record at "building"
    let deploymentId: number;

    if (existing.length > 0 && existing[0]) {
      // Re-deploy: update existing record
      await db.update(apexDeploymentsTable)
        .set({ status: "building", version, filesSnapshot, updatedAt: new Date(), error: null })
        .where(eq(apexDeploymentsTable.id, existing[0].id));
      deploymentId = existing[0].id;
    } else {
      // First deploy: insert new record
      const [inserted] = await db.insert(apexDeploymentsTable).values({
        projectId,
        slug,
        name:          project.name,
        status:        "building",
        language:      project.language,
        filesSnapshot,
        version,
        sessionId,
        provider:      "apex",
      }).returning();
      deploymentId = inserted!.id;
    }

    // Stream "building" response immediately, then process
    res.json({ deploymentId, slug, status: "building", version });

    // ── Async build process (non-blocking) ────────────────────────────────────
    setImmediate(async () => {
      try {
        const baseUrl = `${process.env["REPLIT_DEV_DOMAIN"] ? "https://" + process.env["REPLIT_DEV_DOMAIN"] : ""}`;
        const url     = `${baseUrl}/api/apps/${slug}/`;

        let previewHtml: string | null = null;

        if (project.language === "javascript") {
          previewHtml = buildJSWrapper(project.name, filesSnapshot, slug);
        } else if (project.language === "python") {
          // Pre-execute Python and capture output
          try {
            const { spawn } = await import("node:child_process");
            const mainFile  = filesSnapshot.find(f => f.path === "main.py") ?? filesSnapshot[0];
            if (mainFile) {
              const output = await new Promise<{ stdout: string; stderr: string }>((resolve) => {
                let stdout = "";
                let stderr = "";
                const proc = spawn("python3", ["-c", mainFile.content], {
                  timeout: 10_000,
                  env: { PATH: "/usr/bin:/usr/local/bin:/bin", PYTHONDONTWRITEBYTECODE: "1" },
                  cwd: "/tmp",
                });
                proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
                proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
                proc.on("close", () => resolve({ stdout, stderr }));
                proc.on("error", () => resolve({ stdout, stderr }));
              });
              previewHtml = buildPythonOutputPage(project.name, output.stdout, output.stderr, slug);
            }
          } catch (e) {
            logger.warn({ e }, "[Deploy] Python pre-exec failed");
            previewHtml = buildPythonOutputPage(project.name, "", "Failed to pre-execute Python.", slug);
          }
        }

        // Mark as live
        await db.update(apexDeploymentsTable).set({
          status: "live",
          url,
          previewHtml,
          updatedAt: new Date(),
        }).where(eq(apexDeploymentsTable.id, deploymentId));

        logger.info({ slug, url, version }, "[Deploy] deployment live");
      } catch (err) {
        logger.error({ err }, "[Deploy] build failed");
        await db.update(apexDeploymentsTable).set({
          status: "failed",
          error:  err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        }).where(eq(apexDeploymentsTable.id, deploymentId));
      }
    });

  } catch (err) {
    logger.error({ err }, "[Deploy] deploy error");
    res.status(500).json({ error: "Deployment failed" });
  }
});

// GET /api/deploy/status/:deploymentId  — poll status
router.get("/deploy/status/:deploymentId", async (req, res): Promise<void> => {
  const id = parseInt(req.params["deploymentId"]!);
  try {
    const [dep] = await db.select().from(apexDeploymentsTable)
      .where(eq(apexDeploymentsTable.id, id)).limit(1);
    if (!dep) { res.status(404).json({ error: "Deployment not found" }); return; }
    res.json({
      id:      dep.id,
      slug:    dep.slug,
      status:  dep.status,
      url:     dep.url,
      version: dep.version,
      error:   dep.error,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get status" });
  }
});

// GET /api/deploy/projects/:id/deployments — list deployments for a project
router.get("/deploy/projects/:id/deployments", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params["id"]!);
  try {
    const deps = await db.select({
      id:        apexDeploymentsTable.id,
      slug:      apexDeploymentsTable.slug,
      name:      apexDeploymentsTable.name,
      status:    apexDeploymentsTable.status,
      url:       apexDeploymentsTable.url,
      version:   apexDeploymentsTable.version,
      language:  apexDeploymentsTable.language,
      error:     apexDeploymentsTable.error,
      createdAt: apexDeploymentsTable.createdAt,
      updatedAt: apexDeploymentsTable.updatedAt,
    })
    .from(apexDeploymentsTable)
    .where(eq(apexDeploymentsTable.projectId, projectId))
    .orderBy(desc(apexDeploymentsTable.version))
    .limit(20);
    res.json({ deployments: deps });
  } catch (err) {
    res.status(500).json({ error: "Failed to list deployments" });
  }
});

// GET /api/deploy/all  — all live deployments for current session
router.get("/deploy/all", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || "runtime-default";
  try {
    const deps = await db.select({
      id:        apexDeploymentsTable.id,
      slug:      apexDeploymentsTable.slug,
      name:      apexDeploymentsTable.name,
      status:    apexDeploymentsTable.status,
      url:       apexDeploymentsTable.url,
      version:   apexDeploymentsTable.version,
      language:  apexDeploymentsTable.language,
      projectId: apexDeploymentsTable.projectId,
      createdAt: apexDeploymentsTable.createdAt,
    })
    .from(apexDeploymentsTable)
    .where(eq(apexDeploymentsTable.sessionId, sessionId))
    .orderBy(desc(apexDeploymentsTable.updatedAt))
    .limit(50);
    res.json({ deployments: deps });
  } catch (err) {
    res.status(500).json({ error: "Failed to list deployments" });
  }
});

export default router;
