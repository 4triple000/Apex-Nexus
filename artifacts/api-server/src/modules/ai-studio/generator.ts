/**
 * AI Studio Generator — Apex AI OS Edition
 *
 * Two modes:
 *  - generate: Prompt → structured project plan + workflows + files + preview HTML
 *  - edit: Targeted iterative changes preserving system integrity
 *
 * The preview_html is a standalone HTML file (CDN-based React/Tailwind) that
 * works in an iframe with zero build step.
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";
import type { AiStudioFile, AiStudioPlan, AiStudioChatMessage } from "@workspace/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateResult {
  plan: AiStudioPlan;
  files: AiStudioFile[];
  previewHtml: string;
  summary: string;
}

export interface EditResult {
  files: AiStudioFile[];
  previewHtml: string;
  changedFiles: string[];
  summary: string;
}

// ── System prompts ─────────────────────────────────────────────────────────────

const GENERATE_SYSTEM_PROMPT = `You are Apex Studio AI OS — a full-stack application generation engine.

CRITICAL: Return ONLY a raw JSON object. NO markdown fences. NO backticks. NO explanation. Start with { immediately.

Required JSON structure:
{
  "plan": {
    "project_name": "Short App Name",
    "app_type": "web_app" | "dashboard" | "saas" | "marketplace" | "game" | "tool",
    "description": "One sentence description.",
    "features": ["feature 1", "feature 2", "feature 3", "feature 4"],
    "pages": ["Home", "Dashboard", "Settings"],
    "tech_stack": ["React", "Tailwind CSS", "Node.js"],
    "database_schema": [
      { "table": "users", "fields": ["id", "email", "name", "created_at"] },
      { "table": "items", "fields": ["id", "user_id", "title", "status"] }
    ],
    "api_routes": ["POST /api/auth/login", "GET /api/dashboard/stats"],
    "workflows": [
      {
        "id": "workflow-1",
        "name": "User Onboarding Flow",
        "description": "Handles new user registration and setup",
        "triggers": ["User clicks Sign Up button"],
        "steps": [
          { "id": "step-1", "action": "Render signup form", "output": "Form displayed" },
          { "id": "step-2", "action": "Validate email and password", "output": "Validation result" },
          { "id": "step-3", "action": "Create user record in database", "output": "User ID generated" },
          { "id": "step-4", "action": "Send welcome email", "output": "Email queued" },
          { "id": "step-5", "action": "Redirect to dashboard", "output": "Navigation complete" }
        ]
      },
      {
        "id": "workflow-2",
        "name": "Core Data Flow",
        "description": "Primary data creation and management workflow",
        "triggers": ["User submits main form"],
        "steps": [
          { "id": "step-1", "action": "Validate input data", "output": "Validation passed" },
          { "id": "step-2", "action": "Save to database", "output": "Record ID" },
          { "id": "step-3", "action": "Update UI state", "output": "UI refreshed" }
        ]
      }
    ]
  },
  "preview_html": "FULL STANDALONE HTML — see rules below",
  "files": [
    { "path": "README.md", "content": "# Project name\\n\\nDescription.", "language": "markdown" },
    { "path": "src/App.tsx", "content": "// Main app component", "language": "typescript" },
    { "path": "src/api/routes.ts", "content": "// API route handlers", "language": "typescript" },
    { "path": "package.json", "content": "{}", "language": "json" }
  ],
  "summary": "One sentence describing what was built."
}

PREVIEW HTML RULES:
- Complete <!DOCTYPE html> document, no external file dependencies
- Include: <script src="https://cdn.tailwindcss.com"></script>
- Dark theme: body bg #0D0D0D, cards #161B22, borders #21262D
- Use gold #FFCC33 or a vibrant accent color suited to the app
- Multiple working sections/views with JS navigation (show/hide)
- Include realistic placeholder data — real names, real numbers, real content
- Working interactive elements: buttons, forms, tabs, toggles
- Smooth CSS transitions and hover states
- Mobile-first responsive design
- KEEP UNDER 4000 characters total for fast rendering

FILES RULES:
- 4-6 files max. Include README.md, src/App.tsx, src/api/routes.ts, package.json
- Keep each file under 800 characters
- Focus on structure, not full implementation

CONSTRAINTS:
- Total response must be under 7000 tokens
- Prefer quality and coherence over quantity`;

const EDIT_SYSTEM_PROMPT = `You are Apex Studio AI OS in INTELLIGENT EDIT MODE.

CRITICAL: Return ONLY a raw JSON object. NO markdown fences. Start with { immediately.

{
  "preview_html": "COMPLETE updated standalone HTML preview",
  "files": [
    { "path": "changed/file.tsx", "content": "...", "language": "typescript" }
  ],
  "changed_files": ["changed/file.tsx"],
  "summary": "Friendly description of what was changed.",
  "affected_workflows": ["workflow-id-if-affected"]
}

Rules:
- Identify affected workflows from the project before changing
- Make SURGICAL changes only — never rewrite the whole project
- preview_html must be complete standalone HTML with all existing features preserved
- summary should be conversational and specific
- Keep response under 5000 tokens`;

// ── Generate — new project from scratch ──────────────────────────────────────

export async function generateApp(prompt: string): Promise<GenerateResult> {
  logger.info({ prompt: prompt.slice(0, 100) }, "AI Studio: generating new app");

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8000,
    temperature: 0.7,
    messages: [
      { role: "system", content: GENERATE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Generate this application. Return ONLY raw JSON, no markdown fences, no backticks.\n\nApp idea: ${prompt}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  logger.info({ rawLength: raw.length, preview: raw.slice(0, 120) }, "AI Studio: received generate response");
  return parseGenerateResult(raw);
}

// ── Edit — iterative targeted changes ─────────────────────────────────────────

export async function editApp(
  request: string,
  plan: AiStudioPlan,
  existingFiles: AiStudioFile[],
  previewHtml: string,
  history: AiStudioChatMessage[],
): Promise<EditResult> {
  logger.info({ request: request.slice(0, 100) }, "AI Studio: editing app");

  const filesSummary = existingFiles
    .map((f) => `### ${f.path}\n${f.content.slice(0, 500)}${f.content.length > 500 ? "\n…(truncated)" : ""}`)
    .join("\n\n");

  const historyText = history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "User" : "Apex"}: ${m.content.slice(0, 180)}`)
    .join("\n");

  const workflowsSummary = (plan.workflows ?? [])
    .map((w) => `• ${w.name}: ${w.steps.map((s) => s.action).join(" → ")}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 6000,
    temperature: 0.3,
    messages: [
      { role: "system", content: EDIT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Project: ${plan.project_name} (${plan.app_type})
Description: ${plan.description}
Workflows:\n${workflowsSummary}

Files:\n${filesSummary}

Recent chat:\n${historyText}

Change request: ${request}

Return ONLY raw JSON.`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  logger.info({ rawLength: raw.length }, "AI Studio: received edit response");
  return parseEditResult(raw, previewHtml);
}

// ── JSON extraction (handles markdown fences) ─────────────────────────────────

function extractJson(raw: string): string | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]?.trim().startsWith("{")) return fenced[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last > first) return raw.slice(first, last + 1);
  return null;
}

// ── Parsers ───────────────────────────────────────────────────────────────────

const DEFAULT_PLAN: AiStudioPlan = {
  project_name: "Apex App",
  app_type: "web_app",
  description: "AI-generated application",
  features: ["User authentication", "Dashboard", "Data management"],
  pages: ["Home", "Dashboard"],
  tech_stack: ["React", "Tailwind CSS", "Node.js"],
  workflows: [],
};

function parseGenerateResult(raw: string): GenerateResult {
  try {
    const jsonStr = extractJson(raw);
    if (!jsonStr) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const plan = (parsed.plan as AiStudioPlan) ?? DEFAULT_PLAN;

    if (!plan.workflows) plan.workflows = [];

    const files = Array.isArray(parsed.files)
      ? (parsed.files as AiStudioFile[]).filter((f) => f?.path && f?.content)
      : [];

    const previewHtml =
      typeof parsed.preview_html === "string" && parsed.preview_html.includes("<!DOCTYPE")
        ? parsed.preview_html
        : generateFallbackHtml(plan.project_name, plan.description);

    return {
      plan,
      files,
      previewHtml,
      summary: typeof parsed.summary === "string" ? parsed.summary : "Application generated.",
    };
  } catch (err) {
    logger.error({ err, rawPreview: raw.slice(0, 300) }, "Failed to parse AI Studio generate response");
    return {
      plan: DEFAULT_PLAN,
      files: [],
      previewHtml: generateFallbackHtml("Generated App", "Your app is being prepared."),
      summary: "Application generated.",
    };
  }
}

function parseEditResult(raw: string, fallbackPreview: string): EditResult {
  try {
    const jsonStr = extractJson(raw);
    if (!jsonStr) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    return {
      previewHtml:
        typeof parsed.preview_html === "string" && parsed.preview_html.includes("<html")
          ? parsed.preview_html
          : fallbackPreview,
      files: Array.isArray(parsed.files)
        ? (parsed.files as AiStudioFile[]).filter((f) => f?.path && f?.content)
        : [],
      changedFiles: Array.isArray(parsed.changed_files) ? (parsed.changed_files as string[]) : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "Changes applied.",
    };
  } catch (err) {
    logger.error({ err }, "Failed to parse AI Studio edit response");
    return { previewHtml: fallbackPreview, files: [], changedFiles: [], summary: "Changes applied." };
  }
}

// ── Fallback HTML ─────────────────────────────────────────────────────────────

function generateFallbackHtml(name: string, description: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0D0D0D] text-white min-h-screen flex items-center justify-center">
  <div class="text-center p-8 max-w-md">
    <div class="w-16 h-16 rounded-2xl bg-[#FFCC33]/10 border border-[#FFCC33]/20 flex items-center justify-center text-3xl mx-auto mb-6">⚡</div>
    <h1 class="text-3xl font-bold mb-3">${name}</h1>
    <p class="text-white/60 mb-6">${description}</p>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-[#161B22] border border-[#21262D] rounded-xl p-4"><div class="text-[#FFCC33] text-2xl font-bold">1,247</div><div class="text-white/40 text-sm mt-1">Total Users</div></div>
      <div class="bg-[#161B22] border border-[#21262D] rounded-xl p-4"><div class="text-green-400 text-2xl font-bold">98.2%</div><div class="text-white/40 text-sm mt-1">Uptime</div></div>
    </div>
    <div class="mt-6 text-sm text-white/30">Edit via chat to customize your app</div>
  </div>
</body>
</html>`;
}
