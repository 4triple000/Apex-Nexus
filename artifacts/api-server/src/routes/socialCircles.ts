/**
 * Social, step 3: stories and circles. All routes need a signed-in account.
 *
 *   GET    /stories                   — story tray: yours first, then people you follow (unseen first)
 *   POST   /stories                   — post a story (a photo from /posts/media, or text on a colour); gone after 24h
 *   POST   /stories/:id/view          — mark a story seen
 *   GET    /stories/:id/viewers       — who saw your story
 *   DELETE /stories/:id               — delete your story
 *
 *   GET    /circles                   — circles you're in, and public circles to discover
 *   POST   /circles                   — start a circle
 *   GET    /circles/:id               — one circle (members preview, invite code for members)
 *   POST   /circles/:id/join          — join (public, or with the invite code)
 *   POST   /circles/join-code         — join an invite-only circle by its code
 *   DELETE /circles/:id/membership    — leave
 *   DELETE /circles/:id               — delete a circle you own
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db, usersTable, socialStoriesTable, storyViewsTable, socialPostMediaTable, socialCirclesTable, circleMembersTable } from "@workspace/db";
import { and, asc, desc, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import { requireUser } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";
import { blockedIds, followingIds, idParam } from "../lib/socialPosts";

const router: IRouter = Router();
const bad = (error: string) => ({ ok: false, error });
const authorCols = { id: usersTable.id, username: usersTable.username, avatarEmoji: usersTable.avatarEmoji, avatarUrl: usersTable.avatarUrl };

// ── Stories ───────────────────────────────────────────────────────────────────

export const STORY_BACKGROUNDS = ["night", "gold", "ember", "ocean", "rose", "mono"] as const;
const STORY_HOURS = 24;

router.get("/stories", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const [blocked, following] = await Promise.all([blockedIds(me), followingIds(me)]);
  const authors = [me, ...following.filter((id) => !blocked.includes(id))];
  const rows = await db.select().from(socialStoriesTable)
    .where(and(inArray(socialStoriesTable.userId, authors), eq(socialStoriesTable.deleted, false), gt(socialStoriesTable.expiresAt, new Date())))
    .orderBy(asc(socialStoriesTable.id)).limit(500);
  if (!rows.length) { res.json({ ok: true, data: { groups: [] } }); return; }

  const ids = rows.map((r) => r.id);
  const mediaIds = rows.map((r) => r.mediaId).filter((x): x is number => !!x);
  const [users, seen, media] = await Promise.all([
    db.select(authorCols).from(usersTable).where(inArray(usersTable.id, [...new Set(rows.map((r) => r.userId))])),
    db.select({ storyId: storyViewsTable.storyId }).from(storyViewsTable).where(and(eq(storyViewsTable.userId, me), inArray(storyViewsTable.storyId, ids))),
    mediaIds.length ? db.select({ id: socialPostMediaTable.id, key: socialPostMediaTable.key }).from(socialPostMediaTable).where(inArray(socialPostMediaTable.id, mediaIds)) : Promise.resolve([]),
  ]);
  const seenSet = new Set(seen.map((s) => s.storyId));
  const keyOf = new Map(media.map((m) => [m.id, m.key]));
  const byUser = new Map(users.map((u) => [u.id, u]));

  const groups = new Map<number, { author: (typeof users)[number]; mine: boolean; stories: unknown[]; unseen: number; latest: number }>();
  for (const r of rows) {
    const author = byUser.get(r.userId);
    if (!author) continue;
    const g = groups.get(r.userId) ?? { author, mine: r.userId === me, stories: [], unseen: 0, latest: 0 };
    const isSeen = r.userId === me || seenSet.has(r.id);
    g.stories.push({
      id: r.id, text: r.text, bg: r.bg, createdAt: r.createdAt, expiresAt: r.expiresAt, seen: isSeen,
      media: r.mediaId && keyOf.get(r.mediaId) ? { url: `/api/posts/media/${keyOf.get(r.mediaId)}` } : null,
      viewCount: r.userId === me ? r.viewCount : undefined,
    });
    if (!isSeen) g.unseen++;
    g.latest = Math.max(g.latest, r.id);
    groups.set(r.userId, g);
  }
  // Yours first, then people with stories you haven't seen (newest first), then the rest
  const list = [...groups.values()].sort((a, b) => Number(b.mine) - Number(a.mine) || Number(b.unseen > 0) - Number(a.unseen > 0) || b.latest - a.latest);
  res.json({ ok: true, data: { groups: list.map(({ latest: _l, ...g }) => ({ ...g, allSeen: g.unseen === 0 })) } });
});

const StoryBody = z.object({
  mediaId: z.number().int().positive().optional(),
  text: z.string().trim().max(200).default(""),
  bg: z.enum(STORY_BACKGROUNDS).default("night"),
});

router.post("/stories", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const parsed = StoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(bad("Check your story and try again.")); return; }
  const p = parsed.data;
  if (!p.mediaId && !p.text) { res.status(400).json(bad("Add a photo or write something.")); return; }
  if (p.mediaId) {
    const [m] = await db.select({ userId: socialPostMediaTable.userId }).from(socialPostMediaTable).where(eq(socialPostMediaTable.id, p.mediaId)).limit(1);
    if (!m || m.userId !== me) { res.status(400).json(bad("That photo didn't upload. Try again.")); return; }
  }
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(socialStoriesTable).where(and(eq(socialStoriesTable.userId, me), gt(socialStoriesTable.createdAt, new Date(Date.now() - 86_400_000))));
  if ((recent?.n ?? 0) >= 30) { res.status(429).json(bad("That's a lot of stories today. Try again tomorrow.")); return; }
  const [row] = await db.insert(socialStoriesTable).values({
    userId: me, mediaId: p.mediaId ?? null, text: p.text, bg: p.bg, expiresAt: new Date(Date.now() + STORY_HOURS * 3_600_000),
  }).returning({ id: socialStoriesTable.id });
  res.status(201).json({ ok: true, data: { id: row!.id } });
});

/** A story this person may see: their own, or from someone they follow (and neither blocked the other). */
async function visibleStory(id: number, me: number) {
  const [s] = await db.select().from(socialStoriesTable).where(and(eq(socialStoriesTable.id, id), eq(socialStoriesTable.deleted, false), gt(socialStoriesTable.expiresAt, new Date()))).limit(1);
  if (!s) return null;
  if (s.userId === me) return s;
  const [blocked, following] = await Promise.all([blockedIds(me), followingIds(me)]);
  return following.includes(s.userId) && !blocked.includes(s.userId) ? s : null;
}

