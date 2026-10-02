/**
 * People on Social: profiles, follow, and search. All routes need a signed-in account.
 *
 *   GET  /people/search?q=               — people, hashtags and public circles matching q
 *   GET  /people/:id                      — a profile ("me" for your own): stats, creations, achievements
 *   GET  /people/:id/posts?tab=&cursor=   — their posts: posts · moments · creations · games
 *   GET  /people/:id/followers|following  — lists
 *   POST /people/:id/follow               — follow / unfollow
 *   PUT  /people/me                       — edit bio, tagline, interests and cover
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, usersTable, followsTable, notificationsTable, socialPostsTable, socialProfilesTable, socialCirclesTable } from "@workspace/db";
import { and, desc, eq, ilike, inArray, lt, sql, type SQL } from "drizzle-orm";
import { requireUser } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";
import { blockedIds, followingIds, circleIds, visibleTo, present, idParam } from "../lib/socialPosts";

const router: IRouter = Router();
const bad = (error: string) => ({ ok: false, error });
const COVERS = ["city", "sunset", "studio", "neon", "arcade", "gold", "night"] as const;
const userCols = { id: usersTable.id, username: usersTable.username, avatarEmoji: usersTable.avatarEmoji, avatarUrl: usersTable.avatarUrl, bio: usersTable.bio, followersCount: usersTable.followersCount, followingCount: usersTable.followingCount };

const whoParam = (v: unknown, me: number) => (v === "me" ? me : idParam(v));

router.get("/people/search", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const q = String(req.query.q ?? "").trim().replace(/^[#@]/, "").slice(0, 40);
  if (q.length < 1) { res.json({ ok: true, data: { people: [], tags: [], circles: [] } }); return; }
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const blocked = await blockedIds(me);
  const [people, tags, circles] = await Promise.all([
    db.select({ id: usersTable.id, username: usersTable.username, avatarEmoji: usersTable.avatarEmoji, avatarUrl: usersTable.avatarUrl, followersCount: usersTable.followersCount })
      .from(usersTable).where(ilike(usersTable.username, like)).orderBy(desc(usersTable.followersCount)).limit(12),
    db.execute(sql`
      select tag, count(*)::int as n from ${socialPostsTable}, jsonb_array_elements_text(${socialPostsTable.tags}) as tag
      where ${socialPostsTable.deleted} = false and ${socialPostsTable.visibility} = 'public' and ${socialPostsTable.circleId} is null and tag ilike ${like}
      group by tag order by n desc limit 8`),
    db.select({ id: socialCirclesTable.id, name: socialCirclesTable.name, emoji: socialCirclesTable.emoji, memberCount: socialCirclesTable.memberCount })
      .from(socialCirclesTable).where(and(eq(socialCirclesTable.deleted, false), eq(socialCirclesTable.privacy, "public"), ilike(socialCirclesTable.name, like))).limit(6),
  ]);
  res.json({ ok: true, data: {
    people: people.filter((p) => !blocked.includes(p.id)),
    tags: (tags.rows as { tag: string; n: number }[]).map((t) => ({ tag: t.tag, count: Number(t.n) })),
    circles,
  } });
});

/** Which of this person's posts the viewer may see. */
async function postsWhere(userId: number, me: number): Promise<SQL[]> {
  const [following, circles] = await Promise.all([followingIds(me), circleIds(me)]);
  return [eq(socialPostsTable.userId, userId), eq(socialPostsTable.deleted, false), visibleTo(me, following, circles)];
}

router.get("/people/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = whoParam(req.params.id, me);
  const [user] = id ? await db.select(userCols).from(usersTable).where(eq(usersTable.id, id)).limit(1) : [];
  if (!user || (await blockedIds(me)).includes(user.id)) { res.status(404).json(bad("This profile isn't available.")); return; }
  const where = await postsWhere(user.id, me);
  const count = (extra?: SQL) => db.select({ n: sql<number>`count(*)::int` }).from(socialPostsTable).where(and(...where, ...(extra ? [extra] : []))).then((r) => r[0]?.n ?? 0);
  const followCount = (col: typeof followsTable.followerId | typeof followsTable.followingId) => db.select({ n: sql<number>`count(*)::int` }).from(followsTable).where(eq(col, user.id)).then((r) => r[0]?.n ?? 0);
  const [extras, following, posts, games, voice, reels, apex, moments, challenges, interactions, followers, followingCount] = await Promise.all([
    db.select().from(socialProfilesTable).where(eq(socialProfilesTable.userId, user.id)).limit(1).then((r) => r[0]),
    user.id === me ? Promise.resolve(false) : db.select({ id: followsTable.id }).from(followsTable).where(and(eq(followsTable.followerId, me), eq(followsTable.followingId, user.id))).limit(1).then((r) => r.length > 0),
    count(),
    count(eq(socialPostsTable.kind, "game")),
    count(eq(socialPostsTable.kind, "voice")),
    count(eq(socialPostsTable.kind, "video")),
    count(eq(socialPostsTable.kind, "ask")),
    count(eq(socialPostsTable.kind, "moment")),
    db.select({ n: sql<number>`count(distinct ${socialPostsTable.challengeId})::int` }).from(socialPostsTable).where(and(eq(socialPostsTable.userId, user.id), eq(socialPostsTable.deleted, false))).then((r) => r[0]?.n ?? 0),
    db.select({ n: sql<number>`coalesce(sum(${socialPostsTable.reactionCount} + ${socialPostsTable.commentCount}), 0)::int` }).from(socialPostsTable).where(and(eq(socialPostsTable.userId, user.id), eq(socialPostsTable.deleted, false))).then((r) => r[0]?.n ?? 0),
    followCount(followsTable.followingId),
    followCount(followsTable.followerId),
  ]);
  res.json({ ok: true, data: {
    user: { id: user.id, username: user.username, avatarEmoji: user.avatarEmoji, avatarUrl: user.avatarUrl, bio: user.bio ?? "" },
    profile: { cover: extras?.cover ?? "city", tagline: extras?.tagline ?? "", interests: extras?.interests ?? "" },
    stats: { posts, followers, following: followingCount },
    creations: { games, voice, reels, apex },
    achievements: { challenges, interactions, moments },
    mine: user.id === me,
    following,
  } });
});

