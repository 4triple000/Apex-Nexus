/**
 * Apex Cinematic Preview Scripts
 *
 * Each feature has a timed "trailer" script — a sequence of cinematic scenes
 * that play automatically when a user visits a locked feature.
 *
 * Scene types:
 *   title    — full-bleed text card (big statement + optional sub-line)
 *   battle   — two AI fighters with typewriter responses + score flash
 *   clash    — energy explosion frame with expanding rings
 *   flow     — pipeline nodes appearing left-to-right with pulse connect
 *   avatar   — avatar circle + speech bubble typewriter
 *   result   — winner announcement with glow flash
 *
 * Timing: total trailer should stay within 7–9 seconds before looping.
 */

export type CinemaSceneType =
  | "title" | "battle" | "clash" | "flow" | "avatar" | "result";

export interface TitleScene {
  type: "title";
  text: string;
  sub?: string;
  accent?: string;       // colour for text gradient highlight
  duration: number;
}

export interface FighterDef {
  name:  string;
  color: string;
  icon:  string;
  text:  string;
}

export interface BattleScene {
  type: "battle";
  left:      FighterDef;
  right:     FighterDef;
  duration:  number;
}

export interface ClashScene {
  type: "clash";
  label:     string;
  color:     string;
  duration:  number;
}

export interface FlowStep {
  label: string;
  color: string;
  icon:  string;
}

export interface FlowScene {
  type: "flow";
  steps:    FlowStep[];
  headline: string;
  duration: number;
}

export interface AvatarScene {
  type:      "avatar";
  text:      string;
  sub?:      string;
  duration:  number;
}

export interface ResultScene {
  type:     "result";
  winner:   string;
  score:    string;
  sub:      string;
  color:    string;
  duration: number;
}

export type CinemaScene =
  | TitleScene
  | BattleScene
  | ClashScene
  | FlowScene
  | AvatarScene
  | ResultScene;

// ── Battle Mode ───────────────────────────────────────────────────────────────

const BATTLE_SCRIPT: CinemaScene[] = [
  {
    type: "title",
    text: "Two AI minds.",
    sub:  "One question. One winner.",
    accent: "#EF4444",
    duration: 1500,
  },
  {
    type: "battle",
    left: {
      name:  "GPT-4",
      color: "#10A37F",
      icon:  "✦",
      text:  "Great leaders combine emotional intelligence with relentless execution. Bezos, Musk, Jobs — they all executed without mercy while inspiring millions.",
    },
    right: {
      name:  "Claude",
      color: "#D97757",
      icon:  "◆",
      text:  "The strongest leaders create psychological safety first. Satya Nadella tripled Microsoft's market cap by replacing a culture of fear with curiosity.",
    },
    duration: 3400,
  },
  {
    type: "clash",
    label: "ROUND 1 DECIDED",
    color: "#EF4444",
    duration: 900,
  },
  {
    type: "result",
    winner: "Claude ◆",
    score:  "91 vs 86",
    sub:    "Depth of reasoning scores higher",
    color:  "#D97757",
    duration: 1200,
  },
];

// ── AI Workflows ──────────────────────────────────────────────────────────────

const WORKFLOWS_SCRIPT: CinemaScene[] = [
  {
    type: "title",
    text: "Automate your thinking.",
    sub:  "Chain 4 AIs. One prompt. Done.",
    accent: "#F59E0B",
    duration: 1500,
  },
  {
    type: "flow",
    headline: "YouTube → Blog → 5 Social Posts → Cover Art",
    steps: [
      { label: "YouTube",  color: "#FF4444", icon: "🎥" },
      { label: "Whisper",  color: "#10A37F", icon: "🎙️" },
      { label: "GPT-4",    color: "#10A37F", icon: "✦"  },
      { label: "Claude",   color: "#D97757", icon: "◆"  },
      { label: "DALL·E 3", color: "#A29BFE", icon: "🖼️" },
    ],
    duration: 2800,
  },
  {
    type: "title",
    text: "16 seconds.",
    sub:  "5 assets. Zero manual work.",
    accent: "#F59E0B",
    duration: 1500,
  },
];

// ── Avatar Voice Studio ───────────────────────────────────────────────────────

const AVATAR_VOICE_SCRIPT: CinemaScene[] = [
  {
    type: "title",
    text: "Your AI.",
    sub:  "Your voice. Your personality.",
    accent: "#EC4899",
    duration: 1500,
  },
  {
    type: "avatar",
    text: "Hey — I remember your GPT-4 benchmarking project from last week. Want to continue? Or should I start something new based on your current streak?",
    sub:  "Nova · Analytical 60% · Creative 30%",
    duration: 3000,
  },
  {
    type: "title",
    text: "Remembers. Adapts. Grows.",
    sub:  "847 memory tokens. Always yours.",
    accent: "#EC4899",
    duration: 1500,
  },
];

// ── AI Marketplace ────────────────────────────────────────────────────────────

const MARKETPLACE_SCRIPT: CinemaScene[] = [
  {
    type: "title",
    text: "1,400+ AI tools.",
    sub:  "Built by the community. Shipped today.",
    accent: "#10B981",
    duration: 1500,
  },
  {
    type: "flow",
    headline: "Trending this week",
    steps: [
      { label: "AutoPost",  color: "#6C5CE7", icon: "📱" },
      { label: "GameForge", color: "#FD79A8", icon: "🎮" },
      { label: "PricePilot",color: "#10B981", icon: "💰" },
      { label: "MindMap+",  color: "#F59E0B", icon: "🧠" },
    ],
    duration: 2400,
  },
  {
    type: "title",
    text: "Browse. Buy. Publish.",
    sub:  "The App Store for AI.",
    accent: "#10B981",
    duration: 1500,
  },
];

// ── Registry ───────────────────────────────────────────────────────────────────

export const PREVIEW_SCRIPTS: Record<string, CinemaScene[]> = {
  battleMode:  BATTLE_SCRIPT,
  workflows:   WORKFLOWS_SCRIPT,
  avatarVoice: AVATAR_VOICE_SCRIPT,
  marketplace: MARKETPLACE_SCRIPT,
};

export function getScript(featureId: string): CinemaScene[] | null {
  return PREVIEW_SCRIPTS[featureId] ?? null;
}

/** Sum of all scene durations in ms */
export function scriptDuration(script: CinemaScene[]): number {
  return script.reduce((acc, s) => acc + s.duration, 0);
}
