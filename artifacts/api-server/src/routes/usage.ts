import { Router, type IRouter } from "express";
import { GetUsageQueryParams } from "@workspace/api-zod";
import { getOrCreateUsage } from "../lib/usageTracker";
import { getTierLimit } from "../lib/aiRouter";

const router: IRouter = Router();

router.get("/usage", async (req, res): Promise<void> => {
  const parsed = GetUsageQueryParams.safeParse(req.query);
  const sessionId = parsed.success ? (parsed.data.sessionId ?? "anonymous") : "anonymous";

  const usage = await getOrCreateUsage(sessionId);
  const limit = getTierLimit(usage.tier) + usage.bonusRequests;

  res.json({
    requestsUsed: usage.requestsUsed,
    requestsLimit: limit,
    bonusRequests: usage.bonusRequests,
    tier: usage.tier,
    resetAt: usage.resetAt.toISOString(),
  });
});

export default router;
