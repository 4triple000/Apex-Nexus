/**
 * AI Orchestrator Router
 * Mounts at /api/ai/*
 *
 * Endpoints:
 *   POST /ai/chat           — Main conversational AI
 *   POST /ai/think          — Deep reasoning mode
 *   POST /ai/tool-router    — Determine which tool to invoke
 *   POST /ai/memory-update  — Extract and store memory from conversation
 *   GET  /ai/models         — List available AI models
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { orchestrate, think, extractMemory } from "./orchestrator";
import { injectSession, requireSession } from "../../shared/middleware/auth";
import { aiLimiter } from "../../shared/middleware/rateLimiter";
import { success, badRequest, serverError } from "../../shared/utils/response";
import { APEX_TOOLS, MODEL_REGISTRY } from "../../config/aiModels";
import { logger } from "../../lib/logger";

const router: IRouter = Router();
router.use(injectSession);

// ── POST /ai/chat ─────────────────────────────────────────────────────────────
router.post("/ai/chat", aiLimiter, requireSession, async (req, res): Promise<void> => {
  const schema = z.object({
    sessionId: z.string(),
    message: z.string().min(1).max(4000),
    context: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string() })).default([]),
    provider: z.enum(["openai", "claude", "perplexity", "auto"]).default("auto"),
    injectMemory: z.boolean().default(true),
    injectPersonalization: z.boolean().default(true),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  try {
    const result = await orchestrate({ ...parsed.data, mode: "chat" });
    success(res, result);
  } catch (err) {
    logger.error({ err }, "AI chat error");
    serverError(res, "AI service unavailable");
  }
});

// ── POST /ai/think ────────────────────────────────────────────────────────────
router.post("/ai/think", aiLimiter, requireSession, async (req, res): Promise<void> => {
  const schema = z.object({
    sessionId: z.string(),
    problem: z.string().min(1).max(4000),
    context: z.array(z.string()).default([]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  try {
    const result = await think(parsed.data.sessionId, parsed.data.problem, parsed.data.context);
    success(res, result);
  } catch (err) {
    logger.error({ err }, "AI think error");
    serverError(res, "AI service unavailable");
  }
});

// ── POST /ai/tool-router ──────────────────────────────────────────────────────
// Analyzes a user message and returns which tool(s) should be invoked
router.post("/ai/tool-router", requireSession, async (req, res): Promise<void> => {
  const schema = z.object({
    sessionId: z.string(),
    message: z.string().min(1).max(2000),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const lower = parsed.data.message.toLowerCase();

  // Heuristic tool matching
  const matches = APEX_TOOLS
    .map((tool) => ({
      tool: tool.name,
      confidence: tool.triggers.filter((t) => lower.includes(t)).length / tool.triggers.length,
      description: tool.description,
      endpoint: tool.endpoint,
    }))
    .filter((m) => m.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);

  success(res, {
    message: parsed.data.message,
    matches,
    recommended: matches[0] ?? null,
    requiresAI: matches.length === 0,
  });
});

// ── POST /ai/memory-update ────────────────────────────────────────────────────
// Extracts facts/preferences from a conversation and returns structured memory
router.post("/ai/memory-update", requireSession, async (req, res): Promise<void> => {
  const schema = z.object({
    sessionId: z.string(),
    conversation: z.string().min(1).max(8000),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  try {
    const memory = await extractMemory(parsed.data.sessionId, parsed.data.conversation);
    success(res, { sessionId: parsed.data.sessionId, memory, extractedAt: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "Memory extraction error");
    serverError(res, "Memory service unavailable");
  }
});

// ── GET /ai/models ────────────────────────────────────────────────────────────
router.get("/ai/models", (_req, res): void => {
  success(res, {
    models: MODEL_REGISTRY,
    tools: APEX_TOOLS.map(({ name, description, endpoint }) => ({ name, description, endpoint })),
  });
});

export default router;
