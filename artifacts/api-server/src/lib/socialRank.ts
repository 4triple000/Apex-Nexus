/**
 * For You ranking. Scores the newest posts (last 14 days, up to 400) for one person:
 *
 *   score = freshness × (1 + engagement + closeness + interests)
 *
 *   freshness   halves every 18 hours
 *   engagement  likes and comments (comments count double), on a log scale so big posts don't drown out the rest
 *   closeness   you follow the author, or you've liked / commented on their posts in the last 30 days
 *   interests   the post's hashtags match tags you've posted, liked or commented on lately
 *
 * After sorting, the same author is spread out so one person can't fill the screen.
 * The order is kept for 10 minutes per person, so scrolling pages through one stable list.
 * Older posts continue in time order once the ranked list runs out.
 */
import { db, socialPostsTable, postReactionsTable, postCommentsTable } from "@workspace/db";
import { and, desc, eq, gt, type SQL } from "drizzle-orm";

const WINDOW_DAYS = 14;
const MAX_CANDIDATES = 400;
const HALF_LIFE_H = 18;
const CACHE_MS = 10 * 60_000;

const cache = new Map<number, { ids: number[]; at: number }>();

interface Signals { authors: Map<number, number>; tags: Map<string, number> }

/** What this person has engaged with in the last 30 days. */
async function signalsFor(me: number): Promise<Signals> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [liked, commented, mine] = await Promise.all([
    db.select({ userId: socialPostsTable.userId, tags: socialPostsTable.tags }).from(postReactionsTable)
      .innerJoin(socialPostsTable, eq(socialPostsTable.id, postReactionsTable.postId))
      .where(and(eq(postReactionsTable.userId, me), gt(postReactionsTable.createdAt, since))).limit(300),
    db.select({ userId: socialPostsTable.userId, tags: socialPostsTable.tags }).from(postCommentsTable)
      .innerJoin(socialPostsTable, eq(socialPostsTable.id, postCommentsTable.postId))
      .where(and(eq(postCommentsTable.userId, me), gt(postCommentsTable.createdAt, since))).limit(300),
    db.select({ tags: socialPostsTable.tags }).from(socialPostsTable)
      .where(and(eq(socialPostsTable.userId, me), gt(socialPostsTable.createdAt, since))).limit(100),
  ]);
  const authors = new Map<number, number>();
  const tags = new Map<string, number>();
  const bump = <K>(m: Map<K, number>, k: K, n: number) => m.set(k, (m.get(k) ?? 0) + n);
  for (const r of liked) { if (r.userId !== me) bump(authors, r.userId, 1); r.tags.forEach((t) => bump(tags, t, 1)); }
  for (const r of commented) { if (r.userId !== me) bump(authors, r.userId, 2); r.tags.forEach((t) => bump(tags, t, 2)); }
  for (const r of mine) r.tags.forEach((t) => bump(tags, t, 1));
  return { authors, tags };
}

/**
 * Post ids in For You order. `where` must already limit to posts this person may see.
 * `fresh` recomputes instead of using the 10-minute copy (the first page of a new scroll).
 */
export async function forYouOrder(me: number, following: number[], where: SQL[], fresh: boolean): Promise<number[]> {
  const hit = cache.get(me);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.ids;

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const [rows, sig] = await Promise.all([
    db.select({ id: socialPostsTable.id, userId: socialPostsTable.userId, createdAt: socialPostsTable.createdAt, reactionCount: socialPostsTable.reactionCount, commentCount: socialPostsTable.commentCount, tags: socialPostsTable.tags })
      .from(socialPostsTable).where(and(...where, gt(socialPostsTable.createdAt, since))).orderBy(desc(socialPostsTable.id)).limit(MAX_CANDIDATES),
    signalsFor(me),
  ]);
  const follows = new Set(following);
  const now = Date.now();
  const scored = rows.map((r) => {
    const hours = Math.max(0, (now - r.createdAt.getTime()) / 3_600_000);
    const freshness = Math.pow(0.5, hours / HALF_LIFE_H);
    const engagement = 0.6 * Math.log1p(r.reactionCount + 2 * r.commentCount);
    const closeness = r.userId === me ? 0.5 : (follows.has(r.userId) ? 1 : 0) + 0.8 * Math.min(1, (sig.authors.get(r.userId) ?? 0) / 5);
    const interests = Math.min(1.5, r.tags.reduce((sum, t) => sum + (sig.tags.has(t) ? 0.5 : 0), 0));
    return { id: r.id, userId: r.userId, score: freshness * (1 + engagement + closeness + interests) };
  }).sort((a, b) => b.score - a.score || b.id - a.id);

  // Spread authors out: each earlier post by the same person in the list lowers the next one by 30%
  const placed: typeof scored = [];
  const seen = new Map<number, number>();
  const pool = scored;
  while (pool.length) {
    let best = 0, bestScore = -1;
    for (let i = 0; i < Math.min(pool.length, 25); i++) {
      const s = pool[i]!.score * Math.pow(0.7, seen.get(pool[i]!.userId) ?? 0);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    const [next] = pool.splice(best, 1);
    placed.push(next!);
    seen.set(next!.userId, (seen.get(next!.userId) ?? 0) + 1);
  }
  const ids = placed.map((p) => p.id);
  cache.set(me, { ids, at: Date.now() });
  if (cache.size > 5000) cache.delete(cache.keys().next().value!);
  return ids;
}
