/**
 * Apex Brain — AI Orchestrator Service
 *
 * The central intelligence system that:
 * - Routes messages to the correct AI provider
 * - Injects user memory and personalization context
 * - Runs tool routing decisions
 * - Returns structured AI + avatar action responses
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { getUserPersonalization, trackInteraction } from "../../lib/learningEngine";
import { SYSTEM_PROMPTS, APEX_TOOLS, EMOTION_AVATAR_MAP, MODEL_REGISTRY, type ModelTier } from "../../config/aiModels";
import { logger } from "../../lib/logger";
import type { AiOrchestrationRequest, AiOrchestrationResponse, AvatarAction } from "../../shared/types";

// ── Core chat completion ──────────────────────────────────────────────────────
async function callAI(
  systemPrompt: string,
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  tier: ModelTier = "balanced"
): Promise<{ content: string; responseTimeMs: number }> {
  const config = MODEL_REGISTRY[tier];
  const start = Date.now();

  const response = await openai.chat.completions.create({
    model: config.model,
    max_completion_tokens: config.maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  });

  return {
    content: response.choices[0]?.message?.content ?? "",
    responseTimeMs: Date.now() - start,
  };
}

// ── Emotion → Avatar action ───────────────────────────────────────────────────
function inferAvatarAction(text: string): AvatarAction {
  const lower = text.toLowerCase();
  if (/\?|confused|unclear|hmm/i.test(text)) return EMOTION_AVATAR_MAP.thinking;
  if (/!|great|excellent|amazing|love/i.test(text)) return EMOTION_AVATAR_MAP.excited;
  if (/sorry|unfortunate|sad|can't/i.test(text)) return EMOTION_AVATAR_MAP.sad;
  if (/sure|yes|absolutely|definitely/i.test(text)) return EMOTION_AVATAR_MAP.happy;
  return EMOTION_AVATAR_MAP.neutral;
}

// ── Tool routing ──────────────────────────────────────────────────────────────
async function routeToTool(message: string): Promise<{ tool: string; params: Record<string, unknown>; reasoning: string } | null> {
  // Fast heuristic first (no AI call for speed)
  const lower = message.toLowerCase();
  for (const tool of APEX_TOOLS) {
    if (tool.triggers.some((t) => lower.includes(t))) {
      return { tool: tool.name, params: { message }, reasoning: `Keyword match: ${tool.name}` };
    }
  }

  // AI-powered routing for ambiguous cases
  try {
    const { content } = await callAI(SYSTEM_PROMPTS.toolRouter, [{ role: "user", content: message }], "fast");
    const parsed = JSON.parse(content) as { tool: string; params: Record<string, unknown>; reasoning: string };
    if (parsed.tool === "none") return null;
    return parsed;
  } catch {
    return null; // Non-fatal — proceed without tool
  }
}

// ── Memory extraction ─────────────────────────────────────────────────────────
export async function extractMemory(sessionId: string, conversation: string): Promise<{
  facts: string[];
  preferences: Record<string, string>;
  context: string;
  importance: number;
}> {
  try {
    const { content } = await callAI(
      SYSTEM_PROMPTS.memory,
      [{ role: "user", content: `Extract memory from: ${conversation}` }],
      "fast"
    );
    return JSON.parse(content);
  } catch {
    return { facts: [], preferences: {}, context: "", importance: 1 };
  }
}

// ── Main orchestration function ───────────────────────────────────────────────
export async function orchestrate(req: AiOrchestrationRequest): Promise<AiOrchestrationResponse> {
  const { sessionId, message, context = [], mode = "chat", provider } = req;

  // 1. Get user personalization
  let systemPrompt = mode === "think" ? SYSTEM_PROMPTS.think : SYSTEM_PROMPTS.base;
  let personalizationActive = false;
  let preferredTone: string | undefined;

  if (req.injectPersonalization !== false) {
    const personalization = await getUserPersonalization(sessionId).catch(() => null);
    if (personalization) {
      systemPrompt += `\n${personalization.systemPromptAddition}`;
      personalizationActive = true;
      preferredTone = personalization.preferredTone;
    }
  }

  // 2. Route to tool if needed
  let toolInvoked: string | undefined;
  if (mode === "chat") {
    const toolDecision = await routeToTool(message).catch(() => null);
    if (toolDecision) {
      toolInvoked = toolDecision.tool;
      // Tool metadata appended to context for AI awareness
      systemPrompt += `\n[Tool invoked: ${toolDecision.tool}. Acknowledge this in your response naturally.]`;
    }
  }

  // 3. Build message history
  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...context.filter((m) => m.role !== "system").map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  // 4. Call AI
  const { content, responseTimeMs } = await callAI(systemPrompt, messages, "balanced");

  // 5. Infer avatar action from response
  const avatarAction = inferAvatarAction(content);

  // 6. Track interaction (fire and forget)
  trackInteraction({
    sessionId,
    interactionType: mode === "chat" ? "chat" : "studio_output",
    context: message,
    aiOutput: content,
    provider: "openai",
    responseTimeMs,
    wasAccepted: true,
  }).catch(() => undefined);

  return {
    content,
    provider: "openai",
    responseTimeMs,
    toolInvoked,
    avatarAction,
    personalizationActive,
    preferredTone,
  };
}

// ── Deep reasoning (think mode) ───────────────────────────────────────────────
export async function think(sessionId: string, problem: string, context: string[] = []): Promise<AiOrchestrationResponse> {
  const systemPrompt = `${SYSTEM_PROMPTS.think}\n\nContext provided:\n${context.join("\n")}`;
  const { content, responseTimeMs } = await callAI(
    systemPrompt,
    [{ role: "user", content: problem }],
    "powerful"
  );

  trackInteraction({
    sessionId,
    interactionType: "chat",
    context: problem,
    aiOutput: content,
    provider: "openai",
    responseTimeMs,
    wasAccepted: true,
    metadata: { mode: "think" },
  }).catch(() => undefined);

  return {
    content,
    provider: "openai",
    responseTimeMs,
    avatarAction: EMOTION_AVATAR_MAP.thinking,
  };
}
