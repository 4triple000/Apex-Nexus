/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX AUTH ENGINE v2                                                     ║
 * ║  Email+Password · JWT Access + Refresh Tokens · Session fallback        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router }     from "express";
import { z }          from "zod";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq }         from "drizzle-orm";
import { issueTokenPair, verifyRefreshToken } from "../shared/lib/jwt";
import { authLimiter } from "../shared/middleware/rateLimiter";
import { success, badRequest, unauthorized, serverError } from "../shared/utils/response";
import { logger }     from "../lib/logger";

const router = Router();

// ── Password helpers (scrypt — no extra packages) ─────────────────────────────

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const attempt = Buffer.from(hashPassword(password, salt), "hex");
    const actual  = Buffer.from(hash, "hex");
    if (attempt.length !== actual.length) return false;
    return timingSafeEqual(attempt, actual);
  } catch { return false; }
}

function createPasswordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${hashPassword(password, salt)}`;
}

function randomUsername(): string {
  const adj  = ["Sharp","Neon","Apex","Ultra","Swift","Dark","Storm","Cyber","Nova","Echo"];
  const noun = ["Builder","Mind","Code","Wave","Core","Pulse","Node","Link","Arc","Byte"];
  const adj_ = adj[Math.floor(Math.random() * adj.length)]!;
  const noun_= noun[Math.floor(Math.random() * noun.length)]!;
  return `${adj_}${noun_}${Math.floor(Math.random() * 9000) + 1000}`;
}

function sanitize(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, sessionId: __, stripeCustomerId: ___, stripeSubscriptionId: ____, googleId: _____, ...safe } = user;
  return safe;
}

function tierOf(user: typeof usersTable.$inferSelect): "free" | "pro" | "creator_pro" | "enterprise" {
  const t = user.subscriptionTier;
  if (t === "pro" || t === "creator_pro" || t === "enterprise") return t;
  return "free";
}

// ── POST /auth/register ───────────────────────────────────────────────────────

router.post("/auth/register", authLimiter, async (req, res): Promise<void> => {
  const schema = z.object({
    email:    z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscores only").optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.issues[0]?.message ?? "Validation failed");
    return;
  }

  const { email, password, username } = parsed.data;

  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing) {
      badRequest(res, "An account with this email already exists");
      return;
    }

    const sessionId    = randomBytes(32).toString("hex");
    const passwordHash = createPasswordHash(password);
    const finalName    = username?.trim() || randomUsername();

    const [user] = await db.insert(usersTable).values({
      sessionId, email, passwordHash, username: finalName,
    }).returning();

    if (!user) { serverError(res); return; }

    const tokens = issueTokenPair(user.id, user.sessionId, tierOf(user));
    logger.info({ userId: user.id }, "[auth] new user registered");

    success(res, {
      user:         sanitize(user),
      sessionId:    user.sessionId,
      ...tokens,
      message:      "Account created successfully",
    }, 201);
  } catch (err) {
    logger.error({ err }, "[auth] register error");
    serverError(res);
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

router.post("/auth/login", authLimiter, async (req, res): Promise<void> => {
  const schema = z.object({
    email:    z.string().email(),
    password: z.string().min(1, "Password is required"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.issues[0]?.message ?? "Validation failed");
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      unauthorized(res, "Invalid email or password");
      return;
    }

    const tokens = issueTokenPair(user.id, user.sessionId, tierOf(user));
    logger.info({ userId: user.id }, "[auth] login");

    success(res, {
      user:      sanitize(user),
      sessionId: user.sessionId,
      ...tokens,
      message:   "Login successful",
    });
  } catch (err) {
    logger.error({ err }, "[auth] login error");
    serverError(res);
  }
});

// ── POST /auth/refresh ────────────────────────────────────────────────────────
// Exchange a valid refresh token for a new access token + refresh token pair.

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken || typeof refreshToken !== "string") {
    badRequest(res, "refreshToken is required");
    return;
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    unauthorized(res, "Invalid or expired refresh token. Please login again.");
    return;
  }

  try {
    // Re-read user from DB to get latest tier
    const [user] = await db
      .select({ id: usersTable.id, sessionId: usersTable.sessionId, subscriptionTier: usersTable.subscriptionTier })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user) {
      unauthorized(res, "User not found. Please login again.");
      return;
    }

    const tokens = issueTokenPair(user.id, user.sessionId, tierOf(user as any));
    success(res, { ...tokens, message: "Tokens refreshed" });
  } catch (err) {
    logger.error({ err }, "[auth] refresh error");
    serverError(res);
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

router.get("/auth/me", async (req, res): Promise<void> => {
  // Accept Bearer token OR x-session-id
  const authHeader = req.headers.authorization ?? "";
  let sessionId    = req.headers["x-session-id"] as string;

  if (authHeader.startsWith("Bearer ")) {
    const { verifyAccessToken } = await import("../shared/lib/jwt");
    const payload = verifyAccessToken(authHeader.slice(7).trim());
    if (!payload) { unauthorized(res, "Invalid or expired token"); return; }
    sessionId = payload.sessionId;
  }

  if (!sessionId) { unauthorized(res, "Not authenticated"); return; }

  try {
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.sessionId, sessionId)).limit(1);

    if (!user) { success(res, { authenticated: false }); return; }

    success(res, {
      authenticated: true,
      user:          sanitize(user),
      sessionId:     user.sessionId,
    });
  } catch (err) {
    logger.error({ err }, "[auth] /me error");
    serverError(res);
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
// JWT is stateless — client deletes token. For session-based, also clears server-side.

router.post("/auth/logout", async (_req, res): Promise<void> => {
  // Nothing to invalidate server-side for JWT (stateless by design).
  // Client should delete accessToken and refreshToken from storage.
  success(res, { ok: true, message: "Logged out. Please clear your access and refresh tokens." });
});

// ── GET /auth/status — health check for auth system ──────────────────────────

router.get("/auth/status", (_req, res): void => {
  success(res, {
    auth:     "operational",
    methods:  ["email_password", "google_oauth", "session_id"],
    jwt:      true,
    refresh:  true,
    version:  "2.0",
  });
});

export default router;
