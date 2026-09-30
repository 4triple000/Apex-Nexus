import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { openai, isOpenAIConfigured } from "@workspace/integrations-openai-ai-server";

// Real provider clients. Each is created on first use, so the server starts without keys;
// a provider with no key answers with a clear "not connected" error instead of pretending.
let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  anthropicClient ??= new Anthropic();
  return anthropicClient;
}

let perplexityClient: OpenAI | null = null;
function getPerplexity(): OpenAI | null {
  if (!process.env.PERPLEXITY_API_KEY) return null;
  // Perplexity serves an OpenAI-compatible chat completions API
  perplexityClient ??= new OpenAI({ apiKey: process.env.PERPLEXITY_API_KEY, baseURL: "https://api.perplexity.ai" });
  return perplexityClient;
}

/** Which chat providers have credentials on this server. */
export function providerStatus(): Record<AiProvider, boolean> {
  return {
    openai:     isOpenAIConfigured(),
    claude:     !!process.env.ANTHROPIC_API_KEY,
    perplexity: !!process.env.PERPLEXITY_API_KEY,
  };
}

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

  const ideal: AiProvider = isFactual ? "perplexity" : isComplex ? "claude" : "openai";
  // Auto-route only to providers that are actually connected
  const status = providerStatus();
  if (status[ideal]) return ideal;
  return (Object.keys(status) as AiProvider[]).find((p) => status[p]) ?? ideal;
}

const CALLERS: Record<AiProvider, (message: string) => Promise<AiResponse>> = {
  openai:     (m) => callOpenAI(m),
  claude:     (m) => callClaude(m),
  perplexity: (m) => callPerplexity(m),
};

// Battle and Hive use every connected provider (all of them if none are, so the errors explain why)
function activeProviders(): AiProvider[] {
  const status = providerStatus();
  const connected = (Object.keys(status) as AiProvider[]).filter((p) => status[p]);
  return connected.length ? connected : (Object.keys(status) as AiProvider[]);
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
  const client = getAnthropic();
  if (!client) {
    return { provider: "claude", content: "", responseTime: 0, error: "Claude isn't connected yet. Add ANTHROPIC_API_KEY on the server." };
  }
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      // On a safety decline, the API re-runs the request on a suitable fallback model
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: systemContent,
      messages: [{ role: "user", content: message }],
    });
    if (response.stop_reason === "refusal") {
      return { provider: "claude", content: "", responseTime: Date.now() - start, error: "Claude declined to answer that one." };
    }
    const content = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    return { provider: "claude", content: content || "No response", responseTime: Date.now() - start };
  } catch (err) {
    return {
      provider: "claude",
      content: "",
      responseTime: Date.now() - start,
      error: err instanceof Anthropic.APIError ? `Claude error ${err.status ?? ""}: ${err.message}`.trim() : err instanceof Error ? err.message : "Claude error",
    };
  }
}

async function callPerplexity(message: string, personalizationHint?: string): Promise<AiResponse> {
  const start = Date.now();
  const baseSystem = `You are Apex (Research mode) — specialized in factual information, current events, and research. Provide accurate, well-cited reasoning with clarity.\n\n${HUMAN_VOICE_RULES}`;
  const systemContent = personalizationHint ? `${baseSystem}\n${personalizationHint}` : baseSystem;
  const client = getPerplexity();
  if (!client) {
    return { provider: "perplexity", content: "", responseTime: 0, error: "Perplexity isn't connected yet. Add PERPLEXITY_API_KEY on the server." };
  }
  try {
    const response = await client.chat.completions.create({
      model: "sonar-pro",
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
  return Promise.all(activeProviders().map((p) => CALLERS[p](message)));
}

export async function chatHive(message: string): Promise<{ responses: AiResponse[]; combined: string }> {
  const responses = await Promise.all(activeProviders().map((p) => CALLERS[p](message)));
  const validResponses = responses.filter(r => !r.error && r.content);
  const NAMES: Record<string, string> = { openai: "ChatGPT", claude: "Claude", perplexity: "Perplexity" };

  const combinedPrompt = `You are a synthesis engine. Several AI models have responded to a user's question. Synthesize the best answer from them, combining the strongest insights from each without repeating information. Be concise and comprehensive.

User's question: ${message}

${validResponses.map((r) => `${NAMES[r.provider] ?? r.provider} response: ${r.content}`).join("\n\n")}

Synthesized answer:`;

  let combined = responses.find((r) => r.error)?.error ?? "Failed to synthesize responses.";
  if (validResponses.length === 1) {
    combined = validResponses[0].content;
  } else if (validResponses.length > 1) {
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

// ── Multi-turn chat (mobile app) ──────────────────────────────────────────────

export interface ChatTurn { role: "user" | "assistant"; content: string }

/**
 * One reply from the chosen provider, given a system prompt and prior turns.
 * "auto" (or a provider without a key) routes to a connected provider.
 */
export async function chatWithHistory(
  preferred: string | undefined,
  system: string,
  history: ChatTurn[],
  message: string,
): Promise<AiResponse> {
  const provider = routeToProvider(message, preferred === "auto" ? undefined : preferred);
  const start = Date.now();
  const turns = [...history, { role: "user" as const, content: message }];
  try {
    if (provider === "claude") {
      const client = getAnthropic();
      if (!client) return { provider, content: "", responseTime: 0, error: "Claude isn't connected yet. Add ANTHROPIC_API_KEY on the server." };
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: turns,
      });
      if (response.stop_reason === "refusal") {
        return { provider, content: "", responseTime: Date.now() - start, error: "Claude declined to answer that one." };
      }
      const content = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      return { provider, content, responseTime: Date.now() - start };
    }
    const client = provider === "perplexity" ? getPerplexity() : isOpenAIConfigured() ? openai : null;
    if (!client) {
      const name = provider === "perplexity" ? "Perplexity" : "ChatGPT";
      const key = provider === "perplexity" ? "PERPLEXITY_API_KEY" : "OPENAI_API_KEY";
      return { provider, content: "", responseTime: 0, error: `${name} isn't connected yet. Add ${key} on the server.` };
    }
    const response = await client.chat.completions.create({
      model: provider === "perplexity" ? "sonar-pro" : "gpt-5.2",
      ...(provider === "perplexity" ? {} : { max_completion_tokens: 2048 }),
      messages: [{ role: "system", content: system }, ...turns],
    });
    return { provider, content: response.choices[0]?.message?.content ?? "", responseTime: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Anthropic.APIError ? `Claude error ${err.status ?? ""}: ${err.message}` : err instanceof Error ? err.message : "AI error";
    return { provider, content: "", responseTime: Date.now() - start, error: msg };
  }
}
