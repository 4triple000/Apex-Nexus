/**
 * Apex Billing & Monetization Router
 * Mounts at /api/billing/*
 *
 * Endpoints:
 *   GET  /billing/plans          — List Free/Pro/Enterprise plans with pricing + limits
 *   POST /billing/subscribe      — Create Stripe checkout session for a plan
 *   GET  /billing/status         — Current subscription status + tier
 *   GET  /billing/usage          — Real usage stats vs plan limits
 *   POST /billing/portal         — Open Stripe customer billing portal
 *   POST /billing/cancel         — Cancel subscription (redirects to portal)
 *   POST /billing/webhook        — Stripe webhook receiver (raw body)
 *
 * Architecture:
 *   - Plan config is in server/billing/planConfig.ts (ENV-overridable limits)
 *   - Usage tracking is in server/billing/usageService.ts (DB-backed)
 *   - Webhook logic is in server/billing/webhookHandler.ts
 *   - Feature enforcement middleware: checkUserPlan() from server/billing/checkUserPlan.ts
 */

import express, { Router, type IRouter } from "express";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../../lib/stripeClient";
import { injectSession, requireSession } from "../../shared/middleware/auth";
import { success, badRequest, notFound, serverError } from "../../shared/utils/response";
import { logger } from "../../lib/logger";

// ── Billing service imports ────────────────────────────────────────────────────
import { PLAN_METADATA, normalizeTier } from "../../server/billing/planConfig";
import { getUsage, resolveUserForBilling } from "../../server/billing/usageService";
import { handleStripeWebhook } from "../../server/billing/webhookHandler";
import type { PlanTier } from "../../server/billing/types";

const router: IRouter = Router();

