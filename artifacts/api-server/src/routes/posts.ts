/**
 * Social posts (the new Social tab). All routes need a signed-in account.
 *
 *   GET    /posts/feed?tab=foryou|following&cursor=&tag=&challenge=   — a page of posts (newest first)
 *   GET    /posts/moment                                   — today's Apex Moment prompt and who answered
 *   GET    /posts/trending                                 — top hashtags this week
 *   GET    /posts/ideas                                    — "Not sure what to post?" starters
 *   POST   /posts                                          — create a post
 *   POST   /posts/media                                    — upload a photo (already resized on the device)
 *   GET    /posts/media/:key                               — the photo
 *   GET    /posts/:id                                      — one post
 *   DELETE /posts/:id                                      — delete your post
 *   POST   /posts/:id/react                                — like / unlike
 *   POST   /posts/:id/vote                                 — vote in a poll, or pick a side in a debate
 *   GET    /posts/:id/comments                             — comments with replies
 *   POST   /posts/:id/comments                             — comment or reply
 *   POST   /post-comments/:id/react                        — like / unlike a comment
 *   DELETE /post-comments/:id                              — delete (yours, or any on your post)
 *   POST   /social-reports                                 — report a post, comment or person
 *   GET    /blocks · POST /blocks · DELETE /blocks/:userId — block list
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  db, usersTable, followsTable, gameFeedTable,
  socialPostsTable, socialPostMediaTable, postReactionsTable, postCommentsTable, socialChallengesTable,
  commentReactionsTable, pollVotesTable, contentReportsTable, userBlocksTable,
} from "@workspace/db";
import { and, desc, eq, gt, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { requireUser } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";
import { momentDay, postIdeas, promptFor } from "../lib/moments";
import { tagsIn, blockedIds, followingIds, visibleTo, notify, present, loadVisible, idParam } from "../lib/socialPosts";
import { logger } from "../lib/logger";
import { checkAnswer } from "../lib/socialAi";

const router: IRouter = Router();
const PAGE = 15;

// ── Feed, Moment, trending ───────────────────────────────────────────────────

router.get("/posts/feed", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const tab = req.query.tab === "following" ? "following" : "foryou";
  const cursor = idParam(req.query.cursor);
  const tag = typeof req.query.tag === "string" ? req.query.tag.replace(/^#/, "").toLowerCase().slice(0, 30) : "";
  const challenge = idParam(req.query.challenge);
  const [blocked, following] = await Promise.all([blockedIds(me), followingIds(me)]);

  const where: SQL[] = [eq(socialPostsTable.deleted, false), visibleTo(me, following)];
  if (cursor) where.push(lt(socialPostsTable.id, cursor));
  if (blocked.length) where.push(sql`${socialPostsTable.userId} not in (${sql.join(blocked.map((b) => sql`${b}`), sql`, `)})`);
  if (tab === "following") where.push(inArray(socialPostsTable.userId, [me, ...following]));
  if (tag) where.push(sql`${socialPostsTable.tags} @> ${JSON.stringify([tag])}::jsonb`);
  if (challenge) where.push(eq(socialPostsTable.challengeId, challenge));

  const rows = await db.select().from(socialPostsTable).where(and(...where)).orderBy(desc(socialPostsTable.id)).limit(PAGE + 1);
  const page = rows.slice(0, PAGE);
  res.json({ ok: true, data: { posts: await present(page, me), nextCursor: rows.length > PAGE ? page[page.length - 1]!.id : null } });
});

router.get("/posts/moment", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const day = momentDay();
  const following = await followingIds(me);
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(socialPostsTable).where(and(eq(socialPostsTable.momentDay, day), eq(socialPostsTable.deleted, false)));
  const [mine] = await db.select({ id: socialPostsTable.id }).from(socialPostsTable).where(and(eq(socialPostsTable.momentDay, day), eq(socialPostsTable.userId, me), eq(socialPostsTable.deleted, false))).limit(1);
  const friends = following.length
    ? await db.selectDistinct({ id: usersTable.id, username: usersTable.username, avatarEmoji: usersTable.avatarEmoji, avatarUrl: usersTable.avatarUrl })
        .from(socialPostsTable).innerJoin(usersTable, eq(usersTable.id, socialPostsTable.userId))
        .where(and(eq(socialPostsTable.momentDay, day), inArray(socialPostsTable.userId, following), eq(socialPostsTable.deleted, false))).limit(5)
    : [];
  res.json({ ok: true, data: { day, prompt: promptFor(day), answers: count?.n ?? 0, answered: !!mine, friends } });
});

router.get("/posts/trending", requireUser, async (_req, res): Promise<void> => {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const rows = await db.execute(sql`
    select tag, count(*)::int as n
    from ${socialPostsTable}, jsonb_array_elements_text(${socialPostsTable.tags}) as tag
    where ${socialPostsTable.deleted} = false and ${socialPostsTable.visibility} = 'public' and ${socialPostsTable.createdAt} > ${since}
    group by tag order by n desc limit 10`);
  const tags = (rows.rows as { tag: string; n: number }[]).map((r) => ({ tag: r.tag, count: Number(r.n) }));
  res.json({ ok: true, data: { tags } });
});

router.get("/posts/ideas", requireUser, (_req, res): void => {
  res.json({ ok: true, data: { ideas: postIdeas(momentDay()) } });
});

// ── Creating ──────────────────────────────────────────────────────────────────

const PostBody = z.object({
  kind: z.enum(["text", "photo", "poll", "game", "moment", "debate", "ask"]),
  body: z.string().trim().max(2000).default(""),
  mediaId: z.number().int().positive().optional(),
  pollOptions: z.array(z.string().trim().min(1).max(80)).min(2).max(4).optional(),
  gameId: z.number().int().positive().optional(),
  location: z.string().trim().max(60).optional(),
  challengeId: z.number().int().positive().optional(),
  /** ask posts: Apex's answer and the token /social-ai/ask returned with it */
  answer: z.string().max(4000).optional(),
  answerToken: z.string().max(200).optional(),
  visibility: z.enum(["public", "followers", "private"]).default("public"),
});

