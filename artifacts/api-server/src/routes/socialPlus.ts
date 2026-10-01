/**
 * Social, step 2: challenges and Apex's AI helpers. All routes need a signed-in account.
 *
 *   GET    /challenges              — active challenges (Apex's weekly one first) and recently ended ones
 *   POST   /challenges              — start a challenge
 *   GET    /challenges/:id          — one challenge with its top entries
 *   DELETE /challenges/:id          — remove a challenge you started (its entries stay up)
 *
 *   POST   /social-ai/assist        — draft, improve, hashtags, poll or debate ideas for the composer
 *   POST   /social-ai/ask           — ask Apex a question; returns the answer to review before sharing
 *   POST   /posts/:id/ask-apex      — ask Apex about a post; the answer is private until shared as a comment
 *   POST   /posts/:id/summary       — Apex sums up both sides of a debate (kept for an hour, free to re-read)
 *
 * AI answers are never posted automatically: the person sees them first and chooses to share.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, usersTable, socialChallengesTable, socialPostsTable, postCommentsTable } from "@workspace/db";
import { and, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import { requireUser } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";
import { weekStart, weeklyChallengeFor } from "../lib/moments";
import { blockedIds, followingIds, circleIds, visibleTo, present, loadVisible, idParam } from "../lib/socialPosts";
import { askApex, jsonIn, signAnswer } from "../lib/socialAi";

const router: IRouter = Router();
const bad = (error: string) => ({ ok: false, error });

// ── Challenges ────────────────────────────────────────────────────────────────

/** Make sure this week's Apex challenge exists. */
async function ensureWeekly(): Promise<void> {
  const week = weekStart();
  const c = weeklyChallengeFor(week);
  const endsAt = new Date(Date.parse(`${week}T00:00:00Z`) + 7 * 86_400_000);
  await db.insert(socialChallengesTable).values({ slug: `weekly-${week}`, creatorId: null, title: c.title, description: c.description, tag: c.tag, endsAt }).onConflictDoNothing();
}

type ChallengeRow = typeof socialChallengesTable.$inferSelect;

async function presentChallenges(rows: ChallengeRow[], me: number) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const creatorIds = [...new Set(rows.map((r) => r.creatorId).filter((x): x is number => !!x))];
  const [counts, mine, creators] = await Promise.all([
    db.select({ id: socialPostsTable.challengeId, n: sql<number>`count(*)::int` }).from(socialPostsTable)
      .where(and(inArray(socialPostsTable.challengeId, ids), eq(socialPostsTable.deleted, false))).groupBy(socialPostsTable.challengeId),
    db.selectDistinct({ id: socialPostsTable.challengeId }).from(socialPostsTable)
      .where(and(inArray(socialPostsTable.challengeId, ids), eq(socialPostsTable.userId, me), eq(socialPostsTable.deleted, false))),
    creatorIds.length ? db.select({ id: usersTable.id, username: usersTable.username, avatarEmoji: usersTable.avatarEmoji, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(inArray(usersTable.id, creatorIds)) : Promise.resolve([]),
  ]);
  const byCreator = new Map(creators.map((c) => [c.id, c]));
  const joined = new Set(mine.map((m) => m.id));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    tag: r.tag,
    endsAt: r.endsAt,
    ended: r.endsAt <= new Date(),
    official: !r.creatorId,
    mine: r.creatorId === me,
    creator: r.creatorId ? byCreator.get(r.creatorId) ?? null : null,
    entries: counts.find((c) => c.id === r.id)?.n ?? 0,
    joined: joined.has(r.id),
  }));
}

router.get("/challenges", requireUser, async (req: ApexRequest, res): Promise<void> => {
  await ensureWeekly();
  const now = new Date();
  const [active, ended] = await Promise.all([
    db.select().from(socialChallengesTable).where(and(eq(socialChallengesTable.deleted, false), gt(socialChallengesTable.endsAt, now)))
      .orderBy(sql`${socialChallengesTable.creatorId} is not null`, desc(socialChallengesTable.id)).limit(20),
    db.select().from(socialChallengesTable).where(and(eq(socialChallengesTable.deleted, false), lte(socialChallengesTable.endsAt, now), gte(socialChallengesTable.endsAt, new Date(now.getTime() - 14 * 86_400_000))))
      .orderBy(desc(socialChallengesTable.endsAt)).limit(10),
  ]);
  const blocked = await blockedIds(req.userId!);
  const keep = (r: ChallengeRow) => !r.creatorId || !blocked.includes(r.creatorId);
  res.json({ ok: true, data: { active: await presentChallenges(active.filter(keep), req.userId!), ended: await presentChallenges(ended.filter(keep), req.userId!) } });
});

