import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, usersTable, purchasesTable, earningsTable, studioMarketplaceTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PLATFORM_FEE_PERCENT = 20;

// ── Resolve user from sessionId ───────────────────────────────────────────────
async function resolveUser(sessionId: string) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.sessionId, sessionId)).limit(1);
  return u ?? null;
}

// ── GET /stripe/subscription-status ──────────────────────────────────────────
router.get("/stripe/subscription-status", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || req.query.sessionId as string;
  if (!sessionId) { res.json({ tier: "free", status: "inactive" }); return; }
  const user = await resolveUser(sessionId);
  if (!user) { res.json({ tier: "free", status: "inactive" }); return; }

  // Optionally sync from Stripe if subscriptionId present
  if (user.stripeSubscriptionId) {
    try {
      const stripe = await getUncachableStripeClient();
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      const active = sub.status === "active" || sub.status === "trialing";
      if (!active) {
        await db.update(usersTable)
          .set({ subscriptionStatus: "inactive", subscriptionTier: "free" })
          .where(eq(usersTable.id, user.id));
        res.json({ tier: "free", status: "inactive" });
        return;
      }
    } catch { /* non-fatal */ }
  }

  res.json({ tier: user.subscriptionTier, status: user.subscriptionStatus });
});

// ── GET /stripe/products ──────────────────────────────────────────────────────
// Returns available subscription plans from Stripe
router.get("/stripe/products", async (_req, res): Promise<void> => {
  try {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ active: true, limit: 10 });
    const pricesList = await stripe.prices.list({ active: true, limit: 50 });

    const plans = products.data
      .filter((p) => p.metadata?.apex_tier)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        tier: p.metadata.apex_tier,
        features: (p.metadata.features ?? "").split("|").filter(Boolean),
        prices: pricesList.data
          .filter((pr) => pr.product === p.id)
          .map((pr) => ({
            id: pr.id,
            amount: pr.unit_amount,
            currency: pr.currency,
            interval: (pr.recurring as { interval: string } | null)?.interval ?? "one_time",
          })),
      }));

    res.json({ plans });
  } catch (err) {
    logger.error({ err }, "Failed to fetch Stripe products");
    res.json({ plans: [] });
  }
});

// ── POST /stripe/checkout ─────────────────────────────────────────────────────
router.post("/stripe/checkout", async (req, res): Promise<void> => {
  const schema = z.object({
    sessionId: z.string(),
    priceId: z.string(),
    projectId: z.number().optional(), // for one-time project purchase
    successPath: z.string().default("/marketplace"),
    cancelPath: z.string().default("/pricing"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const { sessionId, priceId, projectId, successPath, cancelPath } = parsed.data;

  const user = await resolveUser(sessionId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const stripe = await getUncachableStripeClient();
  const domain = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;

  // Get or create Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { apexUserId: String(user.id), sessionId } });
    customerId = customer.id;
    await db.update(usersTable).set({ stripeCustomerId: customerId }).where(eq(usersTable.id, user.id));
  }

  // Check if this is a subscription or one-time
  const price = await stripe.prices.retrieve(priceId);
  const mode = price.recurring ? "subscription" : "payment";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode,
    success_url: `${domain}${successPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${domain}${cancelPath}?checkout=cancelled`,
    metadata: {
      apexUserId: String(user.id),
      apexSessionId: sessionId,
      ...(projectId ? { projectId: String(projectId) } : {}),
    },
  });

  res.json({ url: session.url });
});

// ── POST /stripe/portal ───────────────────────────────────────────────────────
// Opens Stripe billing portal to manage subscription
router.post("/stripe/portal", async (req, res): Promise<void> => {
  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }
  const user = await resolveUser(sessionId);
  if (!user?.stripeCustomerId) { res.status(400).json({ error: "No active subscription" }); return; }

  const stripe = await getUncachableStripeClient();
  const domain = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${domain}/pricing`,
  });
  res.json({ url: portal.url });
});

// ── GET /stripe/access-check ──────────────────────────────────────────────────
// Check if a user has access to a paid project
router.get("/stripe/access-check", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || req.query.sessionId as string;
  const projectId = parseInt(req.query.projectId as string);

  if (!sessionId || isNaN(projectId)) { res.status(400).json({ error: "sessionId and projectId required" }); return; }

  const [project] = await db.select().from(studioMarketplaceTable).where(eq(studioMarketplaceTable.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  // Free projects — always accessible
  if (project.accessType === "free" || project.price === 0) {
    res.json({ hasAccess: true, reason: "free" });
    return;
  }

  const user = await resolveUser(sessionId);
  if (!user) { res.json({ hasAccess: false, reason: "not_logged_in", price: project.price, title: project.title }); return; }

  // Check purchase
  const [purchase] = await db.select().from(purchasesTable)
    .where(and(eq(purchasesTable.userId, user.id), eq(purchasesTable.projectId, projectId))).limit(1);
  if (purchase) { res.json({ hasAccess: true, reason: "purchased" }); return; }

  // Check subscription
  if (project.accessType === "subscription") {
    const hasSub = user.subscriptionStatus === "active" && user.subscriptionTier !== "free";
    if (hasSub) { res.json({ hasAccess: true, reason: "subscription" }); return; }
  }

  res.json({ hasAccess: false, reason: "payment_required", price: project.price, accessType: project.accessType, title: project.title });
});

// ── GET /stripe/my-purchases ──────────────────────────────────────────────────
router.get("/stripe/my-purchases", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || req.query.sessionId as string;
  if (!sessionId) { res.json({ purchases: [] }); return; }
  const user = await resolveUser(sessionId);
  if (!user) { res.json({ purchases: [] }); return; }
  const purchases = await db.select().from(purchasesTable).where(eq(purchasesTable.userId, user.id)).limit(100);
  res.json({ purchases });
});

// ── GET /stripe/creator-earnings ──────────────────────────────────────────────
router.get("/stripe/creator-earnings", async (req, res): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string || req.query.sessionId as string;
  if (!sessionId) { res.json({ earnings: [], totalNet: 0, totalGross: 0 }); return; }
  const user = await resolveUser(sessionId);
  if (!user) { res.json({ earnings: [], totalNet: 0, totalGross: 0 }); return; }

  const earnings = await db.select().from(earningsTable)
    .where(eq(earningsTable.creatorId, user.id))
    .orderBy(sql`created_at DESC`)
    .limit(100);

  const totalNet = earnings.reduce((s, e) => s + e.netAmount, 0);
  const totalGross = earnings.reduce((s, e) => s + e.grossAmount, 0);

  // Earnings by project
  const byProject: Record<number, { projectId: number; net: number; gross: number; sales: number }> = {};
  for (const e of earnings) {
    if (!byProject[e.sourceProjectId]) byProject[e.sourceProjectId] = { projectId: e.sourceProjectId, net: 0, gross: 0, sales: 0 };
    byProject[e.sourceProjectId].net += e.netAmount;
    byProject[e.sourceProjectId].gross += e.grossAmount;
    byProject[e.sourceProjectId].sales++;
  }

  res.json({ earnings, totalNet, totalGross, byProject: Object.values(byProject) });
});

export default router;
