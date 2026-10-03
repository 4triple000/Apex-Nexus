/**
 * OpenRouter — one sign-in that gives Apex access to ChatGPT, Claude, Gemini, Grok, Llama and more,
 * billed to the person's own OpenRouter credits.
 *
 * Linking uses OpenRouter's PKCE sign-in, which needs no app registration from the owner:
 *   1. Send the person to openrouter.ai/auth with a code challenge
 *   2. OpenRouter sends them back with a code
 *   3. Trade the code (plus the verifier) for an API key that belongs to them
 *
 * OpenRouter's model names change over time, so the model for each provider is looked up from its
 * public model list (cached) instead of being hard-coded. OPENROUTER_MODEL_<PROVIDER> overrides it.
 */
import OpenAI from "openai";
import { createHash, randomBytes } from "node:crypto";
import type { AiProvider } from "./aiRouter";
import { logger } from "./logger";

const API = "https://openrouter.ai/api/v1";

// ── Sign-in (PKCE) ────────────────────────────────────────────────────────────

export function newPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function openRouterAuthUrl(callbackUrl: string, challenge: string): string {
  const params = new URLSearchParams({ callback_url: callbackUrl, code_challenge: challenge, code_challenge_method: "S256" });
  return `https://openrouter.ai/auth?${params}`;
}

/** Trade the sign-in code for the person's own API key. */
export async function exchangeOpenRouterCode(code: string, verifier: string): Promise<string> {
  const res = await fetch(`${API}/auth/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
  });
  const data = (await res.json().catch(() => ({}))) as { key?: string; error?: { message?: string } | string };
  if (!res.ok || !data.key) {
    const msg = typeof data.error === "string" ? data.error : data.error?.message;
    throw new Error(msg ?? `OpenRouter answered ${res.status}`);
  }
  return data.key;
}

// ── Picking the model for each provider ───────────────────────────────────────

/** Preferred models first (exact ids), then the newest model whose id matches the pattern. */
const WANTED: Record<AiProvider, { prefer: string[]; pattern: RegExp }> = {
  claude:     { prefer: ["anthropic/claude-opus-5.5", "anthropic/claude-sonnet-5.5", "anthropic/claude-opus-5"], pattern: /^anthropic\/claude-(opus|sonnet)-[\d.]+$/ },
  openai:     { prefer: ["openai/gpt-5.2", "openai/gpt-5.1", "openai/gpt-5"], pattern: /^openai\/gpt-5(\.\d+)?$/ },
  gemini:     { prefer: ["google/gemini-2.5-flash"], pattern: /^google\/gemini-[\d.]+-flash$/ },
  grok:       { prefer: ["x-ai/grok-4"], pattern: /^x-ai\/grok-\d+(\.\d+)?$/ },
  deepseek:   { prefer: ["deepseek/deepseek-chat"], pattern: /^deepseek\/deepseek-(chat|v\d)/ },
  mistral:    { prefer: ["mistralai/mistral-large"], pattern: /^mistralai\/mistral-large/ },
  llama:      { prefer: ["meta-llama/llama-3.3-70b-instruct"], pattern: /^meta-llama\/llama-[\d.]+-70b-instruct$/ },
  perplexity: { prefer: ["perplexity/sonar-pro"], pattern: /^perplexity\/sonar(-pro)?$/ },
  free:       { prefer: ["meta-llama/llama-3.3-70b-instruct:free"], pattern: /:free$/ },
};

let cache: { at: number; models: { id: string; created: number }[] } | null = null;

async function modelList(): Promise<{ id: string; created: number }[]> {
  if (cache && Date.now() - cache.at < 12 * 3_600_000) return cache.models;
  try {
    const res = await fetch(`${API}/models`);
    const json = (await res.json()) as { data?: { id: string; created?: number }[] };
    const models = (json.data ?? []).map((m) => ({ id: m.id, created: m.created ?? 0 }));
    if (models.length) cache = { at: Date.now(), models };
    return models;
  } catch (err) {
    logger.warn({ err }, "OpenRouter model list unavailable");
    return cache?.models ?? [];
  }
}

export async function openRouterModel(provider: AiProvider): Promise<string> {
  const override = process.env[`OPENROUTER_MODEL_${provider.toUpperCase()}`];
  if (override) return override;
  const wanted = WANTED[provider];
  const models = await modelList();
  const ids = new Set(models.map((m) => m.id));
  const exact = wanted.prefer.find((id) => ids.has(id));
  if (exact) return exact;
  const newest = models.filter((m) => wanted.pattern.test(m.id)).sort((a, b) => b.created - a.created)[0];
  return newest?.id ?? wanted.prefer[0]!;
}

/**
 * OpenRouter's free models (ids ending in ":free"), strongest first. The free line-up changes often,
 * so it's read from the live model list instead of being hard-coded.
 */
export async function openRouterFreeModels(): Promise<string[]> {
  const rank = (id: string) => (/deepseek|gpt-oss-120b|qwen3-235b|llama-3\.3-70b|llama-4/.test(id) ? 0 : /70b|72b|32b|27b|24b/.test(id) ? 1 : 2);
  return (await modelList())
    .filter((m) => m.id.endsWith(":free"))
    .sort((a, b) => rank(a.id) - rank(b.id) || b.created - a.created)
    .map((m) => m.id);
}

// ── Asking a model through OpenRouter ─────────────────────────────────────────

export function openRouterClient(key: string): OpenAI {
  return new OpenAI({
    apiKey: key,
    baseURL: API,
    defaultHeaders: { "HTTP-Referer": "https://apex-nexus-apex.vercel.app", "X-Title": "Apex" },
  });
}
