/**
 * Waitlist routes — capture user interest for locked features.
 *
 *  POST /waitlist/join         — add to waitlist (requires email)
 *  GET  /waitlist/check/:id   — check if current session is on list
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, waitlistTable, usersTable } from "@workspace/db";
import { and, eq, count } from "drizzle-orm";

const router: IRouter = Router();

// ── Validation ────────────────────────────────────────────────────────────────

const joinSchema = z.object({
  featureId:         z.string().min(1).max(80),
  email:             z.string().email(),
  notifyEarlyAccess: z.boolean().optional().default(false),
  sessionId:         z.string().optional(),
});

// ── POST /waitlist/join ───────────────────────────────────────────────────────

router.post("/waitlist/join", async (req, res): Promise<void> => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const sessionId = (req.headers["x-session-id"] as string | undefined)
    ?? parsed.data.sessionId
    ?? "anonymous";

  let email = parsed.data.email;

  // If logged-in user, we trust the session's email over the submitted one
  // (the submitted email is the fallback for anonymous users)
  if (sessionId !== "anonymous") {
    const [user] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.sessionId, sessionId))
      .limit(1);
    if (user?.email) email = user.email;
  }

  // Upsert: if already joined for this session+feature, update the email/flag
  const existing = await db
    .select()
    .from(waitlistTable)
    .where(and(
      eq(waitlistTable.sessionId, sessionId),
      eq(waitlistTable.featureId, parsed.data.featureId),
    ))
    .limit(1);

  if (existing.length > 0) {
    // Already on list — update flags and return existing
    await db
      .update(waitlistTable)
      .set({ email, notifyEarlyAccess: parsed.data.notifyEarlyAccess })
      .where(eq(waitlistTable.id, existing[0].id));

    res.json({ joined: true, email, notifyEarlyAccess: parsed.data.notifyEarlyAccess });
    return;
  }

  // New entry
  await db.insert(waitlistTable).values({
    sessionId,
    featureId:         parsed.data.featureId,
    email,
    notifyEarlyAccess: parsed.data.notifyEarlyAccess,
  });

  res.status(201).json({ joined: true, email, notifyEarlyAccess: parsed.data.notifyEarlyAccess });
});

// ── GET /waitlist/check/:featureId ────────────────────────────────────────────

router.get("/waitlist/check/:featureId", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string | undefined;
  const { featureId } = req.params;

  if (!sessionId || !featureId) {
    res.json({ joined: false, email: null, notifyEarlyAccess: false });
    return;
  }

  const [entry] = await db
    .select()
    .from(waitlistTable)
    .where(and(
      eq(waitlistTable.sessionId, sessionId),
      eq(waitlistTable.featureId, featureId),
    ))
    .limit(1);

  if (!entry) {
    res.json({ joined: false, email: null, notifyEarlyAccess: false });
    return;
  }

  res.json({
    joined:            true,
    email:             entry.email,
    notifyEarlyAccess: entry.notifyEarlyAccess,
  });
});

// ── GET /waitlist/count — total unique signups across all features ─────────────

router.get("/waitlist/count", async (req, res): Promise<void> => {
  try {
    const [result] = await db.select({ total: count() }).from(waitlistTable);
    res.json({ ok: true, count: result?.total ?? 0 });
  } catch {
    res.status(500).json({ error: "Failed to fetch waitlist count" });
  }
});

// ── GET /waitlist/count/:featureId — count for a specific feature ──────────────

router.get("/waitlist/count/:featureId", async (req, res): Promise<void> => {
  const { featureId } = req.params;
  if (!featureId) { res.status(400).json({ error: "featureId required" }); return; }

  try {
    const [result] = await db.select({ total: count() })
      .from(waitlistTable)
      .where(eq(waitlistTable.featureId, featureId));
    res.json({ ok: true, featureId, count: result?.total ?? 0 });
  } catch {
    res.status(500).json({ error: "Failed to fetch feature waitlist count" });
  }
});

export default router;