const ChallengeBody = z.object({
  title: z.string().trim().min(3, "Give it a title.").max(80),
  description: z.string().trim().max(300).default(""),
  tag: z.string().trim().max(30).optional(),
  days: z.number().int().min(1).max(14).default(7),
});

const tagFrom = (text: string) => text.toLowerCase().replace(/^#/, "").replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 24);

router.post("/challenges", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const parsed = ChallengeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(bad(parsed.error.issues[0]?.message ?? "Check the challenge and try again.")); return; }
  const p = parsed.data;
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(socialChallengesTable)
    .where(and(eq(socialChallengesTable.creatorId, me), gt(socialChallengesTable.createdAt, new Date(Date.now() - 86_400_000))));
  if ((recent?.n ?? 0) >= 3) { res.status(429).json(bad("You can start 3 challenges a day. Try again tomorrow.")); return; }

  let base = tagFrom(p.tag || p.title);
  if (base.length < 2) base = "challenge";
  // A tag can only belong to one running challenge at a time
  const taken = new Set((await db.select({ tag: socialChallengesTable.tag }).from(socialChallengesTable)
    .where(and(eq(socialChallengesTable.deleted, false), gt(socialChallengesTable.endsAt, new Date())))).map((r) => r.tag));
  let tag = base;
  for (let i = 2; taken.has(tag) && i < 100; i++) tag = `${base.slice(0, 22)}${i}`;

  const [row] = await db.insert(socialChallengesTable).values({
    creatorId: me, title: p.title, description: p.description, tag, endsAt: new Date(Date.now() + p.days * 86_400_000),
  }).returning();
  const [view] = await presentChallenges([row!], me);
  res.status(201).json({ ok: true, data: { challenge: view } });
});

router.get("/challenges/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const [row] = id ? await db.select().from(socialChallengesTable).where(and(eq(socialChallengesTable.id, id), eq(socialChallengesTable.deleted, false))).limit(1) : [];
  const [blocked, following, circles] = await Promise.all([blockedIds(me), followingIds(me), circleIds(me)]);
  if (!row || (row.creatorId && blocked.includes(row.creatorId))) { res.status(404).json(bad("This challenge isn't available.")); return; }
  const where = [eq(socialPostsTable.challengeId, row.id), eq(socialPostsTable.deleted, false), visibleTo(me, following, circles)];
  if (blocked.length) where.push(sql`${socialPostsTable.userId} not in (${sql.join(blocked.map((b) => sql`${b}`), sql`, `)})`);
  const top = await db.select().from(socialPostsTable).where(and(...where)).orderBy(desc(socialPostsTable.reactionCount), desc(socialPostsTable.id)).limit(10);
  const [view] = await presentChallenges([row], me);
  res.json({ ok: true, data: { challenge: view, top: await present(top, me) } });
});

router.delete("/challenges/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const id = idParam(req.params.id);
  const done = id ? await db.update(socialChallengesTable).set({ deleted: true }).where(and(eq(socialChallengesTable.id, id), eq(socialChallengesTable.creatorId, req.userId!))).returning({ id: socialChallengesTable.id }) : [];
  if (!done.length) { res.status(404).json(bad("You can only remove challenges you started.")); return; }
  res.json({ ok: true, data: { deleted: true } });
});

// ── AI helpers ────────────────────────────────────────────────────────────────

const AssistBody = z.object({
  action: z.enum(["draft", "improve", "hashtags", "poll", "debate"]),
  text: z.string().trim().min(1, "Write a few words first.").max(2000),
});

const ASSIST: Record<z.infer<typeof AssistBody>["action"], (text: string) => string> = {
  draft: (t) => `Write one short social post (under 60 words) about: ${t}\nSound like a real person. One or two relevant hashtags at the end. Reply with just the post.`,
  improve: (t) => `Make this post clearer and more engaging. Keep the meaning, the voice, any @mentions and #hashtags, and keep it about the same length. Reply with just the post.\n\n${t}`,
  hashtags: (t) => `Suggest up to 5 hashtags for this post. Reply only with JSON: {"tags":["tag1","tag2"]} (no # signs).\n\n${t}`,
  poll: (t) => `Turn this into a fun poll. Reply only with JSON: {"question":"...","options":["...","..."]} with 2 to 4 short options (under 40 characters each).\n\n${t}`,
  debate: (t) => `Turn this into a friendly debate with two clear sides. Reply only with JSON: {"question":"...","sides":["...","..."]} with each side under 40 characters.\n\n${t}`,
};

