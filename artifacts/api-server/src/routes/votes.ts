import { Router, type IRouter } from "express";
import { db, votesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/votes", async (req, res): Promise<void> => {
  const { provider, sessionId, prompt } = req.body as {
    provider?: string;
    sessionId?: string;
    prompt?: string;
  };

  if (!provider || !["openai", "claude", "perplexity"].includes(provider)) {
    res.status(400).json({ error: "Invalid provider. Must be openai, claude, or perplexity." });
    return;
  }

  await db.insert(votesTable).values({
    provider,
    sessionId: sessionId ?? "anonymous",
    prompt: prompt ?? null,
  });

  res.json({ success: true, provider });
});

router.get("/votes/stats", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      provider: votesTable.provider,
      votes: sql<number>`count(*)::int`,
    })
    .from(votesTable)
    .groupBy(votesTable.provider);

  const total = rows.reduce((sum, r) => sum + r.votes, 0);

  const providers = ["openai", "claude", "perplexity"].map((p) => {
    const row = rows.find((r) => r.provider === p);
    const votes = row?.votes ?? 0;
    return {
      provider: p,
      votes,
      percentage: total > 0 ? Math.round((votes / total) * 100) : 0,
    };
  });

  res.json({ total, providers });
});

export default router;
