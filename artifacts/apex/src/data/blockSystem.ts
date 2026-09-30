export type BlockCategory = "ui" | "logic" | "data" | "ai" | "network" | "automation";
export type ApexBuilderMode = "app" | "game" | "ai" | "business" | "custom";

export interface BlockDef {
  id: string;
  category: BlockCategory;
  name: string;
  icon: string;
  description: string;
  color: string;
  accent: string;
  inputs: string[];
  outputs: string[];
  tags: string[];
}

export interface BlueprintConnection {
  from: string;
  to: string;
  label?: string;
}

export interface Blueprint {
  id: string;
  name: string;
  type: string;
  mode: ApexBuilderMode;
  description: string;
  icon: string;
  gradient: string;
  blocks: string[];
  connections: BlueprintConnection[];
  difficulty: "starter" | "intermediate" | "advanced";
  estimatedMinutes: number;
}

export const BLOCK_REGISTRY: Record<string, BlockDef> = {
  // ── UI Blocks ───────────────────────────────────────────────────────────────
  "ui.button": {
    id: "ui.button", category: "ui", name: "Button", icon: "🔲",
    description: "Tappable button with haptic feedback & states",
    color: "#FD79A8", accent: "rgba(253,121,168,0.15)",
    inputs: [], outputs: ["onClick"],
    tags: ["interactive","basic"],
  },
  "ui.form": {
    id: "ui.form", category: "ui", name: "Form", icon: "📝",
    description: "Input form with validation and submission",
    color: "#FD79A8", accent: "rgba(253,121,168,0.15)",
    inputs: [], outputs: ["onSubmit","onValidate"],
    tags: ["input","basic"],
  },
  "ui.dashboard": {
    id: "ui.dashboard", category: "ui", name: "Dashboard", icon: "📊",
    description: "Configurable metrics dashboard with charts",
    color: "#FD79A8", accent: "rgba(253,121,168,0.15)",
    inputs: ["data"], outputs: [],
    tags: ["display","analytics"],
  },
  "ui.chatWindow": {
    id: "ui.chatWindow", category: "ui", name: "Chat Window", icon: "💬",
    description: "Real-time scrolling chat interface with bubble renderer",
    color: "#FD79A8", accent: "rgba(253,121,168,0.15)",
    inputs: ["messages","onSend"], outputs: ["userMessage"],
    tags: ["chat","social"],
  },
  "ui.feed": {
    id: "ui.feed", category: "ui", name: "Feed", icon: "📱",
    description: "Infinite-scroll social content feed with cards",
    color: "#FD79A8", accent: "rgba(253,121,168,0.15)",
    inputs: ["items"], outputs: ["onItemClick","onLike"],
    tags: ["social","display"],
  },
  "ui.canvas": {
    id: "ui.canvas", category: "ui", name: "Game Canvas", icon: "🎮",
    description: "High-performance 2D/3D rendering canvas",
    color: "#FD79A8", accent: "rgba(253,121,168,0.15)",
    inputs: ["scene","assets"], outputs: ["onFrame","onEvent"],
    tags: ["game","graphics"],
  },
  "ui.productGrid": {
    id: "ui.productGrid", category: "ui", name: "Product Grid", icon: "🛍️",
    description: "E-commerce product listing with filters & search",
    color: "#FD79A8", accent: "rgba(253,121,168,0.15)",
    inputs: ["products"], outputs: ["onAddToCart","onSelect"],
    tags: ["ecommerce","display"],
  },
  "ui.videoPlayer": {
    id: "ui.videoPlayer", category: "ui", name: "Video Player", icon: "▶️",
    description: "Custom video player with controls and captions",
    color: "#FD79A8", accent: "rgba(253,121,168,0.15)",
    inputs: ["src","captions"], outputs: ["onPlay","onEnd"],
    tags: ["media","display"],
  },

  // ── Logic Blocks ────────────────────────────────────────────────────────────
  "logic.ifElse": {
    id: "logic.ifElse", category: "logic", name: "If / Else", icon: "🔀",
    description: "Conditional branching based on any expression",
    color: "#A29BFE", accent: "rgba(162,155,254,0.15)",
    inputs: ["condition","data"], outputs: ["trueBranch","falseBranch"],
    tags: ["control","basic"],
  },
  "logic.messageHandler": {
    id: "logic.messageHandler", category: "logic", name: "Message Handler", icon: "📨",
    description: "Processes, validates and routes incoming messages",
    color: "#A29BFE", accent: "rgba(162,155,254,0.15)",
    inputs: ["rawMessage"], outputs: ["processedMessage","error"],
    tags: ["chat","routing"],
  },
  "logic.stateManager": {
    id: "logic.stateManager", category: "logic", name: "State Manager", icon: "🔄",
    description: "Reactive global state with undo/redo history",
    color: "#A29BFE", accent: "rgba(162,155,254,0.15)",
    inputs: ["action"], outputs: ["newState","diff"],
    tags: ["state","basic"],
  },
  "logic.inputController": {
    id: "logic.inputController", category: "logic", name: "Input Controller", icon: "🕹️",
    description: "Handles keyboard, gamepad, touch & mouse input",
    color: "#A29BFE", accent: "rgba(162,155,254,0.15)",
    inputs: [], outputs: ["move","action","aim"],
    tags: ["game","input"],
  },
  "logic.cartSystem": {
    id: "logic.cartSystem", category: "logic", name: "Cart System", icon: "🛒",
    description: "Shopping cart with add/remove, discounts and totals",
    color: "#A29BFE", accent: "rgba(162,155,254,0.15)",
    inputs: ["product","coupon"], outputs: ["cartState","total"],
    tags: ["ecommerce","logic"],
  },
  "logic.ruleEngine": {
    id: "logic.ruleEngine", category: "logic", name: "Rule Engine", icon: "⚙️",
    description: "Declarative business rules evaluated at runtime",
    color: "#A29BFE", accent: "rgba(162,155,254,0.15)",
    inputs: ["facts"], outputs: ["decisions"],
    tags: ["automation","logic"],
  },
  "logic.eventBus": {
    id: "logic.eventBus", category: "logic", name: "Event Bus", icon: "⚡",
    description: "Pub/sub event system connecting all blocks",
    color: "#A29BFE", accent: "rgba(162,155,254,0.15)",
    inputs: ["emit"], outputs: ["broadcast"],
    tags: ["integration","basic"],
  },

  // ── Data Blocks ─────────────────────────────────────────────────────────────
  "data.userStorage": {
    id: "data.userStorage", category: "data", name: "User Storage", icon: "👤",
    description: "Persistent per-user data with schema validation",
    color: "#00D2D3", accent: "rgba(0,210,211,0.15)",
    inputs: ["write"], outputs: ["read"],
    tags: ["storage","user"],
  },
  "data.inventoryDB": {
    id: "data.inventoryDB", category: "data", name: "Inventory DB", icon: "🗄️",
    description: "Real-time product inventory with stock tracking",
    color: "#00D2D3", accent: "rgba(0,210,211,0.15)",
    inputs: ["update"], outputs: ["inventory","lowStock"],
    tags: ["ecommerce","database"],
  },
  "data.localCache": {
    id: "data.localCache", category: "data", name: "Local Cache", icon: "💾",
    description: "Fast LRU in-memory cache with TTL expiry",
    color: "#00D2D3", accent: "rgba(0,210,211,0.15)",
    inputs: ["set"], outputs: ["get","miss"],
    tags: ["performance","storage"],
  },
  "data.analytics": {
    id: "data.analytics", category: "data", name: "Analytics", icon: "📈",
    description: "Event tracking, funnels and retention metrics",
    color: "#00D2D3", accent: "rgba(0,210,211,0.15)",
    inputs: ["event"], outputs: ["aggregated"],
    tags: ["analytics","tracking"],
  },
  "data.fileStorage": {
    id: "data.fileStorage", category: "data", name: "File Storage", icon: "📁",
    description: "Upload, store and serve media files with CDN",
    color: "#00D2D3", accent: "rgba(0,210,211,0.15)",
    inputs: ["file"], outputs: ["url","metadata"],
    tags: ["media","storage"],
  },
  "data.gameState": {
    id: "data.gameState", category: "data", name: "Game State", icon: "🎲",
    description: "Player progress, scores and savegame management",
    color: "#00D2D3", accent: "rgba(0,210,211,0.15)",
    inputs: ["save"], outputs: ["load","leaderboard"],
    tags: ["game","persistence"],
  },

  // ── AI Blocks ───────────────────────────────────────────────────────────────
  "ai.chatbot": {
    id: "ai.chatbot", category: "ai", name: "Chatbot", icon: "🤖",
    description: "ChatGPT powered conversational AI with memory",
    color: "#FFCC33", accent: "rgba(255,204,51,0.15)",
    inputs: ["userMessage","context"], outputs: ["response","intent"],
    tags: ["chat","ai","nlp"],
  },
  "ai.optionalAssistant": {
    id: "ai.optionalAssistant", category: "ai", name: "AI Assistant", icon: "✨",
    description: "Context-aware assistant that enriches any app",
    color: "#FFCC33", accent: "rgba(255,204,51,0.15)",
    inputs: ["query","context"], outputs: ["answer","actions"],
    tags: ["ai","assistant"],
  },
  "ai.enemySystem": {
    id: "ai.enemySystem", category: "ai", name: "Enemy AI", icon: "👾",
    description: "Adaptive NPC behavior tree with pathfinding",
    color: "#FFCC33", accent: "rgba(255,204,51,0.15)",
    inputs: ["worldState","playerPos"], outputs: ["move","attack","flee"],
    tags: ["game","ai","npc"],
  },
  "ai.recommendationEngine": {
    id: "ai.recommendationEngine", category: "ai", name: "Recommendations", icon: "🎯",
    description: "Collaborative filtering + content-based suggestions",
    color: "#FFCC33", accent: "rgba(255,204,51,0.15)",
    inputs: ["userId","history"], outputs: ["items"],
    tags: ["ai","personalization"],
  },
  "ai.imageGeneration": {
    id: "ai.imageGeneration", category: "ai", name: "Image Generation", icon: "🖼️",
    description: "DALL-E/Stable Diffusion image creation on demand",
    color: "#FFCC33", accent: "rgba(255,204,51,0.15)",
    inputs: ["prompt","style"], outputs: ["imageUrl"],
    tags: ["ai","media","generation"],
  },
  "ai.decisionEngine": {
    id: "ai.decisionEngine", category: "ai", name: "Decision Engine", icon: "🧠",
    description: "ML model inference for any classification task",
    color: "#FFCC33", accent: "rgba(255,204,51,0.15)",
    inputs: ["features"], outputs: ["prediction","confidence"],
    tags: ["ai","ml","automation"],
  },
  "ai.voiceInterface": {
    id: "ai.voiceInterface", category: "ai", name: "Voice Interface", icon: "🎙️",
    description: "STT→intent→TTS full voice conversation pipeline",
    color: "#FFCC33", accent: "rgba(255,204,51,0.15)",
    inputs: ["audioStream"], outputs: ["transcript","response"],
    tags: ["voice","ai","nlp"],
  },

  // ── Network Blocks ───────────────────────────────────────────────────────────
  "network.sync": {
    id: "network.sync", category: "network", name: "Multiplayer Sync", icon: "🌐",
    description: "Real-time state sync across all connected clients",
    color: "#55EFC4", accent: "rgba(85,239,196,0.15)",
    inputs: ["localState"], outputs: ["remoteState","conflict"],
    tags: ["multiplayer","realtime"],
  },
  "network.paymentAPI": {
    id: "network.paymentAPI", category: "network", name: "Payment API", icon: "💳",
    description: "Stripe checkout, subscriptions and refunds",
    color: "#55EFC4", accent: "rgba(85,239,196,0.15)",
    inputs: ["cart"], outputs: ["success","failure"],
    tags: ["ecommerce","payments"],
  },
  "network.apiCall": {
    id: "network.apiCall", category: "network", name: "API Call", icon: "🔗",
    description: "REST/GraphQL client with auth, retry and caching",
    color: "#55EFC4", accent: "rgba(85,239,196,0.15)",
    inputs: ["request"], outputs: ["response","error"],
    tags: ["integration","http"],
  },
  "network.webhook": {
    id: "network.webhook", category: "network", name: "Webhook", icon: "📡",
    description: "Listen for and emit HTTP webhook events",
    color: "#55EFC4", accent: "rgba(85,239,196,0.15)",
    inputs: ["emit"], outputs: ["receive"],
    tags: ["integration","events"],
  },
  "network.pushNotification": {
    id: "network.pushNotification", category: "network", name: "Push Notification", icon: "🔔",
    description: "Cross-platform push notifications and in-app alerts",
    color: "#55EFC4", accent: "rgba(85,239,196,0.15)",
    inputs: ["message","userId"], outputs: ["delivered"],
    tags: ["notifications","mobile"],
  },

  // ── Automation Blocks ───────────────────────────────────────────────────────
  "automation.scheduler": {
    id: "automation.scheduler", category: "automation", name: "Scheduler", icon: "⏰",
    description: "Cron jobs and scheduled tasks with retry logic",
    color: "#B2BEC3", accent: "rgba(178,190,195,0.15)",
    inputs: ["cron","task"], outputs: ["triggered"],
    tags: ["automation","backend"],
  },
  "automation.pipeline": {
    id: "automation.pipeline", category: "automation", name: "Pipeline", icon: "🔁",
    description: "Multi-step data transformation & processing chain",
    color: "#B2BEC3", accent: "rgba(178,190,195,0.15)",
    inputs: ["input"], outputs: ["output","error"],
    tags: ["automation","data"],
  },
  "automation.contentModerator": {
    id: "automation.contentModerator", category: "automation", name: "Content Moderator", icon: "🛡️",
    description: "AI-powered text/image moderation with confidence scores",
    color: "#B2BEC3", accent: "rgba(178,190,195,0.15)",
    inputs: ["content"], outputs: ["safe","flagged"],
    tags: ["moderation","ai"],
  },
};

