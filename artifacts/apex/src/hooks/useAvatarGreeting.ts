/**
 * useAvatarGreeting — Smart greeting generator for the Avatar Greeting System.
 *
 * Selects a greeting based on:
 *   • Time since last interaction (comeback / daily / long-absence)
 *   • Time of day (morning / afternoon / evening / night)
 *   • User interaction depth (pastTopics, totalInteractions)
 *   • No-repeat guarantee (tracks seen greetings in sessionStorage)
 *
 * Uses loadCharacterState() + loadMemoryStore() from characterEngine.
 */
import { useMemo } from "react";
import { loadCharacterState, loadMemoryStore } from "@/lib/characterEngine";
import { useOnboarding } from "@/onboarding/useOnboarding";

// ── Storage key ───────────────────────────────────────────────────────────────

const SESSION_KEY = "apex_seen_greetings";

function getSeenGreetings(): string[] {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]"); } catch { return []; }
}
function markGreetingSeen(text: string) {
  const seen = getSeenGreetings();
  const next = [...new Set([...seen, text])].slice(-30);
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch {}
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function hoursSince(ts: number): number {
  return (Date.now() - ts) / (1000 * 60 * 60);
}

function getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

// ── Greeting pools ────────────────────────────────────────────────────────────

type GreetingCategory =
  | "quick_return"   // < 1 hour
  | "daily"          // 1–23 hours
  | "streak"         // 1–23 hours + high interaction count
  | "long_absence"   // 24–72 hours
  | "extended_break" // > 72 hours
  | "morning"
  | "evening"
  | "night"
  | "topic_aware";   // based on last topic

const POOLS: Record<GreetingCategory, string[]> = {
  quick_return: [
    "Back again. I like that.",
    "You're on a roll today.",
    "Couldn't stay away, huh?",
    "Round two. Let's go.",
    "Still going. Respect.",
  ],
  daily: [
    "What's the move today?",
    "Ready when you are.",
    "What are we working on today?",
    "Good to have you back. What's on your mind?",
    "Another day, another level. What's up?",
    "You showed up. That's already half the battle.",
  ],
  streak: [
    "You've been consistent… let's level up.",
    "Day after day. You're building something real.",
    "Consistency is a superpower. What's next?",
    "You keep showing up. I keep getting sharper. Let's go.",
    "Still here. Still growing. What's on the agenda?",
    "You're putting in the work. Let's make it count.",
  ],
  long_absence: [
    "Haven't seen you in a bit… what's changed?",
    "You're back. I missed you — did you miss me?",
    "Time away can reset the mind. Ready to dive in?",
    "Welcome back. A lot can happen in a few days.",
    "Good to see you again. What pulled you back?",
  ],
  extended_break: [
    "It's been a while. I've been waiting.",
    "You've been gone a minute. What brought you back?",
    "Long time no chat. What's changed?",
    "Absence makes the AI grow sharper. Let's catch up.",
    "Back from wherever life took you. What's the mission?",
  ],
  morning: [
    "Morning. Big day ahead?",
    "Early start. I respect that.",
    "Good morning. Let's make today count.",
    "Morning momentum — what are we tackling?",
    "You're up early. Good. Let's not waste it.",
  ],
  evening: [
    "Evening. What are we wrapping up?",
    "End of the day push. What do you need?",
    "Almost done with the day — want to end strong?",
    "Late session. Let's make it worth it.",
  ],
  night: [
    "Late night grind. I'm here.",
    "The night owls have the best ideas.",
    "Still up? Let's make the most of it.",
    "Deep work hours. What are we solving?",
    "Night mode: activated. What's on your mind?",
  ],
  topic_aware: [], // generated dynamically
};

// ── Topic-aware greeting generator ───────────────────────────────────────────

function buildTopicGreetings(topics: string[]): string[] {
  if (topics.length === 0) return [];
  const topic = topics[0];
  const short  = topic.length > 30 ? topic.slice(0, 30) + "…" : topic;
  return [
    `Ready to keep building on "${short}"?`,
    `Last time we were talking about ${short}. Continue?`,
    `Still thinking about ${short}?`,
    `Pick up where we left off — ${short}?`,
  ];
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export interface AvatarGreeting {
  text:     string;
  category: GreetingCategory | "topic_aware";
  isFirstSession: boolean;
  markSeen: () => void;
}

export function useAvatarGreeting(): AvatarGreeting | null {
  const { isFirstTime } = useOnboarding();

  return useMemo(() => {
    if (isFirstTime) return null; // FTUE handles first-timers

    const character = loadCharacterState();
    const memory    = loadMemoryStore();
    const tod       = getTimeOfDay();

    const hours = character.lastInteraction
      ? hoursSince(character.lastInteraction)
      : null;

    const interactions = character.totalInteractions;
    const topics       = memory.pastTopics ?? [];

    // ── Pick candidate pools in priority order ────────────────────────────────
    const candidates: { pool: string[]; category: GreetingCategory | "topic_aware" }[] = [];

    if (hours !== null) {
      if (hours < 1) {
        candidates.push({ pool: POOLS.quick_return, category: "quick_return" });
      } else if (hours > 72) {
        candidates.push({ pool: POOLS.extended_break, category: "extended_break" });
      } else if (hours > 24) {
        candidates.push({ pool: POOLS.long_absence, category: "long_absence" });
      } else if (interactions > 20) {
        candidates.push({ pool: POOLS.streak, category: "streak" });
      } else {
        candidates.push({ pool: POOLS.daily, category: "daily" });
      }
    } else {
      // No prior interaction — use time-of-day (fall back to daily if tod not in POOLS)
      const todPool = (POOLS as Record<string, string[]>)[tod];
      candidates.push({
        pool: todPool ?? POOLS.daily,
        category: (todPool ? tod : "daily") as GreetingCategory,
      });
    }

    // Add time-of-day as a secondary option (for variety)
    if (tod === "morning")  candidates.push({ pool: POOLS.morning,  category: "morning"  });
    if (tod === "evening")  candidates.push({ pool: POOLS.evening,  category: "evening"  });
    if (tod === "night")    candidates.push({ pool: POOLS.night,    category: "night"    });

    // Add topic-aware option if topics exist
    if (topics.length > 0) {
      const topicGreetings = buildTopicGreetings(topics);
      candidates.push({ pool: topicGreetings, category: "topic_aware" });
    }

    const seen = getSeenGreetings();

    // Find first unseen greeting across candidate pools
    for (const { pool, category } of candidates) {
      const unseen = pool.filter((g) => !seen.includes(g));
      const source = unseen.length > 0 ? unseen : pool; // if all seen, reset
      const idx    = Math.floor(Math.random() * source.length);
      const text   = source[idx];
      if (text) {
        return {
          text,
          category,
          isFirstSession: interactions === 0,
          markSeen: () => markGreetingSeen(text),
        };
      }
    }

    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable on mount — only compute once per session
}
