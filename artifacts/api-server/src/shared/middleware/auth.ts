/**
 * Authentication middleware for Apex backend.
 *
 * Apex uses session-based identity via the x-session-id header (UUID stored in localStorage).
 * This is a lightweight, passwordless auth model — each session maps to a user profile.
 * Future: replace with JWT or Replit Auth for stricter identity.
 */

import type { Response, NextFunction } from "express";
import type { ApexRequest } from "../types";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { unauthorized } from "../utils/response";
import { logger } from "../../lib/logger";

// ── Session ID injection (soft — does not block, just populates req.sessionId) ──
export function injectSession(req: ApexRequest, _res: Response, next: NextFunction): void {
  const sessionId =
    (req.headers["x-session-id"] as string) ||
    (req.body?.sessionId as string) ||
    (req.query.sessionId as string);

  if (sessionId) {
    req.sessionId = sessionId;
  }
  next();
}

// ── Require session (blocks requests without a session ID) ────────────────────
export function requireSession(req: ApexRequest, res: Response, next: NextFunction): void {
  if (!req.sessionId) {
    unauthorized(res, "Session ID required. Include x-session-id header.");
    return;
  }
  next();
}

// ── Require resolved user (resolves session → user record) ────────────────────
export function requireUser(req: ApexRequest, res: Response, next: NextFunction): void {
  if (!req.sessionId) {
    unauthorized(res, "Session ID required.");
    return;
  }
  // Resolve async — attach userId to req
  db.select({ id: usersTable.id, subscriptionTier: usersTable.subscriptionTier })
    .from(usersTable)
    .where(eq(usersTable.sessionId, req.sessionId))
    .limit(1)
    .then(([user]) => {
      if (user) {
        req.userId = user.id;
        req.subscriptionTier = user.subscriptionTier as "free" | "pro" | "creator_pro";
      }
      next();
    })
    .catch((err) => {
      logger.error({ err }, "requireUser middleware error");
      next(); // non-fatal — user just won't have userId set
    });
}

// ── Require premium tier ──────────────────────────────────────────────────────
export function requirePremium(req: ApexRequest, res: Response, next: NextFunction): void {
  if (req.subscriptionTier === "free" || !req.subscriptionTier) {
    unauthorized(res, "This feature requires a Pro or Creator Pro subscription.");
    return;
  }
  next();
}
