/**
 * Apex AI OS — AI Controller
 *
 * Handles prompt-to-app generation and self-improvement endpoints.
 *
 * POST /api/ai/generate  — Convert prompt → full project (plan, code, workflows, preview)
 * POST /api/ai/improve   — Analyze and improve an existing project using the memory loop
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { db, apexOsProjectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../../lib/logger";
import { success, badRequest, notFound, serverError } from "../../../shared/utils/response";
import { generateFromPrompt, improveFromFeedback } from "../services/aiService";
import * as memoryService from "../services/memoryService";
import type { GenerateAiBody, ImproveAiBody } from "../core/types";

// ── Validation schemas ─────────────────────────────────────────────────────────

const generateSchema = z.object({
  prompt: z.string().min(5, "Prompt too short").max(4000, "Prompt too long"),
  projectId: z.number().int().positive().optional(),
  sessionId: z.string().optional(),
  options: z
    .object({
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().min(100).max(16000).optional(),
    })
    .optional(),
});

const improveSchema = z.object({
  projectId: z.number().int().positive(),
  autoApply: z.boolean().default(false),
  context: z
    .object({
      prompt: z.string().max(2000).optional(),
      errorLogs: z.array(z.string()).max(10).optional(),
      userFeedback: z.string().max(2000).optional(),
      performanceMetrics: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
});

// ── POST /api/ai/generate ─────────────────────────────────────────────────────

export async function generateHandler(req: Request, res: Response): Promise<void> {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid request body");
    return;
  }

  const body = parsed.data as GenerateAiBody;
  logger.info({ prompt: body.prompt.slice(0, 80), projectId: body.projectId }, "AI OS: /api/ai/generate");

  try {
    // ── Run AI generation ────────────────────────────────────────────────────
    const result = await generateFromPrompt(body.prompt, body.options);

    // ── Persist to project if projectId provided ────────────────────────────
    let savedProjectId = body.projectId;

    if (body.projectId) {
      // Update existing project
      await db
        .update(apexOsProjectsTable)
        .set({
          plan: result.plan,
          generatedCode: result.generatedCode,
          previewHtml: result.previewHtml,
          workflows: result.workflows,
          status: "ready",
          buildCount: db.select({ buildCount: apexOsProjectsTable.buildCount })
            .from(apexOsProjectsTable)
            .where(eq(apexOsProjectsTable.id, body.projectId))
            .then(() => 1) as unknown as number, // counter incremented in DB
          tokensUsed: result.tokensUsed,
          updatedAt: new Date(),
        })
        .where(eq(apexOsProjectsTable.id, body.projectId));

      // Simpler approach without subquery:
      const [existing] = await db
        .select({ buildCount: apexOsProjectsTable.buildCount, tokensUsed: apexOsProjectsTable.tokensUsed })
        .from(apexOsProjectsTable)
        .where(eq(apexOsProjectsTable.id, body.projectId))
        .limit(1);

      await db
        .update(apexOsProjectsTable)
        .set({
          plan: result.plan,
          generatedCode: result.generatedCode,
          previewHtml: result.previewHtml,
          workflows: result.workflows,
          status: "ready",
          buildCount: (existing?.buildCount ?? 0) + 1,
          tokensUsed: (existing?.tokensUsed ?? 0) + result.tokensUsed,
          updatedAt: new Date(),
        })
        .where(eq(apexOsProjectsTable.id, body.projectId));
    } else {
      // Create a new project automatically
      const [newProject] = await db
        .insert(apexOsProjectsTable)
        .values({
          sessionId: body.sessionId ?? "anonymous",
          name: result.plan.goal?.slice(0, 80) ?? body.prompt.slice(0, 80),
          description: result.summary,
          prompt: body.prompt,
          plan: result.plan,
          generatedCode: result.generatedCode,
          previewHtml: result.previewHtml,
          workflows: result.workflows,
          status: "ready",
          buildCount: 1,
          editCount: 0,
          runCount: 0,
          errorCount: 0,
          tokensUsed: result.tokensUsed,
          executionHistory: [],
        })
        .returning({ id: apexOsProjectsTable.id });

      savedProjectId = newProject!.id;
    }

    // ── Log to memory system ─────────────────────────────────────────────────
    await memoryService.log({
      projectId: savedProjectId,
      sessionId: body.sessionId,
      type: "prompt",
      content: body.prompt,
      metadata: {
        action: "generate",
        workflowCount: result.workflows.length,
        tokensUsed: result.tokensUsed,
      },
      success: true,
      durationMs: result.durationMs,
    });

    await memoryService.log({
      projectId: savedProjectId,
      sessionId: body.sessionId,
      type: "ai_output",
      content: result.summary,
      metadata: {
        plan: result.plan,
        workflowIds: result.workflows.map((w) => w.id),
        durationMs: result.durationMs,
      },
      success: true,
      durationMs: result.durationMs,
    });

    success(res, {
      projectId: savedProjectId,
      plan: result.plan,
      generatedCode: result.generatedCode,
      previewHtml: result.previewHtml,
      workflows: result.workflows,
      summary: result.summary,
      tokensUsed: result.tokensUsed,
      durationMs: result.durationMs,
    });
  } catch (err) {
    logger.error({ err }, "AI OS: generate error");

    // Log the error
    if (body.projectId) {
      await memoryService
        .log({
          projectId: body.projectId,
          type: "error",
          content: err instanceof Error ? err.message : "Generation failed",
          metadata: { action: "generate", prompt: body.prompt.slice(0, 100) },
          success: false,
        })
        .catch(() => undefined);
    }

    serverError(res, "AI generation failed — please try again");
  }
}

// ── POST /api/ai/improve ──────────────────────────────────────────────────────

export async function improveHandler(req: Request, res: Response): Promise<void> {
  const parsed = improveSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid request body");
    return;
  }

  const body = parsed.data as ImproveAiBody;
  logger.info({ projectId: body.projectId, autoApply: body.autoApply }, "AI OS: /api/ai/improve");

  try {
    // Load the project
    const [project] = await db
      .select()
      .from(apexOsProjectsTable)
      .where(eq(apexOsProjectsTable.id, body.projectId))
      .limit(1);

    if (!project) { notFound(res, `Project ${body.projectId} not found`); return; }
    if (!project.plan) { badRequest(res, "Project has no plan — generate first"); return; }

    // Load recent memory logs for context
    const recentLogs = await memoryService.getByProject(body.projectId, { limit: 30 });

    // Run improvement analysis
    const result = await improveFromFeedback(
      body.projectId,
      project.generatedCode ?? "",
      project.plan,
      recentLogs,
      body.context,
      body.autoApply ?? false,
    );

    // Apply updated code if improvement was auto-applied
    if (body.autoApply && result.appliedCount > 0 && result.updatedCode) {
      await db
        .update(apexOsProjectsTable)
        .set({
          generatedCode: result.updatedCode,
          editCount: (project.editCount ?? 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(apexOsProjectsTable.id, body.projectId));
    }

    // Log the improvement run
    await memoryService.log({
      projectId: body.projectId,
      type: "improvement",
      content: result.summary,
      metadata: {
        suggestionCount: result.suggestions.length,
        appliedCount: result.appliedCount,
        autoApply: body.autoApply,
        suggestions: result.suggestions.map((s) => ({ id: s.id, type: s.type, priority: s.priority, title: s.title })),
      },
      success: true,
      durationMs: result.durationMs,
    });

    success(res, {
      projectId: body.projectId,
      suggestions: result.suggestions,
      appliedCount: result.appliedCount,
      summary: result.summary,
      durationMs: result.durationMs,
    });
  } catch (err) {
    logger.error({ err }, "AI OS: improve error");
    serverError(res, "Self-improvement analysis failed");
  }
}
