/**
 * Apex AI OS — Self-Improving System
 * ───────────────────────────────────
 * Apex learns from every interaction and improves future outputs.
 *
 * Learning Loop:
 *   INPUT → OUTPUT → RESULT → ANALYSIS → IMPROVEMENT
 *
 * Four core functions:
 *   analyzeMemory()           — Scan logs → structured MemoryAnalysis
 *   detectPatterns()          — Pure pattern detection → DetectedPattern[]
 *   improveGenerationModel()  — AI-enhanced generation parameters (versioned)
 *   updateWorkflowTemplates() — Deterministic workflow template patches (versioned)
 *
 * Additional:
 *   runLearningLoop()         — Full pipeline (calls all four above)
 *   computeProjectScore()     — stability / efficiency / success rate (0-100 each)
 *   getImprovementHistory()   — Versioned before/after records from DB
 *   getLearnedParameters()    — Current in-memory learned overrides
 *
 * Rules:
 *   • Never delete data
 *   • Always version improvements (semantic: v{major}.{minor}.{patch})
 *   • Store before/after comparisons for every change
 *   • Actively modifies future behavior — NOT just logging
 */

import { randomUUID } from "node:crypto";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, apexOsImprovementVersionsTable, apexOsProjectScoresTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  getRecent,
  getByProject,
  getSummary,
  log as memoryLog,
} from "../modules/ai-os/services/memoryService";
import {
  listWorkflows,
  getWorkflow,
  updateWorkflow,
} from "../workflows/workflowEngine";

// Local mirror of ApexOsMemoryLog (avoids cross-package TS resolution issues)
interface MemoryLogEntry {
  id:         number;
  projectId:  number | null;
  sessionId:  string | null;
  type:       string;
  content:    string | null;
  metadata:   Record<string, unknown> | null;
  success:    boolean | null;
  durationMs: number | null;
  timestamp?: Date | string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AI_MODEL = "gpt-5.2";

const THRESHOLDS = {
  SLOW_GENERATION_MS:         10_000,   // AI output slower than this = slow pattern
  REPEATED_FAILURE_COUNT:     3,        // Same step failing ≥ this = repeated failure pattern
  FRICTION_SESSION_COUNT:     3,        // Same session failing ≥ this = friction
  LOW_SUCCESS_RATE:           0.6,      // Success rate below this = low success pattern
  HIGH_ERROR_RATE:            0.2,      // Error log proportion above this = high error pattern
  MIN_LOGS_FOR_ANALYSIS:      5,        // Minimum logs needed before pattern detection runs
  RETRY_INCREMENT:            2,        // Retries added to failing steps
  TIMEOUT_MULTIPLIER:         1.5,      // Timeout factor for slow steps
  MAX_TIMEOUT_MS:             90_000,
} as const;

// Score weights
const SCORE_WEIGHTS = {
  stability:   0.40,
  efficiency:  0.30,
  successRate: 0.30,
} as const;

// ── Pattern types ─────────────────────────────────────────────────────────────

export type PatternClass =
  | "REPEATED_WORKFLOW_FAILURE"  // Same step failing ≥ N times
  | "SLOW_GENERATION"            // AI calls taking too long
  | "UI_UX_FRICTION"             // Same session hitting repeated errors
  | "BROKEN_API_STRUCTURE"       // Same API endpoint failing repeatedly
  | "LOW_SUCCESS_RATE"           // Overall success rate below threshold
  | "HIGH_ERROR_RATE";           // Error logs > 20% of total

export type ImprovementTargetType =
  | "generation_model"     // AI Studio generation parameters
  | "workflow_template"    // Workflow template defaults (retries, timeouts)
  | "prompt_config"        // AI system prompt enrichment
  | "retry_policy";        // Step-level retry policy

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface DetectedPattern {
  id:          string;
  class:       PatternClass;
  title:       string;
  description: string;
  frequency:   number;            // How many times this pattern appears
  severity:    "low" | "medium" | "high" | "critical";
  evidence:    {
    logIds?:      number[];
    sessionIds?:  string[];
    workflowIds?: string[];
    stepIds?:     string[];
    endpoints?:   string[];
    avgDurationMs?: number;
    failureRate?:   number;
  };
  suggestedAction: string;
  projectId?: number;
  detectedAt:  string;
}

export interface MemoryAnalysis {
  analysisId:   string;
  projectId?:   number;
  scannedAt:    string;
  logsAnalyzed: number;
  byType:       Record<string, number>;
  successRate:  number;          // 0-100
  avgDurationMs: number;
  slowOperations: number;
  failedOperations: number;
  activeSessionCount: number;
  timeSpanMs?: number;
  patterns:     DetectedPattern[];
}

export interface ImprovementVersion {
  id:          string;            // DB id (stringified)
  version:     string;            // e.g. "v1.3.2"
  targetType:  ImprovementTargetType;
  targetId:    string;
  rationale:   string;
  before:      Record<string, unknown>;
  after:       Record<string, unknown>;
  patternIds:  string[];
  patternTypes: string[];
  loopId?:     string;
  projectId?:  number;
  appliedAt:   string;
}

export interface ProjectScore {
  projectId:        number;
  stabilityScore:   number;   // 0-100
  efficiencyScore:  number;   // 0-100
  successRateScore: number;   // 0-100
  overallScore:     number;   // weighted average
  grade:            "A" | "B" | "C" | "D" | "F";
  sampleSize:       number;
  computedAt:       string;
  breakdown:        {
    stabilityWeight:   number;
    efficiencyWeight:  number;
    successRateWeight: number;
  };
}

export interface LearningLoopResult {
  loopId:        string;
  completedAt:   string;
  projectId?:    number;
  logsAnalyzed:  number;
  patternsFound: DetectedPattern[];
  improvements:  ImprovementVersion[];
  scores?:       ProjectScore;
  summary: {
    patternsDetected:         number;
    improvementsApplied:      number;
    generationModelUpdated:   boolean;
    workflowTemplatesUpdated: number;
    knowledgeExtracted:       number;
  };
  learningLoop: {
    input:       string;
    output:      string;
    result:      string;
    analysis:    string;
    improvement: string;
  };
}

// ── Learned parameters (active overrides for future operations) ────────────────
// These are NOT just logs — they actively change behavior on next invocation.

interface LearnedParameters {
  generation: {
    temperature?:          number;
    additionalInstructions: string[];
    avoidPatterns:          string[];
    preferredComplexity?:   "low" | "medium" | "high";
    lastUpdatedAt?:         string;
    version?:               string;
  };
  workflowDefaults: {
    stepRetryOverrides:   Record<string, number>;    // stepId → learned retry count
    stepTimeoutOverrides: Record<string, number>;    // stepId → learned timeoutMs
    lastUpdatedAt?:       string;
  };
  knowledgeBase: Array<{
    id:          string;
    pattern:     PatternClass;
    insight:     string;
    appliedAt:   string;
    confidence:  number;
  }>;
}

let _learned: LearnedParameters = {
  generation: {
    additionalInstructions: [],
    avoidPatterns:          [],
  },
  workflowDefaults: {
    stepRetryOverrides:   {},
    stepTimeoutOverrides: {},
  },
  knowledgeBase: [],
};

// Version counters per targetType (incremented for each improvement)
const _versionCounters: Record<string, { major: number; minor: number; patch: number }> = {};

function nextVersion(targetType: ImprovementTargetType): string {
  const c = _versionCounters[targetType] ?? { major: 1, minor: 0, patch: 0 };
  c.patch++;
  if (c.patch >= 10) { c.minor++; c.patch = 0; }
  if (c.minor >= 10) { c.major++; c.minor = 0; }
  _versionCounters[targetType] = c;
  return `v${c.major}.${c.minor}.${c.patch}`;
}

// ── JSON extraction utility ───────────────────────────────────────────────────

function extractJson(raw: string): string | null {
  if (!raw?.trim()) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]?.trim().startsWith("{")) return fenced[1].trim();
  const first = raw.indexOf("{");
  const last  = raw.lastIndexOf("}");
  if (first !== -1 && last > first) return raw.slice(first, last + 1);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. analyzeMemory — Scan memory logs → structured MemoryAnalysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * INPUT phase of the learning loop.
 * Reads from the memory system and produces a rich structured analysis
 * including detected patterns — ready for improvement actions.
 */
