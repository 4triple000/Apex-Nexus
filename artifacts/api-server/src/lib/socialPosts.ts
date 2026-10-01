/** Shared pieces of the Social API: who can see what, and how a post is shown. */
import {
  db, usersTable, followsTable, notificationsTable, gameFeedTable, socialChallengesTable,
  socialPostsTable, socialPostMediaTable, postReactionsTable, pollVotesTable, userBlocksTable,
} from "@workspace/db";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { promptFor } from "./moments";

// ── Helpers ───────────────────────────────────────────────────────────────────

export const tagsIn = (text: string) =>
  [...new Set([...text.matchAll(/#([\p{L}\p{N}_]{2,30})/gu)].map((m) => m[1]!.toLowerCase()))].slice(0, 10);

export async function blockedIds(userId: number): Promise<number[]> {
  const rows = await db.select().from(userBlocksTable).where(or(eq(userBlocksTable.blockerId, userId), eq(userBlocksTable.blockedId, userId)));
  return rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId));
}

export async function followingIds(userId: number): Promise<number[]> {
  const rows = await db.select({ id: followsTable.followingId }).from(followsTable).where(eq(followsTable.followerId, userId));
  return rows.map((r) => r.id);
}

/** Posts this person may see: public ones, followers-only from people they follow, and all their own. */
export function visibleTo(userId: number, following: number[]): SQL {
  return or(
    eq(socialPostsTable.userId, userId),
    eq(socialPostsTable.visibility, "public"),
    following.length ? and(eq(socialPostsTable.visibility, "followers"), inArray(socialPostsTable.userId, following)) : sql`false`,
  )!;
}

export async function notify(userId: number, type: string, message: string, fromUserId: number) {
  if (userId === fromUserId) return;
  await db.insert(notificationsTable).values({ userId, type, message, relatedUserId: fromUserId }).catch(() => undefined);
}

export type PostRow = typeof socialPostsTable.$inferSelect;

/** Turns post rows into what the app shows: author, photo URL, poll results, game, and whether you liked it. */
export async function present(rows: PostRow[], viewerId: number) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.userId))];
  const mediaIds = rows.map((r) => r.mediaId).filter((x): x is number => !!x);
  const gameIds = rows.map((r) => r.gameId).filter((x): x is number => !!x);
  const pollIds = rows.filter((r) => r.kind === "poll" || r.kind === "debate").map((r) => r.id);
  const challengeIds = [...new Set(rows.map((r) => r.challengeId).filter((x): x is number => !!x))];

  const [authors, reacted, media, games, votes, myVotes, challenges] = await Promise.all([
    db.select({ id: usersTable.id, username: usersTable.username, avatarEmoji: usersTable.avatarEmoji, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(inArray(usersTable.id, authorIds)),
    db.select({ postId: postReactionsTable.postId }).from(postReactionsTable).where(and(eq(postReactionsTable.userId, viewerId), inArray(postReactionsTable.postId, ids))),
    mediaIds.length ? db.select({ id: socialPostMediaTable.id, key: socialPostMediaTable.key, width: socialPostMediaTable.width, height: socialPostMediaTable.height }).from(socialPostMediaTable).where(inArray(socialPostMediaTable.id, mediaIds)) : Promise.resolve([]),
    gameIds.length ? db.select({ id: gameFeedTable.id, name: gameFeedTable.name, creatorName: gameFeedTable.creatorName, playCount: gameFeedTable.playCount, likeCount: gameFeedTable.likeCount, gameConfig: gameFeedTable.gameConfig }).from(gameFeedTable).where(inArray(gameFeedTable.id, gameIds)) : Promise.resolve([]),
    pollIds.length ? db.select({ postId: pollVotesTable.postId, option: pollVotesTable.option, n: sql<number>`count(*)::int` }).from(pollVotesTable).where(inArray(pollVotesTable.postId, pollIds)).groupBy(pollVotesTable.postId, pollVotesTable.option) : Promise.resolve([]),
    pollIds.length ? db.select({ postId: pollVotesTable.postId, option: pollVotesTable.option }).from(pollVotesTable).where(and(eq(pollVotesTable.userId, viewerId), inArray(pollVotesTable.postId, pollIds))) : Promise.resolve([]),
    challengeIds.length ? db.select({ id: socialChallengesTable.id, title: socialChallengesTable.title, tag: socialChallengesTable.tag }).from(socialChallengesTable).where(inArray(socialChallengesTable.id, challengeIds)) : Promise.resolve([]),
  ]);
  const byChallenge = new Map(challenges.map((c) => [c.id, c]));
  const byAuthor = new Map(authors.map((a) => [a.id, a]));
  const reactedSet = new Set(reacted.map((r) => r.postId));
  const byMedia = new Map(media.map((m) => [m.id, m]));
  const byGame = new Map(games.map((g) => [g.id, g]));
  const myVote = new Map(myVotes.map((v) => [v.postId, v.option]));

  return rows.map((r) => {
    const m = r.mediaId ? byMedia.get(r.mediaId) : undefined;
    const g = r.gameId ? byGame.get(r.gameId) : undefined;
    const options = r.pollOptions ?? [];
    const counts = options.map((_, i) => votes.find((v) => v.postId === r.id && v.option === i)?.n ?? 0);
    return {
      id: r.id,
      kind: r.kind,
      body: r.body,
      createdAt: r.createdAt,
      location: r.location,
      visibility: r.visibility,
      tags: r.tags,
      reactionCount: r.reactionCount,
      commentCount: r.commentCount,
      reacted: reactedSet.has(r.id),
      mine: r.userId === viewerId,
      author: byAuthor.get(r.userId) ?? { id: r.userId, username: "Someone", avatarEmoji: "🙂", avatarUrl: null },
      media: m ? { url: `/api/posts/media/${m.key}`, width: m.width, height: m.height } : null,
      poll: r.kind === "poll" ? { options, counts, total: counts.reduce((a, b) => a + b, 0), myVote: myVote.get(r.id) ?? null } : null,
      game: g ? { id: g.id, name: g.name, creatorName: g.creatorName, playCount: g.playCount, likeCount: g.likeCount, mode: (g.gameConfig as { gameMode?: string } | null)?.gameMode ?? null } : null,
      moment: r.momentDay ? { day: r.momentDay, prompt: promptFor(r.momentDay) } : null,
      debate: r.kind === "debate" ? { sides: options, counts, total: counts.reduce((a, b) => a + b, 0), mySide: myVote.get(r.id) ?? null, summary: r.aiText, summaryAt: r.aiAt } : null,
      answer: r.kind === "ask" ? r.aiText : null,
      challenge: r.challengeId && byChallenge.get(r.challengeId) ? byChallenge.get(r.challengeId)! : null,
    };
  });
}

export async function loadVisible(postId: number, viewerId: number): Promise<PostRow | null> {
  const [row] = await db.select().from(socialPostsTable).where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.deleted, false))).limit(1);
  if (!row) return null;
  if (row.userId !== viewerId) {
    if ((await blockedIds(viewerId)).includes(row.userId)) return null;
    if (row.visibility === "private") return null;
    if (row.visibility === "followers" && !(await followingIds(viewerId)).includes(row.userId)) return null;
  }
  return row;
}

export const idParam = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

