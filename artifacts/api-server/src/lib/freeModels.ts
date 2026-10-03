/**
 * Apex Free — a pool of free AI models, each with its own daily limit.
 *
 * Instead of one shared quota, every free model (Groq, Cerebras and GitHub Models give each model its own
 * allowance) is counted separately. A message goes to the best model that still has room today; if a
 * provider says "limit reached" anyway, Apex moves on to the next model, so the person never sees it.
 * OpenRouter's free models share one account-wide limit, so they're counted as a group and tried last.
 *
 * Keys (server environment):
 *   GROQ_API_KEY            console.groq.com/keys (no card needed)
 *   CEREBRAS_API_KEY        cloud.cerebras.ai
 *   GITHUB_MODELS_TOKEN     a GitHub token with the "models: read" permission
 *   OPENROUTER_API_KEY      openrouter.ai/keys (optional backup)
 *
 * Tuning:
 *   APEX_FREE_PER_USER_DAILY=200   free messages one person can send per day (-1 = no limit)
 *   OPENROUTER_FREE_DAILY_LIMIT=50 OpenRouter's shared free limit (1000 after a one-time $10 top-up)
 *
 * Limits are the providers' published free-tier numbers. If a provider lowers them, the "limit reached"
 * answer still moves the message to the next model.
 */
import OpenAI from "openai";
import { db, freeModelUsageTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { openRouterFreeModels } from "./openRouter";

/** The provider's model name; OpenRouter's "#n" means the n-th best free model right now. */
async function modelName(m: FreeModel): Promise<string | null> {
  if (m.host !== "openrouter") return m.model;
  const free = await openRouterFreeModels();
  return free[Number(m.model.slice(1)) - 1] ?? null;
}

type Host = "groq" | "cerebras" | "github" | "openrouter";

const HOSTS: Record<Host, { name: string; baseURL: string; envKey: string; headers?: Record<string, string> }> = {
  groq: { name: "Groq", baseURL: "https://api.groq.com/openai/v1", envKey: "GROQ_API_KEY" },
  cerebras: { name: "Cerebras", baseURL: "https://api.cerebras.ai/v1", envKey: "CEREBRAS_API_KEY" },
  github: { name: "GitHub Models", baseURL: "https://models.github.ai/inference", envKey: "GITHUB_MODELS_TOKEN" },
  openrouter: {
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    headers: { "HTTP-Referer": "https://apex-nexus-apex.vercel.app", "X-Title": "Apex" },
  },
};

interface FreeModel {
  id: string;
  name: string;
  host: Host;
  /** The provider's model name */
  model: string;
  /** Requests per minute, per day, and tokens per day (null = no published limit) */
  rpm: number;
  rpd: number | null;
  tpd: number | null;
  /** Models that share one limit instead of having their own */
  group?: string;
}

const envInt = (key: string, fallback: number) => {
  const n = parseInt(process.env[key] ?? "", 10);
  return Number.isNaN(n) ? fallback : n;
};

/** In order of preference: the strongest models first, the small fast ones as backup. */
export const FREE_MODELS: FreeModel[] = [
  { id: "cerebras-gpt-oss-120b", name: "GPT-OSS 120B", host: "cerebras", model: "gpt-oss-120b", rpm: 5, rpd: null, tpd: 1_000_000 },
  { id: "groq-gpt-oss-120b", name: "GPT-OSS 120B", host: "groq", model: "openai/gpt-oss-120b", rpm: 30, rpd: 1000, tpd: 200_000 },
  { id: "github-gpt-4.1", name: "GPT-4.1", host: "github", model: "openai/gpt-4.1", rpm: 10, rpd: 50, tpd: null },
  { id: "cerebras-qwen-3-235b", name: "Qwen3 235B", host: "cerebras", model: "qwen-3-235b-a22b-instruct-2507", rpm: 5, rpd: null, tpd: 1_000_000 },
  { id: "groq-llama-3.3-70b", name: "Llama 3.3 70B", host: "groq", model: "llama-3.3-70b-versatile", rpm: 30, rpd: 1000, tpd: 100_000 },
  { id: "cerebras-llama-3.3-70b", name: "Llama 3.3 70B", host: "cerebras", model: "llama-3.3-70b", rpm: 5, rpd: null, tpd: 1_000_000 },
  { id: "github-gpt-4.1-mini", name: "GPT-4.1 mini", host: "github", model: "openai/gpt-4.1-mini", rpm: 15, rpd: 150, tpd: null },
  { id: "groq-gpt-oss-20b", name: "GPT-OSS 20B", host: "groq", model: "openai/gpt-oss-20b", rpm: 30, rpd: 1000, tpd: 200_000 },
  { id: "groq-llama-3.1-8b", name: "Llama 3.1 8B", host: "groq", model: "llama-3.1-8b-instant", rpm: 30, rpd: 14_400, tpd: 500_000 },
  // OpenRouter's free line-up changes often: these pick the 1st and 2nd best free model from its live list
  { id: "openrouter-free-1", name: "Best free model", host: "openrouter", model: "#1", rpm: 20, rpd: null, tpd: null, group: "openrouter-free" },
  { id: "openrouter-free-2", name: "Next free model", host: "openrouter", model: "#2", rpm: 20, rpd: null, tpd: null, group: "openrouter-free" },
];

const GROUP_RPD: Record<string, () => number> = {
  "openrouter-free": () => envInt("OPENROUTER_FREE_DAILY_LIMIT", 50),
};

const hostReady = (h: Host) => !!process.env[HOSTS[h].envKey];

/** Whether any free model can answer (at least one free provider has a key). */
export function freePoolConfigured(): boolean {
  return FREE_MODELS.some((m) => hostReady(m.host));
}

// ── Counting ─────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);
const msToMidnightUtc = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - d.getTime();
};

