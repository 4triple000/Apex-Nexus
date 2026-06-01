/**
 * Avatar Engine Router
 * Mounts at /api/avatar/*
 *
 * Endpoints:
 *   GET  /avatar/state            — Get current avatar state for session
 *   POST /avatar/state            — Set avatar state (expression, gesture, mode)
 *   POST /avatar/animate          — Trigger a specific animation action
 *   POST /avatar/expression       — Set facial expression with intensity
 *   POST /avatar/voice-sync       — Prepare text for lip sync animation
 *   POST /avatar/emotion-map      — Convert emotion text → avatar action
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  getAvatarState,
  updateAvatarState,
  triggerAnimation,
  setExpression,
  prepareVoiceSync,
  emotionToAvatarAction,
} from "./service";
import { injectSession, requireSession } from "../../shared/middleware/auth";
import { success, badRequest } from "../../shared/utils/response";

const router: IRouter = Router();
router.use(injectSession);

// ── GET /avatar/state ─────────────────────────────────────────────────────────
router.get("/avatar/state", requireSession, (req, res): void => {
  const sessionId = req.headers["x-session-id"] as string;
  const state = getAvatarState(sessionId);
  success(res, { state });
});

// ── POST /avatar/state ────────────────────────────────────────────────────────
router.post("/avatar/state", requireSession, (req, res): void => {
  const schema = z.object({
    sessionId: z.string(),
    expression: z.enum(["happy", "sad", "thinking", "excited", "neutral", "surprised", "angry", "confident"]).optional(),
    gesture: z.enum(["nod", "wave", "point", "shrug", "thumbsup", "none"]).optional(),
    personalityMode: z.string().optional(),
    isAnimating: z.boolean().optional(),
    isSpeaking: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const { sessionId, ...updates } = parsed.data;
  const state = updateAvatarState(sessionId, updates);
  success(res, { state });
});

// ── POST /avatar/animate ──────────────────────────────────────────────────────
router.post("/avatar/animate", requireSession, (req, res): void => {
  const schema = z.object({
    sessionId: z.string(),
    expression: z.enum(["happy", "sad", "thinking", "excited", "neutral", "surprised", "angry", "confident"]).optional(),
    gesture: z.enum(["nod", "wave", "point", "shrug", "thumbsup", "none"]).optional(),
    intensity: z.number().min(0).max(1).optional(),
    durationMs: z.number().min(100).max(10000).optional(),
    voiceSync: z.enum(["lipsync", "expression", "both", "none"]).optional(),
    message: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const { sessionId, ...action } = parsed.data;
  const result = triggerAnimation(sessionId, action);
  success(res, result);
});

// ── POST /avatar/expression ───────────────────────────────────────────────────
router.post("/avatar/expression", requireSession, (req, res): void => {
  const schema = z.object({
    sessionId: z.string(),
    expression: z.enum(["happy", "sad", "thinking", "excited", "neutral", "surprised", "angry", "confident"]),
    intensity: z.number().min(0).max(1).default(0.8),
    durationMs: z.number().min(100).max(30000).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const state = setExpression(parsed.data.sessionId, parsed.data.expression, parsed.data.intensity);
  success(res, {
    state,
    expression: parsed.data.expression,
    intensity: parsed.data.intensity,
    message: `Avatar expression set to ${parsed.data.expression}`,
  });
});

// ── POST /avatar/voice-sync ───────────────────────────────────────────────────
router.post("/avatar/voice-sync", requireSession, (req, res): void => {
  const schema = z.object({
    sessionId: z.string(),
    text: z.string().min(1).max(2000),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const result = prepareVoiceSync(parsed.data.sessionId, parsed.data.text);
  success(res, result);
});

// ── POST /avatar/emotion-map ──────────────────────────────────────────────────
router.post("/avatar/emotion-map", (req, res): void => {
  const schema = z.object({ text: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, "text is required"); return; }

  const action = emotionToAvatarAction(parsed.data.text);
  success(res, { action, sourceText: parsed.data.text });
});

export default router;
