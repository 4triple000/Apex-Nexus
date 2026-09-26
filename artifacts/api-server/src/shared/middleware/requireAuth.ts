/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX UNIVERSAL AUTH MIDDLEWARE                                          ║
 * ║  Accepts: Authorization: Bearer <jwt>  OR  x-apex-auth / x-session-id   ║
 * ║  Backward compatible with all existing frontend code                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import type { Response, NextFunction } from "express";
import type { ApexRequest } from "../types";
import { verifyAccessToken } from "../lib/jwt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { unauthorized, forbidden } from "../utils/response";
import { logger } from "../../lib/logger";
import { cacheGet, cacheSet } from "../../core/cache";

// ── Extract Bearer token from Authorization header ────────────────────────────

function extractBearerToken(req: ApexRequest): string | null {
  const auth = req.headers.authorization ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

// ── Resolve session to user (with short-lived cache) ─────────────────────────

async function resolveSessionUser(sessionId: string): Promise<{
  id: number;
  subscriptionTier: string;
} | null> {
  const cacheKey = `apex:session:${sessionId}`;

  const cached = await cacheGet<{ id: number; subscriptionTier: string }>(cacheKey);
  if (cached) return cached;

  try {
    const [user] = await db
      .select({ id: usersTable.id, subscriptionTier: usersTable.subscriptionTier })
      .from(usersTable)
      .where(eq(usersTable.sessionId, sessionId))
      .limit(1);

    if (user) {
      await cacheSet(cacheKey, user, 60); // cache 60s
      return user;
    }
    return null;
  } catch (err) {
    logger.error({ err }, "[requireAuth] session resolve error");
    return null;
  }
}

// ── requireAuth — blocks unauthenticated requests ─────────────────────────────
// Priority: JWT Bearer token > x-session-id header

export async function requireAuth(
  req: ApexRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // 1. Try JWT Bearer token first
  const token = extractBearerToken(req);
  if (token) {
    const payload = verifyAccessToken(token);
    if (!payload) {
      unauthorized(res, "Invalid or expired access token. Please login again.");
      return;
    }
    req.userId    = payload.userId;
    req.sessionId = payload.sessionId;
    req.subscriptionTier = payload.tier as ApexRequest["subscriptionTier"];
    next();
    return;
  }

  // 2. Fall back to x-session-id header (backward compat)
  const sessionId =
    (req.headers["x-apex-auth"] as string) ||
    (req.headers["x-session-id"] as string) ||
    (req.body?.sessionId as string) ||
    (req.query.sessionId as string);

  if (!sessionId) {
    unauthorized(res, "Authentication required. Include Authorization: Bearer <token> or x-session-id header.");
    return;
  }

  req.sessionId = sessionId;

  // Optionally resolve to a real user (non-blocking if not found)
  const user = await resolveSessionUser(sessionId);
  if (user) {
    req.userId = user.id;
    req.subscriptionTier = user.subscriptionTier as ApexRequest["subscriptionTier"];
  }

  next();
}

// ── requireUser — like requireAuth, but the session must belong to a real account ──
// requireAuth accepts any x-session-id; use this for routes that must not be anonymous
// (e.g. running user code on the server).

export async function requireUser(
  req: ApexRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, () => {
    if (!req.userId) {
      unauthorized(res, "Please sign in to use this feature.");
      return;
    }
    next();
  });
}

// ── resolveUserId — for non-HTTP transports (socket.io handshakes) ────────────

export async function resolveUserId(credentials: {
  token?: string;
  sessionId?: string;
}): Promise<number | null> {
  if (credentials.token) {
    return verifyAccessToken(credentials.token)?.userId ?? null;
  }
  if (credentials.sessionId) {
    return (await resolveSessionUser(credentials.sessionId))?.id ?? null;
  }
  return null;
}

// ── optionalAuth — attaches identity if present, never blocks ─────────────────

export async function optionalAuth(
  req: ApexRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.userId    = payload.userId;
      req.sessionId = payload.sessionId;
      req.subscriptionTier = payload.tier as ApexRequest["subscriptionTier"];
    }
  } else {
    const sessionId =
      (req.headers["x-apex-auth"] as string) ||
    (req.headers["x-session-id"] as string) ||
      (req.body?.sessionId as string) ||
      (req.query.sessionId as string);

    if (sessionId) {
      req.sessionId = sessionId;
      const user = await resolveSessionUser(sessionId);
      if (user) {
        req.userId = user.id;
        req.subscriptionTier = user.subscriptionTier as ApexRequest["subscriptionTier"];
      }
    }
  }
  next();
}

// ── requireTier — enforces minimum subscription tier ─────────────────────────

const TIER_RANK: Record<string, number> = {
  free: 0, pro: 1, creator_pro: 2, enterprise: 3,
};

export function requireTier(minTier: "pro" | "creator_pro" | "enterprise") {
  return function tierGuard(req: ApexRequest, res: Response, next: NextFunction): void {
    const tier = req.subscriptionTier ?? "free";
    if ((TIER_RANK[tier] ?? 0) < (TIER_RANK[minTier] ?? 1)) {
      forbidden(res, `This feature requires a ${minTier} subscription or higher.`);
      return;
    }
    next();
  };
}