/** Today's counts, loaded from the database once per day and kept in memory (one server instance). */
let counts: { day: string; rows: Map<string, { requests: number; tokens: number }> } | null = null;
let loading: Promise<void> | null = null;

async function load(): Promise<Map<string, { requests: number; tokens: number }>> {
  const day = today();
  if (counts?.day === day) return counts.rows;
  loading ??= (async () => {
    const rows = new Map<string, { requests: number; tokens: number }>();
    try {
      const saved = await db.select().from(freeModelUsageTable).where(eq(freeModelUsageTable.day, day));
      for (const r of saved) rows.set(r.key, { requests: r.requests, tokens: r.tokens });
    } catch (err) {
      logger.warn({ err }, "Couldn't load free model usage; starting from zero");
    }
    counts = { day, rows };
  })().finally(() => { loading = null; });
  await loading;
  return counts!.rows;
}

function bump(key: string, tokens: number) {
  const day = counts!.day;
  const row = counts!.rows.get(key) ?? { requests: 0, tokens: 0 };
  row.requests += 1;
  row.tokens += tokens;
  counts!.rows.set(key, row);
  void db
    .insert(freeModelUsageTable)
    .values({ day, key, requests: 1, tokens })
    .onConflictDoUpdate({
      target: [freeModelUsageTable.day, freeModelUsageTable.key],
      set: { requests: sql`${freeModelUsageTable.requests} + 1`, tokens: sql`${freeModelUsageTable.tokens} + ${tokens}`, updatedAt: new Date() },
    })
    .catch((err) => logger.warn({ err, key }, "Couldn't save free model usage"));
}

/** Requests in the last minute, per model (memory only). */
const recent = new Map<string, number[]>();
function minuteCount(id: string): number {
  const now = Date.now();
  const list = (recent.get(id) ?? []).filter((t) => now - t < 60_000);
  recent.set(id, list);
  return list.length;
}

/** Models a provider said were busy or used up, until this time (ms). */
const coolUntil = new Map<string, number>();
const why = new Map<string, string>();

function cool(id: string, ms: number, reason: string) {
  coolUntil.set(id, Date.now() + ms);
  why.set(id, reason);
}

type Status = "ready" | "used-up" | "busy" | "off";

function statusOf(m: FreeModel, rows: Map<string, { requests: number; tokens: number }>): Status {
  if (!hostReady(m.host)) return "off";
  const until = coolUntil.get(m.id) ?? 0;
  if (until > Date.now()) return why.get(m.id) === "used-up" ? "used-up" : "busy";
  const used = rows.get(`model:${m.id}`) ?? { requests: 0, tokens: 0 };
  if (m.rpd !== null && used.requests >= m.rpd) return "used-up";
  if (m.tpd !== null && used.tokens >= m.tpd) return "used-up";
  if (m.group) {
    const g = rows.get(`group:${m.group}`)?.requests ?? 0;
    if (g >= (GROUP_RPD[m.group]?.() ?? Infinity)) return "used-up";
  }
  if (minuteCount(m.id) >= m.rpm) return "busy";
  return "ready";
}

// ── Per-person daily allowance ───────────────────────────────────────────────

const perUserDaily = () => envInt("APEX_FREE_PER_USER_DAILY", 200);

/** How many free messages this person has left today (null = no limit). */
export async function freeLeftFor(userId: number, isOwner = false): Promise<number | null> {
  const cap = perUserDaily();
  if (isOwner || cap < 0) return null;
  const rows = await load();
  return Math.max(0, cap - (rows.get(`user:${userId}`)?.requests ?? 0));
}

/** Count one free message for a person (called when a free reply is recorded). */
export async function noteFreeUse(userId: number): Promise<void> {
  await load();
  bump(`user:${userId}`, 0);
}

// ── Asking ───────────────────────────────────────────────────────────────────