router.post("/posts", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const parsed = PostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check your post and try again." }); return; }
  const p = parsed.data;

  // Light spam guard: at most 30 posts an hour
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(socialPostsTable).where(and(eq(socialPostsTable.userId, me), gt(socialPostsTable.createdAt, new Date(Date.now() - 3_600_000))));
  if ((recent?.n ?? 0) >= 30) { res.status(429).json({ ok: false, error: "You're posting a lot. Take a breather and try again in a bit." }); return; }

  if (p.kind === "photo" && !p.mediaId) { res.status(400).json({ ok: false, error: "Add a photo first." }); return; }
  if (p.kind === "poll" && !p.pollOptions) { res.status(400).json({ ok: false, error: "A poll needs at least two choices." }); return; }
  if (p.kind === "game" && !p.gameId) { res.status(400).json({ ok: false, error: "Pick a game to share." }); return; }
  if (p.kind === "debate" && p.pollOptions?.length !== 2) { res.status(400).json({ ok: false, error: "A debate needs two sides." }); return; }
  if ((p.kind === "text" || p.kind === "moment" || p.kind === "poll" || p.kind === "debate" || p.kind === "ask") && !p.body && !p.mediaId) { res.status(400).json({ ok: false, error: "Write something first." }); return; }
  if (p.kind === "ask" && !(p.answer && p.answerToken && checkAnswer(me, p.body, p.answer, p.answerToken))) {
    res.status(400).json({ ok: false, error: "Ask Apex again, then share the answer." }); return;
  }
  const tags = tagsIn(p.body);
  if (p.challengeId) {
    const [c] = await db.select().from(socialChallengesTable).where(and(eq(socialChallengesTable.id, p.challengeId), eq(socialChallengesTable.deleted, false))).limit(1);
    if (!c || c.endsAt < new Date()) { res.status(400).json({ ok: false, error: "That challenge has ended." }); return; }
    if (!tags.includes(c.tag)) tags.unshift(c.tag);
  }
  if (p.mediaId) {
    const [m] = await db.select({ userId: socialPostMediaTable.userId }).from(socialPostMediaTable).where(eq(socialPostMediaTable.id, p.mediaId)).limit(1);
    if (!m || m.userId !== me) { res.status(400).json({ ok: false, error: "That photo didn't upload. Try again." }); return; }
  }
  if (p.gameId) {
    const [g] = await db.select({ id: gameFeedTable.id }).from(gameFeedTable).where(eq(gameFeedTable.id, p.gameId)).limit(1);
    if (!g) { res.status(400).json({ ok: false, error: "That game isn't available." }); return; }
  }

  const [row] = await db.insert(socialPostsTable).values({
    userId: me,
    kind: p.kind,
    body: p.body,
    mediaId: p.mediaId ?? null,
    pollOptions: p.kind === "poll" || p.kind === "debate" ? p.pollOptions : null,
    gameId: p.gameId ?? null,
    momentDay: p.kind === "moment" ? momentDay() : null,
    location: p.location || null,
    challengeId: p.challengeId ?? null,
    aiText: p.kind === "ask" ? p.answer : null,
    aiAt: p.kind === "ask" ? new Date() : null,
    visibility: p.visibility,
    tags: tags.slice(0, 10),
  }).returning();
  const [view] = await present([row!], me);
  res.status(201).json({ ok: true, data: { post: view } });
});

