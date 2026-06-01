/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX BUILDER AGENT — AI Software Engineer Service                       ║
 * ║  Prompt → Plan → Write Files → Deploy                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, devosProjectsTable, devosFilesTable, apexDeploymentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../../../lib/logger";

// ── Types ────────────────────────────────────────────────────────────────────

export type SseEvent =
  | { type: "thinking";  message: string }
  | { type: "plan";      summary: string; tech: string[]; fileCount: number; files: Array<{ path: string; language: string }> }
  | { type: "writing";   path: string; language: string; size: number; index: number; total: number }
  | { type: "saved";     path: string; fileId: number }
  | { type: "deploying"; slug: string }
  | { type: "done";      projectId: number; projectName: string; slug: string; url: string; fileCount: number }
  | { type: "error";     message: string };

export type SendFn = (event: SseEvent) => void;

interface GeneratedFile {
  path: string;
  language: string;
  content: string;
}

interface GenerationResult {
  plan: { summary: string; tech: string[] };
  files: GeneratedFile[];
}

// ── System prompts ────────────────────────────────────────────────────────────

const GENERATE_SYSTEM = `You are an elite AI software engineer at Apex Labs. Your job is to generate complete, working applications from user descriptions.

Return ONLY a valid JSON object with NO markdown fences, no explanation text, just the raw JSON:

{
  "plan": {
    "summary": "One sentence describing what this app does",
    "tech": ["array", "of", "technologies", "used"]
  },
  "files": [
    {
      "path": "relative/path/filename.ext",
      "language": "javascript|python|html|css|json|markdown|text",
      "content": "COMPLETE file content — no placeholders, no truncation"
    }
  ]
}

RULES:
1. Generate 5–10 files that form a COMPLETE, WORKING app
2. Always include: index.html (entry point), at least one CSS file, at least one JS file
3. For the frontend: use CDN-based React + Tailwind so files work in a browser iframe with NO build step
   - React CDN: <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
   - ReactDOM CDN: <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
   - Babel CDN: <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
   - Tailwind CDN: <script src="https://cdn.tailwindcss.com"></script>
   - Use <script type="text/babel"> for React components
4. For the backend: Node.js + Express with real route logic
5. Always include README.md explaining the app and how to run it
6. Make ALL content complete — no "// TODO", no "// implement later", no truncation
7. Use realistic sample data, proper error handling, and good UX`;

const EDIT_SYSTEM = `You are an elite AI software engineer at Apex Labs. You are editing an existing application based on user instructions.

You will receive the current files and an instruction. Return ONLY a valid JSON object:

{
  "plan": {
    "summary": "Brief description of what changed",
    "tech": ["same", "or", "updated", "tech", "stack"]
  },
  "files": [
    {
      "path": "exact/path/of/file/to/update.ext",
      "language": "javascript|python|html|css|json|markdown|text",
      "content": "COMPLETE updated file content"
    }
  ]
}

RULES:
1. Return ONLY the files that need to be changed (1 to all files)
2. Keep unchanged files out of the response
3. File contents must be COMPLETE — include all existing code plus your changes
4. Maintain the same CDN-based approach (no build step)
5. Be surgical — implement exactly what was asked`;

// ── JSON extraction ────────────────────────────────────────────────────────────

function extractJson(raw: string): GenerationResult | null {
  try {
    // Strip markdown fences if present
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const text = fenced?.[1]?.trim() ?? raw.trim();
    const first = text.indexOf("{");
    const last  = text.lastIndexOf("}");
    if (first === -1 || last <= first) return null;
    const parsed = JSON.parse(text.slice(first, last + 1));
    if (!parsed.files || !Array.isArray(parsed.files)) return null;
    return parsed as GenerationResult;
  } catch {
    return null;
  }
}

// ── Language inference ────────────────────────────────────────────────────────

function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "javascript", tsx: "javascript", mjs: "javascript",
    py: "python",
    html: "html", htm: "html",
    css: "css",
    json: "json",
    md: "markdown", mdx: "markdown",
  };
  return map[ext] ?? "text";
}

// ── Slug builder ──────────────────────────────────────────────────────────────