const clients = new Map<Host, OpenAI>();
function client(h: Host): OpenAI {
  let c = clients.get(h);
  if (!c) {
    // APEX_FREE_<HOST>_URL points a provider somewhere else (tests, or a proxy)
    const baseURL = process.env[`APEX_FREE_${h.toUpperCase()}_URL`] || HOSTS[h].baseURL;
    c = new OpenAI({ apiKey: process.env[HOSTS[h].envKey], baseURL, defaultHeaders: HOSTS[h].headers, maxRetries: 0, timeout: 25_000 });
    clients.set(h, c);
  }
  return c;
}

export interface FreeReply {
  content: string;
  /** e.g. "Llama 3.3 70B · Groq" */
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** After a failed request, decide how long to skip this model (or its whole provider). */
function handleFailure(m: FreeModel, err: unknown) {
  const status = err instanceof OpenAI.APIError ? err.status : undefined;
  const text = err instanceof Error ? err.message.toLowerCase() : "";
  if (status === 429) {
    // A daily limit lasts until the provider's reset; a per-minute one clears quickly
    const daily = /per day|daily|rpd|tpd|tokens per day|requests per day|quota/.test(text);
    const retryAfter = err instanceof OpenAI.APIError ? Number(err.headers?.get?.("retry-after")) : NaN;
    if (daily) cool(m.id, msToMidnightUtc(), "used-up");
    else cool(m.id, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 60_000, "busy");
  } else if (status === 401 || status === 403) {
    // The key is wrong or lacks permission: skip every model on this provider for a while
    for (const other of FREE_MODELS) if (other.host === m.host) cool(other.id, 10 * 60_000, "busy");
  } else if (status === 404 || status === 400) {
    // The provider retired or renamed this model
    cool(m.id, 6 * 60 * 60_000, "busy");
  } else {
    cool(m.id, 2 * 60_000, "busy");
  }
  logger.warn({ model: m.id, status, err: text.slice(0, 200) }, "Free model failed; trying the next one");
}

/**
 * Answer with the best free model that has room, falling through to the next on any failure.
 * Throws a friendly error when every free model is used up or busy.
 */
export async function askFree(messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<FreeReply> {
  const rows = await load();
  const candidates = FREE_MODELS.filter((m) => statusOf(m, rows) === "ready");
  if (!freePoolConfigured()) throw new Error("Apex Free isn't set up yet. Add a free key (GROQ_API_KEY, CEREBRAS_API_KEY or GITHUB_MODELS_TOKEN) on the server.");
  if (!candidates.length) {
    const allUsedUp = FREE_MODELS.every((m) => ["used-up", "off"].includes(statusOf(m, rows)));
    throw new Error(allUsedUp
      ? "All free models are used up for today. They reset at midnight UTC. Pick another model to keep chatting."
      : "The free models are busy right now. Try again in a minute, or pick another model.");
  }

  for (const m of candidates.slice(0, 5)) {
    // Recheck: an earlier failure in this loop may have paused the whole provider
    if (statusOf(m, rows) !== "ready") continue;
    const model = await modelName(m);
    if (!model) continue;
    recent.set(m.id, [...(recent.get(m.id) ?? []), Date.now()]);
    try {
      const res = await client(m.host).chat.completions.create({ model, messages, max_tokens: 4096 });
      const content = res.choices[0]?.message?.content ?? "";
      if (!content.trim()) throw new Error("empty reply");
      const inputTokens = res.usage?.prompt_tokens ?? 0;
      const outputTokens = res.usage?.completion_tokens ?? 0;
      bump(`model:${m.id}`, inputTokens + outputTokens);
      if (m.group) bump(`group:${m.group}`, 0);
      const label = m.host === "openrouter" ? model.replace(/:free$/, "").split("/").pop()! : m.name;
      return { content, model: `${label} · ${HOSTS[m.host].name}`, inputTokens, outputTokens };
    } catch (err) {
      handleFailure(m, err);
    }
  }
  throw new Error("The free models are busy right now. Try again in a minute, or pick another model.");
}

/** Every free model and how much of today's allowance is left, for the app's "Free models" list. */
export async function freePoolStatus() {
  const rows = await load();
  return {
    configured: freePoolConfigured(),
    resetsInMs: msToMidnightUtc(),
    perUserDaily: perUserDaily() < 0 ? null : perUserDaily(),
    models: FREE_MODELS.map((m) => {
      const used = rows.get(`model:${m.id}`) ?? { requests: 0, tokens: 0 };
      const groupUsed = m.group ? rows.get(`group:${m.group}`)?.requests ?? 0 : null;
      return {
        id: m.id,
        name: m.name,
        provider: HOSTS[m.host].name,
        status: statusOf(m, rows),
        requestsToday: m.group ? groupUsed : used.requests,
        requestLimit: m.group ? GROUP_RPD[m.group]?.() ?? null : m.rpd,
        tokensToday: used.tokens,
        tokenLimit: m.tpd,
        shared: !!m.group,
      };
    }),
  };
}
