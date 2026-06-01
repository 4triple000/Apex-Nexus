/**
 * Apex Feature Showcase Data
 * All 17 upcoming features with metadata, phase, preview type, and readiness.
 */

export type PreviewType =
  | "workflow" | "fps" | "marketplace" | "analytics"
  | "social"   | "ai"  | "privacy"    | "memory"
  | "plugin"   | "game" | "referral"  | "monetization"
  | "publish"  | "personality";

export type FeaturePhase = 1 | 2 | 3;

export interface ApexFeature {
  id:          string;
  title:       string;
  description: string;
  icon:        string;
  phase:       FeaturePhase;
  readiness:   number;       // 0-100 fake readiness
  previewType: PreviewType;
  accent:      string;       // primary accent color
  tags:        string[];
}

export const APEX_FEATURES: ApexFeature[] = [
  {
    id:          "autopilot",
    title:       "AI Autopilot System",
    description: "An always-on AI agent that monitors your projects, self-heals errors, and continuously improves performance — zero manual intervention.",
    icon:        "🤖",
    phase:       2,
    readiness:   72,
    previewType: "ai",
    accent:      "#6C5CE7",
    tags:        ["AI", "Automation", "Self-Healing"],
  },
  {
    id:          "workflows",
    title:       "Workflows Engine",
    description: "Build powerful \"When X → Do Y\" automation pipelines. Chain AI agents, APIs, and triggers with a visual no-code builder.",
    icon:        "🔄",
    phase:       2,
    readiness:   68,
    previewType: "workflow",
    accent:      "#F59E0B",
    tags:        ["Automation", "No-Code", "AI Pipeline"],
  },
  {
    id:          "game-studio",
    title:       "AI Game Studio",
    description: "Generate complete playable game worlds from a single prompt. AI handles mechanics, assets, enemies, and level design automatically.",
    icon:        "🎨",
    phase:       2,
    readiness:   61,
    previewType: "game",
    accent:      "#A29BFE",
    tags:        ["Gaming", "AI Generation", "Studio"],
  },
  {
    id:          "multiplayer-fps",
    title:       "Multiplayer FPS System",
    description: "Battle-tested real-time multiplayer engine with matchmaking, lag compensation, server-authority, and 10Hz state broadcasts.",
    icon:        "🎯",
    phase:       3,
    readiness:   54,
    previewType: "fps",
    accent:      "#EF4444",
    tags:        ["Multiplayer", "FPS", "Real-time"],
  },
  {
    id:          "mobile-fps",
    title:       "Mobile FPS Client",
    description: "Touch-optimised FPS controls built for mobile: virtual joystick, touch-look, adaptive HUD, and auto-detect of platform input.",
    icon:        "📱",
    phase:       3,
    readiness:   49,
    previewType: "fps",
    accent:      "#EF4444",
    tags:        ["Mobile", "FPS", "Controls"],
  },
  {
    id:          "unity-gen",
    title:       "Generate Unity Game",
    description: "Describe your game idea and receive a fully-structured Unity C# project — scripts, scenes, weapons, player controller — as a downloadable .zip.",
    icon:        "📦",
    phase:       3,
    readiness:   58,
    previewType: "game",
    accent:      "#10B981",
    tags:        ["Unity", "Code Generation", "Export"],
  },
  {
    id:          "marketplace",
    title:       "Marketplace System",
    description: "Discover, buy, and deploy over 1,400 community-built AI tools. Browse by category, run instantly, or publish your own creations.",
    icon:        "🏪",
    phase:       2,
    readiness:   82,
    previewType: "marketplace",
    accent:      "#10B981",
    tags:        ["Marketplace", "Community", "Tools"],
  },
  {
    id:          "monetization",
    title:       "Monetization System",
    description: "Earn from your AI creations. Set prices, manage Stripe billing, sell in-app packs, and track revenue across your published tools.",
    icon:        "💰",
    phase:       3,
    readiness:   44,
    previewType: "monetization",
    accent:      "#F59E0B",
    tags:        ["Stripe", "Revenue", "Creator"],
  },
  {
    id:          "social",
    title:       "Social System",
    description: "Follow creators, like and share AI sessions, build a public profile, and see the community's top-performing AI experiments.",
    icon:        "👥",
    phase:       2,
    readiness:   76,
    previewType: "social",
    accent:      "#FD79A8",
    tags:        ["Social", "Profiles", "Feed"],
  },
  {
    id:          "referral",
    title:       "Viral Referral Loop",
    description: "Invite friends to unlock premium features early. Track referral progress, share unique codes, and earn exclusive early access rewards.",
    icon:        "🔗",
    phase:       2,
    readiness:   88,
    previewType: "referral",
    accent:      "#A29BFE",
    tags:        ["Growth", "Referrals", "Viral"],
  },
  {
    id:          "self-improve",
    title:       "AI Self-Improvement Engine",
    description: "A continuous learning loop that analyses your AI interactions, detects patterns, and upgrades response quality — automatically, every session.",
    icon:        "🧬",
    phase:       3,
    readiness:   38,
    previewType: "ai",
    accent:      "#BE4BDB",
    tags:        ["AI Learning", "Personalisation", "Memory"],
  },
  {
    id:          "plugins",
    title:       "Plugin & Integration System",
    description: "Connect Apex to any tool in your stack. One-click integrations for Notion, GitHub, Slack, Zapier, and 200+ external services.",
    icon:        "🔌",
    phase:       3,
    readiness:   33,
    previewType: "plugin",
    accent:      "#228BE6",
    tags:        ["Integrations", "APIs", "Plugins"],
  },
  {
    id:          "privacy",
    title:       "Privacy Mode",
    description: "Zero-retention sessions. Your conversations never leave the device. E2E encryption, local-only memory, and anonymous AI processing.",
    icon:        "🔒",
    phase:       2,
    readiness:   65,
    previewType: "privacy",
    accent:      "#10B981",
    tags:        ["Privacy", "Security", "Encryption"],
  },
  {
    id:          "memory-control",
    title:       "Memory Control System",
    description: "Full visibility into what Apex remembers about you. Edit, delete, pin, and organise memories across conversations and AI models.",
    icon:        "🧠",
    phase:       2,
    readiness:   70,
    previewType: "memory",
    accent:      "#6C5CE7",
    tags:        ["Memory", "Control", "Privacy"],
  },
  {
    id:          "personality-reset",
    title:       "Reset Personality System",
    description: "Full AI personality management. Blend traits, switch modes, reset to default, or import community-crafted personality profiles.",
    icon:        "🎭",
    phase:       3,
    readiness:   42,
    previewType: "personality",
    accent:      "#EC4899",
    tags:        ["Personality", "AI Tuning", "Identity"],
  },
  {
    id:          "analytics",
    title:       "Analytics Dashboard",
    description: "Deep insights into your AI usage: token consumption, response quality scores, model comparisons, cost breakdowns, and trend graphs.",
    icon:        "📊",
    phase:       3,
    readiness:   51,
    previewType: "analytics",
    accent:      "#228BE6",
    tags:        ["Analytics", "Insights", "Data"],
  },
  {
    id:          "game-publish",
    title:       "Game Publishing System",
    description: "One-click pipeline to publish your AI-generated games. Host on the web, list on stores, create Stripe storefronts, and track live analytics.",
    icon:        "🌐",
    phase:       3,
    readiness:   58,
    previewType: "publish",
    accent:      "#10B981",
    tags:        ["Publishing", "Distribution", "Monetization"],
  },
];

export const PHASE_META: Record<FeaturePhase, { label: string; color: string; bg: string }> = {
  1: { label: "Phase 1",  color: "#4ADE80", bg: "rgba(74,222,128,0.12)"  },
  2: { label: "Phase 2",  color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  3: { label: "Phase 3",  color: "#A29BFE", bg: "rgba(162,155,254,0.12)" },
};
