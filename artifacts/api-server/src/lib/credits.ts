/**
 * Credits — how much AI each person can use per day, weighted by what each model costs.
 *
 * Every chat reply costs credits: cheap models 1, mid-price 2, premium 3. Each plan gets a daily
 * allowance that resets at midnight UTC. Replies that run on the person's own linked API key
 * (Connectors) are free and unlimited, because they don't touch the owner's keys.
 *
 * Alongside the credits, every reply records its token counts and an estimated dollar cost, so the
 * owner can see what the API keys are really costing (GET /credits/admin).
 *
 * All numbers can be changed on the server without code changes:
 *   APEX_CREDITS_FREE=20  APEX_CREDITS_PRO=60  APEX_CREDITS_ENTERPRISE=-1   (-1 = unlimited)
 *
 * Credits bought in packs (credit_wallet) never expire and are spent only after the daily allowance.
 *   APEX_CREDIT_COST_CLAUDE=3  (any provider, upper-case)
 *   APEX_PRICE_CLAUDE=4,20     (estimated $ per million input,output tokens)
 */
import { db, aiUsageTable, creditBonusTable, creditWalletTable, creditPurchasesTable, usersTable } from "@workspace/db";
import { and, eq, sql, desc, gte } from "drizzle-orm";
import { normalizeTier } from "../server/billing/planConfig";
import { isOwnerEmail } from "../shared/lib/owner";
import type { AiProvider } from "./aiRouter";

type PlanTier = "free" | "pro" | "enterprise";

const envInt = (key: string, fallback: number) => {
  const n = parseInt(process.env[key] ?? "", 10);
  return Number.isNaN(n) ? fallback : n;
};

// ── Prices ────────────────────────────────────────────────────────────────────

/** Credits one reply costs, by model. */
const BASE_COST: Record<AiProvider | "elevenlabs", number> = {
  llama: 1,      // Llama 3.3 70B on Groq
  deepseek: 1,   // DeepSeek V3
  gemini: 1,     // Gemini 2.5 Flash
  mistral: 2,    // Mistral Large
  openai: 2,     // GPT-5.2
  grok: 3,       // Grok 4
  perplexity: 3, // Sonar Pro (web search)
  claude: 3,     // Claude Opus 5.5
  elevenlabs: 2, // one character voice line
};

export function creditCost(provider: string): number {
  const base = BASE_COST[provider as keyof typeof BASE_COST] ?? 2;
  return envInt(`APEX_CREDIT_COST_${provider.toUpperCase()}`, base);
}

/** Estimated $ per million tokens [input, output]. Claude from Anthropic's price list; the rest are estimates. */
const BASE_PRICE: Record<AiProvider | "elevenlabs", [number, number]> = {
  claude: [4, 20],
  openai: [1.75, 14],
  perplexity: [3, 15],
  grok: [3, 15],
  mistral: [2, 6],
  gemini: [0.3, 2.5],
  deepseek: [0.28, 0.42],
  llama: [0.59, 0.79],
  elevenlabs: [0, 150], // billed per character: ~$0.15 per 1,000 (pass characters as outputTokens)
};

function pricePerMTok(provider: string): [number, number] {
  const override = process.env[`APEX_PRICE_${provider.toUpperCase()}`];
  if (override) {
    const [i, o] = override.split(",").map(Number);
    if (Number.isFinite(i) && Number.isFinite(o)) return [i!, o!];
  }
  return BASE_PRICE[provider as keyof typeof BASE_PRICE] ?? [3, 15];
}

/** Estimated cost in millionths of a dollar. $1 per million tokens = 1 micro-dollar per token. */
export function estimateCostMicros(provider: string, inputTokens: number, outputTokens: number): number {
  const [i, o] = pricePerMTok(provider);
  return Math.round(inputTokens * i + outputTokens * o);
}

// ── Allowances ────────────────────────────────────────────────────────────────

export function dailyAllowance(tier: PlanTier): number {
  if (tier === "enterprise") return envInt("APEX_CREDITS_ENTERPRISE", -1);
  if (tier === "pro") return envInt("APEX_CREDITS_PRO", 60);
  return envInt("APEX_CREDITS_FREE", 20);
}

// ── Credit packs (one-time purchases) ─────────────────────────────────────────

export const CREDIT_PACKS = [
  { id: "pack300", credits: 300, priceCents: 500, name: "300 credits" },
  { id: "pack600", credits: 600, priceCents: 800, name: "600 credits" },
  { id: "pack900", credits: 900, priceCents: 1200, name: "900 credits" },
] as const;
export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];
export const creditPack = (id: string) => CREDIT_PACKS.find((p) => p.id === id);

async function walletBalance(userId: number): Promise<number> {
  const [row] = await db.select({ balance: creditWalletTable.balance }).from(creditWalletTable).where(eq(creditWalletTable.userId, userId)).limit(1);
  return row?.balance ?? 0;
}

/**
 * Add a paid pack to the person's wallet. Safe to call twice for the same checkout session:
 * the purchase row is unique per session, so the second call adds nothing.
 */