router.post("/social-ai/assist", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const parsed = AssistBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(bad(parsed.error.issues[0]?.message ?? "Write a few words first.")); return; }
  const { action, text } = parsed.data;
  const r = await askApex(req.userId!, "You help people write posts. Follow the requested format exactly.", ASSIST[action](text));
  if (!r.ok) { res.status(r.status).json(r.body); return; }

  const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
  if (action === "hashtags") {
    const tags = (jsonIn<{ tags?: unknown[] }>(r.text)?.tags ?? []).map((t) => tagFrom(String(t))).filter((t) => t.length >= 2).slice(0, 5);
    if (!tags.length) { res.status(502).json(bad("Apex couldn't think of tags for that. Try again.")); return; }
    res.json({ ok: true, data: { tags, credits: r.credits } }); return;
  }
  if (action === "poll" || action === "debate") {
    const j = jsonIn<{ question?: unknown; options?: unknown[]; sides?: unknown[] }>(r.text);
    const choices = ((action === "poll" ? j?.options : j?.sides) ?? []).map((o) => clip(o, 80)).filter(Boolean).slice(0, action === "poll" ? 4 : 2);
    const question = clip(j?.question, 300);
    if (!question || choices.length < 2) { res.status(502).json(bad("Apex couldn't shape that one. Try rewording it.")); return; }
    res.json({ ok: true, data: { question, options: choices, credits: r.credits } }); return;
  }
  res.json({ ok: true, data: { text: r.text, credits: r.credits } });
});

const AskBody = z.object({ question: z.string().trim().min(3, "Ask a full question.").max(500) });

router.post("/social-ai/ask", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const parsed = AskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(bad(parsed.error.issues[0]?.message ?? "Ask a full question.")); return; }
  const { question } = parsed.data;
  const r = await askApex(req.userId!, "Answer the question helpfully in under 150 words. If it needs up-to-date facts you can't be sure of, say so.", question);
  if (!r.ok) { res.status(r.status).json(r.body); return; }
  res.json({ ok: true, data: { question, answer: r.text, token: signAnswer(req.userId!, question, r.text), credits: r.credits } });
});

/** The post and its conversation, as context for Apex. */
async function threadText(postId: number, me: number, body: string, sides: string[] | null) {
  const blocked = await blockedIds(me);
  const comments = (await db.select().from(postCommentsTable).where(and(eq(postCommentsTable.postId, postId), eq(postCommentsTable.deleted, false), eq(postCommentsTable.ai, false))).orderBy(desc(postCommentsTable.reactionCount), desc(postCommentsTable.id)).limit(40))
    .filter((c) => !blocked.includes(c.userId));
  const lines = comments.map((c) => `- ${sides && c.side !== null ? `[${sides[c.side] ?? "?"}] ` : ""}${c.body.slice(0, 300)}`);
  return { text: `Post: ${body}\n${sides ? `Sides: ${sides.join(" vs ")}\n` : ""}Comments:\n${lines.join("\n") || "(none yet)"}`, count: comments.length };
}

router.post("/posts/:id/ask-apex", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const row = id ? await loadVisible(id, me) : null;
  if (!row) { res.status(404).json(bad("This post isn't available.")); return; }
  const parsed = AskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(bad(parsed.error.issues[0]?.message ?? "Ask a full question.")); return; }
  const { question } = parsed.data;
  const ctx = await threadText(row.id, me, row.body, row.kind === "debate" ? row.pollOptions : null);
  const r = await askApex(me, "Someone is reading a post and its comments and has a question about it. Answer in under 120 words. Be fair to everyone in the thread.", `${ctx.text}\n\nQuestion: ${question}`);
  if (!r.ok) { res.status(r.status).json(r.body); return; }
  res.json({ ok: true, data: { question, answer: r.text, token: signAnswer(me, `post:${row.id}|${question}`, r.text), credits: r.credits } });
});

router.post("/posts/:id/summary", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const row = id ? await loadVisible(id, me) : null;
  if (!row || row.kind !== "debate") { res.status(404).json(bad("This debate isn't available.")); return; }
  // A summary from the last hour is shared with everyone, free
  if (row.aiText && row.aiAt && Date.now() - row.aiAt.getTime() < 3_600_000) {
    res.json({ ok: true, data: { summary: row.aiText, summaryAt: row.aiAt, cached: true } }); return;
  }
  const sides = row.pollOptions ?? [];
  const ctx = await threadText(row.id, me, row.body, sides);
  const r = await askApex(me,
    "Sum up a debate fairly. Give the strongest point for each side in one or two sentences each, then one line on where people seem to agree. Don't pick a winner.",
    `${ctx.text}\n\nFormat:\n${sides[0]}: ...\n${sides[1]}: ...\nCommon ground: ...${ctx.count ? "" : "\n(No comments yet: give the best general argument for each side.)"}`);
  if (!r.ok) { res.status(r.status).json(r.body); return; }
  const summaryAt = new Date();
  await db.update(socialPostsTable).set({ aiText: r.text, aiAt: summaryAt }).where(eq(socialPostsTable.id, row.id));
  res.json({ ok: true, data: { summary: r.text, summaryAt, cached: false, credits: r.credits } });
});

export default router;
