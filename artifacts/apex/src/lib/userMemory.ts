/**
 * userMemory — User Memory Tracking System
 *
 * Tracks what users were doing, when they left, daily streak, goals,
 * and generates personalized return messages when they come back.
 *
 * Integrates with characterEngine — both systems share localStorage
 * but this module owns the visit/activity tracking.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UserProfile {
  lastVisit:      number | null;   // Unix ms — when user last left the app
  lastTopic:      string | null;   // last conversation topic
  streak:         number;          // consecutive daily visit count
  goals:          string[];        // user-stated goals
  recentActivity: string[];        // last N conversation summaries
}

export interface ReturnContext {
  message:       string;
  lastTopic:     string | null;
  daysSince:     number;
  category:      "same_day" | "next_day" | "short_absence" | "long_absence" | "extended_break";
  cta:           string;           // call-to-action label for the continue button
}

// ── Storage ────────────────────────────────────────────────────────────────────

const KEY = "apex_user_profile";

const DEFAULTS: UserProfile = {
  lastVisit:      null,
  lastTopic:      null,
  streak:         0,
  goals:          [],
  recentActivity: [],
};

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) } as UserProfile;
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveUserProfile(profile: UserProfile): void {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch {}
}

// ── Update last visit (call on app exit / beforeunload) ───────────────────────

export function updateLastVisit(topic?: string | null): void {
  const profile = loadUserProfile();
  profile.lastVisit = Date.now();
  if (topic) profile.lastTopic = topic;
  saveUserProfile(profile);
}

// ── Update streak (matches user spec: Math.floor day diff) ───────────────────

export function updateStreak(profile: UserProfile): UserProfile {
  const now  = new Date();
  if (!profile.lastVisit) return { ...profile, streak: 1 };

  const last     = new Date(profile.lastVisit);
  const diffDays = Math.floor((now.getTime() - last.getTime()) / 86_400_000);

  if (diffDays === 0) return profile;                              // same calendar day
  if (diffDays === 1) return { ...profile, streak: profile.streak + 1 }; // next day ✓
  return { ...profile, streak: 1 };                               // streak broken
}

// ── Streak milestone detection ─────────────────────────────────────────────────

export type StreakMilestone = 3 | 7 | 14 | 30 | null;

const MILESTONE_THRESHOLDS: StreakMilestone[] = [30, 14, 7, 3];

export const MILESTONE_MESSAGES: Record<number, string> = {
  3:  "Momentum building",
  7:  "You're locked in",
  14: "Apex power user",
  30: "Legendary status",
};

export const MILESTONE_SHOWN_KEY = "apex_streak_milestone_shown";

export function getStreakMilestone(streak: number): StreakMilestone {
  for (const t of MILESTONE_THRESHOLDS) {
    if (t !== null && streak >= t) return t;
  }
  return null;
}

export function wasMilestoneShown(milestone: number): boolean {
  try {
    const shown = JSON.parse(localStorage.getItem(MILESTONE_SHOWN_KEY) ?? "[]") as number[];
    return shown.includes(milestone);
  } catch { return false; }
}

export function markMilestoneShown(milestone: number): void {
  try {
    const shown = JSON.parse(localStorage.getItem(MILESTONE_SHOWN_KEY) ?? "[]") as number[];
    const next  = [...new Set([...shown, milestone])];
    localStorage.setItem(MILESTONE_SHOWN_KEY, JSON.stringify(next));
  } catch {}
}

// ── Glow intensity (0–1) based on streak ─────────────────────────────────────

export function getStreakGlowIntensity(streak: number): number {
  if (streak >= 30) return 1.0;
  if (streak >= 14) return 0.80;
  if (streak >= 7)  return 0.60;
  if (streak >= 3)  return 0.40;
  return 0.20;
}

// ── Push to recent activity (call after each conversation) ───────────────────

export function addRecentActivity(summary: string): void {
  const profile = loadUserProfile();
  profile.recentActivity = [summary, ...profile.recentActivity].slice(0, 10);
  saveUserProfile(profile);
}

// ── Return message generator ───────────────────────────────────────────────────

export function getReturnMessage(profile: UserProfile): ReturnContext | null {
  // First ever visit — no return message needed
  if (!profile.lastVisit) return null;

  const diffMs   = Date.now() - profile.lastVisit;
  const diffDays = diffMs / 86_400_000;
  const topic    = profile.lastTopic;

  // Same session (< 30 mins) — no message needed
  if (diffMs < 30 * 60_000) return null;

  // ── Long absence: > 3 days ────────────────────────────────────────────────
  if (diffDays > 3) {
    const message = topic
      ? `You were working on "${topic}". Want to continue?`
      : "It's been a while. Ready to pick up where you left off?";
    return {
      message,
      lastTopic:  topic,
      daysSince:  Math.floor(diffDays),
      category:   "long_absence",
      cta:        topic ? "Continue" : "Start a new chat",
    };
  }

  // ── Short absence: > 1 day ────────────────────────────────────────────────
  if (diffDays > 1) {
    const message = topic
      ? `Good to see you back. Still thinking about "${topic}"?`
      : "Good to see you back. Let's pick up where you left off.";
    return {
      message,
      lastTopic:  topic,
      daysSince:  Math.floor(diffDays),
      category:   "short_absence",
      cta:        "Let's go",
    };
  }

  // ── Same day but > 30 mins ────────────────────────────────────────────────
  const hours = diffMs / 3_600_000;
  if (hours > 4) {
    const message = topic
      ? `Back again. Still on "${topic}"?`
      : "Ready to continue?";
    return {
      message,
      lastTopic:  topic,
      daysSince:  0,
      category:   "same_day",
      cta:        "Continue",
    };
  }

  return null; // Too recent — skip the message
}

// ── Goal management ───────────────────────────────────────────────────────────

export function addGoal(goal: string): void {
  const profile = loadUserProfile();
  const trimmed = goal.trim();
  if (!trimmed || profile.goals.includes(trimmed)) return;
  profile.goals = [trimmed, ...profile.goals].slice(0, 10);
  saveUserProfile(profile);
}

export function removeGoal(goal: string): void {
  const profile = loadUserProfile();
  profile.goals  = profile.goals.filter((g) => g !== goal);
  saveUserProfile(profile);
}
