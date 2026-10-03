/**
 * Apex Agent — the AI works in a loop with tools until the task is done:
 * it plans, calls a tool (search the web, read a page, calculate, look through your chats…), reads the
 * result, and repeats, then answers with its sources.
 *
 * Runs on the free models (lib/freeModels.ts) that support tools, so it costs no credits.
 * Web search and page reading use Tavily (TAVILY_API_KEY). Limits, changeable on the server:
 *   APEX_AGENT_PER_USER_DAILY=10   agent tasks one person can run per day (-1 = no limit; owner unlimited)
 *   APEX_TAVILY_PER_USER_DAILY=10  web searches / page reads one person can use per day (owner unlimited)
 *   APEX_TAVILY_DAILY=33           safety cap for the whole app, to stay inside Tavily's free plan (~1,000 a month)
 *
 * The agent never posts or changes anything by itself: draft_social_post only prepares a draft that the
 * person can post with one tap.
 */
import type OpenAI from "openai";
import { db, mobileConversationsTable, mobileMessagesTable } from "@workspace/db";
import { and, desc, eq, ilike } from "drizzle-orm";
import { askFreeRaw, countUse, freePoolConfigured, usedToday } from "./freeModels";
import { getBalance, type CreditUser } from "./credits";
import { logger } from "./logger";

const envInt = (key: string, fallback: number) => {
  const n = parseInt(process.env[key] ?? "", 10);
  return Number.isNaN(n) ? fallback : n;
};
const MAX_STEPS = 6;
const RESULT_CHARS = 6000;

export interface AgentStep {
  tool: string;
  /** "Searched the web", "Read a page"… */
  label: string;
  /** What it searched for, the page it read, the sum it worked out */
  detail?: string;
  /** Pages a search turned up */
  results?: AgentSource[];
  ok: boolean;
}
export interface AgentSource { title: string; url: string }
export interface AgentResult {
  content: string;
  model: string;
  steps: AgentStep[];
  sources: AgentSource[];
  /** A Social post the agent prepared for the person to review */
  draft: string | null;
  inputTokens: number;
  outputTokens: number;
}

export const agentConfigured = () => freePoolConfigured();

/** Agent tasks this person has left today (null = no limit). */
export async function agentRunsLeft(who: CreditUser): Promise<number | null> {
  const cap = envInt("APEX_AGENT_PER_USER_DAILY", 10);
  if (who.isOwner || cap < 0) return null;
  return Math.max(0, cap - (await usedToday(`agent-user:${who.userId}`)));
}

