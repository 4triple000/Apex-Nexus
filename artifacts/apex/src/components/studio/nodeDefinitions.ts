export type NodeCategory = "trigger" | "logic" | "ai" | "media" | "game" | "output";

export interface NodeFieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  placeholder?: string;
  options?: { value: string; label: string }[];
  default?: string | number;
}

export interface NodeDef {
  type: string;
  label: string;
  icon: string;
  category: NodeCategory;
  color: string;
  bgColor: string;
  description: string;
  inputs: number;   // number of input ports
  outputs: number;  // number of output ports
  outputLabels?: string[]; // labels for output ports (e.g. ['true', 'false'])
  fields: NodeFieldDef[];
}

export const NODE_DEFS: NodeDef[] = [
  // ── TRIGGER NODES ──────────────────────────────────────────
  {
    type: "start", label: "Start", icon: "▶", category: "trigger",
    color: "#4ade80", bgColor: "rgba(74,222,128,0.1)",
    description: "Entry point of the project",
    inputs: 0, outputs: 1,
    fields: [],
  },
  {
    type: "user_input", label: "User Input", icon: "💬", category: "trigger",
    color: "#4ade80", bgColor: "rgba(74,222,128,0.1)",
    description: "Capture user input",
    inputs: 1, outputs: 1,
    fields: [
      { key: "label", label: "Label", type: "text", placeholder: "e.g. Your name", default: "Input" },
      { key: "value", label: "Default Value", type: "text", placeholder: "Default..." },
    ],
  },

  // ── LOGIC NODES ────────────────────────────────────────────
  {
    type: "if", label: "IF Condition", icon: "⚡", category: "logic",
    color: "#fbbf24", bgColor: "rgba(251,191,36,0.1)",
    description: "Branch based on condition",
    inputs: 1, outputs: 2, outputLabels: ["true", "false"],
    fields: [
      { key: "condition", label: "Condition", type: "text", placeholder: "{{variable}} or true/false" },
    ],
  },
  {
    type: "compare", label: "Compare", icon: "⚖️", category: "logic",
    color: "#fbbf24", bgColor: "rgba(251,191,36,0.1)",
    description: "Compare two values",
    inputs: 1, outputs: 1,
    fields: [
      { key: "a", label: "Value A", type: "text", placeholder: "{{variable}}" },
      { key: "operator", label: "Operator", type: "select", options: [
        { value: "eq", label: "Equals (=)" },
        { value: "neq", label: "Not Equals (≠)" },
        { value: "gt", label: "Greater Than (>)" },
        { value: "lt", label: "Less Than (<)" },
        { value: "contains", label: "Contains" },
      ], default: "eq" },
      { key: "b", label: "Value B", type: "text", placeholder: "value" },
    ],
  },
  {
    type: "set_variable", label: "Set Variable", icon: "📝", category: "logic",
    color: "#fbbf24", bgColor: "rgba(251,191,36,0.1)",
    description: "Set a variable in context",
    inputs: 1, outputs: 1,
    fields: [
      { key: "key", label: "Variable Name", type: "text", placeholder: "myVar" },
      { key: "value", label: "Value", type: "text", placeholder: "{{input}} or literal" },
    ],
  },

  // ── AI NODES ───────────────────────────────────────────────
  {
    type: "generate_text", label: "Generate Text", icon: "🤖", category: "ai",
    color: "#a78bfa", bgColor: "rgba(167,139,250,0.1)",
    description: "AI text generation",
    inputs: 1, outputs: 1,
    fields: [
      { key: "prompt", label: "Prompt", type: "textarea", placeholder: "Write about {{topic}}..." },
      { key: "outputKey", label: "Output Variable", type: "text", placeholder: "generated", default: "generated" },
    ],
  },
  {
    type: "ai_character", label: "AI Character", icon: "🎭", category: "ai",
    color: "#a78bfa", bgColor: "rgba(167,139,250,0.1)",
    description: "Persona-based AI response",
    inputs: 1, outputs: 1,
    fields: [
      { key: "persona", label: "Persona", type: "text", placeholder: "a wise wizard", default: "a helpful assistant" },
      { key: "message", label: "Message", type: "textarea", placeholder: "{{userInput}}" },
      { key: "outputKey", label: "Output Variable", type: "text", default: "characterResponse" },
    ],
  },
  {
    type: "summarize", label: "Summarize", icon: "📋", category: "ai",
    color: "#a78bfa", bgColor: "rgba(167,139,250,0.1)",
    description: "AI text summarization",
    inputs: 1, outputs: 1,
    fields: [
      { key: "text", label: "Text to Summarize", type: "textarea", placeholder: "{{generated}}" },
      { key: "outputKey", label: "Output Variable", type: "text", default: "summary" },
    ],
  },
  {
    type: "classify", label: "Classify", icon: "🔍", category: "ai",
    color: "#a78bfa", bgColor: "rgba(167,139,250,0.1)",
    description: "AI classification",
    inputs: 1, outputs: 1,
    fields: [
      { key: "text", label: "Text", type: "text", placeholder: "{{lastOutput}}" },
      { key: "categories", label: "Categories (comma-separated)", type: "text", placeholder: "positive, negative, neutral" },
      { key: "outputKey", label: "Output Variable", type: "text", default: "classification" },
    ],
  },

  // ── MEDIA NODES ────────────────────────────────────────────
  {
    type: "generate_image", label: "Generate Image", icon: "🎨", category: "media",
    color: "#38bdf8", bgColor: "rgba(56,189,248,0.1)",
    description: "AI image generation",
    inputs: 1, outputs: 1,
    fields: [
      { key: "prompt", label: "Image Prompt", type: "textarea", placeholder: "A futuristic city at night..." },
      { key: "style", label: "Style", type: "select", options: [
        { value: "realistic", label: "Realistic" },
        { value: "anime", label: "Anime" },
        { value: "cartoon", label: "Cartoon" },
        { value: "painting", label: "Painting" },
      ], default: "realistic" },
    ],
  },
  {
    type: "generate_video", label: "Generate Video", icon: "🎬", category: "media",
    color: "#38bdf8", bgColor: "rgba(56,189,248,0.1)",
    description: "AI video generation",
    inputs: 1, outputs: 1,
    fields: [
      { key: "prompt", label: "Video Prompt", type: "textarea", placeholder: "A timelapse of a city..." },
      { key: "duration", label: "Duration (s)", type: "number", default: 5 },
    ],
  },
  {
    type: "play_audio", label: "Play Audio", icon: "🎙️", category: "media",
    color: "#38bdf8", bgColor: "rgba(56,189,248,0.1)",
    description: "Text-to-speech audio",
    inputs: 1, outputs: 1,
    fields: [
      { key: "text", label: "Text", type: "textarea", placeholder: "{{generated}}" },
      { key: "voice", label: "Voice", type: "select", options: [
        { value: "alloy", label: "Alloy" }, { value: "echo", label: "Echo" },
        { value: "fable", label: "Fable" }, { value: "onyx", label: "Onyx" },
      ], default: "alloy" },
    ],
  },

  // ── GAME NODES ─────────────────────────────────────────────
  {
    type: "player_input", label: "Player Input", icon: "🎮", category: "game",
    color: "#34d399", bgColor: "rgba(52,211,153,0.1)",
    description: "Get player input or action",
    inputs: 1, outputs: 1,
    fields: [
      { key: "label", label: "Prompt", type: "text", placeholder: "What do you do?" },
      { key: "default", label: "Default Value", type: "text", placeholder: "explore" },
    ],
  },
  {
    type: "scene_switch", label: "Scene Switch", icon: "🗺️", category: "game",
    color: "#34d399", bgColor: "rgba(52,211,153,0.1)",
    description: "Switch to a new scene",
    inputs: 1, outputs: 1,
    fields: [
      { key: "scene", label: "Scene Name", type: "text", placeholder: "dungeon_entrance" },
    ],
  },
  {
    type: "score_track", label: "Score Tracker", icon: "🏆", category: "game",
    color: "#34d399", bgColor: "rgba(52,211,153,0.1)",
    description: "Track game score",
    inputs: 1, outputs: 1,
    fields: [
      { key: "operation", label: "Operation", type: "select", options: [
        { value: "add", label: "Add" }, { value: "subtract", label: "Subtract" }, { value: "reset", label: "Reset" },
      ], default: "add" },
      { key: "amount", label: "Amount", type: "number", default: 1 },
    ],
  },
  {
    type: "win_loss", label: "Win/Loss", icon: "🏁", category: "game",
    color: "#34d399", bgColor: "rgba(52,211,153,0.1)",
    description: "Check win/loss condition",
    inputs: 1, outputs: 2, outputLabels: ["win", "loss"],
    fields: [
      { key: "threshold", label: "Win Score Threshold", type: "number", default: 10 },
    ],
  },

  // ── OUTPUT NODES ───────────────────────────────────────────
  {
    type: "display_result", label: "Display Result", icon: "📺", category: "output",
    color: "#f87171", bgColor: "rgba(248,113,113,0.1)",
    description: "Show output to user",
    inputs: 1, outputs: 0,
    fields: [
      { key: "template", label: "Template", type: "textarea", placeholder: "Result: {{lastOutput}}" },
    ],
  },
  {
    type: "save_data", label: "Save Data", icon: "💾", category: "output",
    color: "#f87171", bgColor: "rgba(248,113,113,0.1)",
    description: "Save data to storage",
    inputs: 1, outputs: 0,
    fields: [
      { key: "key", label: "Key", type: "text", placeholder: "result" },
      { key: "value", label: "Value", type: "text", placeholder: "{{lastOutput}}" },
    ],
  },
  {
    type: "publish_project", label: "Publish", icon: "🚀", category: "output",
    color: "#f87171", bgColor: "rgba(248,113,113,0.1)",
    description: "Publish to marketplace",
    inputs: 1, outputs: 0,
    fields: [
      { key: "title", label: "Marketplace Title", type: "text", placeholder: "My Awesome Project" },
    ],
  },
];

export const NODE_DEF_MAP = Object.fromEntries(NODE_DEFS.map((n) => [n.type, n]));

export const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  trigger: { label: "Trigger", icon: "▶", color: "#4ade80" },
  logic: { label: "Logic", icon: "⚡", color: "#fbbf24" },
  ai: { label: "AI", icon: "🤖", color: "#a78bfa" },
  media: { label: "Media", icon: "🎨", color: "#38bdf8" },
  game: { label: "Game", icon: "🎮", color: "#34d399" },
  output: { label: "Output", icon: "📺", color: "#f87171" },
};
