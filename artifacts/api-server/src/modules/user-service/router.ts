/**
 * User Service Router
 * Mounts at /api/auth/* and /api/user/*
 *
 * Endpoints:
 *   POST /auth/register  — Register/resolve a session to a user profile
 *   POST /auth/login     — Alias for register (session-based, idempotent)
 *   GET  /auth/me        — Get current session info
 *   GET  /user/profile   — Get authenticated user's profile
 *   PUT  /user/settings  — Update profile settings
 *   GET  /user/:id       — Get any user's public profile
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { registerOrResolve, getProfile, getProfileById, updateSettings, sanitizeUser } from "./service";
import { injectSession, requireSession } from "../../shared/middleware/auth";
import { authLimiter } from "../../shared/middleware/rateLimiter";
import { success, badRequest, notFound, serverError } from "../../shared/utils/response";
import { logger } from "../../lib/logger";

const router: IRouter = Router();
router.use(injectSession);

// ── POST /auth/register ───────────────────────────────────────────────────────
router.post("/auth/register", authLimiter, async (req, res): Promise<void> => {
  const schema = z.object({ sessionId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, "sessionId must be a valid UUID"); return; }

  try {
    const user = await registerOrResolve(parsed.data.sessionId);
    success(res, {
      user: sanitizeUser(user),
      isNew: user.createdAt ? Date.now() - new Date(user.createdAt).getTime() < 5000 : false,
      message: "Session registered successfully",
    }, 201);
  } catch (err) {
    logger.error({ err }, "User registration error");
    serverError(res, "Failed to register user");
  }
});

// ── POST /auth/login (idempotent alias) ──────────────────────────────────────
router.post("/auth/login", authLimiter, async (req, res): Promise<void> => {
  const schema = z.object({ sessionId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, "sessionId must be a valid UUID"); return; }

  try {
    const user = await registerOrResolve(parsed.data.sessionId);
    success(res, {
      user: sanitizeUser(user),
      token: parsed.data.sessionId, // session token IS the session ID in this model
      message: "Login successful",
    });
  } catch (err) {
    logger.error({ err }, "User login error");
    serverError(res, "Failed to login");
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get("/auth/me", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || "";
  const user = await getProfile(sessionId);
  if (!user) {
    success(res, { authenticated: false, sessionId });
    return;
  }
  success(res, { authenticated: true, user: sanitizeUser(user) });
});

// ── GET /user/profile ─────────────────────────────────────────────────────────
router.get("/user/profile", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || "";
  const user = await getProfile(sessionId);
  if (!user) { notFound(res, "User profile not found. Register first via /auth/register."); return; }
  success(res, { profile: sanitizeUser(user) });
});

// ── PUT /user/settings ────────────────────────────────────────────────────────
router.put("/user/settings", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || "";
  const schema = z.object({
    username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric and underscores").optional(),
    avatarEmoji: z.string().max(4).optional(),
    bio: z.string().max(500).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const user = await updateSettings(sessionId, parsed.data);
  if (!user) { notFound(res, "User not found"); return; }
  success(res, { profile: sanitizeUser(user), message: "Settings updated" });
});

// ── GET /user/:id ─────────────────────────────────────────────────────────────
router.get("/user/:id", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) { badRequest(res, "Invalid user ID"); return; }
  const user = await getProfileById(userId);
  if (!user) { notFound(res, "User not found"); return; }
  success(res, { profile: sanitizeUser(user) });
});

export default router;
