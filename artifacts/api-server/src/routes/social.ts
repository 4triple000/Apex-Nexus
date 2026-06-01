import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, usersTable, followsTable, projectLikesTable, notificationsTable, studioMarketplaceTable } from "@workspace/db";
import { eq, and, desc, sql, inArray, ne } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

function randomUsername(): string {
  const adj = ["Cosmic", "Neon", "Swift", "Bold", "Sharp", "Epic", "Vivid", "Bright", "Rapid", "Keen"];
  const noun = ["Builder", "Coder", "Maker", "Creator", "Dev", "Hacker", "Wizard", "Forge", "Spark", "Pixel"];
  return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}${Math.floor(Math.random() * 999)}`;
}

async function resolveUser(sessionId: string) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.sessionId, sessionId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(usersTable).values({ sessionId, username: randomUsername() }).returning();
  return created;
}

async function createNotification(userId: number, type: string, message: string, relatedUserId?: number, relatedProjectId?: number) {
  try {
    await db.insert(notificationsTable).values({ userId, type, message, relatedUserId, relatedProjectId });
  } catch {
    // Non-fatal
  }
}

// ─── MY PROFILE ───────────────────────────────────────────────────────────────

router.get("/social/me", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || req.query.sessionId as string;
  if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }
  const user = await resolveUser(sessionId);
  res.json({ user });
});

router.put("/social/me", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || req.body.sessionId;
  if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }
  const schema = z.object({ username: z.string().min(2).max(30).optional(), bio: z.string().max(200).optional(), avatarEmoji: z.string().max(4).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const user = await resolveUser(sessionId);
  const [updated] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, user.id)).returning();
  res.json({ user: updated });
});

// ─── PUBLIC PROFILE ───────────────────────────────────────────────────────────

router.get("/social/profile/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }
  const viewerSessionId = req.headers["x-session-id"] as string || req.query.sessionId as string;

  const [profile] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!profile) { res.status(404).json({ error: "User not found" }); return; }

  // Published projects by this user
  const projects = await db.select().from(studioMarketplaceTable)
    .where(and(eq(studioMarketplaceTable.authorId, userId), eq(studioMarketplaceTable.isPublic, true)))
    .orderBy(desc(studioMarketplaceTable.publishedAt))
    .limit(20);

  // Aggregate stats
  const totalLikes = projects.reduce((s, p) => s + p.likes, 0);
  const totalPlays = projects.reduce((s, p) => s + p.plays, 0);
  const totalRemixes = projects.reduce((s, p) => s + p.remixes, 0);
  const reputation = totalPlays + totalLikes * 2 + totalRemixes * 3 + profile.followersCount * 5;

  // Is viewer following this user?
  let isFollowing = false;
  if (viewerSessionId) {
    const viewer = await resolveUser(viewerSessionId);
    if (viewer.id !== userId) {
      const [f] = await db.select().from(followsTable)
        .where(and(eq(followsTable.followerId, viewer.id), eq(followsTable.followingId, userId))).limit(1);
      isFollowing = !!f;
    }
  }

  res.json({ profile, projects, stats: { totalLikes, totalPlays, totalRemixes, reputation }, isFollowing });
});

// ─── FOLLOW / UNFOLLOW ────────────────────────────────────────────────────────

router.post("/social/follow", async (req, res): Promise<void> => {
  const { sessionId, targetUserId } = req.body as { sessionId: string; targetUserId: number };
  if (!sessionId || !targetUserId) { res.status(400).json({ error: "sessionId + targetUserId required" }); return; }
  const follower = await resolveUser(sessionId);
  if (follower.id === targetUserId) { res.status(400).json({ error: "Cannot follow yourself" }); return; }

  try {
    await db.insert(followsTable).values({ followerId: follower.id, followingId: targetUserId });
    await db.update(usersTable).set({ followersCount: sql`${usersTable.followersCount} + 1` }).where(eq(usersTable.id, targetUserId));
    await db.update(usersTable).set({ followingCount: sql`${usersTable.followingCount} + 1` }).where(eq(usersTable.id, follower.id));
    await createNotification(targetUserId, "follow", `${follower.username} started following you`, follower.id);
    res.json({ following: true });
  } catch {
    res.json({ following: true }); // already following — idempotent
  }
});

router.post("/social/unfollow", async (req, res): Promise<void> => {
  const { sessionId, targetUserId } = req.body as { sessionId: string; targetUserId: number };
  if (!sessionId || !targetUserId) { res.status(400).json({ error: "sessionId + targetUserId required" }); return; }
  const follower = await resolveUser(sessionId);

  const deleted = await db.delete(followsTable)
    .where(and(eq(followsTable.followerId, follower.id), eq(followsTable.followingId, targetUserId)))
    .returning();

  if (deleted.length > 0) {
    await db.update(usersTable).set({ followersCount: sql`GREATEST(0, ${usersTable.followersCount} - 1)` }).where(eq(usersTable.id, targetUserId));
    await db.update(usersTable).set({ followingCount: sql`GREATEST(0, ${usersTable.followingCount} - 1)` }).where(eq(usersTable.id, follower.id));
  }
  res.json({ following: false });
});

router.get("/social/followers/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const rows = await db.select().from(followsTable).where(eq(followsTable.followingId, userId)).limit(50);
  const ids = rows.map((r) => r.followerId);
  const users = ids.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, ids)) : [];
  res.json({ users });
});

router.get("/social/following/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const rows = await db.select().from(followsTable).where(eq(followsTable.followerId, userId)).limit(50);
  const ids = rows.map((r) => r.followingId);
  const users = ids.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, ids)) : [];
  res.json({ users });
});

// ─── LIKE / UNLIKE ────────────────────────────────────────────────────────────

router.post("/social/like", async (req, res): Promise<void> => {
  const { sessionId, projectId } = req.body as { sessionId: string; projectId: number };
  if (!sessionId || !projectId) { res.status(400).json({ error: "sessionId + projectId required" }); return; }
  const user = await resolveUser(sessionId);

  const existing = await db.select().from(projectLikesTable)
    .where(and(eq(projectLikesTable.userId, user.id), eq(projectLikesTable.projectId, projectId))).limit(1);

  if (existing.length > 0) {
    // Unlike
    await db.delete(projectLikesTable).where(eq(projectLikesTable.id, existing[0].id));
    await db.update(studioMarketplaceTable).set({ likes: sql`GREATEST(0, ${studioMarketplaceTable.likes} - 1)` }).where(eq(studioMarketplaceTable.id, projectId));
    res.json({ liked: false });
  } else {
    // Like
    await db.insert(projectLikesTable).values({ userId: user.id, projectId });
    await db.update(studioMarketplaceTable).set({ likes: sql`${studioMarketplaceTable.likes} + 1` }).where(eq(studioMarketplaceTable.id, projectId));
    // Notify project author
    const [project] = await db.select().from(studioMarketplaceTable).where(eq(studioMarketplaceTable.id, projectId)).limit(1);
    if (project?.authorId && project.authorId !== user.id) {
      await createNotification(project.authorId, "like", `${user.username} liked your project "${project.title}"`, user.id, projectId);
    }
    res.json({ liked: true });
  }
});

// Batch-check which projects the current user has liked
router.post("/social/likes/check", async (req, res): Promise<void> => {
  const { sessionId, projectIds } = req.body as { sessionId: string; projectIds: number[] };
  if (!sessionId || !projectIds?.length) { res.json({ likedIds: [] }); return; }
  const user = await resolveUser(sessionId);
  const rows = await db.select().from(projectLikesTable)
    .where(and(eq(projectLikesTable.userId, user.id), inArray(projectLikesTable.projectId, projectIds)));
  res.json({ likedIds: rows.map((r) => r.projectId) });
});

// ─── ACTIVITY FEED ────────────────────────────────────────────────────────────

router.get("/social/feed", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || req.query.sessionId as string;

  let followedItems: typeof studioMarketplaceTable.$inferSelect[] = [];

  if (sessionId) {
    const user = await resolveUser(sessionId);
    // Get people this user follows
    const following = await db.select().from(followsTable).where(eq(followsTable.followerId, user.id)).limit(100);
    const followingIds = following.map((f) => f.followingId);

    if (followingIds.length > 0) {
      followedItems = await db.select().from(studioMarketplaceTable)
        .where(and(eq(studioMarketplaceTable.isPublic, true), inArray(studioMarketplaceTable.authorId, followingIds)))
        .orderBy(desc(studioMarketplaceTable.publishedAt))
        .limit(30);
    }
  }

  // Trending (by plays + likes in last 7 days — simplified by sort)
  const trending = await db.select().from(studioMarketplaceTable)
    .where(eq(studioMarketplaceTable.isPublic, true))
    .orderBy(desc(sql`${studioMarketplaceTable.plays} + ${studioMarketplaceTable.likes} * 2 + ${studioMarketplaceTable.remixes} * 3`))
    .limit(20);

  // Recent remixes
  const recent = await db.select().from(studioMarketplaceTable)
    .where(eq(studioMarketplaceTable.isPublic, true))
    .orderBy(desc(studioMarketplaceTable.publishedAt))
    .limit(20);

  res.json({ following: followedItems, trending, recent });
});

// ─── EXPLORE / DISCOVER ───────────────────────────────────────────────────────

router.get("/social/explore", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || req.query.sessionId as string;

  // Trending projects
  const trendingProjects = await db.select().from(studioMarketplaceTable)
    .where(eq(studioMarketplaceTable.isPublic, true))
    .orderBy(desc(sql`${studioMarketplaceTable.plays} + ${studioMarketplaceTable.likes} * 2 + ${studioMarketplaceTable.remixes} * 3`))
    .limit(12);

  // Top creators (users with most followers + published projects)
  const allCreatorIds = await db.select({ authorId: studioMarketplaceTable.authorId })
    .from(studioMarketplaceTable)
    .where(and(eq(studioMarketplaceTable.isPublic, true), sql`${studioMarketplaceTable.authorId} IS NOT NULL`))
    .groupBy(studioMarketplaceTable.authorId)
    .limit(20);

  const creatorIds = allCreatorIds.map((r) => r.authorId).filter(Boolean) as number[];

  // Exclude people already followed
  let suggestedCreators: typeof usersTable.$inferSelect[] = [];
  if (creatorIds.length > 0) {
    let excluded: number[] = [];
    if (sessionId) {
      const me = await resolveUser(sessionId);
      const following = await db.select().from(followsTable).where(eq(followsTable.followerId, me.id));
      excluded = [me.id, ...following.map((f) => f.followingId)];
    }
    const q = db.select().from(usersTable)
      .where(inArray(usersTable.id, creatorIds))
      .orderBy(desc(usersTable.followersCount))
      .limit(8)
      .$dynamic();
    suggestedCreators = await q;
    if (excluded.length > 0) {
      suggestedCreators = suggestedCreators.filter((u) => !excluded.includes(u.id));
    }
  }

  res.json({ trendingProjects, suggestedCreators });
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

router.get("/social/notifications", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || req.query.sessionId as string;
  if (!sessionId) { res.json({ notifications: [], unreadCount: 0 }); return; }
  const user = await resolveUser(sessionId);
  const notifications = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(30);
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({ notifications, unreadCount });
});

router.post("/social/notifications/read", async (req, res): Promise<void> => {
  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }
  const user = await resolveUser(sessionId);
  await db.update(notificationsTable).set({ read: true }).where(
    and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, false))
  );
  res.json({ ok: true });
});

export default router;