const MediaBody = z.object({
  dataUrl: z.string().max(1_200_000),
  width: z.number().int().positive().max(4000).optional(),
  height: z.number().int().positive().max(4000).optional(),
});

router.post("/posts/media", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const parsed = MediaBody.safeParse(req.body);
  const match = parsed.success ? parsed.data.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!parsed.success || !match) { res.status(400).json({ ok: false, error: "That photo is too big or not a JPG, PNG or WebP." }); return; }
  const [row] = await db.insert(socialPostMediaTable).values({
    userId: req.userId!, key: randomBytes(16).toString("hex"), mime: match[1]!, data: match[2]!,
    width: parsed.data.width ?? null, height: parsed.data.height ?? null,
  }).returning({ id: socialPostMediaTable.id, key: socialPostMediaTable.key });
  res.status(201).json({ ok: true, data: { id: row!.id, url: `/api/posts/media/${row!.key}` } });
});

router.get("/posts/media/:key", async (req, res): Promise<void> => {
  const key = String(req.params.key);
  if (!/^[a-f0-9]{32}$/.test(key)) { res.status(404).end(); return; }
  const [m] = await db.select({ mime: socialPostMediaTable.mime, data: socialPostMediaTable.data }).from(socialPostMediaTable).where(eq(socialPostMediaTable.key, key)).limit(1);
  if (!m) { res.status(404).end(); return; }
  const buf = Buffer.from(m.data, "base64");
  res.set({ "Content-Type": m.mime, "Content-Length": String(buf.byteLength), "Cache-Control": "public, max-age=31536000, immutable" });
  res.send(buf);
});

// ── One post ──────────────────────────────────────────────────────────────────

router.get("/posts/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const id = idParam(req.params.id);
  const row = id ? await loadVisible(id, req.userId!) : null;
  if (!row) { res.status(404).json({ ok: false, error: "This post isn't available." }); return; }
  const [view] = await present([row], req.userId!);
  res.json({ ok: true, data: { post: view } });
});

router.delete("/posts/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const id = idParam(req.params.id);
  if (!id) { res.status(404).json({ ok: false, error: "Not found." }); return; }
  const updated = await db.update(socialPostsTable).set({ deleted: true }).where(and(eq(socialPostsTable.id, id), eq(socialPostsTable.userId, req.userId!))).returning({ id: socialPostsTable.id });
  if (!updated.length) { res.status(404).json({ ok: false, error: "You can only delete your own posts." }); return; }
  res.json({ ok: true, data: { deleted: true } });
});

router.post("/posts/:id/react", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const row = id ? await loadVisible(id, me) : null;
  if (!row) { res.status(404).json({ ok: false, error: "This post isn't available." }); return; }
  const removed = await db.delete(postReactionsTable).where(and(eq(postReactionsTable.postId, row.id), eq(postReactionsTable.userId, me))).returning({ id: postReactionsTable.id });
  let reacted = false;
  if (!removed.length) {
    const added = await db.insert(postReactionsTable).values({ postId: row.id, userId: me }).onConflictDoNothing().returning({ id: postReactionsTable.id });
    reacted = added.length > 0;
  }
  const delta = removed.length ? -1 : reacted ? 1 : 0;
  const [u] = await db.update(socialPostsTable).set({ reactionCount: sql`greatest(${socialPostsTable.reactionCount} + ${delta}, 0)` }).where(eq(socialPostsTable.id, row.id)).returning({ n: socialPostsTable.reactionCount });
  if (reacted) {
    const [actor] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, me)).limit(1);
    await notify(row.userId, "post_like", `${actor?.username ?? "Someone"} liked your post`, me);
  }
  res.json({ ok: true, data: { reacted, reactionCount: u?.n ?? 0 } });
});

router.post("/posts/:id/vote", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const row = id ? await loadVisible(id, me) : null;
  const option = Number(req.body?.option);
  if (!row || (row.kind !== "poll" && row.kind !== "debate")) { res.status(404).json({ ok: false, error: "This poll isn't available." }); return; }
  if (!Number.isInteger(option) || option < 0 || option >= (row.pollOptions?.length ?? 0)) { res.status(400).json({ ok: false, error: "Pick one of the choices." }); return; }
  await db.insert(pollVotesTable).values({ postId: row.id, userId: me, option }).onConflictDoUpdate({ target: [pollVotesTable.postId, pollVotesTable.userId], set: { option } });
  const [view] = await present([row], me);
  res.json({ ok: true, data: { poll: view!.poll, debate: view!.debate } });
});

