/**
 * Apex AI OS — Self-Improvement Controller
 *
 * HTTP handlers for the Self-Improving System.
 * Heavy logic lives in /src/core/selfImprovement.ts.
 *
 * POST /api/os/improve/run        — Full learning loop
 * POST /api/os/improve/analyze    — Memory analysis only (no improvements)
 * POST /api/os/improve/patterns   — Pattern detection only (no improvements)
 * GET  /api/os/improve/history    — Versioned improvement records
 * GET  /api/os/improve/score/:id  — Project improvement score
 * GET  /api/os/improve/learned    — Current active learned parameters
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../../lib/logger";
import { success, badRequest, serverError } from "../../../shared/utils/response";
import {
  runLearningLoop,
  analyzeMemory,
  detectPatterns,
  improveGenerationModel,
  updateWorkflowTemplates,
  computeProjectScore,
  getImprovementHistory,
  getLearnedParameters,
} from "../../../core/selfImprovement";
import { getRecent, getByProject } from "../services/memoryService";

// ── Validation schemas ─────────────────────────────────────────────────────────

const runSchema = z.object({
  projectId: z.number().int().positive().optional(),
  logLimit:  z.number().int().min(5).max(500).default(200),
});

const analyzeSchema = z.object({
  projectId: z.number().int().positive().optional(),
  limit:     z.number().int().min(5).max(500).default(100),
});

const patternsSchema = z.object({
  projectId: z.number().int().positive().optional(),
  limit:     z.number().int().min(5).max(500).default(100),
});

const historySchema = z.object({
  projectId:  z.number().int().positive().optional(),
  targetType: z.enum(["generation_model", "workflow_template", "prompt_config", "retry_policy"]).optional(),
  limit:      z.number().int().min(1).max(200).default(50),
});

const scoreParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, "projectId must be a positive integer"),
});

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/os/improve/run
 * Full learning loop: INPUT → OUTPUT → RESULT → ANALYSIS → IMPROVEMENT
 */
export async function runLoopHandler(req: Request, res: Response): Promise<void> {
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid request");
    return;
  }

  try {
    logger.info({ body: parsed.data }, "SelfImprovement: runLoop request");
    const result = await runLearningLoop({
      projectId: parsed.data.projectId,
      logLimit:  parsed.data.logLimit,
    });
    success(res, result);
  } catch (err) {
    logger.error({ err }, "SelfImprovement: runLoop error");
    serverError(res, "Learning loop failed");
  }
}

/**
 * POST /api/os/improve/analyze
 * Memory analysis + pattern detection, no improvements applied.
 */
export async function analyzeHandler(req: Request, res: Response): Promise<void> {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid request");
    return;
  }

  try {
    const analysis = await analyzeMemory({
      projectId: parsed.data.projectId,
      limit:     parsed.data.limit,
    });
    success(res, {
      analysis,
      patternCount:   analysis.patterns.length,
      patternClasses: [...new Set(analysis.patterns.map((p) => p.class))],
    });
  } catch (err) {
    logger.error({ err }, "SelfImprovement: analyze error");
    serverError(res, "Memory analysis failed");
  }
}

/**
 * POST /api/os/improve/patterns
 * Pattern detection only — fetches logs then calls detectPatterns().
 */
export async function patternsHandler(req: Request, res: Response): Promise<void> {
  const parsed = patternsSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid request");
    return;
  }

  try {
    const logs = parsed.data.projectId
      ? await getByProject(parsed.data.projectId, { limit: parsed.data.limit })
      : await getRecent(parsed.data.limit);

    const patterns = detectPatterns(
      logs as Array<{
        id: number; projectId: number | null; sessionId: string | null;
        type: string; content: string | null; metadata: Record<string, unknown> | null;
        success: boolean | null; durationMs: number | null;
      }>,
      parsed.data.projectId,
    );

    const byClass = patterns.reduce<Record<string, number>>((acc, p) => {
      acc[p.class] = (acc[p.class] ?? 0) + 1;
      return acc;
    }, {});

    success(res, {
      logsScanned: logs.length,
      total:       patterns.length,
      byClass,
      critical:    patterns.filter((p) => p.severity === "critical").length,
      high:        patterns.filter((p) => p.severity === "high").length,
      medium:      patterns.filter((p) => p.severity === "medium").length,
      low:         patterns.filter((p) => p.severity === "low").length,
      patterns,
    });
  } catch (err) {
    logger.error({ err }, "SelfImprovement: patterns error");
    serverError(res, "Pattern detection failed");
  }
}

/**
 * GET /api/os/improve/history
 * Returns versioned improvement records from DB.
 */
export async function historyHandler(req: Request, res: Response): Promise<void> {
  const parsed = historySchema.safeParse({
    projectId:  req.query.projectId  ? Number(req.query.projectId)  : undefined,
    targetType: req.query.targetType ?? undefined,
    limit:      req.query.limit      ? Number(req.query.limit)      : 50,
  });
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid query params");
    return;
  }

  try {
    const versions = await getImprovementHistory(parsed.data);
    const byType   = versions.reduce<Record<string, number>>((acc, v) => {
      acc[v.targetType] = (acc[v.targetType] ?? 0) + 1;
      return acc;
    }, {});

    success(res, {
      total:    versions.length,
      byType,
      versions,
    });
  } catch (err) {
    logger.error({ err }, "SelfImprovement: history error");
    serverError(res, "History retrieval failed");
  }
}

/**
 * GET /api/os/improve/score/:id
 * Compute and return improvement scores for a project.
 */
export async function scoreHandler(req: Request, res: Response): Promise<void> {
  const parsed = scoreParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    badRequest(res, "Invalid project ID");
    return;
  }

  const projectId = parseInt(parsed.data.id, 10);

  try {
    const score = await computeProjectScore(projectId, { persist: true });
    success(res, { score });
  } catch (err) {
    logger.error({ err, projectId }, "SelfImprovement: score error");
    serverError(res, "Score computation failed");
  }
}

/**
 * GET /api/os/improve/learned
 * Returns current active learned parameters (the live overrides).
 */
export async function learnedHandler(_req: Request, res: Response): Promise<void> {
  try {
    const params = getLearnedParameters();
    success(res, {
      generation: {
        temperature:            params.generation.temperature,
        additionalInstructions: params.generation.additionalInstructions,
        avoidPatterns:          params.generation.avoidPatterns,
        preferredComplexity:    params.generation.preferredComplexity,
        version:                params.generation.version,
        lastUpdatedAt:          params.generation.lastUpdatedAt,
      },
      workflowDefaults: {
        stepCount:            Object.keys(params.workflowDefaults.stepRetryOverrides).length,
        stepRetryOverrides:   params.workflowDefaults.stepRetryOverrides,
        stepTimeoutOverrides: params.workflowDefaults.stepTimeoutOverrides,
        lastUpdatedAt:        params.workflowDefaults.lastUpdatedAt,
      },
      knowledgeBase: {
        count:   params.knowledgeBase.length,
        entries: params.knowledgeBase.slice(0, 20),
      },
    });
  } catch (err) {
    logger.error({ err }, "SelfImprovement: learned params error");
    serverError(res, "Could not retrieve learned parameters");
  }
}