export const BLUEPRINTS: Blueprint[] = [
  {
    id: "chat-app",
    name: "Chat App",
    type: "chat_app",
    mode: "app",
    description: "Real-time AI-enhanced messaging with smart replies",
    icon: "💬",
    gradient: "linear-gradient(135deg,#FD79A8,#6C5CE7)",
    difficulty: "starter",
    estimatedMinutes: 2,
    blocks: ["ui.chatWindow","logic.messageHandler","data.userStorage","ai.chatbot","network.apiCall"],
    connections: [
      { from: "ui.chatWindow", to: "logic.messageHandler", label: "userMessage" },
      { from: "logic.messageHandler", to: "ai.chatbot", label: "processed" },
      { from: "ai.chatbot", to: "ui.chatWindow", label: "response" },
      { from: "logic.messageHandler", to: "data.userStorage", label: "save" },
    ],
  },
  {
    id: "social-feed",
    name: "Social Feed",
    type: "social",
    mode: "app",
    description: "AI-curated content feed with recommendations",
    icon: "📱",
    gradient: "linear-gradient(135deg,#A29BFE,#FD79A8)",
    difficulty: "intermediate",
    estimatedMinutes: 3,
    blocks: ["ui.feed","logic.stateManager","data.userStorage","ai.recommendationEngine","network.apiCall","network.pushNotification"],
    connections: [
      { from: "network.apiCall", to: "ai.recommendationEngine", label: "feed data" },
      { from: "ai.recommendationEngine", to: "ui.feed", label: "ranked items" },
      { from: "ui.feed", to: "logic.stateManager", label: "interactions" },
      { from: "logic.stateManager", to: "data.userStorage", label: "save prefs" },
    ],
  },
  {
    id: "multiplayer-game",
    name: "Multiplayer Game",
    type: "game",
    mode: "game",
    description: "Real-time multiplayer with adaptive enemy AI",
    icon: "🎮",
    gradient: "linear-gradient(135deg,#00D2D3,#6C5CE7)",
    difficulty: "advanced",
    estimatedMinutes: 5,
    blocks: ["ui.canvas","logic.inputController","ai.enemySystem","network.sync","data.gameState"],
    connections: [
      { from: "logic.inputController", to: "ui.canvas", label: "render" },
      { from: "logic.inputController", to: "network.sync", label: "broadcast" },
      { from: "network.sync", to: "ai.enemySystem", label: "world state" },
      { from: "ai.enemySystem", to: "ui.canvas", label: "NPC actions" },
      { from: "ui.canvas", to: "data.gameState", label: "autosave" },
    ],
  },
  {
    id: "e-commerce",
    name: "E-Commerce Store",
    type: "store",
    mode: "business",
    description: "Full shopping experience with AI recommendations",
    icon: "🛒",
    gradient: "linear-gradient(135deg,#55EFC4,#00D2D3)",
    difficulty: "intermediate",
    estimatedMinutes: 4,
    blocks: ["ui.productGrid","logic.cartSystem","data.inventoryDB","network.paymentAPI","ai.recommendationEngine"],
    connections: [
      { from: "data.inventoryDB", to: "ui.productGrid", label: "products" },
      { from: "ui.productGrid", to: "logic.cartSystem", label: "add to cart" },
      { from: "ai.recommendationEngine", to: "ui.productGrid", label: "suggest" },
      { from: "logic.cartSystem", to: "network.paymentAPI", label: "checkout" },
    ],
  },
  {
    id: "ai-assistant",
    name: "AI Assistant",
    type: "ai_agent",
    mode: "ai",
    description: "Multimodal voice + text AI with long-term memory",
    icon: "🤖",
    gradient: "linear-gradient(135deg,#FFCC33,#FD79A8)",
    difficulty: "starter",
    estimatedMinutes: 2,
    blocks: ["ai.voiceInterface","ai.chatbot","ai.decisionEngine","data.userStorage","logic.eventBus"],
    connections: [
      { from: "ai.voiceInterface", to: "ai.chatbot", label: "transcript" },
      { from: "ai.chatbot", to: "ai.decisionEngine", label: "intent" },
      { from: "ai.decisionEngine", to: "logic.eventBus", label: "action" },
      { from: "ai.chatbot", to: "data.userStorage", label: "memory" },
    ],
  },
  {
    id: "saas-dashboard",
    name: "SaaS Dashboard",
    type: "dashboard",
    mode: "business",
    description: "Analytics dashboard with automated reports & alerts",
    icon: "📊",
    gradient: "linear-gradient(135deg,#6C5CE7,#00D2D3)",
    difficulty: "intermediate",
    estimatedMinutes: 3,
    blocks: ["ui.dashboard","data.analytics","logic.ruleEngine","automation.scheduler","network.pushNotification"],
    connections: [
      { from: "data.analytics", to: "ui.dashboard", label: "metrics" },
      { from: "logic.ruleEngine", to: "network.pushNotification", label: "alerts" },
      { from: "automation.scheduler", to: "data.analytics", label: "fetch report" },
    ],
  },
  {
    id: "content-platform",
    name: "Content Platform",
    type: "content",
    mode: "app",
    description: "Video/image creator platform with AI generation",
    icon: "🎬",
    gradient: "linear-gradient(135deg,#FD79A8,#FFCC33)",
    difficulty: "advanced",
    estimatedMinutes: 5,
    blocks: ["ui.videoPlayer","ui.feed","ai.imageGeneration","data.fileStorage","automation.contentModerator","network.apiCall"],
    connections: [
      { from: "ai.imageGeneration", to: "data.fileStorage", label: "upload" },
      { from: "data.fileStorage", to: "ui.feed", label: "media url" },
      { from: "ui.feed", to: "automation.contentModerator", label: "user content" },
      { from: "automation.contentModerator", to: "logic.ruleEngine", label: "verdict" },
    ],
  },
  {
    id: "automation-bot",
    name: "Automation Bot",
    type: "automation",
    mode: "ai",
    description: "Self-running workflow bot with AI decision-making",
    icon: "⚡",
    gradient: "linear-gradient(135deg,#B2BEC3,#6C5CE7)",
    difficulty: "advanced",
    estimatedMinutes: 4,
    blocks: ["automation.scheduler","automation.pipeline","ai.decisionEngine","network.webhook","logic.ruleEngine"],
    connections: [
      { from: "automation.scheduler", to: "automation.pipeline", label: "trigger" },
      { from: "automation.pipeline", to: "ai.decisionEngine", label: "data" },
      { from: "ai.decisionEngine", to: "logic.ruleEngine", label: "prediction" },
      { from: "logic.ruleEngine", to: "network.webhook", label: "action" },
    ],
  },
];