// ── Webhook endpoint: raw body BEFORE express.json() middleware ────────────────
// Must be registered before router.use(injectSession) — uses raw buffer for signature check
router.post(
  "/billing/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// ── All other routes use JSON + session injection ──────────────────────────────
router.use(injectSession);

// ── GET /billing/plans ────────────────────────────────────────────────────────
router.get("/billing/plans", async (_req, res): Promise<void> => {
  try {
    const stripe = await getUncachableStripeClient();

    // Enrich with live Stripe prices if available
    const [products, prices] = await Promise.all([
      stripe.products.list({ active: true, limit: 20 }),
      stripe.prices.list({ active: true, limit: 50 }),
    ]);

    // Build price map from Stripe data
    const stripeOverrides: Record<string, { id: string; amount: number; currency: string; interval: string }[]> = {};
    for (const price of prices.data) {
      const pid = price.product as string;
      if (!stripeOverrides[pid]) stripeOverrides[pid] = [];
      stripeOverrides[pid].push({
        id:       price.id,
        amount:   price.unit_amount ?? 0,
        currency: price.currency,
        interval: (price.recurring as { interval: string } | null)?.interval ?? "one_time",
      });
    }

    const tiers: PlanTier[] = ["free", "pro", "enterprise"];
    const plans = tiers.map(tier => {
      const meta = PLAN_METADATA[tier];
      const limits = meta.limits;

      // Try to match Stripe product by metadata.apex_tier
      const stripeProduct = products.data.find(p => p.metadata?.apex_tier === tier);
      const livePrices = stripeProduct ? (stripeOverrides[stripeProduct.id] ?? []) : [];

      return {
        tier,
        name:        meta.name,
        description: meta.description,
        priceMonthly: meta.priceMonthly,
        priceYearly:  meta.priceYearly,
        currency:     meta.currency,
        badgeColor:   meta.badgeColor,
        features:     meta.features,
        limits: {
          buildsPerDay:              limits.buildsPerDay,
          aiCallsPerDay:             limits.aiCallsPerDay,
          deploymentsPerMonth:       limits.deploymentsPerMonth,
          maxProjects:               limits.maxProjects,
          autopilotEnabled:          limits.autopilotEnabled,
          agentPipelinesEnabled:     limits.agentPipelinesEnabled,
          maxAgentsPerPipeline:      limits.maxAgentsPerPipeline,
          realtimeCollabEnabled:     limits.realtimeCollabEnabled,
          selfImprovementEnabled:    limits.selfImprovementEnabled,
          prioritySupport:           limits.prioritySupport,
          studioEnabled:             limits.studioEnabled,
          marketplacePublishEnabled: limits.marketplacePublishEnabled,
        },
        stripePrices: livePrices.length > 0 ? livePrices : [
          ...(meta.priceMonthly > 0
            ? [{ id: meta.stripePriceIdMonthly ?? "not_configured", amount: meta.priceMonthly, currency: "usd", interval: "month" }]
            : [{ id: "free", amount: 0, currency: "usd", interval: "forever" }]
          ),
        ],
      };
    });

    success(res, { plans });
  } catch (_err) {
    logger.warn("Stripe unavailable — returning static plan list");
    const plans = (["free", "pro", "enterprise"] as PlanTier[]).map(tier => ({
      tier,
      ...PLAN_METADATA[tier],
      stripePrices: [],
    }));
    success(res, { plans, note: "Stripe not reachable — showing static plan data" });
  }
});

// ── POST /billing/subscribe ────────────────────────────────────────────────────
router.post("/billing/subscribe", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;

  const schema = z.object({
    priceId:    z.string().min(1),
    tier:       z.enum(["free", "pro", "enterprise"]).optional(),
    successUrl: z.string().url().optional(),
    cancelUrl:  z.string().url().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid request body");
    return;
  }

  try {
    const user = await resolveUserForBilling(sessionId);
    if (!user) { notFound(res, "User not found"); return; }

    const stripe = await getUncachableStripeClient();
    const domain = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;

    // Ensure Stripe customer exists
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { apexUserId: String(user.id), sessionId },
      });
      customerId = customer.id;
      await db.update(usersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(usersTable.id, user.id));
    }

    // Create checkout session
    const price = await stripe.prices.retrieve(parsed.data.priceId);
    const isSubscription = !!price.recurring;

    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      payment_method_types: ["card"],
      line_items:           [{ price: parsed.data.priceId, quantity: 1 }],
      mode:                 isSubscription ? "subscription" : "payment",
      success_url:          parsed.data.successUrl ?? `${domain}/pricing?checkout=success&tier=${parsed.data.tier ?? "pro"}`,
      cancel_url:           parsed.data.cancelUrl  ?? `${domain}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        apexUserId:    String(user.id),
        apexSessionId: sessionId,
        apexTier:      parsed.data.tier ?? "pro",
      },
      subscription_data: isSubscription ? {
        metadata: { apexUserId: String(user.id), apexSessionId: sessionId },
      } : undefined,
    });

    logger.info({ userId: user.id, priceId: parsed.data.priceId }, "Billing: checkout session created");
    success(res, {
      checkoutUrl: session.url,
      sessionId:   session.id,
      mode:        isSubscription ? "subscription" : "payment",
    });
  } catch (err) {
    logger.error({ err }, "Billing subscribe error");
    serverError(res, "Failed to create checkout session");
  }
});

// ── GET /billing/status ───────────────────────────────────────────────────────
router.get("/billing/status", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;

  try {
    const user = await resolveUserForBilling(sessionId);
    const tier = normalizeTier(user?.subscriptionTier);
    const meta = PLAN_METADATA[tier];

    // Fetch live Stripe subscription status if we have a subscription ID
    let liveStripeStatus: string | null = null;
    let periodEnd: string | null = null;

    if (user?.stripeSubscriptionId) {
      try {
        const stripe = await getUncachableStripeClient();
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        liveStripeStatus = sub.status;
        periodEnd = new Date((sub as { current_period_end: number }).current_period_end * 1000).toISOString();
      } catch {
        logger.warn("Could not fetch live Stripe subscription — using cached status");
      }
    }

    success(res, {
      tier,
      name:               meta.name,
      status:             liveStripeStatus ?? user?.subscriptionStatus ?? "inactive",
      hasActiveSubscription: (liveStripeStatus ?? user?.subscriptionStatus) === "active" || (liveStripeStatus ?? user?.subscriptionStatus) === "trialing",
      periodEnd,
      stripeCustomerId:   user?.stripeCustomerId   ?? null,
      stripeSubscriptionId: user?.stripeSubscriptionId ?? null,
      limits:             meta.limits,
      badgeColor:         meta.badgeColor,
    });
  } catch (err) {
    logger.error({ err }, "Billing status error");
    serverError(res, "Failed to retrieve billing status");
  }
});

// ── GET /billing/usage ────────────────────────────────────────────────────────
router.get("/billing/usage", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;

  try {
    const user = await resolveUserForBilling(sessionId);
    if (!user) {
      // Return empty usage for unregistered sessions
      const usage = await getUsage(0, sessionId, "free");
      success(res, { usage });
      return;
    }

    const usage = await getUsage(user.id, sessionId, user.subscriptionTier);
    success(res, { usage });
  } catch (err) {
    logger.error({ err }, "Billing usage error");
    serverError(res, "Failed to retrieve usage stats");
  }
});

// ── POST /billing/portal ──────────────────────────────────────────────────────
router.post("/billing/portal", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;
  const user = await resolveUserForBilling(sessionId);

  if (!user?.stripeCustomerId) {
    badRequest(res, "No billing account found. Subscribe first to access the billing portal.");
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    const domain = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
    const portal = await stripe.billingPortal.sessions.create({
      customer:   user.stripeCustomerId,
      return_url: `${domain}/pricing`,
    });
    success(res, { portalUrl: portal.url });
  } catch (err) {
    logger.error({ err }, "Billing portal error");
    serverError(res, "Failed to open billing portal");
  }
});

// ── GET /billing/feature-gate ─────────────────────────────────────────────────
// Check if the current user's tier allows access to a given feature.
// Returns: { canAccess, currentTier, requiredTier }
router.get("/billing/feature-gate", injectSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;
  const featureId = req.query.featureId as string;

  if (!featureId) { badRequest(res, "featureId query param required"); return; }

  const TIER_ORDER: PlanTier[] = ["free", "pro", "enterprise"];

  const FEATURE_TIER_REQUIREMENTS: Record<string, PlanTier> = {
    marketplace:          "free",
    social:               "free",
    referral:             "free",
    workflows:            "pro",
    autopilot:            "pro",
    privacy:              "pro",
    "memory-control":     "pro",
    "game-studio":        "pro",
    monetization:         "pro",
    analytics:            "pro",
    "game-publish":       "pro",
    "self-improve":       "enterprise",
    plugins:              "enterprise",
    "personality-reset":  "enterprise",
    "multiplayer-fps":    "enterprise",
    "mobile-fps":         "enterprise",
    "unity-gen":          "enterprise",
  };

  try {
    const user        = await resolveUserForBilling(sessionId);
    const currentTier = normalizeTier(user?.subscriptionTier) as PlanTier;
    const requiredTier = FEATURE_TIER_REQUIREMENTS[featureId] ?? "enterprise" as PlanTier;
    const canAccess   = TIER_ORDER.indexOf(currentTier) >= TIER_ORDER.indexOf(requiredTier);

    success(res, { canAccess, currentTier, requiredTier, featureId });
  } catch (err) {
    logger.error({ err }, "Billing feature-gate error");
    success(res, { canAccess: false, currentTier: "free", requiredTier: "enterprise", featureId });
  }
});

// ── POST /billing/cancel ──────────────────────────────────────────────────────
router.post("/billing/cancel", requireSession, async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;
  const user = await resolveUserForBilling(sessionId);

  if (!user?.stripeSubscriptionId) {
    badRequest(res, "No active subscription to cancel.");
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    // Cancel at period end (not immediately, to respect already-paid period)
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    success(res, {
      message: "Subscription will be cancelled at the end of the current billing period.",
      cancelledAt: "end_of_period",
    });
  } catch (err) {
    logger.error({ err }, "Billing cancel error");
    serverError(res, "Failed to cancel subscription");
  }
});

export default router;