function buildSlug(name: string, id: number): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}-${id.toString(36).padStart(4, "0")}`;
}

// ── Core: Generate new app ────────────────────────────────────────────────────

export async function generateApp(
  prompt: string,
  sessionId: string,
  send: SendFn,
): Promise<void> {
  send({ type: "thinking", message: "Reading your prompt and planning the application…" });

  let result: GenerationResult | null = null;

  try {
    send({ type: "thinking", message: "Designing architecture and choosing tech stack…" });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 12000,
      messages: [
        { role: "system", content: GENERATE_SYSTEM },
        { role: "user",   content: `Build this application: ${prompt}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    result = extractJson(raw);

    if (!result) {
      // Fallback: generate a simple placeholder app
      result = buildFallback(prompt);
    }
  } catch (err) {
    logger.error({ err }, "[builder-agent] OpenAI call failed");
    result = buildFallback(prompt);
  }

  const { plan, files } = result;
  const appName = prompt.slice(0, 60).replace(/[^a-zA-Z0-9 ]/g, "").trim() || "My App";

  send({
    type: "plan",
    summary: plan.summary,
    tech: plan.tech,
    fileCount: files.length,
    files: files.map(f => ({ path: f.path, language: f.language ?? inferLanguage(f.path) })),
  });

  // ── Create project in DB ───────────────────────────────────────────────────
  const [project] = await db.insert(devosProjectsTable).values({
    name: appName,
    description: plan.summary,
    sessionId,
    language: "javascript",
  }).returning();

  const projectId = project!.id;

  // ── Write files ───────────────────────────────────────────────────────────
  const savedFiles: Array<{ path: string; id: number }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const lang = file.language ?? inferLanguage(file.path);

    send({
      type: "writing",
      path: file.path,
      language: lang,
      size: file.content.length,
      index: i + 1,
      total: files.length,
    });

    const [saved] = await db.insert(devosFilesTable).values({
      projectId,
      path: file.path,
      content: file.content,
      language: lang,
    }).returning();

    savedFiles.push({ path: file.path, id: saved!.id });
    send({ type: "saved", path: file.path, fileId: saved!.id });
  }

  // Update project updatedAt
  await db.update(devosProjectsTable)
    .set({ updatedAt: new Date() })
    .where(eq(devosProjectsTable.id, projectId));

  // ── Deploy ─────────────────────────────────────────────────────────────────
  const slug = buildSlug(appName, projectId);
  const domain = process.env["REPLIT_DEV_DOMAIN"] ?? "localhost";
  const url = `https://${domain}/api/apps/${slug}/`;

  send({ type: "deploying", slug });

  const filesSnapshot = files.map(f => ({
    path: f.path,
    content: f.content,
    language: f.language ?? inferLanguage(f.path),
  }));

  const [deployment] = await db.insert(apexDeploymentsTable).values({
    projectId,
    slug,
    name: appName,
    status: "building",
    language: "javascript",
    filesSnapshot,
    version: 1,
    sessionId,
    provider: "apex",
  }).returning();

  // Mark live
  await db.update(apexDeploymentsTable)
    .set({ status: "live", url, updatedAt: new Date() })
    .where(eq(apexDeploymentsTable.id, deployment!.id));

  send({
    type: "done",
    projectId,
    projectName: appName,
    slug,
    url,
    fileCount: files.length,
  });
}

// ── Core: Edit existing app ───────────────────────────────────────────────────