router.post("/stories/:id/view", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const s = id ? await visibleStory(id, me) : null;
  if (!s) { res.status(404).json(bad("This story is gone.")); return; }
  if (s.userId !== me) {
    const added = await db.insert(storyViewsTable).values({ storyId: s.id, userId: me }).onConflictDoNothing().returning({ id: storyViewsTable.id });
    if (added.length) await db.update(socialStoriesTable).set({ viewCount: sql`${socialStoriesTable.viewCount} + 1` }).where(eq(socialStoriesTable.id, s.id));
  }
  res.json({ ok: true, data: { seen: true } });
});

router.get("/stories/:id/viewers", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const id = idParam(req.params.id);
  const [s] = id ? await db.select({ userId: socialStoriesTable.userId }).from(socialStoriesTable).where(eq(socialStoriesTable.id, id)).limit(1) : [];
  if (!s || s.userId !== req.userId) { res.status(404).json(bad("Only you can see who viewed your story.")); return; }
  const viewers = await db.select({ ...authorCols, seenAt: storyViewsTable.createdAt }).from(storyViewsTable)
    .innerJoin(usersTable, eq(usersTable.id, storyViewsTable.userId)).where(eq(storyViewsTable.storyId, id!)).orderBy(desc(storyViewsTable.id)).limit(200);
  res.json({ ok: true, data: { viewers } });
});

router.delete("/stories/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const id = idParam(req.params.id);
  const done = id ? await db.update(socialStoriesTable).set({ deleted: true }).where(and(eq(socialStoriesTable.id, id), eq(socialStoriesTable.userId, req.userId!))).returning({ id: socialStoriesTable.id }) : [];
  if (!done.length) { res.status(404).json(bad("You can only delete your own stories.")); return; }
  res.json({ ok: true, data: { deleted: true } });
});

// ── Circles ───────────────────────────────────────────────────────────────────

type CircleRow = typeof socialCirclesTable.$inferSelect;

function viewCircle(c: CircleRow, role: string | null) {
  return {
    id: c.id, name: c.name, description: c.description, emoji: c.emoji, privacy: c.privacy, memberCount: c.memberCount,
    role, member: !!role,
    // Members can share the invite code; it's how people join invite-only circles
    inviteCode: role ? c.inviteCode : null,
  };
}

router.get("/circles", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const memberships = await db.select({ circleId: circleMembersTable.circleId, role: circleMembersTable.role }).from(circleMembersTable).where(eq(circleMembersTable.userId, me));
  const roleOf = new Map(memberships.map((m) => [m.circleId, m.role]));
  const ids = [...roleOf.keys()];
  const [mine, discover] = await Promise.all([
    ids.length ? db.select().from(socialCirclesTable).where(and(inArray(socialCirclesTable.id, ids), eq(socialCirclesTable.deleted, false))).orderBy(desc(socialCirclesTable.memberCount)) : Promise.resolve([]),
    db.select().from(socialCirclesTable)
      .where(and(eq(socialCirclesTable.deleted, false), eq(socialCirclesTable.privacy, "public"), ids.length ? notInArray(socialCirclesTable.id, ids) : sql`true`))
      .orderBy(desc(socialCirclesTable.memberCount), desc(socialCirclesTable.id)).limit(12),
  ]);
  res.json({ ok: true, data: { mine: mine.map((c) => viewCircle(c, roleOf.get(c.id) ?? null)), discover: discover.map((c) => viewCircle(c, null)) } });
});

const CircleBody = z.object({
  name: z.string().trim().min(3, "Give your circle a name.").max(40),
  description: z.string().trim().max(200).default(""),
  emoji: z.string().trim().min(1).max(8).default("✨"),
  privacy: z.enum(["public", "invite"]).default("public"),
});

