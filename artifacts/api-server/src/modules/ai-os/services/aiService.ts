/**
 * Apex AI OS — AI Service
 *
 * Core intelligence layer for the AI OS.
 * Handles prompt-to-app generation and self-improvement loops.
 *
 * Functions:
 *   generateFromPrompt()   — Convert natural language → full project
 *   improveFromFeedback()  — Self-improve using memory/feedback data
 *   analyzeForPatterns()   — Extract insights from interaction logs
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { randomUUID } from "node:crypto";
import { logger } from "../../../lib/logger";
import { AI_OS_CONFIG, SYSTEM_PROMPTS } from "../core/config";
import type {
  GenerationResult,
  ImprovementResult,
  ImprovementContext,
  ImprovementSuggestion,
  OsWorkflow,
  OsProjectPlan,
  PatternInsight,
  CreateMemoryLogInput,
} from "../core/types";
import type { ApexOsMemoryLog } from "@workspace/db";

// ── JSON extraction utility ────────────────────────────────────────────────────

function extractJson(raw: string): string | null {
  if (!raw) return null;
  // Strip markdown code fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]?.trim().startsWith("{")) return fenced[1].trim();
  // Find outermost braces
  const first = raw.indexOf("{");
  const last  = raw.lastIndexOf("}");
  if (first !== -1 && last > first) return raw.slice(first, last + 1);
  return null;
}

// ── Default fallback values ────────────────────────────────────────────────────

function buildDefaultWorkflow(name: string, triggers: string[], steps: string[]): OsWorkflow {
  return {
    id: `wf-${randomUUID().slice(0, 8)}`,
    name,
    description: `Automated ${name.toLowerCase()}`,
    triggers,
    steps: steps.map((action, i) => ({
      id: `step-${i + 1}`,
      action,
      output: "Completed",
    })),
    status: "idle",
    createdAt: new Date().toISOString(),
  };
}

function buildFallbackResult(prompt: string): GenerationResult {
  return {
    plan: {
      goal: `Build: ${prompt.slice(0, 80)}`,
      features: ["Core functionality", "User interface", "Data management"],
      pages: ["Home", "Dashboard"],
      tech_stack: ["React", "Tailwind CSS", "Node.js"],
      api_routes: ["GET /api/health", "POST /api/data"],
    },
    generatedCode: `// Generated application — ${prompt.slice(0, 60)}\n// Edit via chat to customize`,
    previewHtml: buildFallbackHtml(prompt),
    workflows: [
      buildDefaultWorkflow("Core Data Flow", ["User submits form"], [
        "Validate input",
        "Process request",
        "Update UI",
      ]),
    ],
    summary: "Application scaffold generated. Use chat to refine.",
    tokensUsed: 0,
    durationMs: 0,
  };
}

function buildFallbackHtml(prompt: string): string {
  const name = prompt.slice(0, 40);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${name}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-[#0D0D0D] text-white min-h-screen flex items-center justify-center"><div class="text-center p-8"><div class="w-16 h-16 rounded-2xl bg-[#FFCC33]/10 border border-[#FFCC33]/20 flex items-center justify-center text-3xl mx-auto mb-6">⚡</div><h1 class="text-3xl font-bold mb-3">${name}</h1><p class="text-white/50 mb-6">AI OS Application</p><div class="grid grid-cols-2 gap-3 max-w-xs mx-auto"><div class="bg-[#161B22] border border-[#21262D] rounded-xl p-4"><div class="text-[#FFCC33] text-2xl font-bold">0</div><div class="text-white/40 text-sm mt-1">Records</div></div><div class="bg-[#161B22] border border-[#21262D] rounded-xl p-4"><div class="text-green-400 text-2xl font-bold">Live</div><div class="text-white/40 text-sm mt-1">Status</div></div></div></div></body></html>`;
}

// ── generateFromPrompt ─────────────────────────────────────────────────────────

export async function generateFromPrompt(
  prompt: string,
  options?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<GenerationResult> {
  const startMs = Date.now();
  logger.info({ prompt: prompt.slice(0, 100) }, "AI OS: generateFromPrompt");

  try {
    const response = await openai.chat.completions.create({
      model: options?.model ?? AI_OS_CONFIG.model.primary,
      max_completion_tokens: options?.maxTokens ?? AI_OS_CONFIG.model.maxTokens.generate,
      temperature: options?.temperature ?? AI_OS_CONFIG.model.temperature.generate,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.generate },
        {
          role: "user",
          content: `Build this application. Return ONLY raw JSON, no markdown, no explanation.\n\nRequest: ${prompt}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const tokensUsed = response.usage?.total_tokens ?? 0;
    const durationMs = Date.now() - startMs;

    logger.info({ rawLen: raw.length, tokensUsed, durationMs }, "AI OS: generation complete");

    return parseGenerationResponse(raw, prompt, tokensUsed, durationMs);
  } catch (err) {
    logger.error({ err }, "AI OS: generateFromPrompt failed");
    return { ...buildFallbackResult(prompt), durationMs: Date.now() - startMs };
  }
}

function parseGenerationResponse(
  raw: string,
  prompt: string,
  tokensUsed: number,
  durationMs: number,
): GenerationResult {
  try {
    const jsonStr = extractJson(raw);
    if (!jsonStr) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const plan = (parsed.plan as OsProjectPlan) ?? { goal: prompt, features: [], pages: [], tech_stack: [] };

    const workflows: OsWorkflow[] = Array.isArray(parsed.workflows)
      ? (parsed.workflows as OsWorkflow[]).map((w) => ({
          ...w,
          id: w.id ?? `wf-${randomUUID().slice(0, 8)}`,
          status: "idle" as const,
          createdAt: w.createdAt ?? new Date().toISOString(),
        }))
      : [];

    const previewHtml =
      typeof parsed.preview_html === "string" && parsed.preview_html.includes("<!DOCTYPE")
        ? parsed.preview_html
        : buildFallbackHtml(prompt);

    return {
      plan,
      generatedCode: typeof parsed.generated_code === "string" ? parsed.generated_code : `// ${prompt}`,
      previewHtml,
      workflows,
      summary: typeof parsed.summary === "string" ? parsed.summary : "Application generated.",
      tokensUsed,
      durationMs,
    };
  } catch (err) {
    logger.error({ err, rawPreview: raw.slice(0, 200) }, "AI OS: failed to parse generation response");
    return { ...buildFallbackResult(prompt), tokensUsed, durationMs };
  }
}

// ── improveFromFeedback ────────────────────────────────────────────────────────

export async function improveFromFeedback(
  projectId: number,
  generatedCode: string,
  plan: OsProjectPlan,
  recentLogs: ApexOsMemoryLog[],
  context?: ImprovementContext,
  autoApply = false,
): Promise<ImprovementResult> {
  const startMs = Date.now();
  logger.info({ projectId, autoApply }, "AI OS: improveFromFeedback");

  const logSummary = recentLogs
    .slice(0, 15)
    .map((l) => `[${l.type}] ${l.content.slice(0, 150)}${l.success === false ? " [FAILED]" : ""}`)
    .join("\n");

  const contextBlock = [
    `Project ID: ${projectId}`,
    `Goal: ${plan.goal}`,
    `Tech: ${plan.tech_stack.join(", ")}`,
    context?.userFeedback ? `User feedback: ${context.userFeedback}` : "",
    context?.errorLogs?.length ? `Errors:\n${context.errorLogs.slice(0, 5).join("\n")}` : "",
    recentLogs.length ? `Recent interaction log:\n${logSummary}` : "",
    `Current code (first 1000 chars):\n${generatedCode.slice(0, 1000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await openai.chat.completions.create({
      model: AI_OS_CONFIG.model.primary,
      max_completion_tokens: AI_OS_CONFIG.model.maxTokens.improve,
      temperature: AI_OS_CONFIG.model.temperature.improve,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.improve },
        {
          role: "user",
          content: `${contextBlock}\n\nReturn ONLY raw JSON with improvement suggestions.`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    return parseImprovementResponse(raw, projectId, autoApply, Date.now() - startMs);
  } catch (err) {
    logger.error({ err }, "AI OS: improveFromFeedback failed");
    return {
      projectId,
      suggestions: [],
      appliedCount: 0,
      summary: "Improvement analysis failed — try again.",
      durationMs: Date.now() - startMs,
    };
  }
}

function parseImprovementResponse(
  raw: string,
  projectId: number,
  autoApply: boolean,
  durationMs: number,
): ImprovementResult {
  try {
    const jsonStr = extractJson(raw);
    if (!jsonStr) throw new Error("No JSON");
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const suggestions: ImprovementSuggestion[] = Array.isArray(parsed.suggestions)
      ? (parsed.suggestions as ImprovementSuggestion[]).map((s) => ({
          ...s,
          id: s.id ?? `imp-${randomUUID().slice(0, 8)}`,
          applied: autoApply && s.priority === "high",
        }))
      : [];

    const appliedCount = suggestions.filter((s) => s.applied).length;

    return {
      projectId,
      suggestions,
      appliedCount,
      summary: typeof parsed.summary === "string" ? parsed.summary : `Found ${suggestions.length} improvements.`,
      updatedCode: typeof parsed.updated_code === "string" ? parsed.updated_code : undefined,
      durationMs,
    };
  } catch {
    return { projectId, suggestions: [], appliedCount: 0, summary: "Could not parse improvements.", durationMs };
  }
}

// ── analyzeForPatterns ─────────────────────────────────────────────────────────

export async function analyzeForPatterns(logs: ApexOsMemoryLog[]): Promise<PatternInsight[]> {
  if (logs.length < AI_OS_CONFIG.memory.patternAnalysisMinLogs) {
    return [];
  }

  logger.info({ logCount: logs.length }, "AI OS: analyzeForPatterns");

  // Lightweight client-side pattern analysis (no AI call needed for basic patterns)
  const byType = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.type] = (acc[l.type] ?? 0) + 1;
    return acc;
  }, {});

  const errorRate = (byType["error"] ?? 0) / logs.length;
  const failedLogs = logs.filter((l) => l.success === false);
  const failRate = failedLogs.length / logs.length;

  const insights: PatternInsight[] = [];

  if (errorRate > 0.2) {
    insights.push({
      pattern: "High error rate",
      frequency: byType["error"] ?? 0,
      impact: "negative",
      recommendation: "Review error logs and apply fixes via Autopilot",
      affectedProjects: [...new Set(logs.filter((l) => l.type === "error").map((l) => l.projectId).filter(Boolean) as number[])],
    });
  }

  if (failRate > 0.3) {
    insights.push({
      pattern: "High workflow failure rate",
      frequency: failedLogs.length,
      impact: "negative",
      recommendation: "Validate workflow steps and add error handling",
      affectedProjects: [...new Set(failedLogs.map((l) => l.projectId).filter(Boolean) as number[])],
    });
  }

  const promptLogs = logs.filter((l) => l.type === "prompt");
  if (promptLogs.length > 5) {
    insights.push({
      pattern: "Active prompt iteration",
      frequency: promptLogs.length,
      impact: "positive",
      recommendation: "User is actively improving — enable Full Auto mode for faster iterations",
      affectedProjects: [...new Set(promptLogs.map((l) => l.projectId).filter(Boolean) as number[])],
    });
  }

  return insights;
}
