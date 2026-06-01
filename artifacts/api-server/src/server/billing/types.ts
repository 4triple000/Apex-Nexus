/**
 * Apex Billing System — Shared Types
 *
 * Extends shared types to add enterprise tier and full feature set.
 * All plan limits are defined in planConfig.ts and can be overridden via ENV.
 */

// ── Plan tiers ─────────────────────────────────────────────────────────────────

export type PlanTier = "free" | "pro" | "enterprise";

export type SubscriptionStatus =
  | "active"
  | "inactive"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "unpaid";

// ── Usage actions tracked per user ────────────────────────────────────────────

export type UsageAction = "build" | "ai_call" | "deployment";

// ── Plan limits ────────────────────────────────────────────────────────────────

export interface PlanLimits {
  /** Max app/project builds per day. -1 = unlimited. */
  buildsPerDay: number;
  /** Max AI LLM calls per day across all features. -1 = unlimited. */
  aiCallsPerDay: number;
  /** Max deployments per month. -1 = unlimited. */
  deploymentsPerMonth: number;
  /** Max concurrent projects. -1 = unlimited. */
  maxProjects: number;
  /** Autopilot (autonomous monitoring + self-healing) enabled. */
  autopilotEnabled: boolean;
  /** Multi-agent pipeline chaining enabled. */
  agentPipelinesEnabled: boolean;
  /** Max agents per pipeline. -1 = unlimited. */
  maxAgentsPerPipeline: number;
  /** Real-time multiplayer collaboration. */
  realtimeCollabEnabled: boolean;
  /** Self-improving memory system. */
  selfImprovementEnabled: boolean;
  /** Priority API processing and support. */
  prioritySupport: boolean;
  /** AI Studio access. */
  studioEnabled: boolean;
  /** Studio Marketplace publish access. */
  marketplacePublishEnabled: boolean;
}

// ── Plan metadata (display info + pricing) ────────────────────────────────────

export interface PlanMetadata {
  tier: PlanTier;
  name: string;
  description: string;
  priceMonthly: number; // cents
  priceYearly: number;  // cents
  currency: "usd";
  badgeColor: string;
  features: string[];
  limits: PlanLimits;
  /** Stripe Price IDs (from ENV or hardcoded fallback) */
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

// ── Usage stats response ───────────────────────────────────────────────────────

export interface UsageStats {
  userId: number;
  sessionId: string;
  tier: PlanTier;
  period: string; // YYYY-MM-DD for daily actions
  builds:      { used: number; limit: number; remaining: number; unlimited: boolean };
  aiCalls:     { used: number; limit: number; remaining: number; unlimited: boolean };
  deployments: { used: number; limit: number; remaining: number; unlimited: boolean };
}

// ── Check result from checkUserPlan middleware ─────────────────────────────────

export interface PlanCheckResult {
  allowed: boolean;
  tier: PlanTier;
  reason?: string;
  limit?: number;
  used?: number;
  upgradeRequired?: PlanTier;
}

// ── Webhook event shape ────────────────────────────────────────────────────────

export interface WebhookProcessResult {
  processed: boolean;
  eventId: string;
  eventType: string;
  userId?: number;
  tierChange?: { before: string; after: string };
  error?: string;
}
