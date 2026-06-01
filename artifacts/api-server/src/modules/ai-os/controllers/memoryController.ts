/**
 * Apex AI OS — Memory Controller
 *
 * Manages the self-improving memory log system.
 * Every AI action (prompts, outputs, errors, fixes, workflows) is logged here
 * and analyzed to detect patterns for autonomous improvement.
 *
 * GET    /api/os/memory               — List logs (filtered by project/session/type)
 * POST   /api/os/memory               — Write a log entry
 * GET    /api/os/memory/summary       — Get aggregate stats
 * GET    /api/os/memory/patterns      — Run pattern analysis
 * DELETE /api/os/memory/:projectId    — Clear logs for a project
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../../lib/logger";
import { success, created, badRequest, notFound, serverError } from "../../../shared/utils/response";
import * as memoryService from "../services/memoryService";
import type { LogMemoryBody, MemoryLogType } from "../core/types";

// ── Validation schemas ─────────────────────────────────────────────────────────

const LOG_TYPES = ["prompt", "error", "workflow", "fix", "ai_output", "improvement"] as const;

const logSchema = z.object({
  projectId: z.number().int().positive().optional(),
  sessionId: z.string().max(100).optional(),
  type: z.enum(LOG_TYPES),
  content: z.string().min(1, "Content required").max(10000),
  metadata: z.record(z.string(), z.unknown()).optional(),
  success: z.boolean().optional(),
  durationMs: z.number().int().min(0).optional(),
});

const querySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  sessionId: z.string().optional(),
  type: z.enum(LOG_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── GET /api/os/memory ─────────────────────────────────────────────────────────

export async function listLogs(req: Request, res: Response): Promise<void> {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid query"); return; }

  const { projectId, sessionId, type, limit, offset } = parsed.data;

  try {
    let logs;

    if (projectId) {
      logs = await memoryService.getByProject(projectId, {
        type: type as MemoryLogType | undefined,
        limit,
        offset,
      });
    } else if (sessionId) {
      logs = await memoryService.getBySession(sessionId, limit);
    } else if (type) {
      logs = await memoryService.getByType(type as MemoryLogType, limit);
    } else {
      logs = await memoryService.getRecent(limit);
    }

    success(res, { logs, total: logs.length, limit, offset });
  } catch (err) {
    logger.error({ err }, "memoryController.listLogs error");
    serverError(res, "Failed to retrieve memory logs");
  }
}

// ── POST /api/os/memory ────────────────────────────────────────────────────────

export async function createLog(req: Request, res: Response): Promise<void> {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const body = parsed.data as LogMemoryBody;

  try {
    const log = await memoryService.log({
      projectId: body.projectId,
      sessionId: body.sessionId,
      type: body.type,
      content: body.content,
      metadata: body.metadata,
      success: body.success,
      durationMs: body.durationMs,
    });

    created(res, { log });
  } catch (err) {
    logger.error({ err }, "memoryController.createLog error");
    serverError(res, "Failed to write memory log");
  }
}

// ── GET /api/os/memory/summary ────────────────────────────────────────────────

export async function getMemorySummary(req: Request, res: Response): Promise<void> {
  const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

  try {
    const summary = await memoryService.getSummary(projectId);
    success(res, { summary });
  } catch (err) {
    logger.error({ err }, "memoryController.getMemorySummary error");
    serverError(res, "Failed to get memory summary");
  }
}

// ── GET /api/os/memory/patterns ───────────────────────────────────────────────

export async function analyzePatterns(req: Request, res: Response): Promise<void> {
  const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

  try {
    const insights = await memoryService.analyzePatterns(projectId);
    success(res, {
      projectId,
      insights,
      total: insights.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "memoryController.analyzePatterns error");
    serverError(res, "Failed to analyze patterns");
  }
}

// ── DELETE /api/os/memory/:projectId ─────────────────────────────────────────

export async function clearProjectLogs(req: Request, res: Response): Promise<void> {
  const projectId = parseInt(req.params.projectId ?? "");
  if (isNaN(projectId)) { badRequest(res, "Invalid project ID"); return; }

  try {
    const result = await memoryService.clear(projectId);
    success(res, { projectId, ...result });
  } catch (err) {
    logger.error({ err }, "memoryController.clearProjectLogs error");
    serverError(res, "Failed to clear memory logs");
  }
}
