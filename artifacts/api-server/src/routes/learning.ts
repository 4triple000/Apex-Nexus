import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, aiInsightsTable, userAiPrefsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  trackInteraction,
  updateInteractionOutcome,
  learnFromData,
  getUserInsights,
  getProjectOptimizations,
  getUserPersonalization,
  detectTone,
} from "../lib/learningEngine";

const router: IRouter = Router();

// ── POST /learning/track ──────────────────────────────────────────────────────
// Log an AI interaction for learning
router.post("/learning/track", async (req, res): Promise<void> => {
  const schema = z.object({
    sessionId: z.string(),
    userId: z.number().optional(),
    interactionType: z.enum(["chat", "dm_reply", "studio_output", "autopilot"]).default("chat"),
    context: z.string().optional(),
    aiOutput: z.string(),
    provider: z.string().optional(),
    projectId: z.number().optional(),
    wasAccepted: z.boolean().optional(),
    gotReply: z.boolean().optional(),
    responseTimeMs: z.number().optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await trackInteraction(parsed.data);
  res.json({ ok: true, tone: detectTone(parsed.data.aiOutput) });
});

// ── PATCH /learning/track/:id ─────────────────────────────────────────────────
// Update outcome of an interaction (e.g., got_reply)
router.patch("/learning/track/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { wasAccepted, gotReply } = req.body as { wasAccepted?: boolean; gotReply?: boolean };
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await updateInteractionOutcome(id, { wasAccepted, gotReply });
  res.json({ ok: true });
});

// ── POST /learning/learn ──────────────────────────────────────────────────────
// Manually trigger a learning cycle (admin / cron)
router.post("/learning/learn", async (_req, res): Promise<void> => {
  const result = await learnFromData();
  res.json({ ok: true, ...result });
});

// ── GET /learning/insights ────────────────────────────────────────────────────
// Get AI insights for a user (global + personal)
router.get("/learning/insights", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || req.query.sessionId as string || "";
  const limit = parseInt(req.query.limit as string || "8");
  const insights = await getUserInsights(sessionId, limit);
  res.json({ insights });
});

// ── GET /learning/insights/project/:id ───────────────────────────────────────
// Get optimization suggestions for a specific project
router.get("/learning/insights/project/:id", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project id" }); return; }
  const insights = await getProjectOptimizations(projectId);
  res.json({ insights });
});

// ── GET /learning/personalization ─────────────────────────────────────────────
// Get a user's learned AI personalization profile
router.get("/learning/personalization", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || req.query.sessionId as string || "";
  if (!sessionId) { res.json({ personalization: null }); return; }
  const [prefs] = await db.select().from(userAiPrefsTable).where(eq(userAiPrefsTable.sessionId, sessionId)).limit(1);
  const personalization = await getUserPersonalization(sessionId);
  res.json({
    prefs: prefs ?? null,
    personalization,
    successRate: prefs ? (prefs.successfulInteractions / Math.max(1, prefs.totalInteractions)) : 0,
  });
});

// ── POST /learning/insights/:id/dismiss ──────────────────────────────────────
router.post("/learning/insights/:id/dismiss", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(aiInsightsTable).set({ isDismissed: true }).where(eq(aiInsightsTable.id, id));
  res.json({ ok: true });
});

// ── POST /learning/insights/:id/apply ────────────────────────────────────────
router.post("/learning/insights/:id/apply", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(aiInsightsTable).set({ isApplied: true }).where(eq(aiInsightsTable.id, id));
  res.json({ ok: true });
});

// ── GET /learning/trends ──────────────────────────────────────────────────────
// Get global trending content data
router.get("/learning/trends", async (_req, res): Promise<void> => {
  const insights = await db.select().from(aiInsightsTable)
    .where(and(eq(aiInsightsTable.insightType, "trend"), eq(aiInsightsTable.scope, "global"), eq(aiInsightsTable.isDismissed, false)))
    .orderBy(desc(aiInsightsTable.confidence))
    .limit(5);
  res.json({ trends: insights });
});

export default router;