// ── Tools ────────────────────────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information: news, prices, facts, people, how-tos. Returns titles, links and snippets.",
      parameters: { type: "object", properties: { query: { type: "string", description: "What to search for" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "open_url",
      description: "Read the main text of one web page (for example a link from web_search or one the user gave).",
      parameters: { type: "object", properties: { url: { type: "string", description: "Full http(s) link" } }, required: ["url"] },
    },
  },
  {
    type: "function",
    function: {
      name: "calculator",
      description: "Exact arithmetic. Supports + - * / ^ % parentheses, sqrt, abs, round, floor, ceil, min, max, pi, e.",
      parameters: { type: "object", properties: { expression: { type: "string", description: "e.g. (1250 * 0.08) / 12" } }, required: ["expression"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_my_chats",
      description: "Search the user's own saved conversations with Apex for a word or phrase.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_credits",
      description: "The user's Apex AI credits: how many are left today, their plan, when they reset.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_social_post",
      description: "Prepare a post for the user's Apex Social feed. It is NOT posted: the user reviews it and taps Post.",
      parameters: { type: "object", properties: { text: { type: "string", description: "The post, under 500 characters" } }, required: ["text"] },
    },
  },
];

const LABEL: Record<string, string> = {
  web_search: "Searched the web",
  open_url: "Read a page",
  calculator: "Calculated",
  search_my_chats: "Searched your chats",
  get_my_credits: "Checked your credits",
  draft_social_post: "Drafted a Social post",
};

function detailOf(name: string, a: Record<string, string>): string | undefined {
  if (name === "web_search" || name === "search_my_chats") return a.query ? String(a.query).slice(0, 120) : undefined;
  if (name === "open_url") { try { const u = new URL(a.url ?? ""); return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 120); } catch { return undefined; } }
  if (name === "calculator") return a.expression ? String(a.expression).slice(0, 120) : undefined;
  return undefined;
}

async function tavily(who: CreditUser, path: "search" | "extract", body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("Web search isn't set up yet (TAVILY_API_KEY).");
  const mine = `tavily-user:${who.userId}`;
  const perUser = envInt("APEX_TAVILY_PER_USER_DAILY", 10);
  if (!who.isOwner && perUser >= 0 && (await usedToday(mine)) >= perUser) throw new Error(`You've used today's ${perUser} web searches. They come back at midnight UTC.`);
  if ((await usedToday("tool:tavily")) >= envInt("APEX_TAVILY_DAILY", 33)) throw new Error("Apex has used today's web searches. Try again tomorrow.");
  await countUse("tool:tavily");
  await countUse(mine);
  // APEX_TAVILY_URL points at another address (tests)
  const res = await fetch(`${process.env.APEX_TAVILY_URL || "https://api.tavily.com"}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Web search failed (${res.status}).`);
  return (await res.json()) as Record<string, unknown>;
}

/** Safe arithmetic: a tiny parser instead of eval. */
export function calculate(expression: string): number {
  // "1,000" is a thousands separator; "max(2, 7)" keeps its commas
  const src = expression.replace(/×/g, "*").replace(/÷/g, "/").replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
  let i = 0;
  const FUNCS: Record<string, (...a: number[]) => number> = { sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, log: Math.log10, ln: Math.log };
  const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
  const ws = () => { while (src[i] === " ") i++; };
  const expr = (): number => {
    let v = term();
    for (ws(); src[i] === "+" || src[i] === "-"; ws()) v = src[i++] === "+" ? v + term() : v - term();
    return v;
  };
  const term = (): number => {
    let v = power();
    for (ws(); src[i] === "*" || src[i] === "/" || src[i] === "%"; ws()) {
      const op = src[i++];
      const r = power();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  };
  const power = (): number => {
    const b = unary();
    ws();
    if (src[i] === "^") { i++; return b ** power(); }
    return b;
  };
  const unary = (): number => {
    ws();
    if (src[i] === "-") { i++; return -unary(); }
    if (src[i] === "+") { i++; return unary(); }
    return atom();
  };
  const atom = (): number => {
    ws();
    if (src[i] === "(") { i++; const v = expr(); ws(); if (src[i++] !== ")") throw new Error("missing )"); return v; }
    const num = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(src.slice(i));
    if (num) { i += num[0].length; return parseFloat(num[0]); }
    const name = /^[a-z]+/i.exec(src.slice(i));
    if (name) {
      const n = name[0].toLowerCase();
      i += name[0].length;
      if (n in CONSTS) return CONSTS[n]!;
      const f = FUNCS[n];
      ws();
      if (!f || src[i] !== "(") throw new Error(`unknown "${n}"`);
      i++;
      const args = [expr()];
      for (ws(); src[i] === ","; ws()) { i++; args.push(expr()); }
      if (src[i++] !== ")") throw new Error("missing )");
      return f(...args);
    }
    throw new Error("couldn't read the expression");
  };
  const v = expr();
  ws();
  if (i < src.length) throw new Error(`unexpected "${src[i]}"`);
  if (!Number.isFinite(v)) throw new Error("the result isn't a finite number");
  return v;
}

interface Ctx { who: CreditUser; sources: AgentSource[]; draft: string | null; lastResults?: AgentSource[] }

async function runTool(name: string, args: Record<string, string>, ctx: Ctx): Promise<unknown> {
  switch (name) {
    case "web_search": {
      const data = await tavily(ctx.who, "search", { query: String(args.query ?? "").slice(0, 300), max_results: 5, search_depth: "basic" });
      const results = ((data.results as { title?: string; url?: string; content?: string }[] | undefined) ?? []).slice(0, 5);
      for (const r of results) if (r.url && !ctx.sources.some((s) => s.url === r.url)) ctx.sources.push({ title: r.title ?? r.url, url: r.url });
      ctx.lastResults = results.filter((r) => r.url).map((r) => ({ title: r.title ?? r.url!, url: r.url! }));
      return results.map((r) => ({ title: r.title, url: r.url, snippet: (r.content ?? "").slice(0, 700) }));
    }
    case "open_url": {
      const url = String(args.url ?? "");
      if (!/^https?:\/\//i.test(url)) throw new Error("Only http(s) links can be opened.");
      // Tavily fetches the page on its side, so the server never connects to arbitrary addresses
      const data = await tavily(ctx.who, "extract", { urls: [url] });
      const page = ((data.results as { url?: string; raw_content?: string }[] | undefined) ?? [])[0];
      if (!page?.raw_content) throw new Error("Couldn't read that page.");
      if (!ctx.sources.some((s) => s.url === url)) ctx.sources.push({ title: new URL(url).hostname, url });
      return { url, text: page.raw_content.slice(0, RESULT_CHARS) };
    }
    case "calculator":
      return { result: calculate(String(args.expression ?? "")) };
    case "search_my_chats": {
      const q = String(args.query ?? "").replace(/[%_]/g, "").trim().slice(0, 80);
      if (!q) return [];
      const rows = await db.select({ title: mobileConversationsTable.title, role: mobileMessagesTable.role, content: mobileMessagesTable.content, at: mobileMessagesTable.createdAt })
        .from(mobileMessagesTable)
        .innerJoin(mobileConversationsTable, eq(mobileMessagesTable.conversationId, mobileConversationsTable.id))
        .where(and(eq(mobileConversationsTable.userId, ctx.who.userId), ilike(mobileMessagesTable.content, `%${q}%`)))
        .orderBy(desc(mobileMessagesTable.id)).limit(6);
      return rows.map((r) => ({ chat: r.title, from: r.role, when: r.at, text: r.content.slice(0, 500) }));
    }
    case "get_my_credits": {
      const b = await getBalance(ctx.who);
      return { plan: b.tier, unlimited: b.unlimited, leftToday: b.remaining, dailyAllowance: b.limit, boughtCredits: b.purchased, resetsAt: b.resetsAt };
    }
    case "draft_social_post": {
      ctx.draft = String(args.text ?? "").trim().slice(0, 500) || null;
      return { drafted: true, note: "Shown to the user to review; it is not posted." };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

// ── The loop ─────────────────────────────────────────────────────────────────

const SYSTEM = () => `You are Apex Agent, the hands-on side of Apex. Today is ${new Date().toISOString().slice(0, 10)}.
Work step by step: decide what you need, use a tool, read the result, and repeat until you can answer well.
- Use web_search for anything current or that you aren't sure of, and open_url to read a page in full when snippets aren't enough.
- Use calculator for any math beyond the trivial.
- Keep tool use focused: usually 1-3 searches is plenty.
- When you used the web, cite sources inline as [1], [2] in the order you list them, and end with a "Sources" list of the links.
- If the user wants something posted to Apex Social, use draft_social_post and tell them to review and tap Post. Never claim you posted anything.
- Answer in a warm, plain, human voice. Be concise.`;

export async function runAgent(who: CreditUser, message: string, history: { role: "user" | "assistant"; content: string }[]): Promise<AgentResult> {
  const ctx: Ctx = { who, sources: [], draft: null };
  const steps: AgentStep[] = [];
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: SYSTEM() }, ...history, { role: "user", content: message }];
  let model = "";
  let inputTokens = 0;
  let outputTokens = 0;
  await countUse(`agent-user:${who.userId}`);

  for (let step = 0; step < MAX_STEPS; step++) {
    // On the last allowed step, ask for the answer without more tool calls
    const last = step === MAX_STEPS - 1;
    if (last) messages.push({ role: "system", content: "You've used all your steps. Answer now with what you have." });
    const r = await askFreeRaw(messages, last ? undefined : TOOLS);
    model = r.model;
    inputTokens += r.inputTokens;
    outputTokens += r.outputTokens;
    const calls = r.message.tool_calls ?? [];
    if (!calls.length) {
      return { content: (r.message.content ?? "").trim() || "I couldn't put an answer together. Try asking another way.", model, steps, sources: ctx.sources, draft: ctx.draft, inputTokens, outputTokens };
    }
    messages.push({ role: "assistant", content: r.message.content ?? "", tool_calls: calls });
    for (const call of calls.slice(0, 4)) {
      if (call.type !== "function") continue;
      const name = call.function.name;
      let args: Record<string, string> = {};
      try { args = JSON.parse(call.function.arguments || "{}") as Record<string, string>; } catch { /* bad arguments are reported back below */ }
      let result: unknown;
      let ok = true;
      ctx.lastResults = undefined;
      try {
        result = await runTool(name, args, ctx);
      } catch (err) {
        ok = false;
        result = { error: err instanceof Error ? err.message : "Tool failed" };
        logger.warn({ tool: name, err: (err as Error)?.message }, "Agent tool failed");
      }
      steps.push({ tool: name, label: LABEL[name] ?? name, detail: detailOf(name, args), results: ctx.lastResults, ok });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, RESULT_CHARS) });
    }
  }
  return { content: "I ran out of steps before finishing. Try a narrower request.", model, steps, sources: ctx.sources, draft: ctx.draft, inputTokens, outputTokens };
}
