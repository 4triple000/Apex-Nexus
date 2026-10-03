/**
 * Apex's helpers inside Social: drafting posts, answering questions, summing up debates.
 *
 * Nothing here posts on anyone's behalf. Each helper returns text the person reviews first;
 * they choose to post it or not. Answers that will show with the Apex label are signed
 * (`signAnswer`) so a post can only claim "Answered by Apex" for text Apex really wrote.
 *
 * Social helpers use the cheapest connected model: the person's own linked key if they have one
 * (free for them), else the lowest-priced model the server has a key for. Each call costs that
 * model's usual credits.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { freeLeftFor } from "./freeModels";
import { AI_PROVIDERS, chatWithHistory, hasOwnKey, providerStatus, type AiProvider } from "./aiRouter";
import { canSpend, creditCost, creditUserFor, getBalance, outOfCredits, recordUsage, type CreditBalance } from "./credits";
import { getUserKeys } from "./connectors";

const CHEAP_FIRST: AiProvider[] = ["llama", "deepseek", "gemini", "mistral", "openai", "grok", "claude", "perplexity"];

export type AskResult =
  | { ok: true; text: string; credits: CreditBalance }
  | { ok: false; status: number; body: Record<string, unknown> };

export const SOCIAL_RULES = `You are Apex, the assistant inside the Apex Nexus social app.
Write like a friendly person, never like a corporate assistant. Keep it short and plain.
Never invent facts about real people. Refuse anything hateful, sexual, violent or harassing.
Write plain text only: no markdown headings, no asterisks.`;

/** Ask the cheapest available model, after checking (and then charging) the person's credits. */
export async function askApex(userId: number, system: string, prompt: string): Promise<AskResult> {
  const who = await creditUserFor(userId);
  if (!who) return { ok: false, status: 401, body: { ok: false, error: "Please sign in again." } };
  const keys = await getUserKeys(userId);
  const status = providerStatus(keys);
  const own = CHEAP_FIRST.find((p) => hasOwnKey(keys, p));
  // Free models first (no credits) while this person has free messages left today
  const freeOk = status.free && (await freeLeftFor(userId, who.isOwner)) !== 0;
  const provider = own ?? (freeOk ? "free" : CHEAP_FIRST.find((p) => status[p] && AI_PROVIDERS.includes(p)));
  if (!provider) return { ok: false, status: 503, body: { ok: false, error: "Apex's AI isn't set up on the server yet." } };

  const needed = own ? 0 : creditCost(provider);
  const check = await canSpend(who, needed);
  if (!check.ok) return { ok: false, status: 429, body: outOfCredits(check.balance, needed) };

  const r = await chatWithHistory(provider, `${SOCIAL_RULES}\n\n${system}`, [], prompt, keys);
  if (r.error || !r.content.trim()) return { ok: false, status: 502, body: { ok: false, error: r.error || "Apex didn't have an answer. Try again." } };
  await recordUsage(who, { provider: r.provider as AiProvider, ownKey: r.ownKey, inputTokens: r.inputTokens, outputTokens: r.outputTokens }).catch(() => undefined);
  return { ok: true, text: tidy(r.content), credits: await getBalance(who) };
}

/** Strip markdown the model adds anyway, and keep it to a post-sized length. */
export function tidy(text: string, max = 1800): string {
  const t = text.replace(/^#+\s*/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/^\s*[-*]\s+/gm, "• ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** First JSON object in a model reply, or null. */
export function jsonIn<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

// ── Signing answers ───────────────────────────────────────────────────────────

const secret = () => process.env.SESSION_SECRET || "apex-dev-secret";

/** A token proving Apex wrote `answer` for this person and question. */
export function signAnswer(userId: number, question: string, answer: string): string {
  return createHmac("sha256", secret()).update(`social-ai|${userId}|${question}|${answer}`).digest("base64url");
}

export function checkAnswer(userId: number, question: string, answer: string, token: string): boolean {
  const want = Buffer.from(signAnswer(userId, question, answer));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}
