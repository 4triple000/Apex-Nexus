/**
 * Apex Preview Demo Engine
 * Pre-scripted demo sequences for each locked feature.
 * Each sequence plays in the PreviewOverlay mini-player.
 */

export type DemoActor = "system" | "gpt4" | "claude" | "perplexity" | "ai" | "step";

export interface DemoMessage {
  actor:   DemoActor;
  text:    string;
  ms:      number;       // delay from sequence start (ms)
  badge?:  string;       // e.g. "ROUND 1", "90 pts"
  emoji?:  string;
}

export interface DemoSequence {
  id:        string;
  title:     string;
  prompt?:   string;
  messages:  DemoMessage[];
  loopDelay: number;     // ms to wait before looping
}

// ── Battle Mode Demo ───────────────────────────────────────────────────────────

const BATTLE_DEMO: DemoSequence = {
  id:        "battleMode",
  title:     "AI Battle Arena",
  prompt:    '"What makes a great leader?"',
  loopDelay: 3000,
  messages: [
    {
      actor: "system", ms: 0, emoji: "⚔️",
      text:  "Logic Battle starting — GPT-4 vs Claude",
      badge: "ROUND 1",
    },
    {
      actor: "gpt4", ms: 700,
      text:  "Great leaders combine emotional intelligence with relentless execution. Research shows EQ-led teams outperform by 20% — and vision without follow-through is just wishful thinking.",
    },
    {
      actor: "claude", ms: 1800,
      text:  "The strongest leaders create psychological safety first. When teams feel safe to voice ideas and take risks, organizations innovate 3× faster. Satya Nadella turned Microsoft around by replacing 'know-it-alls' with 'learn-it-alls'.",
    },
    {
      actor: "system", ms: 3000, emoji: "🔥",
      text:  "Round 1 scored — Claude wins with depth",
      badge: "Claude 91 · GPT-4 86",
    },
    {
      actor: "gpt4", ms: 3800,
      text:  "Psychological safety alone won't ship a product. The best leaders set clear accountability, make hard calls, and earn trust through consistency. Execution is the real differentiator.",
    },
    {
      actor: "claude", ms: 4900,
      text:  "Accountability without empathy creates fear-based compliance. Sustainable performance comes from purpose-driven leadership — Netflix's culture deck, Patagonia's mission. People don't quit jobs, they quit leaders.",
    },
    {
      actor: "system", ms: 6200, emoji: "⚡",
      text:  "Round 2 — Dead heat! Both score 89/100",
      badge: "TIED",
    },
    {
      actor: "system", ms: 7000, emoji: "🏆",
      text:  "Final round incoming — unlock to decide the winner!",
    },
  ],
};

// ── Workflows Demo ─────────────────────────────────────────────────────────────

const WORKFLOWS_DEMO: DemoSequence = {
  id:        "workflows",
  title:     "AI Workflows",
  prompt:    "YouTube → Blog → Social Post",
  loopDelay: 2500,
  messages: [
    {
      actor: "system", ms: 0, emoji: "⚡",
      text:  "Pipeline started — 4 AI steps chained",
      badge: "RUNNING",
    },
    {
      actor: "step", ms: 600, emoji: "🎥",
      text:  "Step 1 · Whisper AI — transcribing YouTube video",
      badge: "3.2s",
    },
    {
      actor: "step", ms: 1500, emoji: "✍️",
      text:  "Step 2 · GPT-4 — converting transcript to blog post (1,200 words)",
      badge: "4.7s",
    },
    {
      actor: "step", ms: 2800, emoji: "📱",
      text:  "Step 3 · Claude — rewriting as 5 social posts (Twitter, LinkedIn, IG)",
      badge: "2.1s",
    },
    {
      actor: "step", ms: 4000, emoji: "🖼️",
      text:  "Step 4 · DALL·E 3 — generating cover art from title",
      badge: "6.3s",
    },
    {
      actor: "system", ms: 5400, emoji: "✅",
      text:  "Pipeline complete — 4 assets ready in 16.3s",
      badge: "DONE",
    },
  ],
};

// ── Avatar Voice Demo ──────────────────────────────────────────────────────────

const AVATAR_VOICE_DEMO: DemoSequence = {
  id:        "avatarVoice",
  title:     "Avatar Voice Studio",
  prompt:    "Customizing AI personality…",
  loopDelay: 3000,
  messages: [
    {
      actor: "system", ms: 0, emoji: "🎭",
      text:  "Avatar voice initialized — Nova style selected",
      badge: "VOICE",
    },
    {
      actor: "ai", ms: 700,
      text:  "Hey, I'm your personalized AI. I've loaded your memory — looks like you prefer concise answers with examples. Want me to stay in that mode?",
    },
    {
      actor: "system", ms: 1800, emoji: "🎨",
      text:  "Personality blend: Analytical 60% · Creative 30% · Casual 10%",
      badge: "TUNING",
    },
    {
      actor: "ai", ms: 2700,
      text:  "Personality adjusted. I'll lean more analytical now but keep it conversational. By the way — your streak is 12 days! You're in the top 8% of users.",
    },
    {
      actor: "system", ms: 3900, emoji: "🧠",
      text:  "Memory anchors updated — 847 context tokens stored",
      badge: "MEMORY",
    },
    {
      actor: "ai", ms: 4800,
      text:  "I remember your project on GPT-4 vs Claude benchmarks from last week. Should I continue from there or start fresh?",
    },
    {
      actor: "system", ms: 6000, emoji: "✨",
      text:  "Unlock to create your full AI avatar",
    },
  ],
};

// ── Marketplace Demo ──────────────────────────────────────────────────────────

const MARKETPLACE_DEMO: DemoSequence = {
  id:        "marketplace",
  title:     "AI Marketplace",
  prompt:    "Trending this week",
  loopDelay: 3000,
  messages: [
    {
      actor: "system", ms: 0, emoji: "🏪",
      text:  "Marketplace opened — 1,400+ AI tools available",
      badge: "TRENDING",
    },
    {
      actor: "step", ms: 700, emoji: "🎯",
      text:  "#1 · AutoPost — multi-platform social automation · ⭐ 4.9 · 12k users",
    },
    {
      actor: "step", ms: 1600, emoji: "🎮",
      text:  "#2 · GameForge Pro — Unity game generator with 40+ templates · ⭐ 4.8",
    },
    {
      actor: "step", ms: 2500, emoji: "💰",
      text:  "#3 · PricePilot — AI pricing strategy for SaaS · ⭐ 4.7 · $120 avg revenue",
    },
    {
      actor: "system", ms: 3500, emoji: "✨",
      text:  "Join 50,000+ creators publishing AI tools — unlock to browse & publish",
    },
  ],
};

// ── Registry ───────────────────────────────────────────────────────────────────

export const PREVIEW_DEMOS: Record<string, DemoSequence> = {
  battleMode:  BATTLE_DEMO,
  workflows:   WORKFLOWS_DEMO,
  avatarVoice: AVATAR_VOICE_DEMO,
  marketplace: MARKETPLACE_DEMO,
};

export function getDemoForFeature(featureId: string): DemoSequence | null {
  return PREVIEW_DEMOS[featureId] ?? null;
}