export async function grantPurchasedCredits(userId: number, packId: string, credits: number, amountCents: number, stripeSessionId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(creditPurchasesTable)
      .values({ userId, packId, credits, amountCents, stripeSessionId })
      .onConflictDoNothing({ target: creditPurchasesTable.stripeSessionId })
      .returning({ id: creditPurchasesTable.id });
    if (!inserted.length) return false;
    await tx
      .insert(creditWalletTable)
      .values({ userId, balance: credits })
      .onConflictDoUpdate({ target: creditWalletTable.userId, set: { balance: sql`${creditWalletTable.balance} + ${credits}`, updatedAt: new Date() } });
    return true;
  });
}

const today = () => new Date().toISOString().slice(0, 10);

function nextResetIso(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

// ── Who is spending ───────────────────────────────────────────────────────────

export interface CreditUser {
  usageKey: string;
  userId: number;
  tier: PlanTier;
  isOwner: boolean;
}

export async function creditUserFor(userId: number): Promise<CreditUser | null> {
  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, tier: usersTable.subscriptionTier, status: usersTable.subscriptionStatus })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) return null;
  // A cancelled subscription falls back to the free allowance (past_due keeps it while Stripe retries the card)
  const paid = user.status === "active" || user.status === "trialing" || user.status === "past_due";
  const tier = paid ? normalizeTier(user.tier) : "free";
  return { usageKey: `user:${user.id}`, userId: user.id, tier, isOwner: isOwnerEmail(user.email) };
}

/** Resolve by session ID (web chat sends the signed-in session). */
export async function creditUserForSession(sessionId: string): Promise<CreditUser | null> {
  if (!sessionId) return null;
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.sessionId, sessionId)).limit(1);
  return user ? creditUserFor(user.id) : null;
}

// ── Balance ───────────────────────────────────────────────────────────────────

export interface CreditBalance {
  tier: PlanTier;
  used: number;
  limit: number;       // daily allowance + today's bonus; -1 = unlimited
  bonus: number;
  /** Credits left today plus bought credits; -1 = unlimited */
  remaining: number;
  /** Left from today's allowance */
  dailyRemaining: number;
  /** Bought in packs (never expire) */
  purchased: number;
  unlimited: boolean;
  resetsAt: string;
  costs: Record<string, number>;
}

export async function getBalance(who: CreditUser): Promise<CreditBalance> {
  const day = today();
  const [usage] = await db
    .select({ used: sql<number>`coalesce(sum(${aiUsageTable.credits}), 0)::int` })
    .from(aiUsageTable)
    .where(and(eq(aiUsageTable.usageKey, who.usageKey), eq(aiUsageTable.day, day)));
  const [bonusRow] = await db
    .select({ credits: creditBonusTable.credits })
    .from(creditBonusTable)
    .where(and(eq(creditBonusTable.usageKey, who.usageKey), eq(creditBonusTable.day, day)));

  const used = usage?.used ?? 0;
  const bonus = bonusRow?.credits ?? 0;
  const base = who.isOwner ? -1 : dailyAllowance(who.tier);
  const unlimited = base === -1;
  const limit = unlimited ? -1 : base + bonus;
  const purchased = await walletBalance(who.userId);
  const dailyRemaining = unlimited ? -1 : Math.max(0, limit - used);
  return {
    tier: who.tier,
    used,
    limit,
    bonus,
    remaining: unlimited ? -1 : dailyRemaining + purchased,
    dailyRemaining,
    purchased,
    unlimited,
    resetsAt: nextResetIso(),
    costs: Object.fromEntries(Object.keys(BASE_COST).map((p) => [p, creditCost(p)])),
  };
}

/** Can this person afford `credits` more right now? */
export async function canSpend(who: CreditUser, credits: number): Promise<{ ok: boolean; balance: CreditBalance }> {
  const balance = await getBalance(who);
  return { ok: balance.unlimited || credits <= 0 || balance.remaining >= credits, balance };
}

/** The 429 body every AI route sends when someone is out of credits. */
export function outOfCredits(balance: CreditBalance, needed: number) {
  return {
    ok: false,
    code: "OUT_OF_CREDITS",
    error:
      balance.remaining > 0
        ? `That model needs ${needed} credits and you have ${balance.remaining} left today. Try a lighter model, or upgrade for more.`
        : "You've used today's AI credits. They reset at midnight, or buy a credit pack or upgrade to Pro for more.",
    credits: balance,
  };
}

// ── Recording ─────────────────────────────────────────────────────────────────

