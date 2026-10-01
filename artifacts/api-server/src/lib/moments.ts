/**
 * Apex Moments: one shared prompt a day that everyone can answer.
 *
 * The prompts rotate by date from this list. To manage them from a database later, replace
 * `promptFor()` — everything else asks for today's prompt through it.
 */
const PROMPTS = [
  "What are you listening to today?",
  "What's something you're working on?",
  "What's your current mood?",
  "What's something you learned this week?",
  "What's one thing you'd do with $100K?",
  "Show us your setup.",
  "What's your unpopular opinion?",
  "What song are you playing on repeat?",
  "What made you smile today?",
  "What game are you playing right now?",
  "What's a goal you're chasing this month?",
  "Show us the view from where you are.",
  "What's the best thing you ate this week?",
  "What would you build if you had a week off?",
  "What's a small win from today?",
  "Who inspires you right now, and why?",
  "What's a skill you want to learn this year?",
  "Drop a photo that sums up your week.",
  "What's your go-to late night snack?",
  "What's a movie or show everyone should watch?",
  "Finish the bar: \"I came from nothing, now…\"",
];

export const momentDay = (d = new Date()) => d.toISOString().slice(0, 10);

export function promptFor(day: string): string {
  // Days since a fixed start, so every day gets the next prompt in the list
  const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  return PROMPTS[((n % PROMPTS.length) + PROMPTS.length) % PROMPTS.length]!;
}

/** A few idea starters for "Not sure what to post?" (no AI needed) */
export function postIdeas(day: string, count = 3): string[] {
  const start = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000) + 7;
  return Array.from({ length: count }, (_, i) => PROMPTS[(start + i * 5) % PROMPTS.length]!);
}