export const CATEGORY_META: Record<BlockCategory, { label: string; color: string; icon: string }> = {
  ui:         { label: "UI",         color: "#FD79A8", icon: "🖼" },
  logic:      { label: "Logic",      color: "#A29BFE", icon: "⚙️" },
  data:       { label: "Data",       color: "#00D2D3", icon: "💾" },
  ai:         { label: "AI",         color: "#FFCC33", icon: "🤖" },
  network:    { label: "Network",    color: "#55EFC4", icon: "🌐" },
  automation: { label: "Automation", color: "#B2BEC3", icon: "⚡" },
};

export const MODE_META: Record<ApexBuilderMode, { label: string; emoji: string; color: string; description: string }> = {
  app:      { label: "App",      emoji: "🟣", color: "#A29BFE", description: "dashboards · tools · SaaS" },
  game:     { label: "Game",     emoji: "🔵", color: "#00D2D3", description: "FPS · RPG · multiplayer" },
  ai:       { label: "AI",       emoji: "🟢", color: "#55EFC4", description: "chatbots · agents · assistants" },
  business: { label: "Business", emoji: "🟠", color: "#FFCC33", description: "e-commerce · booking · CRM" },
  custom:   { label: "Custom",   emoji: "🔴", color: "#FD79A8", description: "full block editor" },
};

