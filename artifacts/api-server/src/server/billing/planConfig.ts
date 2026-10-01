/**
 * Apex Billing — Plan Configuration
 *
 * All limits are defined here and are ENV-overridable so you can tune them
 * without code changes (e.g., for beta, launch, or enterprise deals).
 *
 * ENV override pattern:
 *   APEX_PLAN_PRO_BUILDS_PER_DAY=100
 *   APEX_PLAN_ENTERPRISE_AI_CALLS_PER_DAY=-1
 *
 * Returns -1 for "unlimited" on any numeric limit.
 */

import type { PlanTier, PlanLimits, PlanMetadata } from "./types";

// ── Env-overridable number helper ──────────────────────────────────────────────

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined || val === "") return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined || val === "") return fallback;
  return val === "1" || val === "true";
}

// ── Plan Limits ────────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    buildsPerDay:             envInt ("APEX_PLAN_FREE_BUILDS_PER_DAY",          5),
    aiCallsPerDay:            envInt ("APEX_PLAN_FREE_AI_CALLS_PER_DAY",        50),
    deploymentsPerMonth:      envInt ("APEX_PLAN_FREE_DEPLOYMENTS_PER_MONTH",   2),
    maxProjects:              envInt ("APEX_PLAN_FREE_MAX_PROJECTS",             3),
    autopilotEnabled:         envBool("APEX_PLAN_FREE_AUTOPILOT",               false),
    agentPipelinesEnabled:    envBool("APEX_PLAN_FREE_AGENT_PIPELINES",         false),
    maxAgentsPerPipeline:     envInt ("APEX_PLAN_FREE_MAX_AGENTS_PER_PIPELINE", 1),
    realtimeCollabEnabled:    envBool("APEX_PLAN_FREE_REALTIME_COLLAB",         false),
    selfImprovementEnabled:   envBool("APEX_PLAN_FREE_SELF_IMPROVEMENT",        false),
    prioritySupport:          envBool("APEX_PLAN_FREE_PRIORITY_SUPPORT",        false),
    studioEnabled:            envBool("APEX_PLAN_FREE_STUDIO",                  true),
    marketplacePublishEnabled:envBool("APEX_PLAN_FREE_MARKETPLACE_PUBLISH",     false),
  },
  pro: {
    buildsPerDay:             envInt ("APEX_PLAN_PRO_BUILDS_PER_DAY",          50),
    aiCallsPerDay:            envInt ("APEX_PLAN_PRO_AI_CALLS_PER_DAY",        500),
    deploymentsPerMonth:      envInt ("APEX_PLAN_PRO_DEPLOYMENTS_PER_MONTH",   20),
    maxProjects:              envInt ("APEX_PLAN_PRO_MAX_PROJECTS",             25),
    autopilotEnabled:         envBool("APEX_PLAN_PRO_AUTOPILOT",               true),
    agentPipelinesEnabled:    envBool("APEX_PLAN_PRO_AGENT_PIPELINES",         true),
    maxAgentsPerPipeline:     envInt ("APEX_PLAN_PRO_MAX_AGENTS_PER_PIPELINE", 3),
    realtimeCollabEnabled:    envBool("APEX_PLAN_PRO_REALTIME_COLLAB",         true),
    selfImprovementEnabled:   envBool("APEX_PLAN_PRO_SELF_IMPROVEMENT",        true),
    prioritySupport:          envBool("APEX_PLAN_PRO_PRIORITY_SUPPORT",        false),
    studioEnabled:            envBool("APEX_PLAN_PRO_STUDIO",                  true),
    marketplacePublishEnabled:envBool("APEX_PLAN_PRO_MARKETPLACE_PUBLISH",     true),
  },
  enterprise: {
    buildsPerDay:             envInt ("APEX_PLAN_ENT_BUILDS_PER_DAY",          -1),
    aiCallsPerDay:            envInt ("APEX_PLAN_ENT_AI_CALLS_PER_DAY",        -1),
    deploymentsPerMonth:      envInt ("APEX_PLAN_ENT_DEPLOYMENTS_PER_MONTH",   -1),
    maxProjects:              envInt ("APEX_PLAN_ENT_MAX_PROJECTS",             -1),
    autopilotEnabled:         envBool("APEX_PLAN_ENT_AUTOPILOT",               true),
    agentPipelinesEnabled:    envBool("APEX_PLAN_ENT_AGENT_PIPELINES",         true),
    maxAgentsPerPipeline:     envInt ("APEX_PLAN_ENT_MAX_AGENTS_PER_PIPELINE", -1),
    realtimeCollabEnabled:    envBool("APEX_PLAN_ENT_REALTIME_COLLAB",         true),
    selfImprovementEnabled:   envBool("APEX_PLAN_ENT_SELF_IMPROVEMENT",        true),
    prioritySupport:          envBool("APEX_PLAN_ENT_PRIORITY_SUPPORT",        true),
    studioEnabled:            envBool("APEX_PLAN_ENT_STUDIO",                  true),
    marketplacePublishEnabled:envBool("APEX_PLAN_ENT_MARKETPLACE_PUBLISH",     true),
  },
};

