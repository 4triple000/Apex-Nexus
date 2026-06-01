/**
 * Apex Tier Access System
 *
 * Maps subscription tiers to feature access.
 * Tiers (matching DB / billing backend):  free | pro | enterprise
 * UI display names:                        Free | Pro | Creator | Elite
 *
 * The "creator" display tier maps to "pro" in the backend;
 * "elite" maps to "enterprise".  We keep this mapping here so the
 * paywall can show four distinct plans without touching the billing backend.
 */

export type ApexBillingTier = "free" | "pro" | "enterprise";

// ── Display-tier metadata (UI only) ──────────────────────────────────────────

export interface TierDisplayMeta {
  id:          ApexBillingTier;
  name:        string;
  label:       string;            // short badge label
  icon:        string;
  color:       string;
  bg:          string;
  border:      string;
  glow:        string;
  priceMonthly: number | null;   // null = contact us
  tagline:     string;
  highlights:  string[];
}

export const TIER_DISPLAY: TierDisplayMeta[] = [
  {
    id: "free",
    name: "Free", label: "Free", icon: "🌱",
    color: "#9CA3AF", bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.20)", glow: "rgba(156,163,175,0.10)",
    priceMonthly: 0,
    tagline: "Get started — no credit card needed",
    highlights: [
      "50 AI calls / day",
      "3 projects max",
      "Browse Marketplace",
      "Community access",
      "AI Studio (basic)",
    ],
  },
  {
    id: "pro",
    name: "Pro", label: "Pro", icon: "⚡",
    color: "#FFCC33", bg: "rgba(255,204,51,0.10)", border: "rgba(255,204,51,0.25)", glow: "rgba(255,204,51,0.20)",
    priceMonthly: 19,
    tagline: "Full AI power for serious builders",
    highlights: [
      "500 AI calls / day",
      "25 projects",
      "Workflows Engine",
      "AI Autopilot",
      "Memory Control",
      "Privacy Mode",
      "Marketplace publish",
    ],
  },
  {
    id: "enterprise",
    name: "Elite", label: "Elite", icon: "👑",
    color: "#A29BFE", bg: "rgba(162,155,254,0.10)", border: "rgba(162,155,254,0.28)", glow: "rgba(162,155,254,0.22)",
    priceMonthly: 99,
    tagline: "Unlimited AI power — everything unlocked",
    highlights: [
      "Unlimited AI calls",
      "Unlimited projects",
      "All Pro features",
      "Multiplayer FPS",
      "Unity Game Export",
      "Plugin system",
      "Self-Improvement AI",
      "Priority support",
    ],
  },
];

// ── Tier ordering ─────────────────────────────────────────────────────────────

export const TIER_ORDER: ApexBillingTier[] = ["free", "pro", "enterprise"];

export function tierIndex(tier: ApexBillingTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function normalizeTierClient(raw: string | null | undefined): ApexBillingTier {
  if (!raw) return "free";
  const map: Record<string, ApexBillingTier> = {
    free: "free",
    pro: "pro",
    creator_pro: "pro",
    enterprise: "enterprise",
    elite: "enterprise",
  };
  return map[raw] ?? "free";
}

// ── Feature → minimum required tier ──────────────────────────────────────────
// Every feature in APEX_FEATURES has an id. Map each to the minimum billing tier needed.

export const FEATURE_TIER_REQUIREMENT: Record<string, ApexBillingTier> = {
  // Free — available to everyone
  marketplace:       "free",
  social:            "free",
  referral:          "free",

  // Pro — paid subscription required
  workflows:         "pro",
  autopilot:         "pro",
  privacy:           "pro",
  "memory-control":  "pro",
  "game-studio":     "pro",
  monetization:      "pro",
  analytics:         "pro",
  "game-publish":    "pro",

  // Elite — top tier only
  "self-improve":    "enterprise",
  plugins:           "enterprise",
  "personality-reset": "enterprise",
  "multiplayer-fps": "enterprise",
  "mobile-fps":      "enterprise",
  "unity-gen":       "enterprise",
};

/** Returns true if `userTier` meets or exceeds the required tier for `featureId`. */
export function tierCanAccessFeature(userTier: ApexBillingTier, featureId: string): boolean {
  const required = FEATURE_TIER_REQUIREMENT[featureId] ?? "enterprise";
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(required);
}

/** Returns the minimum billing tier needed for a feature. */
export function getRequiredTierForFeature(featureId: string): ApexBillingTier {
  return FEATURE_TIER_REQUIREMENT[featureId] ?? "enterprise";
}

/** Returns the display metadata for a billing tier. */
export function getTierDisplayMeta(tier: ApexBillingTier): TierDisplayMeta {
  return TIER_DISPLAY.find(t => t.id === tier) ?? TIER_DISPLAY[0]!;
}
