/**
 * greetingEngine — standalone (non-React) greeting engine.
 *
 * Responsibility:
 *   • Maintain categorised greeting pools (default / returning / inactive + time-of-day)
 *   • Pick the best greeting for a user based on lastVisit timing
 *   • Guarantee no back-to-back repeat via sessionStorage
 *   • Return animation metadata so the avatar can move/speak in sync
 *
 * Usage:
 *   import { greetingEngine } from "@/components/avatar/greetingEngine"
 *   const result = greetingEngine.getGreeting(user)
 *   greetingEngine.triggerGreeting(user, { onSpeak, onAnimate })
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type GreetingCategory =
  | "default"
  | "returning"
  | "inactive"
  | "morning"
  | "evening"
  | "night"
  | "streak"
  | "topic_aware";

export interface GreetingUser {
  lastVisit?:        number;   // Unix ms timestamp
  totalInteractions?: number;
  pastTopics?:       string[];
  isFirstTime?:      boolean;
}

export interface AvatarAnimState {
  headTilt: number;    // degrees, negative = left, positive = right
  eyeFocus: boolean;   // true = looking straight at user
  lipSync:  boolean;   // true while voice is playing
  animName: "greeting" | "thinking" | "idle" | "nod";
}

export interface GreetingResult {
  text:      string;
  category:  GreetingCategory;
  animState: AvatarAnimState;
  markSeen:  () => void;
}

export interface TriggerCallbacks {
  onSpeak?:   (text: string) => void;
  onAnimate?: (state: AvatarAnimState) => void;
  onDone?:    () => void;
}

// ── Storage ────────────────────────────────────────────────────────────────────

const LAST_SEEN_KEY = "apex_last_greeting";
const SEEN_POOL_KEY = "apex_seen_greetings_v2";

function getLastSeen(): string {
  try { return sessionStorage.getItem(LAST_SEEN_KEY) ?? ""; } catch { return ""; }
}
function getSeenPool(): string[] {
  try { return JSON.parse(sessionStorage.getItem(SEEN_POOL_KEY) ?? "[]"); } catch { return []; }
}
function markSeen(text: string) {
  try {
    sessionStorage.setItem(LAST_SEEN_KEY, text);
    const pool = [...new Set([...getSeenPool(), text])].slice(-40);
    sessionStorage.setItem(SEEN_POOL_KEY, JSON.stringify(pool));
  } catch { /* ignore */ }
}

// ── Greeting pools ─────────────────────────────────────────────────────────────