export async function analyzeMemory(options?: {
  projectId?: number;
  limit?: number;
}): Promise<MemoryAnalysis> {
  const limit = options?.limit ?? 200;
  const analysisId = randomUUID();

  logger.info({ projectId: options?.projectId, limit }, "SelfImprovement: analyzeMemory start");

  const logs: MemoryLogEntry[] = options?.projectId
    ? await getByProject(options.projectId, { limit })
    : await getRecent(limit);

  if (logs.length < THRESHOLDS.MIN_LOGS_FOR_ANALYSIS) {
    const emptyPatterns: DetectedPattern[] = [];
    return {
      analysisId,
      projectId: options?.projectId,
      scannedAt: new Date().toISOString(),
      logsAnalyzed: logs.length,
      byType: {},
      successRate: 100,
      avgDurationMs: 0,
      slowOperations: 0,
      failedOperations: 0,
      activeSessionCount: 0,
      patterns: emptyPatterns,
    };
  }

  // Aggregate stats
  const byType = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.type] = (acc[l.type] ?? 0) + 1;
    return acc;
  }, {});

  const logsWithSuccess = logs.filter((l) => l.success !== null);
  const successRate = logsWithSuccess.length > 0
    ? Math.round((logsWithSuccess.filter((l) => l.success).length / logsWithSuccess.length) * 100)
    : 100;

  const logsWithDuration = logs.filter((l) => l.durationMs != null);
  const avgDurationMs = logsWithDuration.length > 0
    ? Math.round(logsWithDuration.reduce((s, l) => s + l.durationMs!, 0) / logsWithDuration.length)
    : 0;

  const slowOperations = logsWithDuration.filter(
    (l) => l.durationMs! > THRESHOLDS.SLOW_GENERATION_MS,
  ).length;
  const failedOperations = logs.filter((l) => l.success === false).length;
  const activeSessionCount = new Set(logs.map((l) => l.sessionId).filter(Boolean)).size;

  const timestamps = logs
    .map((l) => (l.timestamp ? new Date(l.timestamp as string | Date).getTime() : null))
    .filter((t): t is number => t !== null);
  const timeSpanMs = timestamps.length >= 2
    ? Math.max(...timestamps) - Math.min(...timestamps)
    : undefined;

  // Detect patterns from the raw logs
  const patterns = detectPatterns(logs, options?.projectId);

  logger.info(
    { analysisId, logsAnalyzed: logs.length, patternsFound: patterns.length },
    "SelfImprovement: analyzeMemory complete",
  );

  return {
    analysisId,
    projectId: options?.projectId,
    scannedAt: new Date().toISOString(),
    logsAnalyzed: logs.length,
    byType,
    successRate,
    avgDurationMs,
    slowOperations,
    failedOperations,
    activeSessionCount,
    timeSpanMs,
    patterns,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. detectPatterns — Pure pattern detection on a set of logs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OUTPUT phase of the learning loop.
 * Pure function — no side effects, no DB writes, no AI calls.
 * Takes logs and returns all detected patterns.
 *
 * Detects:
 *   REPEATED_WORKFLOW_FAILURE  — same step failing ≥ 3 times
 *   SLOW_GENERATION            — AI calls taking > 10s
 *   UI_UX_FRICTION             — same session failing ≥ 3 times
 *   BROKEN_API_STRUCTURE       — same endpoint in multiple error logs
 *   LOW_SUCCESS_RATE           — overall success < 60%
 *   HIGH_ERROR_RATE            — error logs > 20% of total
 */
export function detectPatterns(
  logs: MemoryLogEntry[],
  projectId?: number,
): DetectedPattern[] {
  if (logs.length < THRESHOLDS.MIN_LOGS_FOR_ANALYSIS) return [];

  const patterns: DetectedPattern[] = [];
  const now = new Date().toISOString();

  // ── REPEATED_WORKFLOW_FAILURE ─────────────────────────────────────────────
  {
    const stepFailures = new Map<string, MemoryLogEntry[]>();
    for (const log of logs) {
      if (log.success === false && log.type === "workflow") {
        const meta = (log.metadata ?? {}) as Record<string, unknown>;
        const key  = `${meta.workflowId ?? "unknown"}::${meta.stepId ?? "unknown"}`;
        const arr  = stepFailures.get(key) ?? [];
        arr.push(log);
        stepFailures.set(key, arr);
      }
    }
    for (const [key, failures] of stepFailures) {
      if (failures.length >= THRESHOLDS.REPEATED_FAILURE_COUNT) {
        const [wfId, stepId] = key.split("::");
        const severity =
          failures.length >= 10 ? "critical" :
          failures.length >= 6  ? "high"     :
          failures.length >= 4  ? "medium"   : "low";

        patterns.push({
          id:          randomUUID(),
          class:       "REPEATED_WORKFLOW_FAILURE",
          title:       `Step "${stepId}" in workflow "${wfId}" fails repeatedly`,
          description: `Step "${stepId}" has failed ${failures.length} times in recent history. This indicates a systemic configuration issue.`,
          frequency:   failures.length,
          severity,
          evidence: {
            logIds:      failures.map((l) => l.id),
            workflowIds: [wfId],
            stepIds:     [stepId],
          },
          suggestedAction: `Increase retries (+${THRESHOLDS.RETRY_INCREMENT}) and timeout (×${THRESHOLDS.TIMEOUT_MULTIPLIER}) for step "${stepId}"`,
          projectId,
          detectedAt: now,
        });
      }
    }
  }

  // ── SLOW_GENERATION ───────────────────────────────────────────────────────
  {
    const slowLogs = logs.filter(
      (l) =>
        (l.type === "ai_output" || l.type === "prompt") &&
        (l.durationMs ?? 0) > THRESHOLDS.SLOW_GENERATION_MS,
    );
    if (slowLogs.length >= 2) {
      const avgMs = Math.round(
        slowLogs.reduce((s, l) => s + (l.durationMs ?? 0), 0) / slowLogs.length,
      );
      const worstMs = Math.max(...slowLogs.map((l) => l.durationMs ?? 0));

      patterns.push({
        id:          randomUUID(),
        class:       "SLOW_GENERATION",
        title:       `AI generation is consistently slow (avg ${avgMs}ms)`,
        description: `${slowLogs.length} AI operations exceeded ${THRESHOLDS.SLOW_GENERATION_MS}ms. Worst: ${worstMs}ms. This degrades user experience.`,
        frequency:   slowLogs.length,
        severity:    avgMs > 60_000 ? "critical" : avgMs > 30_000 ? "high" : "medium",
        evidence: {
          logIds:       slowLogs.map((l) => l.id),
          avgDurationMs: avgMs,
        },
        suggestedAction: "Reduce generation complexity, add caching guidance to system prompt, or tune temperature",
        projectId,
        detectedAt: now,
      });
    }
  }

  // ── UI_UX_FRICTION ────────────────────────────────────────────────────────
  {
    const sessionFails = new Map<string, MemoryLogEntry[]>();
    for (const log of logs) {
      if (log.success === false && log.sessionId) {
        const arr = sessionFails.get(log.sessionId) ?? [];
        arr.push(log);
        sessionFails.set(log.sessionId, arr);
      }
    }
    const frictionSessions = [...sessionFails.entries()].filter(
      ([, fails]) => fails.length >= THRESHOLDS.FRICTION_SESSION_COUNT,
    );
    if (frictionSessions.length > 0) {
      const totalFails = frictionSessions.reduce((s, [, f]) => s + f.length, 0);
      patterns.push({
        id:          randomUUID(),
        class:       "UI_UX_FRICTION",
        title:       `${frictionSessions.length} user session(s) hitting repeated errors`,
        description: `${frictionSessions.length} sessions experienced ${totalFails} combined failures. Users are stuck.`,
        frequency:   totalFails,
        severity:    frictionSessions.length >= 5 ? "high" : "medium",
        evidence: {
          logIds:     frictionSessions.flatMap(([, f]) => f.map((l) => l.id)),
          sessionIds: frictionSessions.map(([sid]) => sid),
          failureRate: totalFails / logs.length,
        },
        suggestedAction: "Add better error recovery instructions to AI Studio generation prompt",
        projectId,
        detectedAt: now,
      });
    }
  }

  // ── BROKEN_API_STRUCTURE ──────────────────────────────────────────────────
  {
    const endpointFails = new Map<string, number>();
    for (const log of logs) {
      if (log.success === false) {
        const meta = (log.metadata ?? {}) as Record<string, unknown>;
        const ep   = meta.endpoint as string | undefined;
        if (ep) endpointFails.set(ep, (endpointFails.get(ep) ?? 0) + 1);
      }
    }
    for (const [endpoint, count] of endpointFails) {
      if (count >= 3) {
        patterns.push({
          id:          randomUUID(),
          class:       "BROKEN_API_STRUCTURE",
          title:       `API endpoint "${endpoint}" is failing repeatedly`,
          description: `Endpoint "${endpoint}" has ${count} failures in recent history. Generated API structure may be incorrect.`,
          frequency:   count,
          severity:    count >= 10 ? "critical" : count >= 5 ? "high" : "medium",
          evidence:    { endpoints: [endpoint] },
          suggestedAction: "Improve API route generation in AI Studio to produce more robust handlers",
          projectId,
          detectedAt: now,
        });
      }
    }
  }

  // ── LOW_SUCCESS_RATE ──────────────────────────────────────────────────────
  {
    const withOutcome = logs.filter((l) => l.success !== null);
    if (withOutcome.length >= 10) {
      const rate = withOutcome.filter((l) => l.success).length / withOutcome.length;
      if (rate < THRESHOLDS.LOW_SUCCESS_RATE) {
        patterns.push({
          id:          randomUUID(),
          class:       "LOW_SUCCESS_RATE",
          title:       `Low overall success rate: ${Math.round(rate * 100)}%`,
          description: `Only ${Math.round(rate * 100)}% of operations succeed (threshold: ${Math.round(THRESHOLDS.LOW_SUCCESS_RATE * 100)}%). System needs tuning.`,
          frequency:   withOutcome.filter((l) => !l.success).length,
          severity:    rate < 0.3 ? "critical" : rate < 0.45 ? "high" : "medium",
          evidence:    { failureRate: 1 - rate },
          suggestedAction: "Run full autopilot scan + improve generation model for more reliable outputs",
          projectId,
          detectedAt: now,
        });
      }
    }
  }

  // ── HIGH_ERROR_RATE ────────────────────────────────────────────────────────
  {
    const errorCount = logs.filter((l) => l.type === "error").length;
    const errorRate  = errorCount / logs.length;
    if (errorRate > THRESHOLDS.HIGH_ERROR_RATE && errorCount >= 3) {
      patterns.push({
        id:          randomUUID(),
        class:       "HIGH_ERROR_RATE",
        title:       `High error log rate: ${Math.round(errorRate * 100)}%`,
        description: `${errorCount} error entries out of ${logs.length} total logs. Normal operation should have < ${Math.round(THRESHOLDS.HIGH_ERROR_RATE * 100)}%.`,
        frequency:   errorCount,
        severity:    errorRate > 0.5 ? "critical" : errorRate > 0.35 ? "high" : "medium",
        evidence:    { failureRate: errorRate, logIds: logs.filter((l) => l.type === "error").map((l) => l.id) },
        suggestedAction: "Review error sources and add error handling guidance to generation model",
        projectId,
        detectedAt: now,
      });
    }
  }

  return patterns;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. improveGenerationModel — AI-powered enhancement of generation parameters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RESULT phase — generation model branch.
 * Takes detected patterns, uses AI to generate enhanced instructions, then:
 *   1. Updates in-memory learnedParameters.generation (active — changes next AI call)
 *   2. Stores a versioned before/after record to DB
 *
 * Returns the ImprovementVersion or null if no improvement was needed.
 */
export async function improveGenerationModel(
  patterns: DetectedPattern[],
  options?: { projectId?: number; loopId?: string },
): Promise<ImprovementVersion | null> {
  const relevantPatterns = patterns.filter((p) =>
    ["SLOW_GENERATION", "UI_UX_FRICTION", "BROKEN_API_STRUCTURE", "LOW_SUCCESS_RATE", "HIGH_ERROR_RATE"].includes(p.class),
  );

  if (relevantPatterns.length === 0) {
    logger.info("SelfImprovement: improveGenerationModel — no relevant patterns, skipping");
    return null;
  }

  logger.info(
    { patterns: relevantPatterns.map((p) => p.class) },
    "SelfImprovement: improveGenerationModel start",
  );

  const patternSummary = relevantPatterns
    .map((p) => `• [${p.class}/${p.severity}] ${p.description} → ${p.suggestedAction}`)
    .join("\n");

  const currentParams = {
    temperature:            _learned.generation.temperature ?? 0.7,
    additionalInstructions: [..._learned.generation.additionalInstructions],
    avoidPatterns:          [..._learned.generation.avoidPatterns],
    preferredComplexity:    _learned.generation.preferredComplexity ?? "medium",
  };

  let aiSuggestion: Record<string, unknown> | null = null;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 600,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are an AI parameter optimizer for the Apex AI OS self-improving system.
Given patterns detected from real usage logs, suggest improvements to the AI generation model parameters.
Return ONLY raw JSON — no markdown, no explanation.

JSON format:
{
  "temperature": <number 0.1-1.0>,
  "additionalInstructions": [<string>, ...],
  "avoidPatterns": [<string>, ...],
  "preferredComplexity": "low"|"medium"|"high",
  "rationale": "<one sentence explaining the changes>"
}

Rules:
- additionalInstructions: specific guidance to add to the system prompt for better generation
- avoidPatterns: phrases or patterns to avoid in generated code/config
- Keep suggestions targeted to the patterns provided
- Never increase temperature above 0.9 or reduce below 0.1`,
        },
        {
          role: "user",
          content: `Current parameters:\n${JSON.stringify(currentParams, null, 2)}\n\nDetected patterns:\n${patternSummary}\n\nSuggest improvements.`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const jsonStr = extractJson(raw);
    if (jsonStr) {
      aiSuggestion = JSON.parse(jsonStr) as Record<string, unknown>;
    }
  } catch (err) {
    logger.warn({ err }, "SelfImprovement: improveGenerationModel AI call failed — using heuristic");
  }

  // Heuristic fallback if AI call fails
  if (!aiSuggestion) {
    const hasSlowGen = relevantPatterns.some((p) => p.class === "SLOW_GENERATION");
    const hasFriction = relevantPatterns.some((p) => p.class === "UI_UX_FRICTION");
    aiSuggestion = {
      temperature: hasSlowGen ? Math.max(0.3, (currentParams.temperature ?? 0.7) - 0.1) : currentParams.temperature,
      additionalInstructions: [
        ...(hasFriction ? ["Always include error handling and loading states in generated UI"] : []),
        ...(hasSlowGen  ? ["Prefer simpler, more focused implementations over complex multi-feature ones"] : []),
        "Always validate generated API routes match the declared schema",
      ],
      avoidPatterns: ["nested callback hell", "unhandled promise rejections", "missing error boundaries"],
      preferredComplexity: hasSlowGen ? "low" : currentParams.preferredComplexity,
      rationale: `Heuristic improvement based on ${relevantPatterns.map((p) => p.class).join(", ")}`,
    };
  }

  const newParams = {
    temperature:            (aiSuggestion.temperature as number) ?? currentParams.temperature,
    additionalInstructions: mergeUnique(
      currentParams.additionalInstructions,
      (aiSuggestion.additionalInstructions as string[]) ?? [],
    ),
    avoidPatterns: mergeUnique(
      currentParams.avoidPatterns,
      (aiSuggestion.avoidPatterns as string[]) ?? [],
    ),
    preferredComplexity: (["low", "medium", "high"] as const).find((c) => c === aiSuggestion.preferredComplexity)
      ?? currentParams.preferredComplexity,
  };

  // Check if anything actually changed
  const changed =
    newParams.temperature !== currentParams.temperature ||
    newParams.additionalInstructions.length !== currentParams.additionalInstructions.length ||
    newParams.avoidPatterns.length !== currentParams.avoidPatterns.length;

  if (!changed) {
    logger.info("SelfImprovement: improveGenerationModel — parameters unchanged, skipping version");
    return null;
  }

  // Apply to in-memory learned params — this actively changes future behavior
  const version = nextVersion("generation_model");
  _learned.generation = {
    ...newParams,
    lastUpdatedAt: new Date().toISOString(),
    version,
  };

  logger.info(
    { version, temperature: newParams.temperature, instructions: newParams.additionalInstructions.length },
    "SelfImprovement: generation model updated (active)",
  );

  // Persist versioned record to DB
  const rationale = (aiSuggestion.rationale as string) ?? `Improvement from patterns: ${relevantPatterns.map((p) => p.class).join(", ")}`;
  const stored = await storeVersion({
    version,
    targetType: "generation_model",
    targetId:   AI_MODEL,
    rationale,
    beforeState: currentParams,
    afterState:  newParams,
    patternIds:  relevantPatterns.map((p) => p.id),
    patternTypes: relevantPatterns.map((p) => p.class),
    loopId:      options?.loopId,
    projectId:   options?.projectId,
  });

  // Store knowledge entry
  _learned.knowledgeBase.push({
    id:         randomUUID(),
    pattern:    relevantPatterns[0]!.class,
    insight:    rationale,
    appliedAt:  new Date().toISOString(),
    confidence: 0.8,
  });

  // Log to memory system
  await memoryLog({
    projectId:  options?.projectId,
    type:       "improvement",
    content:    `Self-improvement: generation model updated to ${version} — ${rationale}`,
    metadata: {
      improvementVersion: version,
      targetType:         "generation_model",
      targetId:           AI_MODEL,
      patternClasses:     relevantPatterns.map((p) => p.class),
      loopId:             options?.loopId,
      before:             currentParams,
      after:              newParams,
    },
    success: true,
  }).catch(() => {});

  return stored;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. updateWorkflowTemplates — Deterministic template patching from failure patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RESULT phase — workflow template branch.
 * For each REPEATED_WORKFLOW_FAILURE pattern:
 *   1. Find the matching workflow + step in the registry
 *   2. Bump retries by RETRY_INCREMENT
 *   3. Extend timeout by TIMEOUT_MULTIPLIER
 *   4. Update in-memory stepRetryOverrides and stepTimeoutOverrides (active)
 *   5. Store versioned before/after to DB
 *
 * Returns all ImprovementVersions applied.
 */
export async function updateWorkflowTemplates(
  patterns: DetectedPattern[],
  options?: { loopId?: string },
): Promise<ImprovementVersion[]> {
  const failurePatterns = patterns.filter((p) => p.class === "REPEATED_WORKFLOW_FAILURE");
  if (failurePatterns.length === 0) {
    logger.info("SelfImprovement: updateWorkflowTemplates — no failure patterns, skipping");
    return [];
  }

  logger.info({ count: failurePatterns.length }, "SelfImprovement: updateWorkflowTemplates start");

  const improvements: ImprovementVersion[] = [];

  for (const pattern of failurePatterns) {
    const wfId   = pattern.evidence.workflowIds?.[0];
    const stepId = pattern.evidence.stepIds?.[0];
    if (!wfId || !stepId) continue;

    const workflow = await getWorkflow(wfId);
    if (!workflow) {
      // Workflow not in registry (e.g. after server restart) — still record the learned override
      const currentRetries = _learned.workflowDefaults.stepRetryOverrides[stepId] ?? 0;
      const currentTimeout = _learned.workflowDefaults.stepTimeoutOverrides[stepId] ?? 5_000;
      const newRetries     = currentRetries + THRESHOLDS.RETRY_INCREMENT;
      const newTimeout     = Math.min(
        Math.round(currentTimeout * THRESHOLDS.TIMEOUT_MULTIPLIER),
        THRESHOLDS.MAX_TIMEOUT_MS,
      );

      const version = nextVersion("retry_policy");
      const stored = await storeVersion({
        version,
        targetType: "retry_policy",
        targetId:   `${wfId}:step:${stepId}`,
        rationale:  `Step "${stepId}" failed ${pattern.frequency}x — learned retry/timeout policy stored for next workflow registration`,
        beforeState: { retries: currentRetries, timeoutMs: currentTimeout },
        afterState:  { retries: newRetries,     timeoutMs: newTimeout },
        patternIds:  [pattern.id],
        patternTypes: [pattern.class],
        loopId:      options?.loopId,
      });

      _learned.workflowDefaults.stepRetryOverrides[stepId]   = newRetries;
      _learned.workflowDefaults.stepTimeoutOverrides[stepId] = newTimeout;
      _learned.workflowDefaults.lastUpdatedAt = new Date().toISOString();

      logger.info({ version, stepId, newRetries, newTimeout }, "SelfImprovement: retry policy learned (step not in registry)");
      improvements.push(stored);
      continue;
    }

    const step = workflow.steps.find((s) => s.stepId === stepId);
    if (!step) continue;

    const currentRetries = step.retries ?? 0;
    const currentTimeout = step.timeoutMs ?? 5_000;
    const newRetries     = currentRetries + THRESHOLDS.RETRY_INCREMENT;
    const newTimeout     = Math.min(
      Math.round(currentTimeout * THRESHOLDS.TIMEOUT_MULTIPLIER),
      THRESHOLDS.MAX_TIMEOUT_MS,
    );

    // Apply to workflow engine (active — changes behavior immediately)
    try {
      await updateWorkflow(wfId, {
        steps: workflow.steps.map((s) =>
          s.stepId === stepId
            ? { ...s, retries: newRetries, timeoutMs: newTimeout }
            : s,
        ),
      });
    } catch (err) {
      logger.warn({ err, wfId, stepId }, "SelfImprovement: workflow update failed — recording learned policy only");
    }

    // Update learned overrides (active even if workflow update failed)
    _learned.workflowDefaults.stepRetryOverrides[stepId]   = newRetries;
    _learned.workflowDefaults.stepTimeoutOverrides[stepId] = newTimeout;
    _learned.workflowDefaults.lastUpdatedAt = new Date().toISOString();

    const version = nextVersion("workflow_template");
    const stored = await storeVersion({
      version,
      targetType: "workflow_template",
      targetId:   `${wfId}:step:${stepId}`,
      rationale:  `Step "${stepId}" failed ${pattern.frequency}x — retries bumped +${THRESHOLDS.RETRY_INCREMENT}, timeout ×${THRESHOLDS.TIMEOUT_MULTIPLIER}`,
      beforeState: { stepId, retries: currentRetries, timeoutMs: currentTimeout, workflowId: wfId },
      afterState:  { stepId, retries: newRetries,     timeoutMs: newTimeout,     workflowId: wfId },
      patternIds:  [pattern.id],
      patternTypes: [pattern.class],
      loopId:      options?.loopId,
    });

    logger.info({ version, wfId, stepId, newRetries, newTimeout }, "SelfImprovement: workflow template updated (active)");
    improvements.push(stored);

    // Log to memory
    await memoryLog({
      type:    "improvement",
      content: `Self-improvement: workflow "${wfId}" step "${stepId}" updated to ${version} — retries ${currentRetries}→${newRetries}, timeout ${currentTimeout}→${newTimeout}ms`,
      metadata: {
        improvementVersion: version,
        targetType:        "workflow_template",
        targetId:          `${wfId}:step:${stepId}`,
        before:            { retries: currentRetries, timeoutMs: currentTimeout },
        after:             { retries: newRetries,     timeoutMs: newTimeout },
        loopId:            options?.loopId,
      },
      success: true,
    }).catch(() => {});
  }

  return improvements;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. computeProjectScore — stability / efficiency / success rate scores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ANALYSIS phase.
 * Produces three scores (0-100) and an overall weighted average.
 * Each project gets:
 *   stabilityScore   — inversely related to failure rate
 *   efficiencyScore  — inversely related to average duration
 *   successRateScore — raw success rate percentage
 */
export async function computeProjectScore(
  projectId: number,
  options?: { loopId?: string; persist?: boolean },
): Promise<ProjectScore> {
  const summary = await getSummary(projectId);

  // Stability: 100 - failureRate*100 (clamped 0-100)
  const failureRate    = Math.max(0, 1 - summary.successRate / 100);
  const stabilityScore = Math.max(0, Math.min(100, Math.round(100 - failureRate * 100)));

  // Efficiency: 100 at ≤1s avg, 0 at ≥100s avg (linear interpolation)
  const efficiencyScore = Math.max(
    0,
    Math.min(100, Math.round(100 - (summary.avgDurationMs / 1000) * 1)),
  );

  // Success rate is already 0-100
  const successRateScore = Math.round(summary.successRate);

  const overallScore = Math.round(
    stabilityScore   * SCORE_WEIGHTS.stability   +
    efficiencyScore  * SCORE_WEIGHTS.efficiency  +
    successRateScore * SCORE_WEIGHTS.successRate,
  );

  const grade: ProjectScore["grade"] =
    overallScore >= 90 ? "A" :
    overallScore >= 75 ? "B" :
    overallScore >= 60 ? "C" :
    overallScore >= 40 ? "D" : "F";

  const score: ProjectScore = {
    projectId,
    stabilityScore,
    efficiencyScore,
    successRateScore,
    overallScore,
    grade,
    sampleSize:  summary.totalLogs,
    computedAt:  new Date().toISOString(),
    breakdown: {
      stabilityWeight:   SCORE_WEIGHTS.stability,
      efficiencyWeight:  SCORE_WEIGHTS.efficiency,
      successRateWeight: SCORE_WEIGHTS.successRate,
    },
  };

  // Persist to DB if requested (default: yes)
  if (options?.persist !== false && summary.totalLogs > 0) {
    await db
      .insert(apexOsProjectScoresTable)
      .values({
        projectId,
        stabilityScore,
        efficiencyScore,
        successRateScore,
        overallScore,
        grade,
        sampleSize:  summary.totalLogs,
        loopId:      options?.loopId,
      })
      .catch((err: unknown) => logger.warn({ err }, "SelfImprovement: score persistence failed"));
  }

  logger.info({ projectId, overallScore, grade }, "SelfImprovement: project score computed");
  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. runLearningLoop — Full INPUT → OUTPUT → RESULT → ANALYSIS → IMPROVEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the complete self-improvement pipeline.
 *
 * INPUT:       analyzeMemory() — read and aggregate all recent logs
 * OUTPUT:      detectPatterns() — identify what is wrong
 * RESULT:      improveGenerationModel() + updateWorkflowTemplates() — apply fixes
 * ANALYSIS:    computeProjectScore() — measure before/after
 * IMPROVEMENT: all versions stored, learned params updated, loop logged to memory
 */
export async function runLearningLoop(options?: {
  projectId?: number;
  logLimit?:  number;
}): Promise<LearningLoopResult> {
  const loopId    = randomUUID();
  const startedAt = Date.now();

  logger.info({ loopId, projectId: options?.projectId }, "SelfImprovement: learning loop START");

  // INPUT: Read and analyze memory
  const analysis = await analyzeMemory({
    projectId: options?.projectId,
    limit:     options?.logLimit ?? 200,
  });

  // OUTPUT: Patterns are already in analysis.patterns (detectPatterns was called inside analyzeMemory)
  const patterns = analysis.patterns;

  // RESULT: Apply improvements
  const [genVersion, wfVersions] = await Promise.all([
    improveGenerationModel(patterns, { projectId: options?.projectId, loopId }),
    updateWorkflowTemplates(patterns, { loopId }),
  ]);

  const allVersions: ImprovementVersion[] = [
    ...(genVersion ? [genVersion] : []),
    ...wfVersions,
  ];

  // ANALYSIS: Compute project score (only if projectId is known)
  let scores: ProjectScore | undefined;
  if (options?.projectId) {
    scores = await computeProjectScore(options.projectId, { loopId, persist: true });
  }

  const durationMs = Date.now() - startedAt;

  // IMPROVEMENT: Log the completed loop to memory
  const summary = {
    patternsDetected:         patterns.length,
    improvementsApplied:      allVersions.length,
    generationModelUpdated:   !!genVersion,
    workflowTemplatesUpdated: wfVersions.length,
    knowledgeExtracted:       _learned.knowledgeBase.length,
  };

  await memoryLog({
    projectId: options?.projectId,
    type:      "improvement",
    content:   `Self-improvement loop ${loopId} completed: ${patterns.length} patterns → ${allVersions.length} improvements in ${durationMs}ms`,
    metadata: {
      loopId,
      durationMs,
      summary,
      patternsDetected: patterns.map((p) => ({ id: p.id, class: p.class, severity: p.severity })),
      improvementVersions: allVersions.map((v) => v.version),
      score: scores ? { overallScore: scores.overallScore, grade: scores.grade } : undefined,
    },
    success:   true,
    durationMs,
  }).catch(() => {});

  logger.info({ loopId, durationMs, ...summary }, "SelfImprovement: learning loop COMPLETE");

  return {
    loopId,
    completedAt:   new Date().toISOString(),
    projectId:     options?.projectId,
    logsAnalyzed:  analysis.logsAnalyzed,
    patternsFound: patterns,
    improvements:  allVersions,
    scores,
    summary,
    learningLoop: {
      input:       `Analyzed ${analysis.logsAnalyzed} memory logs (success: ${analysis.successRate}%, avg: ${analysis.avgDurationMs}ms)`,
      output:      `Detected ${patterns.length} patterns: ${[...new Set(patterns.map((p) => p.class))].join(", ") || "none"}`,
      result:      `Applied ${allVersions.length} improvements (gen model: ${!!genVersion}, wf templates: ${wfVersions.length})`,
      analysis:    scores
        ? `Project score: ${scores.overallScore}/100 (${scores.grade}) — stability: ${scores.stabilityScore}, efficiency: ${scores.efficiencyScore}, success: ${scores.successRateScore}`
        : `No project score (no projectId provided)`,
      improvement: `Knowledge base: ${_learned.knowledgeBase.length} entries. Generation model: ${_learned.generation.version ?? "base"}. Retry overrides: ${Object.keys(_learned.workflowDefaults.stepRetryOverrides).length} steps`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. getImprovementHistory — query DB for versioned improvement records
// ─────────────────────────────────────────────────────────────────────────────

export async function getImprovementHistory(options?: {
  projectId?:   number;
  targetType?:  ImprovementTargetType;
  limit?:       number;
}): Promise<ImprovementVersion[]> {
  const limit = Math.min(options?.limit ?? 50, 200);

  const rows = await db
    .select()
    .from(apexOsImprovementVersionsTable)
    .where(
      options?.projectId != null
        ? eq(apexOsImprovementVersionsTable.projectId, options.projectId)
        : undefined,
    )
    .orderBy(desc(apexOsImprovementVersionsTable.appliedAt))
    .limit(limit);

  return rows
    .filter((r) => !options?.targetType || r.targetType === options.targetType)
    .map(rowToVersion);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. getLearnedParameters — return current active learned overrides
// ─────────────────────────────────────────────────────────────────────────────

export function getLearnedParameters(): Readonly<LearnedParameters> {
  return {
    generation: { ...(_learned.generation) },
    workflowDefaults: {
      stepRetryOverrides:   { ..._learned.workflowDefaults.stepRetryOverrides },
      stepTimeoutOverrides: { ..._learned.workflowDefaults.stepTimeoutOverrides },
      lastUpdatedAt: _learned.workflowDefaults.lastUpdatedAt,
    },
    knowledgeBase: [..._learned.knowledgeBase],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function mergeUnique(existing: string[], incoming: string[]): string[] {
  const set = new Set([...existing, ...incoming]);
  return [...set].slice(0, 20); // cap at 20 entries each
}

async function storeVersion(input: {
  version:      string;
  targetType:   string;
  targetId:     string;
  rationale:    string;
  beforeState:  Record<string, unknown>;
  afterState:   Record<string, unknown>;
  patternIds:   string[];
  patternTypes: string[];
  loopId?:      string;
  projectId?:   number;
}): Promise<ImprovementVersion> {
  const [row] = await db
    .insert(apexOsImprovementVersionsTable)
    .values({
      version:      input.version,
      targetType:   input.targetType,
      targetId:     input.targetId,
      rationale:    input.rationale,
      beforeState:  input.beforeState,
      afterState:   input.afterState,
      patternIds:   input.patternIds,
      patternTypes: input.patternTypes,
      loopId:       input.loopId,
      projectId:    input.projectId,
    })
    .returning();

  return rowToVersion(row!);
}

function rowToVersion(row: {
  id:           number;
  version:      string;
  targetType:   string;
  targetId:     string;
  rationale:    string;
  beforeState:  Record<string, unknown>;
  afterState:   Record<string, unknown>;
  patternIds:   string[];
  patternTypes: string[];
  loopId:       string | null;
  projectId:    number | null;
  appliedAt:    Date;
}): ImprovementVersion {
  return {
    id:           String(row.id),
    version:      row.version,
    targetType:   row.targetType as ImprovementTargetType,
    targetId:     row.targetId,
    rationale:    row.rationale,
    before:       row.beforeState,
    after:        row.afterState,
    patternIds:   row.patternIds ?? [],
    patternTypes: row.patternTypes ?? [],
    loopId:       row.loopId ?? undefined,
    projectId:    row.projectId ?? undefined,
    appliedAt:    row.appliedAt.toISOString(),
  };
}
