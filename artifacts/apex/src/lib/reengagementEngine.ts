/**
 * reengagementEngine — Behavioral re-engagement logic (non-React).
 *
 * Implements the exact logic from spec:
 *
 *   if diff > 7 days  → "You disappeared for a while… everything good?"
 *   if streak >= 3    → "You've been consistent. Keep going."
 *   else              → "What are we building today?"
 *
 * Each tone drives a distinct avatar expression and voice inflection.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReengagementTone =
  | "concerned"   // > 7 days away — avatar leans in, softer voice
  | "affirming"   // streak >= 3 — avatar nods, confident voice
  | "engaged";    // default — avatar tilts forward, curious voice

export interface ReengagementMessage {
  text:    string;
  tone:    ReengagementTone;
  subtext: string;           // smaller supporting line
  phase:   "long_absence" | "streak" | "default";
}

export interface ReengagementUser {
  lastVisit?: number;   // Unix ms
  streak:     number;
}

// ── Session guard ─────────────────────────────────────────────────────────────

const SESSION_KEY = "apex_reengagement_shown_v1";

export function wasReengagementShown(): boolean {
  try { return !!sessionStorage.getItem(SESSION_KEY); } catch { return false; }
}

export function markReengagementShown(): void {
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
}

// ── Core logic (exact spec implementation) ────────────────────────────────────

export function getReengagementMessage(user: ReengagementUser): ReengagementMessage | null {
  const diff = user.lastVisit ? Date.now() - user.lastVisit : 0;

  // > 7 days (604_800_000 ms)
  if (diff > 604_800_000) {
    return {
      text:    "You disappeared for a while… everything good?",
      subtext: "No pressure. I'm here when you need me.",
      tone:    "concerned",
      phase:   "long_absence",
    };
  }

  // Consistent streak
  if (user.streak >= 3) {
    return {
      text:    "You've been consistent. Keep going.",
      subtext: `${user.streak} days straight. That's how it's done.`,
      tone:    "affirming",
      phase:   "streak",
    };
  }

  // Show default only when returning (> 30 min away), not on every load
  if (diff > 1_800_000) {
    return {
      text:    "What are we building today?",
      subtext: "Ready when you are.",
      tone:    "engaged",
      phase:   "default",
    };
  }

  // Same-session or brand new user — no message
  return null;
}

// ── Voice speech params per tone ───────────────────────────────────────────────

export function getVoiceParams(tone: ReengagementTone): {
  rate: number; pitch: number; volume: number;
} {
  switch (tone) {
    case "concerned":  return { rate: 0.82, pitch: 0.95, volume: 0.80 };
    case "affirming":  return { rate: 0.90, pitch: 1.08, volume: 0.90 };
    case "engaged":    return { rate: 0.94, pitch: 1.05, volume: 0.88 };
  }
}

// ── Avatar expression state per tone ──────────────────────────────────────────

export interface AvatarExpression {
  headTilt:     number;    // degrees
  orbScale:     number;    // 1.0 = normal
  glowIntensity: number;   // 0–1
  animVariant:  "lean_in" | "nod" | "forward";
}

export function getAvatarExpression(tone: ReengagementTone): AvatarExpression {
  switch (tone) {
    case "concerned":
      return { headTilt: -4, orbScale: 1.04, glowIntensity: 0.45, animVariant: "lean_in"  };
    case "affirming":
      return { headTilt:  3, orbScale: 1.08, glowIntensity: 0.70, animVariant: "nod"      };
    case "engaged":
      return { headTilt:  2, orbScale: 1.06, glowIntensity: 0.60, animVariant: "forward"  };
  }
}
