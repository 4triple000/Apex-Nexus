/**
 * Reels and voice notes: uploading and streaming the files.
 *
 *   POST /media/upload?kind=video|audio&duration=&width=&height=   — raw file body (video up to 32 MB / 65 s, audio up to 8 MB / 65 s)
 *   GET  /media/:key                                              — the file, with byte ranges so phones can stream and seek
 *   GET  /posts/reels?cursor=                                     — reels (video posts), newest first
 *
 * Files live in Postgres (social_media_blobs) until object storage is set up on the server.
 * Each person can keep up to 400 MB of video and voice.
 */
import express, { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { db, socialMediaBlobsTable, socialPostsTable } from "@workspace/db";
import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { requireUser } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";
import { blockedIds, followingIds, circleIds, visibleTo, present, idParam } from "../lib/socialPosts";

const router: IRouter = Router();
const bad = (error: string) => ({ ok: false, error });

const TYPES: Record<string, "video" | "audio"> = {
  "video/mp4": "video", "video/webm": "video", "video/quicktime": "video",
  "audio/webm": "audio", "audio/mp4": "audio", "audio/mpeg": "audio", "audio/ogg": "audio", "audio/aac": "audio", "audio/x-m4a": "audio",
};
const MAX_BYTES = { video: 32 * 1024 * 1024, audio: 8 * 1024 * 1024 };
const MAX_MS = 65_000;
const PER_USER_BYTES = 400 * 1024 * 1024;

const mimeOf = (req: express.Request) => String(req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
const rawBody = express.raw({ type: (req) => mimeOf(req as express.Request) in TYPES, limit: "33mb" });

router.post("/media/upload", requireUser, rawBody, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const mime = mimeOf(req);
  const kind = TYPES[mime];
  const body = req.body as Buffer;
  if (!kind || !Buffer.isBuffer(body) || !body.length) { res.status(400).json(bad("That file type isn't supported. Use MP4, WebM or MOV video, or a voice recording.")); return; }
  if (req.query.kind && req.query.kind !== kind) { res.status(400).json(bad(`That's not a ${req.query.kind} file.`)); return; }
  if (body.length > MAX_BYTES[kind]) { res.status(413).json(bad(kind === "video" ? "Reels can be up to 32 MB. Try a shorter clip." : "Voice notes can be up to 8 MB.")); return; }
  const durationMs = Math.round(Number(req.query.duration) || 0) || null;
  if (durationMs && durationMs > MAX_MS) { res.status(400).json(bad("Keep it to 60 seconds or less.")); return; }

  const [used] = await db.select({ bytes: sql<number>`coalesce(sum(${socialMediaBlobsTable.size}), 0)::bigint` }).from(socialMediaBlobsTable).where(eq(socialMediaBlobsTable.userId, me));
  if (Number(used?.bytes ?? 0) + body.length > PER_USER_BYTES) { res.status(413).json(bad("You've reached your storage limit for reels and voice notes. Delete some older ones first.")); return; }
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(socialMediaBlobsTable).where(and(eq(socialMediaBlobsTable.userId, me), gt(socialMediaBlobsTable.createdAt, new Date(Date.now() - 3_600_000))));
  if ((recent?.n ?? 0) >= 20) { res.status(429).json(bad("That's a lot of uploads. Try again in a bit.")); return; }

  const dim = (v: unknown) => { const n = Math.round(Number(v)); return n > 0 && n < 10_000 ? n : null; };
  const [row] = await db.insert(socialMediaBlobsTable).values({
    userId: me, key: randomBytes(16).toString("hex"), mime, kind, size: body.length, durationMs,
    width: dim(req.query.width), height: dim(req.query.height), data: body,
  }).returning({ id: socialMediaBlobsTable.id, key: socialMediaBlobsTable.key });
  res.status(201).json({ ok: true, data: { id: row!.id, url: `/api/media/${row!.key}`, kind } });
});

router.get("/media/:key", async (req, res): Promise<void> => {
  const key = String(req.params.key);
  if (!/^[a-f0-9]{32}$/.test(key)) { res.status(404).end(); return; }
  const [m] = await db.select({ id: socialMediaBlobsTable.id, mime: socialMediaBlobsTable.mime, size: socialMediaBlobsTable.size }).from(socialMediaBlobsTable).where(eq(socialMediaBlobsTable.key, key)).limit(1);
  if (!m) { res.status(404).end(); return; }
  res.set({ "Content-Type": m.mime, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable" });

  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
  if (!range) {
    const [full] = await db.select({ data: socialMediaBlobsTable.data }).from(socialMediaBlobsTable).where(eq(socialMediaBlobsTable.id, m.id)).limit(1);
    res.set("Content-Length", String(m.size)).send(full!.data);
    return;
  }
  let start = range[1] ? Number(range[1]) : NaN;
  let end = range[2] ? Number(range[2]) : NaN;
  if (Number.isNaN(start)) { start = Math.max(0, m.size - (end || 0)); end = m.size - 1; } // "bytes=-500": the last 500 bytes
  // Open-ended ranges get at most 2 MB at a time, so seeking a long reel doesn't pull the whole file
  if (Number.isNaN(end)) end = Math.min(m.size - 1, start + 2 * 1024 * 1024 - 1);
  end = Math.min(end, m.size - 1);
  if (start > end || start >= m.size) { res.status(416).set("Content-Range", `bytes */${m.size}`).end(); return; }
  const result = await db.execute(sql`select substring(${socialMediaBlobsTable.data} from ${start + 1} for ${end - start + 1}) as chunk from ${socialMediaBlobsTable} where ${socialMediaBlobsTable.id} = ${m.id}`);
  const chunk = (result.rows[0] as { chunk: Buffer }).chunk;
  res.status(206).set({ "Content-Range": `bytes ${start}-${end}/${m.size}`, "Content-Length": String(chunk.length) }).send(chunk);
});

router.get("/posts/reels", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const me = req.userId!;
  const cursor = idParam(req.query.cursor);
  const [blocked, following, circles] = await Promise.all([blockedIds(me), followingIds(me), circleIds(me)]);
  const where = [eq(socialPostsTable.deleted, false), eq(socialPostsTable.kind, "video"), visibleTo(me, following, circles)];
  if (blocked.length) where.push(sql`${socialPostsTable.userId} not in (${sql.join(blocked.map((b) => sql`${b}`), sql`, `)})`);
  if (cursor) where.push(lt(socialPostsTable.id, cursor));
  const rows = await db.select().from(socialPostsTable).where(and(...where)).orderBy(desc(socialPostsTable.id)).limit(11);
  const page = rows.slice(0, 10);
  res.json({ ok: true, data: { posts: await present(page, me), nextCursor: rows.length > 10 ? String(page[page.length - 1]!.id) : null } });
});

export default router;
