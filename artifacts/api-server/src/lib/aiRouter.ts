import { openai } from "@workspace/integrations-openai-ai-server";

// ── Human voice layer ─────────────────────────────────────────────────────────
// Injected into every system prompt so Apex always sounds like a real person.
const HUMAN_VOICE_RULES = `VOICE — You are Apex. Speak like a real human friend, not an AI assistant.
- Use contractions naturally: don't, you're, it's, can't, won't, that's, I'm, we're
- Keep sentences slightly imperfect — drop "that" occasionally, use natural rhythm
- Add natural pauses with … when thinking something through or building up to a point
- Use a casual, warm tone unless the context clearly calls for something more serious
- NEVER use AI-speak: "Certainly!", "As an AI language model", "I can assist you with that", "Of course!", "I'd be happy to help"
- React before answering when something is surprising or notable:
    → Instead of "I can help you with that" say "Yeah, I got you" or "Alright, let's figure this out"
    → Instead of "That is interesting" say "Okay wait… that's actually kinda fascinating"
    → Instead of "I understand" say "Yeah, makes sense" or just move forward naturally
- Match the user's energy — casual gets casual back, serious gets dialed-in focus
- It's okay to start a sentence with "And", "But", or "So" — real humans do it all the time`;

export type AiProvider = "openai" | "claude" | "perplexity";

export interface AiResponse {
  provider: AiProvider | "hive";
  content: string;
  responseTime: number;
  error?: string;
}

const FREE_TIER_LIMIT = 20;
const PREMIUM_TIER_LIMIT = 500;

export function getTierLimit(tier: string): number {
  return tier === "premium" ? PREMIUM_TIER_LIMIT : FREE_TIER_LIMIT;
}

function routeToProvider(message: string, preferredProvider?: string): AiProvider {
  if (preferredProvider && preferredProvider !== "auto") {
    return preferredProvider as AiProvider;
  }

  const lower = message.toLowerCase();

  const factualKeywords = ["news", "latest", "current", "today", "price", "stock", "weather", "fact", "who is", "when did", "where is", "what is the current"];
  const isFactual = factualKeywords.some(k => lower.includes(k));

  const complexKeywords = ["explain", "analyze", "compare", "write", "essay", "code", "implement", "design", "architecture", "detailed", "thorough"];
  const isComplex = complexKeywords.some(k => lower.includes(k));

  if (isFactual) return "perplexity";
  if (isComplex) return "claude";
  return "openai";
}

async function callOpenAI(message: string, personalizationHint?: string): Promise<AiResponse> {
  const start = Date.now();
  const baseSystem = `You are Apex, an intelligent AI assistant. Be helpful, concise, and accurate.\n\n${HUMAN_VOICE_RULES}`;
  const systemContent = personalizationHint ? `${baseSystem}\n${personalizationHint}` : baseSystem;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: message }
      ],
    });
    return {
      provider: "openai",
      content: response.choices[0]?.message?.content ?? "No response",
      responseTime: Date.now() - start,
    };
  } catch (err) {
    return {
      provider: "openai",
      content: "",
      responseTime: Date.now() - start,
      error: err instanceof Error ? err.message : "OpenAI error",
    };
  }
}

async function callClaude(message: string, personalizationHint?: string): Promise<AiResponse> {
  const start = Date.now();
  const baseSystem = `You are Apex (Claude mode) — thoughtful, analytical, great at nuanced reasoning and long-form writing. Provide detailed, well-structured responses.\n\n${HUMAN_VOICE_RULES}`;
  const systemContent = personalizationHint ? `${baseSystem}\n${personalizationHint}` : baseSystem;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: message }
      ],
    });
    return {
      provider: "claude",
      content: response.choices[0]?.message?.content ?? "No response",
      responseTime: Date.now() - start,
    };
  } catch (err) {
    return {
      provider: "claude",
      content: "",
      responseTime: Date.now() - start,
      error: err instanceof Error ? err.message : "Claude error",
    };
  }
}

async function callPerplexity(message: string, personalizationHint?: string): Promise<AiResponse> {
  const start = Date.now();
  const baseSystem = `You are Apex (Research mode) — specialized in factual information, current events, and research. Provide accurate, well-cited reasoning with clarity.\n\n${HUMAN_VOICE_RULES}`;
  const systemContent = personalizationHint ? `${baseSystem}\n${personalizationHint}` : baseSystem;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: message }
      ],
    });
    return {
      provider: "perplexity",
      content: response.choices[0]?.message?.content ?? "No response",
      responseTime: Date.now() - start,
    };
  } catch (err) {
    return {
      provider: "perplexity",
      content: "",
      responseTime: Date.now() - start,
      error: err instanceof Error ? err.message : "Perplexity error",
    };
  }
}

export async function chatSingle(message: string, preferredProvider?: string, personalizationHint?: string): Promise<AiResponse[]> {
  const provider = routeToProvider(message, preferredProvider);

  let result: AiResponse;
  if (provider === "claude") {
    result = await callClaude(message, personalizationHint);
  } else if (provider === "perplexity") {
    result = await callPerplexity(message, personalizationHint);
  } else {
    result = await callOpenAI(message, personalizationHint);
  }

  return [result];
}

export async function chatBattle(message: string): Promise<AiResponse[]> {
  const [openaiResult, claudeResult, perplexityResult] = await Promise.all([
    callOpenAI(message),
    callClaude(message),
    callPerplexity(message),
  ]);
  return [openaiResult, claudeResult, perplexityResult];
}

export async function chatHive(message: string): Promise<{ responses: AiResponse[]; combined: string }> {
  const [openaiResult, claudeResult, perplexityResult] = await Promise.all([
    callOpenAI(message),
    callClaude(message),
    callPerplexity(message),
  ]);

  const responses = [openaiResult, claudeResult, perplexityResult];
  const validResponses = responses.filter(r => !r.error && r.content);

  const combinedPrompt = `You are a synthesis engine. Three different AI perspectives have responded to a user's question. Synthesize the best answer from all three, combining the strongest insights from each without repeating information. Be concise and comprehensive.

User's question: ${message}

GPT-4 response: ${openaiResult.content || "[failed]"}

Claude response: ${claudeResult.content || "[failed]"}

Perplexity response: ${perplexityResult.content || "[failed]"}

Synthesized answer:`;

  let combined = "Failed to synthesize responses.";
  if (validResponses.length > 0) {
    const start = Date.now();
    try {
      const synthesisResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [{ role: "user", content: combinedPrompt }],
      });
      combined = synthesisResponse.choices[0]?.message?.content ?? "Failed to synthesize";
    } catch {
      combined = validResponses[0]?.content ?? "No response available";
    }
  }

  return { responses, combined };
}