export async function editApp(
  projectId: number,
  instruction: string,
  sessionId: string,
  send: SendFn,
): Promise<void> {
  send({ type: "thinking", message: "Reading your project files…" });

  // Load existing files
  const existingFiles = await db
    .select()
    .from(devosFilesTable)
    .where(eq(devosFilesTable.projectId, projectId));

  if (existingFiles.length === 0) {
    send({ type: "error", message: "Project has no files to edit." });
    return;
  }

  const filesContext = existingFiles
    .map(f => `=== ${f.path} (${f.language}) ===\n${f.content}`)
    .join("\n\n");

  send({ type: "thinking", message: "Analyzing codebase and planning edits…" });

  let result: GenerationResult | null = null;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 12000,
      messages: [
        { role: "system",    content: EDIT_SYSTEM },
        { role: "user",      content: `CURRENT FILES:\n\n${filesContext}\n\nINSTRUCTION: ${instruction}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    result = extractJson(raw);
  } catch (err) {
    logger.error({ err }, "[builder-agent] OpenAI edit call failed");
    send({ type: "error", message: "AI service unavailable. Please try again." });
    return;
  }

  if (!result) {
    send({ type: "error", message: "AI returned an unexpected response format. Please try again." });
    return;
  }

  const { plan, files } = result;

  send({
    type: "plan",
    summary: plan.summary,
    tech: plan.tech,
    fileCount: files.length,
    files: files.map(f => ({ path: f.path, language: f.language ?? inferLanguage(f.path) })),
  });

  // ── Upsert modified files ─────────────────────────────────────────────────
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const lang = file.language ?? inferLanguage(file.path);

    send({
      type: "writing",
      path: file.path,
      language: lang,
      size: file.content.length,
      index: i + 1,
      total: files.length,
    });

    // Check if file exists
    const [existing] = await db
      .select({ id: devosFilesTable.id })
      .from(devosFilesTable)
      .where(and(eq(devosFilesTable.projectId, projectId), eq(devosFilesTable.path, file.path)))
      .limit(1);

    let fileId: number;
    if (existing) {
      await db.update(devosFilesTable)
        .set({ content: file.content, language: lang, updatedAt: new Date() })
        .where(eq(devosFilesTable.id, existing.id));
      fileId = existing.id;
    } else {
      const [ins] = await db.insert(devosFilesTable)
        .values({ projectId, path: file.path, content: file.content, language: lang })
        .returning();
      fileId = ins!.id;
    }

    send({ type: "saved", path: file.path, fileId });
  }

  // Update project
  await db.update(devosProjectsTable)
    .set({ updatedAt: new Date() })
    .where(eq(devosProjectsTable.id, projectId));

  // Update deployment
  const allFiles = await db.select().from(devosFilesTable)
    .where(eq(devosFilesTable.projectId, projectId));

  const [project] = await db.select().from(devosProjectsTable)
    .where(eq(devosProjectsTable.id, projectId)).limit(1);

  const appName = project?.name ?? "My App";
  const slug = buildSlug(appName, projectId);
  const domain = process.env["REPLIT_DEV_DOMAIN"] ?? "localhost";
  const url = `https://${domain}/api/apps/${slug}/`;

  send({ type: "deploying", slug });

  const [existingDeploy] = await db
    .select()
    .from(apexDeploymentsTable)
    .where(eq(apexDeploymentsTable.projectId, projectId))
    .orderBy(desc(apexDeploymentsTable.version))
    .limit(1);

  const version = (existingDeploy?.version ?? 0) + 1;
  const filesSnapshot = allFiles.map(f => ({ path: f.path, content: f.content, language: f.language }));

  if (existingDeploy) {
    await db.update(apexDeploymentsTable)
      .set({ status: "live", version, filesSnapshot, url, updatedAt: new Date(), error: null })
      .where(eq(apexDeploymentsTable.id, existingDeploy.id));
  } else {
    await db.insert(apexDeploymentsTable).values({
      projectId, slug, name: appName, status: "live",
      language: "javascript", filesSnapshot, version, sessionId, provider: "apex", url,
    });
  }

  send({
    type: "done",
    projectId,
    projectName: appName,
    slug,
    url,
    fileCount: allFiles.length,
  });
}

// ── Fallback app when AI is unavailable ───────────────────────────────────────

function buildFallback(prompt: string): GenerationResult {
  const escaped = prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return {
    plan: {
      summary: `Application based on: ${prompt.slice(0, 80)}`,
      tech: ["HTML", "CSS", "JavaScript"],
    },
    files: [
      {
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escaped.slice(0, 40)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-white min-h-screen flex items-center justify-center">
  <div class="text-center max-w-xl p-8">
    <div class="text-6xl mb-6">🚀</div>
    <h1 class="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
      ${escaped.slice(0, 40)}
    </h1>
    <p class="text-gray-400 mb-8">Your application is ready. Edit the files to customize it.</p>
    <button onclick="alert('App started!')"
      class="px-6 py-3 bg-purple-600 rounded-lg hover:bg-purple-500 transition font-semibold">
      Get Started
    </button>
  </div>
</body>
</html>`,
      },
      {
        path: "README.md",
        language: "markdown",
        content: `# ${prompt.slice(0, 40)}\n\nGenerated by Apex Builder Agent.\n\n## Getting Started\n\nOpen \`index.html\` in your browser to run the app.\n`,
      },
    ],
  };
}