// ─── Feature Map ─────────────────────────────────────────────────────────────
// Maps extracted feature names → the block IDs that implement them.
// The pipeline engine assembles these into a deduplicated block set.
export const FEATURE_MAP: Record<string, string[]> = {
  user_accounts:        ["ui.form",        "logic.stateManager",   "data.userStorage"],
  chat_system:          ["ui.chatWindow",  "logic.messageHandler", "data.userStorage", "network.apiCall"],
  payment_processing:   ["logic.cartSystem","network.paymentAPI",  "data.userStorage"],
  product_listings:     ["ui.productGrid", "data.inventoryDB",     "logic.stateManager"],
  social_feed:          ["ui.feed",        "logic.stateManager",   "data.userStorage", "ai.recommendationEngine"],
  multiplayer:          ["network.sync",   "logic.stateManager",   "data.gameState"],
  ai_assistant:         ["ai.chatbot",     "data.userStorage",     "logic.eventBus"],
  push_notifications:   ["network.pushNotification", "logic.stateManager"],
  analytics:            ["data.analytics", "ui.dashboard",         "automation.scheduler"],
  content_upload:       ["data.fileStorage","automation.contentModerator","network.apiCall"],
  game_engine:          ["ui.canvas",      "logic.inputController","data.gameState"],
  enemy_ai:             ["ai.enemySystem", "logic.stateManager"],
  recommendations:      ["ai.recommendationEngine",  "data.analytics"],
  automation_bot:       ["automation.scheduler","automation.pipeline","logic.ruleEngine"],
  voice_interface:      ["ai.voiceInterface","ai.chatbot"],
  image_generation:     ["ai.imageGeneration","data.fileStorage"],
  search:               ["logic.stateManager","network.apiCall"],
  booking_system:       ["ui.form",        "data.userStorage",     "network.paymentAPI","automation.scheduler"],
  reviews_ratings:      ["ui.feed",        "data.userStorage",     "automation.contentModerator"],
  admin_dashboard:      ["ui.dashboard",   "data.analytics",       "logic.ruleEngine"],
  webhooks:             ["network.webhook","logic.ruleEngine"],
  content_moderation:   ["automation.contentModerator","logic.ruleEngine"],
  caching:              ["data.localCache","network.apiCall"],
  leaderboard:          ["data.gameState", "ui.feed",              "network.sync"],
  video_streaming:      ["ui.videoPlayer", "data.fileStorage",     "network.apiCall"],
  crm:                  ["data.userStorage","ui.dashboard",        "logic.ruleEngine","network.pushNotification"],
  inventory:            ["data.inventoryDB","logic.ruleEngine",    "ui.dashboard"],
  reporting:            ["data.analytics", "automation.scheduler", "network.webhook"],
  npc_ai:               ["ai.enemySystem", "ai.decisionEngine",   "logic.stateManager"],
  decision_engine:      ["ai.decisionEngine","logic.ruleEngine"],
  file_storage:         ["data.fileStorage","network.apiCall"],
};

