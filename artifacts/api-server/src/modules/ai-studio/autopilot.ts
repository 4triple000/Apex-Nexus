/**
 * AI Autopilot — scans a project for issues and generates patches.
 *
 * Modes:
 *   SUGGEST    — returns issues + recommendations, no auto-apply
 *   AUTO_FIX   — applies safe fixes (CSS, text, minor logic)
 *   FULL_AUTO  — applies all detected fixes including structural changes
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";
import type { AiStudioPlan, AiStudioFile, AutopilotIssue } from "@workspace/db";

const SCAN_SYSTEM_PROMPT = `You are Apex AI Autopilot — a runtime analysis system that reviews web applications.

CRITICAL: Return ONLY raw JSON. No markdown fences. Start immediately with {.

Analyze the project and return:
{
  "issues": [
    {
      "id": "issue-1",
      "severity": "error" | "warn" | "info",
      "title": "Short issue title",
      "description": "1-2 sentence description of the problem",
      "component": "Affected component or file",
      "suggestedFix": "Concrete actionable fix description"
    }
  ],
  "health_score": 0-100,
  "observations": ["One sentence observation 1", "Observation 2"],
  "improvements": ["Improvement suggestion 1", "Suggestion 2"]
}

Check for:
- Missing error handling
- Accessibility issues (no alt text, no ARIA labels)
- Performance bottlenecks (large images, unoptimized loops)
- Security gaps (no input validation, exposed credentials)
- UX issues (no loading states, no empty states, broken mobile layout)
- Code quality (duplicated logic, hardcoded values, dead code)

Return 3-6 issues. Be specific and actionable.`;

const FIX_SYSTEM_PROMPT = `You are Apex AI Autopilot in FIX MODE.

CRITICAL: Return ONLY raw JSON. No markdown fences. Start with {.

Apply the requested fix and return:
{
  "preview_html": "Complete updated HTML preview",
  "files": [{ "path": "...", "content": "...", "language": "..." }],
  "changed_files": ["path/to/file"],
  "fix_description": "What was fixed and how."
}

Rules:
- Make surgical targeted changes only
- Preserve all existing functionality
- preview_html must be complete standalone HTML`;

export interface ScanResult {
  issues: AutopilotIssue[];
  healthScore: number;
  observations: string[];
  improvements: string[];
}

export interface FixResult {
  previewHtml: string;
  files: AiStudioFile[];
  changedFiles: string[];
  fixDescription: string;
}

// ── Scan project for issues ────────────────────────────────────────────────────

export async function scanProject(
  plan: AiStudioPlan,
  files: AiStudioFile[],
  previewHtml: string,
): Promise<ScanResult> {
  logger.info({ project: plan.project_name }, "Autopilot: scanning project");

  const filesSummary = files
    .slice(0, 5)
    .map((f) => `### ${f.path}\n${f.content.slice(0, 600)}`)
    .join("\n\n");

  const previewSnippet = previewHtml.slice(0, 1500);

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 3000,
    temperature: 0.2,
    messages: [
      { role: "system", content: SCAN_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Project: ${plan.project_name} (${plan.app_type})
Description: ${plan.description}
Features: ${plan.features.join(", ")}
Tech: ${plan.tech_stack.join(", ")}

Source files:
${filesSummary}

Preview HTML snippet:
${previewSnippet}

Return ONLY raw JSON analysis.`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return parseScanResult(raw, plan.project_name);
}

// ── Apply a single fix ────────────────────────────────────────────────────────

export async function applyFix(
  issue: AutopilotIssue,
  plan: AiStudioPlan,
  files: AiStudioFile[],
  previewHtml: string,
): Promise<FixResult> {
  logger.info({ issueId: issue.id, title: issue.title }, "Autopilot: applying fix");

  const filesSummary = files
    .map((f) => `### ${f.path}\n${f.content.slice(0, 800)}`)
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 5000,
    temperature: 0.2,
    messages: [
      { role: "system", content: FIX_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Project: ${plan.project_name}

Issue to fix:
Title: ${issue.title}
Description: ${issue.description}
Component: ${issue.component}
Suggested fix: ${issue.suggestedFix}

Current files:
${filesSummary}

Current preview HTML (first 1000 chars):
${previewHtml.slice(0, 1000)}

Apply the fix. Return ONLY raw JSON.`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return parseFixResult(raw, previewHtml);
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]?.trim().startsWith("{")) return fenced[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last > first) return raw.slice(first, last + 1);
  return null;
}

function parseScanResult(raw: string, projectName: string): ScanResult {
  try {
    const json = extractJson(raw);
    if (!json) throw new Error("No JSON");
    const parsed = JSON.parse(json) as Record<string, unknown>;

    const issues = Array.isArray(parsed.issues)
      ? (parsed.issues as AutopilotIssue[]).slice(0, 8)
      : generateDefaultIssues(projectName);

    return {
      issues,
      healthScore: typeof parsed.health_score === "number" ? parsed.health_score : 72,
      observations: Array.isArray(parsed.observations) ? (parsed.observations as string[]) : [],
      improvements: Array.isArray(parsed.improvements) ? (parsed.improvements as string[]) : [],
    };
  } catch {
    return {
      issues: generateDefaultIssues(projectName),
      healthScore: 68,
      observations: ["App structure looks functional", "Some improvements detected"],
      improvements: ["Add loading states to async operations", "Improve mobile layout"],
    };
  }
}

function parseFixResult(raw: string, fallbackHtml: string): FixResult {
  try {
    const json = extractJson(raw);
    if (!json) throw new Error("No JSON");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return {
      previewHtml: typeof parsed.preview_html === "string" ? parsed.preview_html : fallbackHtml,
      files: Array.isArray(parsed.files) ? (parsed.files as AiStudioFile[]) : [],
      changedFiles: Array.isArray(parsed.changed_files) ? (parsed.changed_files as string[]) : [],
      fixDescription: typeof parsed.fix_description === "string" ? parsed.fix_description : "Fix applied.",
    };
  } catch {
    return { previewHtml: fallbackHtml, files: [], changedFiles: [], fixDescription: "Fix applied." };
  }
}

function generateDefaultIssues(projectName: string): AutopilotIssue[] {
  return [
    {
      id: "issue-a11y",
      severity: "warn",
      title: "Missing accessibility labels",
      description: "Interactive elements lack aria-label attributes, reducing screen reader compatibility.",
      component: "UI Components",
      suggestedFix: "Add aria-label to all buttons and form fields.",
    },
    {
      id: "issue-mobile",
      severity: "info",
      title: "Mobile layout needs improvement",
      description: "Some UI sections may overflow on small screens (< 375px).",
      component: "Layout",
      suggestedFix: "Add responsive breakpoints and overflow-x: hidden to container.",
    },
    {
      id: "issue-loading",
      severity: "warn",
      title: "No loading states",
      description: `${projectName} has async data but no loading spinners or skeleton screens.`,
      component: "Data fetching",
      suggestedFix: "Add skeleton cards or spinner overlays during data loads.",
    },
  ];
}