// ── Plan Metadata (display + pricing) ─────────────────────────────────────────

export const PLAN_METADATA: Record<PlanTier, PlanMetadata> = {
  free: {
    tier: "free",
    name: "Free",
    description: "Build and explore Apex at no cost",
    priceMonthly: 0,
    priceYearly: 0,
    currency: "usd",
    badgeColor: "#6B7280",
    features: [
      "20 AI credits a day",
      `${PLAN_LIMITS.free.buildsPerDay} builds / day`,
      `${PLAN_LIMITS.free.deploymentsPerMonth} deployments / month`,
      `Up to ${PLAN_LIMITS.free.maxProjects} projects`,
      "AI Studio access",
      "Community support",
    ],
    limits: PLAN_LIMITS.free,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_FREE_MONTHLY,
    stripePriceIdYearly:  process.env.STRIPE_PRICE_FREE_YEARLY,
  },
  pro: {
    tier: "pro",
    name: "Pro",
    description: "Full AI power for serious builders",
    priceMonthly: 1499, // $14.99/mo
    priceYearly:  12900, // $129/yr
    currency: "usd",
    badgeColor: "#FFCC33",
    features: [
      "60 AI credits a day (3x Free)",
      `${PLAN_LIMITS.pro.buildsPerDay} builds / day`,
      `${PLAN_LIMITS.pro.deploymentsPerMonth} deployments / month`,
      `Up to ${PLAN_LIMITS.pro.maxProjects} projects`,
      "Autopilot (autonomous monitoring)",
      "Multi-agent pipelines (up to 3)",
      "Real-time collaboration",
      "Self-improving memory",
      "Studio + Marketplace publish",
    ],
    limits: PLAN_LIMITS.pro,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    stripePriceIdYearly:  process.env.STRIPE_PRICE_PRO_YEARLY,
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    description: "Unlimited AI power for teams and organizations",
    priceMonthly: 9900, // $99/mo
    priceYearly:  99000, // $990/yr
    currency: "usd",
    badgeColor: "#8B5CF6",
    features: [
      "Unlimited builds",
      "Unlimited AI calls",
      "Unlimited deployments",
      "Unlimited projects",
      "Autopilot — full autonomous mode",
      "Unlimited agent pipelines",
      "Priority API processing",
      "Priority support + SLA",
      "All features included",
    ],
    limits: PLAN_LIMITS.enterprise,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    stripePriceIdYearly:  process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
  },
};

// ── Tier resolution from Stripe price ID ──────────────────────────────────────

const PRICE_TO_TIER: Record<string, PlanTier> = {};

// Populate from env at module init
for (const tier of Object.keys(PLAN_METADATA) as PlanTier[]) {
  const meta = PLAN_METADATA[tier];
  if (meta.stripePriceIdMonthly) PRICE_TO_TIER[meta.stripePriceIdMonthly] = tier;
  if (meta.stripePriceIdYearly)  PRICE_TO_TIER[meta.stripePriceIdYearly]  = tier;
}

// Legacy tier name mapping (backward compat with existing "creator_pro" records)
const LEGACY_TIER_MAP: Record<string, PlanTier> = {
  creator_pro: "pro",
  free: "free",
  pro: "pro",
  enterprise: "enterprise",
};

export function normalizeTier(tier: string | null | undefined): PlanTier {
  if (!tier) return "free";
  return LEGACY_TIER_MAP[tier] ?? "free";
}

export function getTierForPriceId(priceId: string): PlanTier {
  return PRICE_TO_TIER[priceId] ?? "free";
}

export function getLimits(tier: PlanTier | string): PlanLimits {
  return PLAN_LIMITS[normalizeTier(tier)] ?? PLAN_LIMITS.free;
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}

export function formatLimit(value: number): string {
  return value === -1 ? "Unlimited" : String(value);
}
