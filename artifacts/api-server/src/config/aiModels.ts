/**
 * AI model configuration for Apex Brain.
 * Centralizes all model selection, parameter tuning, and routing logic.
 */
import type { AvatarAction } from "../shared/types";

export type ModelProvider = "openai" | "claude" | "perplexity";
export type ModelTier = "fast" | "balanced" | "powerful";

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  description: string;
}

// ── Model registry ──────────────────────────────────────────────────────────

export const MODEL_REGISTRY: Record<ModelTier, ModelConfig> = {
  fast: {
    provider: "openai",
    model: "gpt-5.2",
    maxTokens: 2048,
    temperature: 0.7,
    description: "Fast, general-purpose responses",
  },
  balanced: {
    provider: "openai",
    model: "gpt-5.2",
    maxTokens: 4096,
    temperature: 0.8,
    description: "Balanced quality and speed",
  },
  powerful: {
    provider: "openai",
    model: "gpt-5.2",
    maxTokens: 8192,
    temperature: 0.9,
    description: "Maximum capability for complex tasks",
  },
};

// ── Tool definitions for AI tool router ─────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  triggers: string[];
  endpoint: string;
}

export const APEX_TOOLS: ToolDefinition[] = [
  {
    name: "avatar_control",
    description: "Control avatar expressions, animations, and voice sync",
    triggers: ["avatar", "expression", "animate", "face", "gesture", "emotion"],
    endpoint: "/api/avatar/animate",
  },
  {
    name: "workflow_runner",
    description: "Execute automated AI workflows and task chains",
    triggers: ["workflow", "automate", "schedule", "task", "chain", "execute"],
    endpoint: "/api/workflows/run",
  },
  {
    name: "memory_recall",
    description: "Retrieve user memory and past context",
    triggers: ["remember", "recall", "history", "previously", "last time", "before"],
    endpoint: "/api/memory/recall",
  },
  {
    name: "web_search",
    description: "Search the web for real-time information",
    triggers: ["search", "latest", "news", "current", "today", "real-time"],
    endpoint: "/api/ai/search",
  },
  {
    name: "image_generation",
    description: "Generate images from text descriptions",
    triggers: ["generate image", "create image", "draw", "picture of", "visualize"],
    endpoint: "/api/ai/generate-image",
  },
];

// ── System prompts ───────────────────────────────────────────────────────────

export const SYSTEM_PROMPTS = {
  base: `You are Apex, a next-generation AI assistant. You are intelligent, direct, and helpful.
You have access to tools: avatar control, workflows, memory, and web search.
Always respond in structured, clear formats. Be concise unless asked for detail.`,

  think: `You are Apex in deep-reasoning mode. Break down complex problems step by step.
Show your reasoning process clearly. Consider multiple perspectives before concluding.`,

  toolRouter: `You are Apex's tool router. Analyze the user request and determine which tool(s) to invoke.
Respond with a JSON object: { "tool": "<tool_name>", "params": {}, "reasoning": "<why>" }.
Available tools: avatar_control, workflow_runner, memory_recall, web_search, image_generation.
If no tool is needed, respond with: { "tool": "none", "params": {}, "reasoning": "<why>" }.`,

  memory: `You are Apex's memory system. Extract key facts, preferences, and context from the conversation.
Output a structured JSON: { "facts": [], "preferences": [], "context": "", "importance": 1-10 }.`,

  avatar: `You are Apex's avatar controller. Based on the AI response emotional content, determine:
{ "expression": "<happy|sad|thinking|excited|neutral|surprised>", "gesture": "<nod|wave|point|shrug|none>", "intensity": 0.0-1.0 }`,
};

// ── Emotion → Avatar mapping ─────────────────────────────────────────────────

export const EMOTION_AVATAR_MAP = {
  happy: { expression: "happy", gesture: "nod", intensity: 0.8 },
  excited: { expression: "excited", gesture: "wave", intensity: 1.0 },
  thinking: { expression: "thinking", gesture: "point", intensity: 0.6 },
  sad: { expression: "sad", gesture: "none", intensity: 0.7 },
  confused: { expression: "thinking", gesture: "shrug", intensity: 0.5 },
  surprised: { expression: "surprised", gesture: "none", intensity: 0.9 },
  neutral: { expression: "neutral", gesture: "none", intensity: 0.3 },
} satisfies Record<string, AvatarAction>;
