/**
 * Memory System Router
 * Mounts at /api/memory/*
 *
 * Endpoints:
 *   GET  /memory/chat-history   — Retrieve session chat history
 *   GET  /memory/preferences    — Get user's learned preferences
 *   GET  /memory/recall         — Recall relevant memories (with optional query)
 *   POST /memory/store          — Store a specific memory entry
 *   DELETE /memory/clear        — Clear session memory
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { getChatHistory, getUserMemory, recallMemory, storeMemory, clearMemory } from "./service";
import { extractMemoryFromMessage } from "./extractor";
import { injectSession, requireSession } from "../../shared/middleware/auth";
import { success, badRequest, serverError } from "../../shared/utils/response";
import { logger } from "../../lib/logger";

const router: IRouter = Router();
router.use(injectSession);

// ── GET /memory/chat-history ──────────────────────────────────────────────────
router.get("/memory/chat-history", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;
  const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

  try {
    const history = await getChatHistory(sessionId, limit);
    success(res, history);
  } catch (err) {
    logger.error({ err }, "Memory chat-history error");
    serverError(res, "Failed to retrieve chat history");
  }
});

// ── GET /memory/preferences ───────────────────────────────────────────────────
router.get("/memory/preferences", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;

  try {
    const memory = await getUserMemory(sessionId);
    success(res, { sessionId, memory });
  } catch (err) {
    logger.error({ err }, "Memory preferences error");
    serverError(res, "Failed to retrieve preferences");
  }
});

// ── GET /memory/recall ────────────────────────────────────────────────────────
router.get("/memory/recall", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;
  const query = req.query.q as string | undefined;

  try {
    const recalled = await recallMemory(sessionId, query);
    success(res, { sessionId, query, ...recalled });
  } catch (err) {
    logger.error({ err }, "Memory recall error");
    serverError(res, "Failed to recall memory");
  }
});

// ── POST /memory/store ────────────────────────────────────────────────────────
router.post("/memory/store", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;
  const schema = z.object({
    type: z.enum(["fact", "preference", "context", "workflow_history", "avatar_personality"]).default("fact"),
    key: z.string().min(1).max(100),
    value: z.unknown(),
    importance: z.number().min(1).max(10).default(5),
    expiresInDays: z.number().min(1).max(365).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86400_000)
    : undefined;

  try {
    const { expiresInDays: _expiresInDays, value, ...fields } = parsed.data;
    await storeMemory({ sessionId, ...fields, value: value ?? null, expiresAt });
    success(res, { stored: true, key: parsed.data.key, message: "Memory stored successfully" });
  } catch (err) {
    logger.error({ err }, "Memory store error");
    serverError(res, "Failed to store memory");
  }
});

// ── POST /memory/extract ──────────────────────────────────────────────────────
// AI-powered memory extraction from a single user message.
// Accepts user_id (integer) for authenticated mobile users.
router.post("/memory/extract", async (req, res): Promise<void> => {
  const schema = z.object({
    user_id: z.number().int().positive("user_id must be a positive integer"),
    message: z.string().min(1, "message is required").max(4000),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  try {
    const result = await extractMemoryFromMessage(parsed.data.user_id, parsed.data.message);
    success(res, {
      extracted: result.extracted,
      stored: result.stored,
      skipped: result.skipped,
      message: result.stored > 0
        ? `Extracted ${result.stored} new memory item(s)`
        : "No new memories found in this message",
    });
  } catch (err) {
    logger.error({ err }, "Memory extract error");
    serverError(res, "Memory extraction failed");
  }
});

// ── DELETE /memory/clear ──────────────────────────────────────────────────────
router.delete("/memory/clear", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;

  try {
    await clearMemory(sessionId);
    success(res, { cleared: true, message: "Memory cleared" });
  } catch (err) {
    logger.error({ err }, "Memory clear error");
    serverError(res, "Failed to clear memory");
  }
});

export default router;