// ─── UI Block → Screen Mapping ────────────────────────────────────────────────
// Determines which screens/routes get auto-generated based on UI blocks used.
export const UI_BLOCK_TO_SCREEN: Record<string, { name: string; icon: string; route: string; description: string }> = {
  "ui.chatWindow":  { name: "Chat",        icon: "💬", route: "/chat",       description: "Real-time messaging interface" },
  "ui.feed":        { name: "Feed",        icon: "📱", route: "/feed",       description: "Scrollable content stream" },
  "ui.productGrid": { name: "Shop",        icon: "🛍️", route: "/shop",       description: "Product catalog & listings" },
  "ui.dashboard":   { name: "Dashboard",   icon: "📊", route: "/dashboard",  description: "Analytics & metrics overview" },
  "ui.canvas":      { name: "Game",        icon: "🎮", route: "/game",       description: "Interactive game canvas" },
  "ui.form":        { name: "Profile",     icon: "👤", route: "/profile",    description: "User account & settings" },
  "ui.videoPlayer": { name: "Watch",       icon: "▶️", route: "/watch",      description: "Video playback experience" },
  "ui.button":      { name: "Home",        icon: "🏠", route: "/",           description: "Main landing screen" },
};

// ─── Intent categories ────────────────────────────────────────────────────────
export type IntentCategory =
  | "social_app" | "game" | "ecommerce" | "ai_tool" | "productivity"
  | "media_platform" | "marketplace" | "dashboard" | "automation" | "general_app";