router.post("/circles", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const parsed = CircleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(bad(parsed.error.issues[0]?.message ?? "Check the circle and try again.")); return; }
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(socialCirclesTable).where(and(eq(socialCirclesTable.ownerId, me), gt(socialCirclesTable.createdAt, new Date(Date.now() - 86_400_000))));
  if ((recent?.n ?? 0) >= 5) { res.status(429).json(bad("You can start 5 circles a day. Try again tomorrow.")); return; }
  const [c] = await db.insert(socialCirclesTable).values({ ownerId: me, ...parsed.data, inviteCode: randomBytes(5).toString("hex") }).returning();
  await db.insert(circleMembersTable).values({ circleId: c!.id, userId: me, role: "owner" });
  res.status(201).json({ ok: true, data: { circle: viewCircle(c!, "owner") } });
});

async function loadCircle(id: number) {
  const [c] = await db.select().from(socialCirclesTable).where(and(eq(socialCirclesTable.id, id), eq(socialCirclesTable.deleted, false))).limit(1);
  return c ?? null;
}
async function roleIn(circleId: number, userId: number) {
  const [m] = await db.select({ role: circleMembersTable.role }).from(circleMembersTable).where(and(eq(circleMembersTable.circleId, circleId), eq(circleMembersTable.userId, userId))).limit(1);
  return m?.role ?? null;
}

router.get("/circles/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const c = id ? await loadCircle(id) : null;
  const role = c ? await roleIn(c.id, me) : null;
  const code = typeof req.query.code === "string" ? req.query.code : "";
  // Invite-only circles stay hidden from people who aren't in them and don't have the code
  if (!c || (c.privacy === "invite" && !role && code !== c.inviteCode)) { res.status(404).json(bad("This circle isn't available.")); return; }
  const blocked = await blockedIds(me);
  const members = (await db.select({ ...authorCols, role: circleMembersTable.role }).from(circleMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, circleMembersTable.userId)).where(eq(circleMembersTable.circleId, c.id))
    .orderBy(asc(circleMembersTable.id)).limit(24)).filter((m) => !blocked.includes(m.id)).slice(0, 12);
  res.json({ ok: true, data: { circle: viewCircle(c, role), members } });
});

async function join(c: CircleRow, me: number) {
  const added = await db.insert(circleMembersTable).values({ circleId: c.id, userId: me }).onConflictDoNothing().returning({ id: circleMembersTable.id });
  if (added.length) await db.update(socialCirclesTable).set({ memberCount: sql`${socialCirclesTable.memberCount} + 1` }).where(eq(socialCirclesTable.id, c.id));
  const fresh = (await loadCircle(c.id)) ?? c;
  return viewCircle(fresh, (await roleIn(c.id, me)) ?? "member");
}

router.post("/circles/join-code", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const code = String(req.body?.code ?? "").trim().toLowerCase();
  const [c] = /^[a-f0-9]{10}$/.test(code) ? await db.select().from(socialCirclesTable).where(and(eq(socialCirclesTable.inviteCode, code), eq(socialCirclesTable.deleted, false))).limit(1) : [];
  if (!c) { res.status(404).json(bad("That invite code didn't work. Check it and try again.")); return; }
  res.json({ ok: true, data: { circle: await join(c, req.userId!) } });
});

router.post("/circles/:id/join", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const id = idParam(req.params.id);
  const c = id ? await loadCircle(id) : null;
  if (!c) { res.status(404).json(bad("This circle isn't available.")); return; }
  if (c.privacy === "invite" && String(req.body?.code ?? "") !== c.inviteCode) { res.status(403).json(bad("This circle is invite-only. Ask a member for the invite code.")); return; }
  res.json({ ok: true, data: { circle: await join(c, req.userId!) } });
});

router.delete("/circles/:id/membership", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  const role = id ? await roleIn(id, me) : null;
  if (!role) { res.status(404).json(bad("You're not in this circle.")); return; }
  if (role === "owner") { res.status(400).json(bad("You own this circle. Delete it instead of leaving.")); return; }
  await db.delete(circleMembersTable).where(and(eq(circleMembersTable.circleId, id!), eq(circleMembersTable.userId, me)));
  await db.update(socialCirclesTable).set({ memberCount: sql`greatest(${socialCirclesTable.memberCount} - 1, 0)` }).where(eq(socialCirclesTable.id, id!));
  res.json({ ok: true, data: { left: true } });
});

router.delete("/circles/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const id = idParam(req.params.id);
  const done = id ? await db.update(socialCirclesTable).set({ deleted: true }).where(and(eq(socialCirclesTable.id, id), eq(socialCirclesTable.ownerId, req.userId!))).returning({ id: socialCirclesTable.id }) : [];
  if (!done.length) { res.status(404).json(bad("Only the owner can delete a circle.")); return; }
  // Members are removed so the circle's posts drop out of their feeds
  await db.delete(circleMembersTable).where(eq(circleMembersTable.circleId, id!));
  res.json({ ok: true, data: { deleted: true } });
});

export default router;
