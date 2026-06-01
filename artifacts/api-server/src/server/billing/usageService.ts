/**
 * Apex Billing — Usage Service
 *
 * Tracks and queries per-user usage for builds, AI calls, and deployments.
 * Uses the apex_usage_logs table with daily buckets per action type.
 *
 * Core operations:
 *   trackUsage(userId, action)  — Atomically increment usage counter
 *   getUsage(userId, tier)      — Fetch usage stats for current period
 *   checkLimit(userId, tier, action) — Is this action allowed?
 */

import { db, apexUsageLogsTable, usersTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getLimits, isUnlimited, normalizeTier } from "./planConfig";
import type { PlanTier, UsageAction, UsageStats } from "./types";

// ── Date helpers ───────────────────────────────────────────────────────────────

function todayDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function currentMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── Track usage (increment counter) ───────────────────────────────────────────

export async function trackUsage(
  userId: number,
  action: UsageAction,
  sessionId?: string
): Promise<void> {
  const periodDate = action === "deployment" ? currentMonthStart() : todayDate();

  try {
    // UPSERT: increment count atomically, create row if not exists
    await db
      .insert(apexUsageLogsTable)
      .values({
        userId,
        sessionId: sessionId ?? null,
        action,
        periodDate,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [apexUsageLogsTable.userId, apexUsageLogsTable.action, apexUsageLogsTable.periodDate],
        set: {
          count: sql`${apexUsageLogsTable.count} + 1`,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    // Non-fatal: log but don't block the action
    logger.error({ err, userId, action }, "UsageService: failed to track usage");
  }
}

// ── Get current usage for a user ───────────────────────────────────────────────

export async function getUsage(
  userId: number,
  sessionId: string,
  rawTier?: string
): Promise<UsageStats> {
  const tier = normalizeTier(rawTier ?? "free") as PlanTier;
  const limits = getLimits(tier);
  const today = todayDate();
  const monthStart = currentMonthStart();

  // Fetch all relevant log rows
  const rows = await db
    .select()
    .from(apexUsageLogsTable)
    .where(
      and(
        eq(apexUsageLogsTable.userId, userId),
        gte(apexUsageLogsTable.periodDate, monthStart)
      )
    );

  const getCount = (action: UsageAction, period: string): number => {
    return rows
      .filter(r => r.action === action && r.periodDate === period)
      .reduce((sum, r) => sum + r.count, 0);
  };

  const buildsUsed      = getCount("build",      today);
  const aiCallsUsed     = getCount("ai_call",    today);
  const deploymentsUsed = getCount("deployment", monthStart);

  const mkStat = (used: number, limit: number) => ({
    used,
    limit,
    remaining: isUnlimited(limit) ? -1 : Math.max(0, limit - used),
    unlimited: isUnlimited(limit),
  });

  return {
    userId,
    sessionId,
    tier,
    period: today,
    builds:      mkStat(buildsUsed,      limits.buildsPerDay),
    aiCalls:     mkStat(aiCallsUsed,     limits.aiCallsPerDay),
    deployments: mkStat(deploymentsUsed, limits.deploymentsPerMonth),
  };
}

// ── Check if an action is within limits ────────────────────────────────────────

export interface LimitCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
  reason?: string;
}

export async function checkLimit(
  userId: number,
  rawTier: string,
  action: UsageAction
): Promise<LimitCheckResult> {
  const tier = normalizeTier(rawTier);
  const limits = getLimits(tier);

  const limitValue = action === "deployment"
    ? limits.deploymentsPerMonth
    : action === "ai_call"
    ? limits.aiCallsPerDay
    : limits.buildsPerDay;

  // Unlimited
  if (isUnlimited(limitValue)) {
    return { allowed: true, used: 0, limit: -1, remaining: -1, unlimited: true };
  }

  const period = action === "deployment" ? currentMonthStart() : todayDate();

  const rows = await db
    .select({ count: apexUsageLogsTable.count })
    .from(apexUsageLogsTable)
    .where(
      and(
        eq(apexUsageLogsTable.userId, userId),
        eq(apexUsageLogsTable.action, action),
        eq(apexUsageLogsTable.periodDate, period)
      )
    );

  const used = rows[0]?.count ?? 0;
  const remaining = Math.max(0, limitValue - used);
  const allowed = used < limitValue;

  return {
    allowed,
    used,
    limit: limitValue,
    remaining,
    unlimited: false,
    reason: allowed ? undefined : `${action} limit reached (${used}/${limitValue})`,
  };
}

// ── Resolve user from session ──────────────────────────────────────────────────

export async function resolveUserForBilling(sessionId: string): Promise<{
  id: number;
  subscriptionTier: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
} | null> {
  const [user] = await db
    .select({
      id:                  usersTable.id,
      subscriptionTier:    usersTable.subscriptionTier,
      subscriptionStatus:  usersTable.subscriptionStatus,
      stripeCustomerId:    usersTable.stripeCustomerId,
      stripeSubscriptionId: usersTable.stripeSubscriptionId,
    })
    .from(usersTable)
    .where(eq(usersTable.sessionId, sessionId))
    .limit(1);

  return user ?? null;
}