// ── Comments ──────────────────────────────────────────────────────────────────

router.get("/posts/:id/comments", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const row = id ? await loadVisible(id, me) : null;
  if (!row) { res.status(404).json({ ok: false, error: "This post isn't available." }); return; }
  const blocked = await blockedIds(me);
  const rows = await db.select().from(postCommentsTable).where(and(eq(postCommentsTable.postId, row.id), eq(postCommentsTable.deleted, false))).orderBy(postCommentsTable.id).limit(300);
  const visible = rows.filter((c) => !blocked.includes(c.userId));
  const userIds = [...new Set(visible.map((c) => c.userId))];
  const [authors, liked] = await Promise.all([
    userIds.length ? db.select({ id: usersTable.id, username: usersTable.username, avatarEmoji: usersTable.avatarEmoji, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(inArray(usersTable.id, userIds)) : Promise.resolve([]),
    visible.length ? db.select({ commentId: commentReactionsTable.commentId }).from(commentReactionsTable).where(and(eq(commentReactionsTable.userId, me), inArray(commentReactionsTable.commentId, visible.map((c) => c.id)))) : Promise.resolve([]),
  ]);
  const byUser = new Map(authors.map((a) => [a.id, a]));
  const likedSet = new Set(liked.map((l) => l.commentId));
  const view = (c: typeof rows[number]) => ({
    id: c.id, body: c.body, createdAt: c.createdAt, reactionCount: c.reactionCount, reacted: likedSet.has(c.id),
    side: c.side, ai: c.ai, aiPrompt: c.aiPrompt,
    mine: c.userId === me, canDelete: c.userId === me || row.userId === me,
    author: byUser.get(c.userId) ?? { id: c.userId, username: "Someone", avatarEmoji: "🙂", avatarUrl: null },
  });
  const top = visible.filter((c) => !c.parentId).map((c) => ({ ...view(c), replies: visible.filter((r) => r.parentId === c.id).map(view) }));
  res.json({ ok: true, data: { comments: top } });
});

const CommentBody = z.object({
  body: z.string().trim().min(1).max(4000),
  parentId: z.number().int().positive().optional(),
  /** Sharing an Apex answer from /posts/:id/ask-apex: the question and its token */
  aiPrompt: z.string().trim().max(500).optional(),
  aiToken: z.string().max(200).optional(),
});

router.post("/posts/:id/comments", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const row = id ? await loadVisible(id, me) : null;
  if (!row) { res.status(404).json({ ok: false, error: "This post isn't available." }); return; }
  const parsed = CommentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: "Write a comment first." }); return; }
  const ai = !!parsed.data.aiPrompt;
  if (ai && !(parsed.data.aiToken && checkAnswer(me, `post:${row.id}|${parsed.data.aiPrompt}`, parsed.data.body, parsed.data.aiToken))) {
    res.status(400).json({ ok: false, error: "Ask Apex again, then share the answer." }); return;
  }
  if (!ai && parsed.data.body.length > 1000) { res.status(400).json({ ok: false, error: "Comments can be up to 1,000 characters." }); return; }
  // On debates, the comment shows the side its writer picked
  const [vote] = row.kind === "debate" ? await db.select({ option: pollVotesTable.option }).from(pollVotesTable).where(and(eq(pollVotesTable.postId, row.id), eq(pollVotesTable.userId, me))).limit(1) : [];
  const side = vote?.option ?? null;
  let parent: typeof postCommentsTable.$inferSelect | undefined;
  if (parsed.data.parentId) {
    [parent] = await db.select().from(postCommentsTable).where(and(eq(postCommentsTable.id, parsed.data.parentId), eq(postCommentsTable.postId, row.id))).limit(1);
    if (!parent) { res.status(400).json({ ok: false, error: "That comment is gone." }); return; }
  }
  // Replies stay one level deep: replying to a reply attaches to its parent
  const parentId = parent ? parent.parentId ?? parent.id : null;
  const [c] = await db.insert(postCommentsTable).values({ postId: row.id, userId: me, parentId, body: parsed.data.body, side, ai, aiPrompt: ai ? parsed.data.aiPrompt : null }).returning();
  await db.update(socialPostsTable).set({ commentCount: sql`${socialPostsTable.commentCount} + 1` }).where(eq(socialPostsTable.id, row.id));
  const [actor] = await db.select({ username: usersTable.username, avatarEmoji: usersTable.avatarEmoji, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(eq(usersTable.id, me)).limit(1);
  const name = actor?.username ?? "Someone";
  if (parent) await notify(parent.userId, "comment_reply", `${name} replied to your comment`, me);
  if (!parent || parent.userId !== row.userId) await notify(row.userId, "post_comment", `${name} commented on your post`, me);
  res.status(201).json({ ok: true, data: { comment: { id: c!.id, body: c!.body, createdAt: c!.createdAt, parentId, side, ai, aiPrompt: c!.aiPrompt, reactionCount: 0, reacted: false, mine: true, canDelete: true, author: { id: me, ...actor } } } });
});