export interface UsageReport {
  provider: string;
  ownKey?: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

/** Charge a finished reply. Replies on the person's own key cost no credits and no owner money. */
export async function recordUsage(who: CreditUser, report: UsageReport): Promise<number> {
  const own = !!report.ownKey;
  const credits = own ? 0 : creditCost(report.provider);
  const inputTokens = Math.max(0, Math.round(report.inputTokens ?? 0));
  const outputTokens = Math.max(0, Math.round(report.outputTokens ?? 0));
  const costMicros = own ? 0 : estimateCostMicros(report.provider, inputTokens, outputTokens);
  // Whatever today's allowance can't cover comes out of bought credits
  if (credits > 0 && !who.isOwner) {
    const balance = await getBalance(who);
    const overflow = balance.unlimited ? 0 : Math.max(0, credits - balance.dailyRemaining);
    if (overflow > 0) {
      await db
        .update(creditWalletTable)
        .set({ balance: sql`greatest(${creditWalletTable.balance} - ${overflow}, 0)`, updatedAt: new Date() })
        .where(eq(creditWalletTable.userId, who.userId));
    }
  }
  await db
    .insert(aiUsageTable)
    .values({
      usageKey: who.usageKey, userId: who.userId, day: today(), provider: report.provider,
      messages: 1, ownKeyMessages: own ? 1 : 0, credits, inputTokens, outputTokens, costMicros,
    })
    .onConflictDoUpdate({
      target: [aiUsageTable.usageKey, aiUsageTable.day, aiUsageTable.provider],
      set: {
        messages: sql`${aiUsageTable.messages} + 1`,
        ownKeyMessages: sql`${aiUsageTable.ownKeyMessages} + ${own ? 1 : 0}`,
        credits: sql`${aiUsageTable.credits} + ${credits}`,
        inputTokens: sql`${aiUsageTable.inputTokens} + ${inputTokens}`,
        outputTokens: sql`${aiUsageTable.outputTokens} + ${outputTokens}`,
        costMicros: sql`${aiUsageTable.costMicros} + ${costMicros}`,
        updatedAt: new Date(),
      },
    });
  return credits;
}

/** Add bonus credits for today only (e.g. the day-3 streak reward). */
export async function grantBonusCredits(userId: number, credits: number): Promise<void> {
  await db
    .insert(creditBonusTable)
    .values({ usageKey: `user:${userId}`, day: today(), credits })
    .onConflictDoUpdate({
      target: [creditBonusTable.usageKey, creditBonusTable.day],
      set: { credits: sql`${creditBonusTable.credits} + ${credits}` },
    });
}

// ── Owner report ──────────────────────────────────────────────────────────────

/** Spending over the last `days` days: totals, per day, per model and the heaviest users. */
export async function spendingReport(days = 30) {
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const inRange = gte(aiUsageTable.day, since);
  const sum = (col: typeof aiUsageTable.costMicros | typeof aiUsageTable.messages | typeof aiUsageTable.credits | typeof aiUsageTable.ownKeyMessages) =>
    sql<number>`coalesce(sum(${col}), 0)::bigint`;

  const [totals] = await db
    .select({ costMicros: sum(aiUsageTable.costMicros), messages: sum(aiUsageTable.messages), ownKeyMessages: sum(aiUsageTable.ownKeyMessages), credits: sum(aiUsageTable.credits), users: sql<number>`count(distinct ${aiUsageTable.usageKey})::int` })
    .from(aiUsageTable).where(inRange);
  const byDay = await db
    .select({ day: aiUsageTable.day, costMicros: sum(aiUsageTable.costMicros), messages: sum(aiUsageTable.messages) })
    .from(aiUsageTable).where(inRange).groupBy(aiUsageTable.day).orderBy(aiUsageTable.day);
  const byModel = await db
    .select({ provider: aiUsageTable.provider, costMicros: sum(aiUsageTable.costMicros), messages: sum(aiUsageTable.messages) })
    .from(aiUsageTable).where(inRange).groupBy(aiUsageTable.provider).orderBy(desc(sum(aiUsageTable.costMicros)));
  const topUsers = await db
    .select({
      userId: aiUsageTable.userId,
      username: usersTable.username,
      email: usersTable.email,
      tier: usersTable.subscriptionTier,
      costMicros: sum(aiUsageTable.costMicros),
      messages: sum(aiUsageTable.messages),
    })
    .from(aiUsageTable)
    .leftJoin(usersTable, eq(usersTable.id, aiUsageTable.userId))
    .where(inRange)
    .groupBy(aiUsageTable.userId, usersTable.username, usersTable.email, usersTable.subscriptionTier)
    .orderBy(desc(sum(aiUsageTable.costMicros)))
    .limit(15);

  const num = (v: unknown) => Number(v ?? 0);
  return {
    days,
    since,
    totals: { costUsd: num(totals?.costMicros) / 1e6, messages: num(totals?.messages), ownKeyMessages: num(totals?.ownKeyMessages), credits: num(totals?.credits), users: num(totals?.users) },
    byDay: byDay.map((d) => ({ day: d.day, costUsd: num(d.costMicros) / 1e6, messages: num(d.messages) })),
    byModel: byModel.map((m) => ({ provider: m.provider, costUsd: num(m.costMicros) / 1e6, messages: num(m.messages) })),
    topUsers: topUsers.map((u) => ({ userId: u.userId, username: u.username, email: u.email, tier: u.tier, costUsd: num(u.costMicros) / 1e6, messages: num(u.messages) })),
  };
}
