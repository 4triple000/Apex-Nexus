/**
 * Store — buying Pro and credit packs through Stripe Checkout.
 *
 *   GET  /store                    — prices, packs, and whether payments are switched on
 *   POST /store/credits/checkout   — buy a credit pack (one-time) → { url }
 *   POST /store/pro/checkout       — subscribe to Pro (monthly or yearly) → { url }
 *   POST /store/portal             — manage or cancel the subscription → { url }
 *
 * Prices are sent with each checkout, so nothing has to be created in the Stripe dashboard.
 * Stripe tells us about the payment on /api/billing/webhook, which adds the credits or turns Pro on.
 * Needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on the server.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireUser } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { CREDIT_PACKS, creditPack } from "../lib/credits";
import { PLAN_METADATA } from "../server/billing/planConfig";
import { isAllowedReturn, defaultReturnUrl } from "../lib/secureLinks";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const stripeReady = () => !!process.env.STRIPE_SECRET_KEY;

function returnUrl(requested: string | undefined, fallbackPath: string): string {
  return requested && isAllowedReturn(requested) ? requested : `${defaultReturnUrl()}${fallbackPath}`;
}

function withParam(url: string, key: string, value: string): string {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}

/** The person's Stripe customer, created on first purchase. */
async function customerFor(userId: number): Promise<string> {
  const [user] = await db.select({ id: usersTable.id, email: usersTable.email, customer: usersTable.stripeCustomerId }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) throw new Error("User not found");
  if (user.customer) return user.customer;
  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { apexUserId: String(user.id) } });
  await db.update(usersTable).set({ stripeCustomerId: customer.id }).where(eq(usersTable.id, user.id));
  return customer.id;
}

const notReady = { ok: false, error: "Payments aren't switched on yet. Check back soon." };

router.get("/store", (_req, res): void => {
  res.json({
    ok: true,
    data: {
      stripeReady: stripeReady(),
      pro: { monthlyCents: PLAN_METADATA.pro.priceMonthly, yearlyCents: PLAN_METADATA.pro.priceYearly, features: PLAN_METADATA.pro.features },
      packs: CREDIT_PACKS,
    },
  });
});

const PackBody = z.object({ packId: z.string(), returnTo: z.string().url().optional() });

router.post("/store/credits/checkout", requireUser, async (req: ApexRequest, res): Promise<void> => {
  if (!stripeReady()) { res.status(503).json(notReady); return; }
  const parsed = PackBody.safeParse(req.body);
  const pack = parsed.success ? creditPack(parsed.data.packId) : undefined;
  if (!parsed.success || !pack) { res.status(400).json({ ok: false, error: "Pick a credit pack." }); return; }
  try {
    const stripe = await getUncachableStripeClient();
    const back = returnUrl(parsed.data.returnTo, "/pricing");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: await customerFor(req.userId!),
      line_items: [{
        quantity: 1,
        price_data: { currency: "usd", unit_amount: pack.priceCents, product_data: { name: `Apex ${pack.name}`, description: "AI credits that never expire" } },
      }],
      success_url: withParam(back, "credits", "success"),
      cancel_url: withParam(back, "credits", "cancelled"),
      metadata: { apexKind: "credits", apexUserId: String(req.userId), packId: pack.id },
      payment_intent_data: { metadata: { apexKind: "credits", apexUserId: String(req.userId), packId: pack.id } },
    });
    res.json({ ok: true, data: { url: session.url } });
  } catch (err) {
    logger.error({ err }, "Credit pack checkout failed");
    res.status(502).json({ ok: false, error: "Couldn't start checkout. Try again in a moment." });
  }
});

const ProBody = z.object({ interval: z.enum(["month", "year"]).default("month"), returnTo: z.string().url().optional() });

router.post("/store/pro/checkout", requireUser, async (req: ApexRequest, res): Promise<void> => {
  if (!stripeReady()) { res.status(503).json(notReady); return; }
  const parsed = ProBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ ok: false, error: "Pick monthly or yearly." }); return; }
  const [user] = await db.select({ status: usersTable.subscriptionStatus, tier: usersTable.subscriptionTier }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (user && user.tier !== "free" && (user.status === "active" || user.status === "trialing")) {
    res.status(409).json({ ok: false, error: "You already have Pro. Use Manage subscription to change it." });
    return;
  }
  try {
    const stripe = await getUncachableStripeClient();
    const back = returnUrl(parsed.data.returnTo, "/pricing");
    const yearly = parsed.data.interval === "year";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: await customerFor(req.userId!),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: yearly ? PLAN_METADATA.pro.priceYearly : PLAN_METADATA.pro.priceMonthly,
          recurring: { interval: parsed.data.interval },
          product_data: { name: "Apex Pro" },
        },
      }],
      allow_promotion_codes: true,
      success_url: withParam(back, "checkout", "success"),
      cancel_url: withParam(back, "checkout", "cancelled"),
      metadata: { apexKind: "pro", apexUserId: String(req.userId) },
      subscription_data: { metadata: { apexTier: "pro", apexUserId: String(req.userId) } },
    });
    res.json({ ok: true, data: { url: session.url } });
  } catch (err) {
    logger.error({ err }, "Pro checkout failed");
    res.status(502).json({ ok: false, error: "Couldn't start checkout. Try again in a moment." });
  }
});

router.post("/store/portal", requireUser, async (req: ApexRequest, res): Promise<void> => {
  if (!stripeReady()) { res.status(503).json(notReady); return; }
  const [user] = await db.select({ customer: usersTable.stripeCustomerId }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user?.customer) { res.status(404).json({ ok: false, error: "No subscription to manage yet." }); return; }
  try {
    const stripe = await getUncachableStripeClient();
    const back = returnUrl(typeof req.body?.returnTo === "string" ? req.body.returnTo : undefined, "/pricing");
    const portal = await stripe.billingPortal.sessions.create({ customer: user.customer, return_url: back });
    res.json({ ok: true, data: { url: portal.url } });
  } catch (err) {
    logger.error({ err }, "Billing portal failed");
    res.status(502).json({ ok: false, error: "Couldn't open subscription settings. Try again in a moment." });
  }
});

export default router;