const POOLS: Record<GreetingCategory, string[]> = {
  default: [
    "What are we working on today?",
    "Ready to get started?",
    "What's on your mind?",
    "Let's build something great.",
    "I'm here — what do you need?",
    "Where do you want to start?",
  ],

  returning: [
    "Back again. I like that.",
    "Let's keep the momentum going.",
    "You're on a roll today.",
    "Round two. Let's go.",
    "Still going. Respect.",
    "Good to have you back. What's next?",
    "Another session. Another level.",
  ],

  inactive: [
    "It's been a minute… what's changed?",
    "You've been gone a while. What brought you back?",
    "Long time no chat. Ready to pick up where we left off?",
    "Absence makes the AI grow sharper. What's the mission?",
    "Welcome back — I kept the lights on.",
  ],

  morning: [
    "Morning. Big day ahead?",
    "Early start. I respect that.",
    "Good morning — let's make today count.",
    "Morning momentum. What are we tackling?",
    "You're up early. Good. Let's not waste it.",
  ],

  evening: [
    "Evening. What are we wrapping up?",
    "End-of-day push. What do you need?",
    "Late session. Let's make it worth it.",
    "Almost done with the day — want to end strong?",
  ],

  night: [
    "Late night grind. I'm here.",
    "The night owls have the best ideas.",
    "Still up? Let's make the most of it.",
    "Deep work hours. What are we solving?",
    "Night mode: activated. What's on your mind?",
  ],

  streak: [
    "You've been consistent… let's level up.",
    "Day after day. You're building something real.",
    "Consistency is a superpower. What's next?",
    "You keep showing up. I keep getting sharper.",
    "Still here. Still growing. What's on the agenda?",
  ],

  topic_aware: [], // built dynamically — see buildTopicPool()
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function hoursSince(ts: number): number {
  return (Date.now() - ts) / 3_600_000;
}

function getTimeOfDay(): "morning" | "evening" | "night" | null {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "morning";
  if (h >= 18 && h < 22) return "evening";
  if (h >= 22 || h < 5)  return "night";
  return null; // afternoon — don't add time-of-day
}

function buildTopicPool(topics: string[]): string[] {
  if (!topics.length) return [];
  const t = topics[0];
  const short = t.length > 30 ? t.slice(0, 30) + "…" : t;
  return [
    `Ready to keep building on "${short}"?`,
    `Last time we talked about ${short}. Continue?`,
    `Still thinking about ${short}?`,
    `Pick up where we left off — ${short}?`,
  ];
}

function pickUnseen(pool: string[], seen: string[], last: string): string {
  // Never repeat last greeting
  const filtered = pool.filter((g) => g !== last && !seen.includes(g));
  const source   = filtered.length > 0 ? filtered : pool.filter((g) => g !== last);
  if (!source.length) return pool[0]; // absolute fallback
  return source[Math.floor(Math.random() * source.length)];
}

function animForCategory(cat: GreetingCategory): AvatarAnimState {
  switch (cat) {
    case "returning":
    case "streak":
      return { headTilt: -6, eyeFocus: true,  lipSync: true, animName: "greeting" };
    case "inactive":
      return { headTilt:  8, eyeFocus: true,  lipSync: true, animName: "nod"      };
    case "morning":
      return { headTilt: -4, eyeFocus: true,  lipSync: true, animName: "greeting" };
    case "night":
      return { headTilt: 10, eyeFocus: false, lipSync: true, animName: "thinking" };
    case "topic_aware":
      return { headTilt: -8, eyeFocus: true,  lipSync: true, animName: "nod"      };
    default:
      return { headTilt:  0, eyeFocus: true,  lipSync: true, animName: "greeting" };
  }
}

// ── Core engine ────────────────────────────────────────────────────────────────

function getGreeting(user: GreetingUser): GreetingResult {
  if (user.isFirstTime) {
    // First-timers: use FTUE, return a soft default
    const text = POOLS.default[0];
    return { text, category: "default", animState: animForCategory("default"), markSeen: () => markSeen(text) };
  }

  const seen = getSeenPool();
  const last = getLastSeen();

  // Build candidate list in priority order
  const candidates: { pool: string[]; cat: GreetingCategory }[] = [];

  const hours = user.lastVisit ? hoursSince(user.lastVisit) : null;
  const interactions = user.totalInteractions ?? 0;

  if (hours !== null) {
    if (hours < 1) {
      candidates.push({ pool: POOLS.returning, cat: "returning" });
    } else if (hours > 72) {
      candidates.push({ pool: POOLS.inactive,  cat: "inactive"  });
    } else if (hours > 24) {
      candidates.push({ pool: POOLS.inactive,  cat: "inactive"  });
    } else if (interactions > 20) {
      candidates.push({ pool: POOLS.streak,    cat: "streak"    });
    } else {
      candidates.push({ pool: POOLS.returning, cat: "returning" });
    }
  } else {
    candidates.push({ pool: POOLS.default, cat: "default" });
  }

  // Secondary: time-of-day (guard against tod values not in POOLS, e.g. "afternoon")
  const tod = getTimeOfDay();
  if (tod) {
    const todPool = (POOLS as Record<string, string[]>)[tod];
    if (todPool) candidates.push({ pool: todPool, cat: tod as GreetingCategory });
  }

  // Tertiary: topic-aware
  const topics = user.pastTopics ?? [];
  if (topics.length > 0) {
    candidates.push({ pool: buildTopicPool(topics), cat: "topic_aware" });
  }

  // Always add default as final fallback
  candidates.push({ pool: POOLS.default, cat: "default" });

  // Find best unseen greeting
  for (const { pool, cat } of candidates) {
    if (!pool.length) continue;
    const text = pickUnseen(pool, seen, last);
    if (text) {
      return {
        text,
        category: cat,
        animState: animForCategory(cat),
        markSeen: () => markSeen(text),
      };
    }
  }

  // Absolute fallback
  const text = POOLS.default[0];
  return { text, category: "default", animState: animForCategory("default"), markSeen: () => markSeen(text) };
}

// ── Web Speech API voice ───────────────────────────────────────────────────────

function speak(text: string, onDone?: () => void): void {
  if (!window.speechSynthesis) { onDone?.(); return; }
  window.speechSynthesis.cancel();
  const utt  = new SpeechSynthesisUtterance(text);
  utt.rate   = 0.92;
  utt.pitch  = 1.05;
  utt.volume = 1.0;
  utt.onend  = () => onDone?.();
  utt.onerror = () => onDone?.();
  window.speechSynthesis.speak(utt);
}

// ── triggerGreeting — the all-in-one API ───────────────────────────────────────

function triggerGreeting(user: GreetingUser, callbacks: TriggerCallbacks = {}): GreetingResult {
  const result = getGreeting(user);
  result.markSeen();

  const animPlaying: AvatarAnimState = { ...result.animState, lipSync: true };
  const animDone:    AvatarAnimState = { ...result.animState, lipSync: false, headTilt: 0, animName: "idle" };

  callbacks.onAnimate?.(animPlaying);
  callbacks.onSpeak?.(result.text);

  speak(result.text, () => {
    callbacks.onAnimate?.(animDone);
    callbacks.onDone?.();
  });

  return result;
}

// ── Singleton export ───────────────────────────────────────────────────────────

export const greetingEngine = {
  getGreeting,
  triggerGreeting,
  speak,
  POOLS,
} as const;
