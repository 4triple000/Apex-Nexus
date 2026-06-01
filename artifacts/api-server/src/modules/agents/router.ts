/**
 * Apex Multi-Agent System — REST Router
 * Mounts at /api/agents/*
 *
 * Endpoints:
 *   GET  /agents                  — List all agents with capabilities
 *   POST /agents/route            — Auto-route task to best agent
 *   POST /agents/run/:agentId     — Run a specific agent directly
 *   POST /agents/pipeline         — Run a multi-agent pipeline
 *   GET  /agents/history          — Recent agent executions from memory
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { routeTask, runAgent, runPipeline, listAgents } from "../../agents/orchestrator";
import { getRecent } from "../ai-os/services/memoryService";
import { injectSession } from "../../shared/middleware/auth";
import { aiLimiter } from "../../shared/middleware/rateLimiter";
import { success, badRequest, serverError } from "../../shared/utils/response";
import { logger } from "../../lib/logger";
import type { AgentId } from "../../agents/types";

const router: IRouter = Router();
router.use(injectSession);

// ── Shared schemas ─────────────────────────────────────────────────────────────

const agentFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  language: z.string().optional(),
});

const taskSchema = z.object({
  prompt: z.string().min(1).max(4000),
  projectId: z.number().int().positive().optional(),
  sessionId: z.string().optional(),
  context: z.string().max(2000).optional(),
  files: z.array(agentFileSchema).max(8).optional(),
});

const VALID_AGENTS: AgentId[] = ["builder", "debug", "ui", "optimizer", "product"];

// ── GET /agents ────────────────────────────────────────────────────────────────

router.get("/agents", (_req, res): void => {
  success(res, {
    agents: listAgents(),
    totalAgents: VALID_AGENTS.length,
    version: "1.0.0",
  });
});

// ── POST /agents/route ────────────────────────────────────────────────────────

router.post("/agents/route", aiLimiter, async (req, res): Promise<void> => {
  const schema = taskSchema.extend({
    runPipeline: z.boolean().default(true),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const { prompt, projectId, sessionId, context, files, runPipeline: runPipelineFlag } = parsed.data;

  try {
    logger.info({ prompt: prompt.slice(0, 80) }, "Agents: routing task");
    const result = await routeTask(prompt, {
      projectId,
      sessionId: sessionId ?? (req as { sessionId?: string }).sessionId,
      context,
      files,
      runPipeline: runPipelineFlag,
    });

    success(res, {
      taskId: result.output.taskId,
      decision: result.decision,
      agentUsed: {
        id: result.output.agentId,
        name: result.output.agentName,
        icon: result.output.agentIcon,
      },
      output: result.output,
      pipeline: result.pipeline ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Agents: route error");
    serverError(res, "Agent routing failed");
  }
});

// ── POST /agents/run/:agentId ──────────────────────────────────────────────────

router.post("/agents/run/:agentId", aiLimiter, async (req, res): Promise<void> => {
  const agentId = req.params.agentId as AgentId;

  if (!VALID_AGENTS.includes(agentId)) {
    badRequest(res, `Unknown agent: ${agentId}. Valid agents: ${VALID_AGENTS.join(", ")}`);
    return;
  }

  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  try {
    logger.info({ agentId, prompt: parsed.data.prompt.slice(0, 80) }, "Agents: running specific agent");

    const output = await runAgent(agentId, {
      id: randomUUID(),
      ...parsed.data,
      sessionId: parsed.data.sessionId ?? (req as { sessionId?: string }).sessionId,
    });

    success(res, {
      taskId: output.taskId,
      agentId,
      output,
    });
  } catch (err) {
    logger.error({ err, agentId }, "Agents: run error");
    serverError(res, `Agent ${agentId} execution failed`);
  }
});

// ── POST /agents/pipeline ──────────────────────────────────────────────────────

router.post("/agents/pipeline", aiLimiter, async (req, res): Promise<void> => {
  const schema = taskSchema.extend({
    steps: z.array(
      z.object({
        agentId: z.enum(["builder", "debug", "ui", "optimizer", "product"]),
        reason: z.string().optional(),
      })
    ).min(1).max(5),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const { prompt, projectId, sessionId, context, files, steps } = parsed.data;

  try {
    logger.info({
      agents: steps.map((s) => s.agentId),
      prompt: prompt.slice(0, 80),
    }, "Agents: running pipeline");

    const result = await runPipeline(
      steps.map((s) => ({ agentId: s.agentId as AgentId, reason: s.reason ?? "user pipeline" })),
      {
        id: randomUUID(),
        prompt,
        projectId,
        sessionId: sessionId ?? (req as { sessionId?: string }).sessionId,
        context,
        files,
      }
    );

    success(res, result);
  } catch (err) {
    logger.error({ err }, "Agents: pipeline error");
    serverError(res, "Pipeline execution failed");
  }
});

// ── GET /agents/history ───────────────────────────────────────────────────────

router.get("/agents/history", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query["limit"]) || 20, 50);

  try {
    const logs = await getRecent(limit);
    const agentLogs = logs.filter(
      (l) => typeof l.metadata === "object" && l.metadata !== null && "agentId" in (l.metadata as object)
    );

    success(res, {
      total: agentLogs.length,
      executions: agentLogs.map((log) => ({
        id: log.id,
        agentId: (log.metadata as Record<string, unknown>)?.["agentId"],
        taskId: (log.metadata as Record<string, unknown>)?.["taskId"],
        prompt: (log.metadata as Record<string, unknown>)?.["prompt"],
        content: log.content,
        success: log.success,
        durationMs: log.durationMs,
        projectId: log.projectId,
        createdAt: log.createdAt,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Agents: history error");
    serverError(res, "Failed to retrieve agent history");
  }
});

export default router;
