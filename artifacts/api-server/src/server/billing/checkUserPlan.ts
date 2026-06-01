/**
 * Apex Billing — Plan Enforcement Middleware
 *
 * checkUserPlan(options) — Returns an Express middleware that:
 *   1. Resolves the user from x-session-id header
 *   2. Checks plan access for the requested feature
 *   3. (optionally) Checks usage limits for tracked actions
 *   4. Blocks with HTTP 402/403/429 if denied
 *   5. Calls next() if allowed
 *
 * Usage:
 *   router.post("/autopilot/run", checkUserPlan({ feature: "autopilot" }), handler);
 *   router.post("/deploy/:id", checkUserPlan({ feature: "deployment", trackAction: "deployment" }), handler);
 *   router.post("/ai/chat", checkUserPlan({ trackAction: "ai_call" }), handler);
 *
 * Options:
 *   feature         — Plan feature to check (e.g., "autopilot", "agentPipelines")
 *   trackAction     — Usage action to both check AND track if allowed
 *   requiredTier    — Minimum required tier (e.g., "pro" blocks free)
 *   blockFree       — Shorthand for requiredTier: "pro"
 *   skipTracking    — Check limits but don't increment (for read-only endpoints)
 */

import type { Response, NextFunction } from "express";
import type { ApexRequest } from "../../shared/types";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getLimits, normalizeTier } from "./planConfig";
import { checkLimit, trackUsage } from "./usageService";
import { logger } from "../../lib/logger";
import type { PlanTier, UsageAction } from "./types";

// ── Feature → plan limit key mapping ─────────────────────────────────────────

type FeatureKey =
  | "autopilot"
  | "agentPipelines"
  | "realtimeCollab"
  | "selfImprovement"
  | "marketplacePublish"
  | "studioAccess"
  | "deployment"
  | "ai_call"
  | "build";

type PlanLimitBooleanKey =
  | "autopilotEnabled"
  | "agentPipelinesEnabled"
  | "realtimeCollabEnabled"
  | "selfImprovementEnabled"
  | "marketplacePublishEnabled"
  | "studioEnabled";

const FEATURE_TO_LIMIT_KEY: Record<string, PlanLimitBooleanKey | null> = {
  autopilot:           "autopilotEnabled",
  agentPipelines:      "agentPipelinesEnabled",
  realtimeCollab:      "realtimeCollabEnabled",
  selfImprovement:     "selfImprovementEnabled",
  marketplacePublish:  "marketplacePublishEnabled",
  studioAccess:        "studioEnabled",
  deployment:          null, // usage-based, not boolean
  ai_call:             null,
  build:               null,
};

const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, enterprise: 2 };

function meetsMinTier(userTier: PlanTier, required: PlanTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface CheckUserPlanOptions {
  /** Feature name to check boolean access for */
  feature?: FeatureKey;
  /** Usage action to check limits AND optionally track */
  trackAction?: UsageAction;
  /** Minimum tier required (overrides blockFree) */
  requiredTier?: PlanTier;
  /** Shorthand: require at least "pro" tier */
  blockFree?: boolean;
  /** Check limits but don't increment usage counter */
  skipTracking?: boolean;
}

// ── Middleware factory ────────────────────────────────────────────────────────

export function checkUserPlan(options: CheckUserPlanOptions = {}) {
  return async function planMiddleware(req: ApexRequest, res: Response, next: NextFunction): Promise<void> {
    const sessionId = (req.headers["x-session-id"] as string)
      || (req.body as Record<string, string>)?.sessionId
      || (req.query.sessionId as string);

    // ── Resolve user ───────────────────────────────────────────────────────
    let userId: number | null = null;
    let rawTier = "free";

    if (sessionId) {
      try {
        const [user] = await db
          .select({ id: usersTable.id, subscriptionTier: usersTable.subscriptionTier, subscriptionStatus: usersTable.subscriptionStatus })
          .from(usersTable)
          .where(eq(usersTable.sessionId, sessionId))
          .limit(1);

        if (user) {
          userId = user.id;
          rawTier = user.subscriptionTier;
          req.userId = user.id;
        }
      } catch (err) {
        logger.warn({ err }, "checkUserPlan: DB error resolving user — defaulting to free");
      }
    }

    const tier = normalizeTier(rawTier) as PlanTier;
    const limits = getLimits(tier);

    // ── Minimum tier check ─────────────────────────────────────────────────
    const minTier: PlanTier | undefined = options.requiredTier ?? (options.blockFree ? "pro" : undefined);
    if (minTier && !meetsMinTier(tier, minTier)) {
      res.status(402).json({
        ok: false,
        error: `This feature requires ${minTier} plan or higher`,
        code: "UPGRADE_REQUIRED",
        currentTier: tier,
        requiredTier: minTier,
        upgradeUrl: "/pricing",
      });
      return;
    }

    // ── Feature boolean check ──────────────────────────────────────────────
    if (options.feature) {
      const limitKey = FEATURE_TO_LIMIT_KEY[options.feature];
      if (limitKey && !limits[limitKey]) {
        const neededTier: PlanTier = tier === "free" ? "pro" : "enterprise";
        res.status(402).json({
          ok: false,
          error: `${options.feature} is not available on your current ${tier} plan`,
          code: "FEATURE_NOT_AVAILABLE",
          currentTier: tier,
          requiredTier: neededTier,
          upgradeUrl: "/pricing",
        });
        return;
      }
    }

    // ── Usage limit check + tracking ───────────────────────────────────────
    if (options.trackAction && userId !== null) {
      const check = await checkLimit(userId, tier, options.trackAction);

      if (!check.allowed) {
        const period = options.trackAction === "deployment" ? "this month" : "today";
        res.status(429).json({
          ok: false,
          error: `${options.trackAction} limit reached for ${period} (${check.used}/${check.limit})`,
          code: "USAGE_LIMIT_EXCEEDED",
          currentTier: tier,
          used: check.used,
          limit: check.limit,
          upgradeUrl: "/pricing",
          upgradeMessage: `Upgrade to Pro for higher limits`,
        });
        return;
      }

      // Track the usage if allowed and not skip-only mode
      if (!options.skipTracking) {
        void trackUsage(userId, options.trackAction, sessionId);
      }
    }

    // ── Attach plan info to request for use in handlers ────────────────────
    req.subscriptionTier = tier as "free" | "pro" | "creator_pro";

    next();
  };
}

// ── Shorthand middlewares ─────────────────────────────────────────────────────

/** Blocks free users from autopilot */
export const requireAutopilot = checkUserPlan({ feature: "autopilot" });

/** Tracks a build and enforces daily build limit */
export const trackBuild = checkUserPlan({ trackAction: "build" });

/** Tracks an AI call and enforces daily AI call limit */
export const trackAiCall = checkUserPlan({ trackAction: "ai_call" });

/** Tracks a deployment and enforces monthly deployment limit */
export const trackDeployment = checkUserPlan({ trackAction: "deployment" });

/** Blocks free users from multi-agent pipelines */
export const requireAgentPipelines = checkUserPlan({ feature: "agentPipelines" });

/** Blocks free users from marketplace publishing */
export const requireMarketplacePublish = checkUserPlan({ feature: "marketplacePublish" });

/** Blocks free users from real-time collaboration */
export const requireRealtimeCollab = checkUserPlan({ feature: "realtimeCollab" });
