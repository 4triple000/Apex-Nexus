/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  DB-BACKED DAILY RATE LIMITER                                            ║
 * ║  Persists across server restarts · Per-user daily quota                  ║
 * ║  Free: 20 AI req/day · Pro: 200/day · Enterprise: unlimited              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import type { Response, NextFunction } from "express";
import type { ApexRequest } from "../types";
import { db, usageTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { tooManyRequests } from "../utils/response";
import { logger } from "../../lib/logger";

// ── Tier limits ───────────────────────────────────────────────────────────────

export const DAILY_LIMITS: Record<string, number> = {
  free:         20,
  pro:          200,
  creator_pro:  500,
  enterprise:   -1,   // unlimited (-1 = no check)
};

export const HOURLY_API_LIMITS: Record<string, number> = {
  free:         100,
  pro:          1000,
  creator_pro:  2000,
  enterprise:   -1,
};

// In-memory fast-path cache (keyed by sessionId) to avoid DB hits every request
// Purged when day rolls over
const inMemory = new Map<string, { used: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of inMemory.entries()) {
    if (entry.resetAt < now) inMemory.delete(key);
  }
}, 60_000); // cleanup every minute

function nextMidnight(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Get or create usage row ───────────────────────────────────────────────────

async function getOrCreateUsageRow(sessionId: string, tier: string) {
  const [row] = await db
    .select()
    .from(usageTable)
    .where(eq(usageTable.sessionId, sessionId))
    .limit(1);

  if (!row) {
    const [created] = await db
      .insert(usageTable)
      .values({ sessionId, tier, requestsUsed: 0, resetAt: nextMidnight() })
      .returning();
    return created!;
  }

  // Auto-reset if day rolled over
  if (new Date(row.resetAt) <= new Date()) {
    const [reset] = await db
      .update(usageTable)
      .set({ requestsUsed: 0, tier, resetAt: nextMidnight(), updatedAt: new Date() })
      .where(eq(usageTable.sessionId, sessionId))
      .returning();
    return reset!;
  }

  return row;
}

// ── Middleware factory ────────────────────────────────────────────────────────

export function dailyAiLimiter(req: ApexRequest, res: Response, next: NextFunction): void {
  const sessionId = req.sessionId ?? req.ip ?? "anonymous";
  const tier      = req.subscriptionTier ?? "free";
  const limit     = DAILY_LIMITS[tier] ?? DAILY_LIMITS["free"]!;

  // Enterprise: skip all checks
  if (limit === -1) { next(); return; }

  // Fast-path: check in-memory counter first
  const now   = Date.now();
  const mem   = inMemory.get(sessionId);
  if (mem && mem.resetAt > now) {
    if (mem.used >= limit) {
      res.setHeader("X-RateLimit-Limit",     limit);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset",     Math.ceil(mem.resetAt / 1000));
      tooManyRequests(res, `Daily AI request limit reached (${limit}/day). Resets at midnight. Upgrade to Pro for higher limits.`);
      return;
    }
    mem.used++;
    res.setHeader("X-RateLimit-Limit",     limit);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - mem.used));
    res.setHeader("X-RateLimit-Reset",     Math.ceil(mem.resetAt / 1000));
    next();
    return;
  }

  // Slow-path: sync with DB
  getOrCreateUsageRow(sessionId, tier)
    .then(row => {
      const resetMs = new Date(row.resetAt).getTime();

      // Update in-memory cache
      inMemory.set(sessionId, { used: row.requestsUsed + 1, resetAt: resetMs });

      res.setHeader("X-RateLimit-Limit",     limit);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - row.requestsUsed - 1));
      res.setHeader("X-RateLimit-Reset",     Math.ceil(resetMs / 1000));

      if (row.requestsUsed >= limit) {
        tooManyRequests(res, `Daily AI request limit reached (${limit}/day). Resets at midnight. Upgrade to Pro for higher limits.`);
        return;
      }

      // Persist increment (fire & forget — non-blocking)
      db.update(usageTable)
        .set({ requestsUsed: row.requestsUsed + 1, updatedAt: new Date() })
        .where(eq(usageTable.sessionId, sessionId))
        .execute()
        .catch(err => logger.warn({ err }, "[dailyRateLimit] increment failed"));

      next();
    })
    .catch(err => {
      logger.error({ err }, "[dailyRateLimit] DB error — allowing request");
      next(); // fail open to avoid blocking users on DB errors
    });
}

// ── Get usage stats for a session ────────────────────────────────────────────

export async function getUsageStats(sessionId: string, tier: string) {
  const row   = await getOrCreateUsageRow(sessionId, tier);
  const limit = DAILY_LIMITS[tier] ?? DAILY_LIMITS["free"]!;
  return {
    requestsUsed:  row.requestsUsed,
    requestsLimit: limit === -1 ? null : limit,
    tier:          row.tier,
    resetAt:       row.resetAt,
    percentUsed:   limit === -1 ? 0 : Math.round((row.requestsUsed / limit) * 100),
    isUnlimited:   limit === -1,
    isNearLimit:   limit !== -1 && row.requestsUsed >= limit * 0.8,
    isAtLimit:     limit !== -1 && row.requestsUsed >= limit,
  };
}