router.get("/people/:id/posts", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = whoParam(req.params.id, me);
  if (!id || (await blockedIds(me)).includes(id)) { res.status(404).json(bad("This profile isn't available.")); return; }
  const where = await postsWhere(id, me);
  const tab = String(req.query.tab ?? "posts");
  if (tab === "moments") where.push(eq(socialPostsTable.kind, "moment"));
  if (tab === "creations") where.push(inArray(socialPostsTable.kind, ["video", "voice", "ask", "photo"]));
  if (tab === "games") where.push(eq(socialPostsTable.kind, "game"));
  const cursor = idParam(req.query.cursor);
  if (cursor) where.push(lt(socialPostsTable.id, cursor));
  const rows = await db.select().from(socialPostsTable).where(and(...where)).orderBy(desc(socialPostsTable.id)).limit(16);
  const page = rows.slice(0, 15);
  res.json({ ok: true, data: { posts: await present(page, me), nextCursor: rows.length > 15 ? String(page[page.length - 1]!.id) : null } });
});

for (const which of ["followers", "following"] as const) {
  router.get(`/people/:id/${which}`, requireUser, async (req: ApexRequest, res): Promise<void> => {
    const me = req.userId!;
    const id = whoParam(req.params.id, me);
    if (!id) { res.status(404).json(bad("Not found.")); return; }
    const rows = await db.select({ other: which === "followers" ? followsTable.followerId : followsTable.followingId }).from(followsTable)
      .where(eq(which === "followers" ? followsTable.followingId : followsTable.followerId, id)).orderBy(desc(followsTable.id)).limit(100);
    const blocked = await blockedIds(me);
    const ids = rows.map((r) => r.other).filter((x) => !blocked.includes(x));
    const people = ids.length ? await db.select({ id: usersTable.id, username: usersTable.username, avatarEmoji: usersTable.avatarEmoji, avatarUrl: usersTable.avatarUrl, followersCount: usersTable.followersCount }).from(usersTable).where(inArray(usersTable.id, ids)) : [];
    res.json({ ok: true, data: { people } });
  });
}

router.post("/people/:id/follow", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const id = idParam(req.params.id);
  if (!id || id === me) { res.status(400).json(bad("You can't follow yourself.")); return; }
  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target || (await blockedIds(me)).includes(id)) { res.status(404).json(bad("This profile isn't available.")); return; }
  const removed = await db.delete(followsTable).where(and(eq(followsTable.followerId, me), eq(followsTable.followingId, id))).returning({ id: followsTable.id });
  let following = false;
  if (removed.length) {
    await db.update(usersTable).set({ followersCount: sql`greatest(${usersTable.followersCount} - 1, 0)` }).where(eq(usersTable.id, id));
    await db.update(usersTable).set({ followingCount: sql`greatest(${usersTable.followingCount} - 1, 0)` }).where(eq(usersTable.id, me));
  } else {
    const added = await db.insert(followsTable).values({ followerId: me, followingId: id }).onConflictDoNothing().returning({ id: followsTable.id });
    following = true;
    if (added.length) {
      await db.update(usersTable).set({ followersCount: sql`${usersTable.followersCount} + 1` }).where(eq(usersTable.id, id));
      await db.update(usersTable).set({ followingCount: sql`${usersTable.followingCount} + 1` }).where(eq(usersTable.id, me));
      const [actor] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, me)).limit(1);
      await db.insert(notificationsTable).values({ userId: id, type: "follow", message: `${actor?.username ?? "Someone"} started following you`, relatedUserId: me }).catch(() => undefined);
    }
  }
  const [u] = await db.select({ n: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followingId, id));
  res.json({ ok: true, data: { following, followers: u?.n ?? 0 } });
});

const ProfileBody = z.object({
  bio: z.string().trim().max(160).optional(),
  tagline: z.string().trim().max(40).optional(),
  interests: z.string().trim().max(60).optional(),
  cover: z.enum(COVERS).optional(),
});

router.put("/people/me", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const parsed = ProfileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(bad("Check your profile and try again.")); return; }
  const { bio, ...extras } = parsed.data;
  if (bio !== undefined) await db.update(usersTable).set({ bio }).where(eq(usersTable.id, me));
  if (Object.keys(extras).length) {
    await db.insert(socialProfilesTable).values({ userId: me, ...extras }).onConflictDoUpdate({ target: socialProfilesTable.userId, set: { ...extras, updatedAt: new Date() } });
  }
  res.json({ ok: true, data: { saved: true } });
});

export default router;
