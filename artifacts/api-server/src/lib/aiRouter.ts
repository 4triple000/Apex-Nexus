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

// Chat providers that serve an OpenAI-compatible API. The model can be changed with <NAME>_MODEL on the server.
type CompatProvider = "gemini" | "grok" | "deepseek" | "mistral" | "llama";
const COMPAT: Record<CompatProvider, { name: string; envKey: string; baseURL: string; model: string; modelEnv: string }> = {
  gemini:   { name: "Gemini",   envKey: "GEMINI_API_KEY",   baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-2.5-flash", modelEnv: "GEMINI_MODEL" },
  grok:     { name: "Grok",     envKey: "XAI_API_KEY",      baseURL: "https://api.x.ai/v1",            model: "grok-4",                  modelEnv: "XAI_MODEL" },
  deepseek: { name: "DeepSeek", envKey: "DEEPSEEK_API_KEY", baseURL: "https://api.deepseek.com",       model: "deepseek-chat",           modelEnv: "DEEPSEEK_MODEL" },
  mistral:  { name: "Mistral",  envKey: "MISTRAL_API_KEY",  baseURL: "https://api.mistral.ai/v1",      model: "mistral-large-latest",    modelEnv: "MISTRAL_MODEL" },
  llama:    { name: "Llama",    envKey: "GROQ_API_KEY",     baseURL: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", modelEnv: "GROQ_MODEL" },
};
const isCompat = (p: string): p is CompatProvider => p in COMPAT;

const compatClients: Partial<Record<CompatProvider, OpenAI>> = {};
function getCompat(p: CompatProvider): OpenAI | null {
  const cfg = COMPAT[p];
  const apiKey = process.env[cfg.envKey];
  if (!apiKey) return null;
  compatClients[p] ??= new OpenAI({ apiKey, baseURL: cfg.baseURL });
  return compatClients[p]!;
}
const compatModel = (p: CompatProvider) => process.env[COMPAT[p].modelEnv] || COMPAT[p].model;

/** Which chat providers have credentials on this server. */
export function providerStatus(): Record<AiProvider, boolean> {
  return {
    openai:     isOpenAIConfigured(),
    claude:     !!process.env.ANTHROPIC_API_KEY,
    perplexity: !!process.env.PERPLEXITY_API_KEY,
    gemini:     !!process.env.GEMINI_API_KEY,
    grok:       !!process.env.XAI_API_KEY,
    deepseek:   !!process.env.DEEPSEEK_API_KEY,
    mistral:    !!process.env.MISTRAL_API_KEY,
    llama:      !!process.env.GROQ_API_KEY,
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

export type AiProvider = "openai" | "claude" | "perplexity" | CompatProvider;
export const AI_PROVIDERS: AiProvider[] = ["openai", "claude", "perplexity", "gemini", "grok", "deepseek", "mistral", "llama"];

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
  if (preferredProvider && preferredProvider !== "auto" && (AI_PROVIDERS as string[]).includes(preferredProvider)) {
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

const CALLERS: Record<AiProvider, (message: string, hint?: string) => Promise<AiResponse>> = {
  openai:     (m, h) => callOpenAI(m, h),
  claude:     (m, h) => callClaude(m, h),
  perplexity: (m, h) => callPerplexity(m, h),
  gemini:     (m, h) => callCompat("gemini", m, h),
  grok:       (m, h) => callCompat("grok", m, h),
  deepseek:   (m, h) => callCompat("deepseek", m, h),
  mistral:    (m, h) => callCompat("mistral", m, h),
  llama:      (m, h) => callCompat("llama", m, h),
};

// Battle and Hive use every connected provider (the original three if none are, so the errors explain why)
function activeProviders(): AiProvider[] {
  const status = providerStatus();
  const connected = AI_PROVIDERS.filter((p) => status[p]);
  return connected.length ? connected : ["openai", "claude", "perplexity"];
}

async function callCompat(provider: CompatProvider, message: string, personalizationHint?: string): Promise<AiResponse> {
  const start = Date.now();
  const cfg = COMPAT[provider];
  const client = getCompat(provider);
  if (!client) {
    return { provider, content: "", responseTime: 0, error: `${cfg.name} isn't connected yet. Add ${cfg.envKey} on the server.` };
  }
  const baseSystem = `You are Apex (${cfg.name} mode), a helpful AI assistant. Be clear, accurate and friendly.\n\n${HUMAN_VOICE_RULES}`;
  try {
    const response = await client.chat.completions.create({
      model: compatModel(provider),
      messages: [
        { role: "system", content: personalizationHint ? `${baseSystem}\n${personalizationHint}` : baseSystem },
        { role: "user", content: message },
      ],
    });
    return { provider, content: response.choices[0]?.message?.content ?? "No response", responseTime: Date.now() - start };
  } catch (err) {
    return { provider, content: "", responseTime: Date.now() - start, error: err instanceof Error ? `${cfg.name}: ${err.message}` : `${cfg.name} error` };
  }
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
  return [await CALLERS[provider](message, personalizationHint)];
}

export async function chatBattle(message: string): Promise<AiResponse[]> {
  return Promise.all(activeProviders().map((p) => CALLERS[p](message)));
}

export async function chatHive(message: string): Promise<{ responses: AiResponse[]; combined: string }> {
  const responses = await Promise.all(activeProviders().map((p) => CALLERS[p](message)));
  const validResponses = responses.filter(r => !r.error && r.content);
  const NAMES: Record<string, string> = { openai: "ChatGPT", claude: "Claude", perplexity: "Perplexity", ...Object.fromEntries(Object.entries(COMPAT).map(([k, v]) => [k, v.name])) };

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
    if (isCompat(provider)) {
      const cfg = COMPAT[provider];
      const compat = getCompat(provider);
      if (!compat) return { provider, content: "", responseTime: 0, error: `${cfg.name} isn't connected yet. Add ${cfg.envKey} on the server.` };
      const response = await compat.chat.completions.create({ model: compatModel(provider), messages: [{ role: "system", content: system }, ...turns] });
      return { provider, content: response.choices[0]?.message?.content ?? "", responseTime: Date.now() - start };
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