export type Complexity = "simple" | "medium" | "complex";
export type Tone       = "fun" | "serious" | "professional" | "playful";
export type Scale      = "hobby" | "startup" | "enterprise";
export type UIStyle    = "minimal" | "bold" | "elegant" | "playful" | "dark";

export interface DetectedIntent {
  category: IntentCategory;
  subtype: string;
  complexity: Complexity;
  mode: ApexBuilderMode;
}

// ─── AI Enhancement Layer ─────────────────────────────────────────────────────
export interface AIEnhancement {
  tone: Tone;
  scale: Scale;
  audience: string;
  uiStyle: UIStyle;
  colorPalette: string[];
  tagline: string;
  emoji: string;
}

// ─── Upgrade Suggestion ───────────────────────────────────────────────────────
export interface UpgradeSuggestion {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  blockCount: number;
}

// ─── Upgrade Paths ────────────────────────────────────────────────────────────
export const UPGRADE_PATHS: Record<string, {
  label: string; description: string; icon: string; color: string; features: string[];
}> = {
  ai_recommendations:  { label: "AI Recommendations",   icon: "🎯", color: "#FFCC33", description: "Smart personalized content powered by ML", features: ["recommendations","analytics"] },
  monetization:        { label: "Monetization",          icon: "💰", color: "#55EFC4", description: "Payments, subscriptions & in-app purchases",  features: ["payment_processing"] },
  multiplayer:         { label: "Multiplayer",           icon: "🌐", color: "#00D2D3", description: "Real-time sync for collaborative experiences",  features: ["multiplayer"] },
  push_alerts:         { label: "Push Notifications",   icon: "🔔", color: "#FD79A8", description: "Re-engage users with smart, timely alerts",     features: ["push_notifications"] },
  ai_assistant:        { label: "AI Assistant",          icon: "🤖", color: "#A29BFE", description: "Conversational AI built into your app",         features: ["ai_assistant","voice_interface"] },
  analytics_dashboard: { label: "Analytics Dashboard",  icon: "📊", color: "#6C5CE7", description: "Track usage, retention and growth metrics",     features: ["analytics","admin_dashboard"] },
  content_moderation:  { label: "Content Moderation",   icon: "🛡️", color: "#B2BEC3", description: "AI-powered safety layer for user content",       features: ["content_moderation"] },
  image_generation:    { label: "AI Image Generation",  icon: "🖼️", color: "#FD79A8", description: "Let users create images with one prompt",        features: ["image_generation"] },
  voice_interface:     { label: "Voice Interface",      icon: "🎙️", color: "#A29BFE", description: "Hands-free voice commands & responses",          features: ["voice_interface"] },
  leaderboard:         { label: "Leaderboard",          icon: "🏆", color: "#FFCC33", description: "Competitive rankings to drive engagement",        features: ["leaderboard"] },
};

// ─── Builder Memory ───────────────────────────────────────────────────────────
export interface BuildMemoryEntry {
  id: string;
  prompt: string;
  appName: string;
  features: string[];
  intent: DetectedIntent;
  enhancement: AIEnhancement;
  timestamp: number;
}

export interface PipelineStage<T> {
  name: string;
  status: "pending" | "running" | "done" | "error";
  output?: T;
  durationMs?: number;
}

export interface GeneratedScreen {
  name: string;
  icon: string;
  route: string;
  description: string;
  blocks: string[];
}

export interface PipelineResult {
  prompt: string;
  durationMs: number;
  intent: DetectedIntent;
  enhancement: AIEnhancement;
  features: string[];
  featureBlockMap: Record<string, string[]>;
  assembledBlockIds: string[];
  blocks: BlockDef[];
  screens: GeneratedScreen[];
  navigation: string[];
  appName: string;
  blueprint: Blueprint | null;
  confidence: number;
  upgrades: UpgradeSuggestion[];
}