router.post("/post-comments/:id/react", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const [c] = id ? await db.select().from(postCommentsTable).where(and(eq(postCommentsTable.id, id), eq(postCommentsTable.deleted, false))).limit(1) : [];
  if (!c || !(await loadVisible(c.postId, me))) { res.status(404).json({ ok: false, error: "This comment isn't available." }); return; }
  const removed = await db.delete(commentReactionsTable).where(and(eq(commentReactionsTable.commentId, c.id), eq(commentReactionsTable.userId, me))).returning({ id: commentReactionsTable.id });
  const reacted = !removed.length && (await db.insert(commentReactionsTable).values({ commentId: c.id, userId: me }).onConflictDoNothing().returning({ id: commentReactionsTable.id })).length > 0;
  const delta = removed.length ? -1 : reacted ? 1 : 0;
  const [u] = await db.update(postCommentsTable).set({ reactionCount: sql`greatest(${postCommentsTable.reactionCount} + ${delta}, 0)` }).where(eq(postCommentsTable.id, c.id)).returning({ n: postCommentsTable.reactionCount });
  res.json({ ok: true, data: { reacted, reactionCount: u?.n ?? 0 } });
});

router.delete("/post-comments/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const [c] = id ? await db.select().from(postCommentsTable).where(and(eq(postCommentsTable.id, id), eq(postCommentsTable.deleted, false))).limit(1) : [];
  if (!c) { res.status(404).json({ ok: false, error: "Not found." }); return; }
  const [post] = await db.select({ userId: socialPostsTable.userId }).from(socialPostsTable).where(eq(socialPostsTable.id, c.postId)).limit(1);
  if (c.userId !== me && post?.userId !== me) { res.status(403).json({ ok: false, error: "You can't delete this comment." }); return; }
  await db.update(postCommentsTable).set({ deleted: true }).where(eq(postCommentsTable.id, c.id));
  await db.update(socialPostsTable).set({ commentCount: sql`greatest(${socialPostsTable.commentCount} - 1, 0)` }).where(eq(socialPostsTable.id, c.postId));
  res.json({ ok: true, data: { deleted: true } });
});

// ── Safety: reports and blocks ────────────────────────────────────────────────

const ReportBody = z.object({
  targetType: z.enum(["post", "comment", "user"]),
  targetId: z.number().int().positive(),
  reason: z.enum(["spam", "harassment", "hate", "violence", "nudity", "self_harm", "misinformation", "other"]),
});

router.post("/social-reports", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const parsed = ReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: "Pick a reason." }); return; }
  await db.insert(contentReportsTable).values({ reporterId: req.userId!, ...parsed.data });
  logger.warn({ report: parsed.data, by: req.userId }, "Social report filed");
  res.status(201).json({ ok: true, data: { reported: true } });
});

router.get("/blocks", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const rows = await db.select({ id: usersTable.id, username: usersTable.username, avatarEmoji: usersTable.avatarEmoji })
    .from(userBlocksTable).innerJoin(usersTable, eq(usersTable.id, userBlocksTable.blockedId)).where(eq(userBlocksTable.blockerId, req.userId!));
  res.json({ ok: true, data: { blocked: rows } });
});

router.post("/blocks", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const target = Number(req.body?.userId);
  if (!Number.isInteger(target) || target <= 0 || target === req.userId) { res.status(400).json({ ok: false, error: "Pick someone to block." }); return; }
  await db.insert(userBlocksTable).values({ blockerId: req.userId!, blockedId: target }).onConflictDoNothing();
  // Blocking also unfollows both ways
  await db.delete(followsTable).where(or(and(eq(followsTable.followerId, req.userId!), eq(followsTable.followingId, target)), and(eq(followsTable.followerId, target), eq(followsTable.followingId, req.userId!))));
  res.json({ ok: true, data: { blocked: true } });
});

router.delete("/blocks/:userId", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const target = idParam(req.params.userId);
  if (target) await db.delete(userBlocksTable).where(and(eq(userBlocksTable.blockerId, req.userId!), eq(userBlocksTable.blockedId, target)));
  res.json({ ok: true, data: { blocked: false } });
});

export default router;
