/**
 * Fake waitlist counter — grows deterministically over time.
 * Uses a fixed epoch so the numbers are consistent between page loads
 * but still visually increase as real time passes.
 */
import { getTotalWaitlist } from "./referralGenerator";

export { getTotalWaitlist as getWaitlistCount };

/** Format a number with commas: 12482 → "12,482" */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Get the "tick delta" — how many people to add per UI tick (for animation).
 * Designed to add 1-4 people every 4-8 seconds across all features.
 */
export function getTickDelta(featureId: string): number {
  // Growth rates per-hour → per-tick (every 5s)
  const growthRates: Record<string, number> = {
    "marketplace":   3, "autopilot": 2, "social": 2,
    "referral":      2, "workflows": 2, "multiplayer-fps": 1,
    "game-studio":   1, "privacy":   1, "memory-control": 1,
    "analytics":     1,
  };
  return growthRates[featureId] ?? 1;
}

/** Urgency message pool */
export const URGENCY_MESSAGES = [
  "🔥 Limited early access spots remaining",
  "⚡ Launching sooner than you think",
  "🏆 Top 10% get exclusive early access",
  "🚀 Join before this phase closes",
  "⏳ Spots filling up fast",
  "💎 Early adopters get lifetime perks",
];
