/**
 * Block Data Map
 * Maps block IDs → their backend endpoint + data role.
 * When the AI generates blocks, this config auto-connects each
 * component to its live data source.
 */
export interface BlockDataConfig {
  endpoint:   string;
  role:       "chat" | "products" | "leaderboard" | "feed" | "stats" | "auth" | "none";
  pollMs?:    number;   // auto-refresh interval in ms (undefined = no polling)
  label:      string;   // human-readable description
}

export const BLOCK_DATA_MAP: Record<string, BlockDataConfig> = {
  // ── UI Blocks ────────────────────────────────────────────────────────────
  "ui.chatWindow":  { endpoint: "/messages",     role: "chat",        pollMs: 2000,  label: "Live AI Chat"       },
  "ui.productGrid": { endpoint: "/products",     role: "products",    pollMs: 10000, label: "Real Product Store" },
  "ui.feed":        { endpoint: "/feed",         role: "feed",        pollMs: 8000,  label: "Social Feed"        },
  "ui.dashboard":   { endpoint: "/stats",        role: "stats",       pollMs: 5000,  label: "Analytics Dashboard"},
  "ui.canvas":      { endpoint: "/leaderboard",  role: "leaderboard", pollMs: 3000,  label: "Game Leaderboard"   },

  // ── AI Blocks ────────────────────────────────────────────────────────────
  "ai.chatbot":           { endpoint: "/messages", role: "chat",    pollMs: 2000, label: "AI Chatbot"     },
  "ai.optionalAssistant": { endpoint: "/messages", role: "chat",    pollMs: 2000, label: "AI Assistant"   },

  // ── Network Blocks ───────────────────────────────────────────────────────
  "network.sync":       { endpoint: "/leaderboard", role: "leaderboard", pollMs: 2000, label: "Multiplayer Sync" },
  "network.paymentAPI": { endpoint: "/products",    role: "products",               label: "Payment API"      },

  // ── Auth Blocks ───────────────────────────────────────────────────────────
  "ui.auth":    { endpoint: "/my-projects", role: "auth", label: "Auth Screen"  },
  "ui.profile": { endpoint: "/my-projects", role: "auth", label: "User Profile" },

  // Default (no data)
  "_default":           { endpoint: "", role: "none", label: "Logic Block" },
};

export function getBlockDataConfig(blockId: string): BlockDataConfig {
  return BLOCK_DATA_MAP[blockId] ?? BLOCK_DATA_MAP["_default"]!;
}
