import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { openai, isOpenAIConfigured } from "@workspace/integrations-openai-ai-server";
import { openRouterClient, openRouterModel } from "./openRouter";
import { askFree, freePoolConfigured } from "./freeModels";

// Real provider clients. Each is created on first use, so the server starts without keys;
// a provider with no key answers with a clear "not connected" error instead of pretending.
// A person's own key (from Connectors) gets a client of its own; otherwise the server's shared client is used.
let anthropicClient: Anthropic | null = null;
function getAnthropic(userKey?: string): Anthropic | null {
  if (userKey) return new Anthropic({ apiKey: userKey });
  if (!process.env.ANTHROPIC_API_KEY) return null;
  anthropicClient ??= new Anthropic();
  return anthropicClient;
}

function getOpenAI(userKey?: string): OpenAI | null {
  if (userKey) return new OpenAI({ apiKey: userKey });
  return isOpenAIConfigured() ? openai : null;
}

let perplexityClient: OpenAI | null = null;
function getPerplexity(userKey?: string): OpenAI | null {
  if (userKey) return new OpenAI({ apiKey: userKey, baseURL: "https://api.perplexity.ai" });
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
function getCompat(p: CompatProvider, userKey?: string): OpenAI | null {
  const cfg = COMPAT[p];
  if (userKey) return new OpenAI({ apiKey: userKey, baseURL: cfg.baseURL });
  const apiKey = process.env[cfg.envKey];
  if (!apiKey) return null;
  compatClients[p] ??= new OpenAI({ apiKey, baseURL: cfg.baseURL });
  return compatClients[p]!;
}
const compatModel = (p: CompatProvider) => process.env[COMPAT[p].modelEnv] || COMPAT[p].model;

/** Which chat providers can answer: the server has a key, or this person linked their own. */
export function providerStatus(keys?: UserKeys): Record<AiProvider, boolean> {
  const server: Record<AiProvider, boolean> = {
    openai:     isOpenAIConfigured(),
    claude:     !!process.env.ANTHROPIC_API_KEY,
    perplexity: !!process.env.PERPLEXITY_API_KEY,
    gemini:     !!process.env.GEMINI_API_KEY,
    grok:       !!process.env.XAI_API_KEY,
    deepseek:   !!process.env.DEEPSEEK_API_KEY,
    mistral:    !!process.env.MISTRAL_API_KEY,
    llama:      !!process.env.GROQ_API_KEY,
    free:       freePoolConfigured(),
  };
  if (!keys) return server;
  return Object.fromEntries(AI_PROVIDERS.map((p) => [p, server[p] || hasOwnKey(keys, p)])) as Record<AiProvider, boolean>;
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

/** "free" is Apex Free: a pool of free models, each with its own daily limit (lib/freeModels.ts) */
export type AiProvider = "openai" | "claude" | "perplexity" | CompatProvider | "free";
export const AI_PROVIDERS: AiProvider[] = ["openai", "claude", "perplexity", "gemini", "grok", "deepseek", "mistral", "llama", "free"];

export interface AiResponse {
  provider: AiProvider | "hive";
  content: string;
  responseTime: number;
  error?: string;
  /** Answered with the person's own linked key (costs them no credits) */
  ownKey?: boolean;
  /** The exact model that answered, when the provider picks one (Apex Free) */
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** A person's own API keys from Connectors, by provider. `openrouter` covers every provider. */
export type UserKeys = Partial<Record<AiProvider | "openrouter", string>>;

/** Whether this provider would run on the person's own account (a direct key or OpenRouter). */
export function hasOwnKey(keys: UserKeys | undefined, provider: string): boolean {
  // Apex Free always runs on the app's free keys, never on a person's account
  if (provider === "free") return false;
  return !!keys && (!!keys[provider as AiProvider] || (!!keys.openrouter && (AI_PROVIDERS as string[]).includes(provider)));
}

const SYSTEM_BY_PROVIDER: Record<AiProvider, string> = {
  openai: "You are Apex, an intelligent AI assistant. Be helpful, concise, and accurate.",
  claude: "You are Apex (Claude mode) — thoughtful, analytical, great at nuanced reasoning and long-form writing. Provide detailed, well-structured responses.",
  perplexity: "You are Apex (Research mode) — specialized in factual information, current events, and research. Provide accurate, well-cited reasoning with clarity.",
  gemini: "You are Apex (Gemini mode), a helpful AI assistant. Be clear, accurate and friendly.",
  grok: "You are Apex (Grok mode), a helpful AI assistant. Be clear, accurate and friendly.",
  deepseek: "You are Apex (DeepSeek mode), a helpful AI assistant. Be clear, accurate and friendly.",
  mistral: "You are Apex (Mistral mode), a helpful AI assistant. Be clear, accurate and friendly.",
  llama: "You are Apex (Llama mode), a helpful AI assistant. Be clear, accurate and friendly.",
  free: "You are Apex, a helpful AI assistant. Be clear, accurate and friendly.",
};

/** Ask a provider's model through the person's OpenRouter account. */
async function callViaOpenRouter(provider: AiProvider, key: string, system: string, turns: ChatTurn[]): Promise<AiResponse> {
  const start = Date.now();
  try {
    const response = await openRouterClient(key).chat.completions.create({
      model: await openRouterModel(provider),
      messages: [{ role: "system", content: system }, ...turns],
    });
    return { provider, content: response.choices[0]?.message?.content ?? "No response", responseTime: Date.now() - start, ownKey: true, ...oaiTokens(response.usage) };
  } catch (err) {
    return { provider, content: "", responseTime: Date.now() - start, error: err instanceof Error ? `OpenRouter: ${err.message}` : "OpenRouter error" };
  }
}

/** One message to a provider: the person's direct key, then their OpenRouter account, then the server's key. */
function ask(provider: AiProvider, message: string, hint: string | undefined, keys: UserKeys | undefined): Promise<AiResponse> {
  if (provider !== "free" && !keys?.[provider] && keys?.openrouter) {
    const base = `${SYSTEM_BY_PROVIDER[provider]}\n\n${HUMAN_VOICE_RULES}`;
    return callViaOpenRouter(provider, keys.openrouter, hint ? `${base}\n${hint}` : base, [{ role: "user", content: message }]);
  }
  return CALLERS[provider](message, hint, keys?.[provider]);
}

type Usage = { prompt_tokens?: number; completion_tokens?: number } | null | undefined;
const oaiTokens = (u: Usage) => ({ inputTokens: u?.prompt_tokens ?? 0, outputTokens: u?.completion_tokens ?? 0 });

const FREE_TIER_LIMIT = 20;
const PREMIUM_TIER_LIMIT = 500;

export function getTierLimit(tier: string): number {
  return tier === "premium" ? PREMIUM_TIER_LIMIT : FREE_TIER_LIMIT;
}

function routeToProvider(message: string, preferredProvider?: string, keys?: UserKeys): AiProvider {
  if (preferredProvider && preferredProvider !== "auto" && (AI_PROVIDERS as string[]).includes(preferredProvider)) {
    return preferredProvider as AiProvider;
  }

  const lower = message.toLowerCase();

  const factualKeywords = ["news", "latest", "current", "today", "price", "stock", "weather", "fact", "who is", "when did", "where is", "what is the current"];
  const isFactual = factualKeywords.some(k => lower.includes(k));

  const complexKeywords = ["explain", "analyze", "compare", "write", "essay", "code", "implement", "design", "architecture", "detailed", "thorough"];
  const isComplex = complexKeywords.some(k => lower.includes(k));

  const ideal: AiProvider = isFactual ? "perplexity" : isComplex ? "claude" : "openai";
  // The person's own keys come first (they cost the app nothing), then connected providers
  if (hasOwnKey(keys, ideal)) return ideal;
  const own = AI_PROVIDERS.find((p) => keys?.[p]);
  if (own) return own;
  const status = providerStatus();
  if (status[ideal]) return ideal;
  // Free models before any other paid model
  if (status.free) return "free";
  return (Object.keys(status) as AiProvider[]).find((p) => status[p]) ?? ideal;
}

const CALLERS: Record<AiProvider, (message: string, hint?: string, key?: string) => Promise<AiResponse>> = {
  openai:     (m, h, k) => callOpenAI(m, h, k),
  claude:     (m, h, k) => callClaude(m, h, k),
  perplexity: (m, h, k) => callPerplexity(m, h, k),
  gemini:     (m, h, k) => callCompat("gemini", m, h, k),
  grok:       (m, h, k) => callCompat("grok", m, h, k),
  deepseek:   (m, h, k) => callCompat("deepseek", m, h, k),
  mistral:    (m, h, k) => callCompat("mistral", m, h, k),
  llama:      (m, h, k) => callCompat("llama", m, h, k),
  free:       (m, h) => callFree([{ role: "user", content: m }], h ? `${SYSTEM_BY_PROVIDER.free}\n\n${HUMAN_VOICE_RULES}\n${h}` : `${SYSTEM_BY_PROVIDER.free}\n\n${HUMAN_VOICE_RULES}`),
};

/** Apex Free: the best free model with room today (see lib/freeModels.ts). */
async function callFree(turns: ChatTurn[], system: string): Promise<AiResponse> {
  const start = Date.now();
  try {
    const r = await askFree([{ role: "system", content: system }, ...turns]);
    return { provider: "free", content: r.content, model: r.model, responseTime: Date.now() - start, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
  } catch (err) {
    return { provider: "free", content: "", responseTime: Date.now() - start, error: err instanceof Error ? err.message : "Apex Free error" };
  }
}

// Battle and Hive use every connected provider (the original three if none are, so the errors explain why)
function activeProviders(keys?: UserKeys): AiProvider[] {
  const status = providerStatus(keys);
  const connected = AI_PROVIDERS.filter((p) => status[p]);
  return connected.length ? connected : ["openai", "claude", "perplexity"];
}

async function callCompat(provider: CompatProvider, message: string, personalizationHint?: string, userKey?: string): Promise<AiResponse> {
  const start = Date.now();
  const cfg = COMPAT[provider];
  const client = getCompat(provider, userKey);
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
    return { provider, content: response.choices[0]?.message?.content ?? "No response", responseTime: Date.now() - start, ownKey: !!userKey, ...oaiTokens(response.usage) };
  } catch (err) {
    return { provider, content: "", responseTime: Date.now() - start, error: err instanceof Error ? `${cfg.name}: ${err.message}` : `${cfg.name} error` };
  }
}

async function callOpenAI(message: string, personalizationHint?: string, userKey?: string): Promise<AiResponse> {
  const start = Date.now();
  const client = getOpenAI(userKey);
  if (!client) {
    return { provider: "openai", content: "", responseTime: 0, error: "ChatGPT isn't connected yet. Add OPENAI_API_KEY on the server." };
  }
  const baseSystem = `You are Apex, an intelligent AI assistant. Be helpful, concise, and accurate.\n\n${HUMAN_VOICE_RULES}`;
  const systemContent = personalizationHint ? `${baseSystem}\n${personalizationHint}` : baseSystem;
  try {
    const response = await client.chat.completions.create({
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
      ownKey: !!userKey,
      ...oaiTokens(response.usage),
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

async function callClaude(message: string, personalizationHint?: string, userKey?: string): Promise<AiResponse> {
  const start = Date.now();
  const baseSystem = `You are Apex (Claude mode) — thoughtful, analytical, great at nuanced reasoning and long-form writing. Provide detailed, well-structured responses.\n\n${HUMAN_VOICE_RULES}`;
  const systemContent = personalizationHint ? `${baseSystem}\n${personalizationHint}` : baseSystem;
  const client = getAnthropic(userKey);
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
    return { provider: "claude", content: content || "No response", responseTime: Date.now() - start, ownKey: !!userKey, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  } catch (err) {
    return {
      provider: "claude",
      content: "",
      responseTime: Date.now() - start,
      error: err instanceof Anthropic.APIError ? `Claude error ${err.status ?? ""}: ${err.message}`.trim() : err instanceof Error ? err.message : "Claude error",
    };
  }
}

async function callPerplexity(message: string, personalizationHint?: string, userKey?: string): Promise<AiResponse> {
  const start = Date.now();
  const baseSystem = `You are Apex (Research mode) — specialized in factual information, current events, and research. Provide accurate, well-cited reasoning with clarity.\n\n${HUMAN_VOICE_RULES}`;
  const systemContent = personalizationHint ? `${baseSystem}\n${personalizationHint}` : baseSystem;
  const client = getPerplexity(userKey);
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
      ownKey: !!userKey,
      ...oaiTokens(response.usage),
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

/** The provider a message would go to, so the caller can check credits before asking it. */
export function pickProvider(message: string, preferredProvider?: string, keys?: UserKeys): AiProvider {
  return routeToProvider(message, preferredProvider, keys);
}

/** The providers Battle and Hive would ask. */
export function battleProviders(keys?: UserKeys): AiProvider[] {
  return activeProviders(keys);
}

export async function chatSingle(message: string, preferredProvider?: string, personalizationHint?: string, keys?: UserKeys): Promise<AiResponse[]> {
  const provider = routeToProvider(message, preferredProvider, keys);
  return [await ask(provider, message, personalizationHint, keys)];
}

export async function chatBattle(message: string, keys?: UserKeys): Promise<AiResponse[]> {
  return Promise.all(activeProviders(keys).map((p) => ask(p, message, undefined, keys)));
}

export async function chatHive(message: string, keys?: UserKeys): Promise<{ responses: AiResponse[]; combined: string }> {
  const responses = await Promise.all(activeProviders(keys).map((p) => ask(p, message, undefined, keys)));
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
  keys?: UserKeys,
): Promise<AiResponse> {
  const provider = routeToProvider(message, preferred === "auto" ? undefined : preferred, keys);
  const userKey = keys?.[provider];
  const ownKey = !!userKey;
  const start = Date.now();
  const turns = [...history, { role: "user" as const, content: message }];
  if (provider === "free") return callFree(turns, system);
  if (!userKey && keys?.openrouter) return callViaOpenRouter(provider, keys.openrouter, system, turns);
  try {
    if (provider === "claude") {
      const client = getAnthropic(userKey);
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
      return { provider, content, responseTime: Date.now() - start, ownKey, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
    }
    if (isCompat(provider)) {
      const cfg = COMPAT[provider];
      const compat = getCompat(provider, userKey);
      if (!compat) return { provider, content: "", responseTime: 0, error: `${cfg.name} isn't connected yet. Add ${cfg.envKey} on the server.` };
      const response = await compat.chat.completions.create({ model: compatModel(provider), messages: [{ role: "system", content: system }, ...turns] });
      return { provider, content: response.choices[0]?.message?.content ?? "", responseTime: Date.now() - start, ownKey, ...oaiTokens(response.usage) };
    }
    const client = provider === "perplexity" ? getPerplexity(userKey) : getOpenAI(userKey);
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
    return { provider, content: response.choices[0]?.message?.content ?? "", responseTime: Date.now() - start, ownKey, ...oaiTokens(response.usage) };
  } catch (err) {
    const msg = err instanceof Anthropic.APIError ? `Claude error ${err.status ?? ""}: ${err.message}` : err instanceof Error ? err.message : "AI error";
    return { provider, content: "", responseTime: Date.now() - start, error: msg };
  }
}
