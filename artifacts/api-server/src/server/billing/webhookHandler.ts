/**
 * Apex Billing — Stripe Webhook Handler
 *
 * Processes incoming Stripe webhook events:
 *   customer.subscription.created  → activate user tier
 *   customer.subscription.updated  → update tier / status
 *   customer.subscription.deleted  → downgrade to free
 *   invoice.payment_succeeded       → confirm active status
 *   invoice.payment_failed          → set status to past_due
 *
 * Security: verifies Stripe-Signature header using STRIPE_WEBHOOK_SECRET.
 * Idempotent: records processed events in apex_billing_events to prevent double-processing.
 *
 * Usage:
 *   router.post("/billing/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
 */

import type { Request, Response } from "express";
import { db, usersTable, apexBillingEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../../lib/stripeClient";
import { getTierForPriceId, normalizeTier } from "./planConfig";
import { logger } from "../../lib/logger";
import type { PlanTier, WebhookProcessResult } from "./types";
import type Stripe from "stripe";

// ── Main webhook handler ───────────────────────────────────────────────────────

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers["stripe-signature"] as string;
  const secret    = process.env.STRIPE_WEBHOOK_SECRET;

  // ── Parse & verify event ───────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    const stripe = await getUncachableStripeClient();
    if (secret && signature) {
      event = stripe.webhooks.constructEvent(req.body as Buffer, signature, secret);
    } else {
      // Dev mode: parse raw JSON (no signature verification)
      logger.warn("Stripe webhook: STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
      event = JSON.parse((req.body as Buffer).toString()) as Stripe.Event;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Stripe webhook: signature verification failed");
    res.status(400).json({ error: `Webhook signature error: ${msg}` });
    return;
  }

  // ── Idempotency check ──────────────────────────────────────────────────────
  const alreadyProcessed = await db
    .select({ id: apexBillingEventsTable.id })
    .from(apexBillingEventsTable)
    .where(eq(apexBillingEventsTable.stripeEventId, event.id))
    .limit(1);

  if (alreadyProcessed.length > 0) {
    logger.info({ eventId: event.id }, "Stripe webhook: already processed — skipping");
    res.json({ received: true, eventId: event.id, status: "already_processed" });
    return;
  }

  // ── Process event ──────────────────────────────────────────────────────────
  let result: WebhookProcessResult;
  try {
    result = await processEvent(event);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, eventId: event.id, eventType: event.type }, "Stripe webhook: processing failed");
    await recordEvent(event, null, null, null, "error", msg);
    res.status(500).json({ error: "Webhook processing failed" });
    return;
  }

  logger.info({ result }, "Stripe webhook: processed");
  res.json({ received: true, result });
}

// ── Event processor ────────────────────────────────────────────────────────────

async function processEvent(event: Stripe.Event): Promise<WebhookProcessResult> {
  const base: WebhookProcessResult = {
    processed: false,
    eventId: event.id,
    eventType: event.type,
  };

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      return await handleSubscriptionChange(sub, base);
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      return await handleSubscriptionDeleted(sub, base);
    }

    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice;
      return await handlePaymentSucceeded(inv, base);
    }

    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      return await handlePaymentFailed(inv, base);
    }

    default:
      await recordEvent(event, null, null, null, "processed", undefined);
      return { ...base, processed: false };
  }
}

// ── Subscription created / updated ────────────────────────────────────────────

async function handleSubscriptionChange(
  sub: Stripe.Subscription,
  base: WebhookProcessResult
): Promise<WebhookProcessResult> {
  const customerId = sub.customer as string;
  const priceId    = sub.items.data[0]?.price?.id;
  const newTier    = priceId ? getTierForPriceId(priceId) : "pro";
  const newStatus  = mapStripeStatus(sub.status);

  const user = await findUserByCustomerId(customerId);
  if (!user) {
    logger.warn({ customerId }, "Stripe webhook: no user found for customer");
    await recordEvent({ id: base.eventId, type: base.eventType } as Stripe.Event, customerId, sub.id, null, "processed");
    return { ...base, processed: true };
  }

  const tierBefore = normalizeTier(user.subscriptionTier);
  await db.update(usersTable)
    .set({
      subscriptionTier:     newTier,
      subscriptionStatus:   newStatus,
      stripeSubscriptionId: sub.id,
    })
    .where(eq(usersTable.id, user.id));

  await recordEvent(
    { id: base.eventId, type: base.eventType } as Stripe.Event,
    customerId, sub.id, user.id, "processed",
    undefined, tierBefore, newTier
  );

  return {
    ...base,
    processed: true,
    userId: user.id,
    tierChange: { before: tierBefore, after: newTier },
  };
}

// ── Subscription deleted (cancelled) ──────────────────────────────────────────

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  base: WebhookProcessResult
): Promise<WebhookProcessResult> {
  const customerId = sub.customer as string;
  const user = await findUserByCustomerId(customerId);

  if (!user) {
    await recordEvent({ id: base.eventId, type: base.eventType } as Stripe.Event, customerId, sub.id, null, "processed");
    return { ...base, processed: true };
  }

  const tierBefore = normalizeTier(user.subscriptionTier);
  await db.update(usersTable)
    .set({ subscriptionTier: "free", subscriptionStatus: "cancelled", stripeSubscriptionId: null })
    .where(eq(usersTable.id, user.id));

  await recordEvent(
    { id: base.eventId, type: base.eventType } as Stripe.Event,
    customerId, sub.id, user.id, "processed",
    undefined, tierBefore, "free"
  );

  return {
    ...base,
    processed: true,
    userId: user.id,
    tierChange: { before: tierBefore, after: "free" },
  };
}

// ── Payment succeeded ─────────────────────────────────────────────────────────

async function handlePaymentSucceeded(
  inv: Stripe.Invoice,
  base: WebhookProcessResult
): Promise<WebhookProcessResult> {
  const customerId = inv.customer as string;
  const user = await findUserByCustomerId(customerId);

  if (user && user.subscriptionStatus !== "active") {
    await db.update(usersTable)
      .set({ subscriptionStatus: "active" })
      .where(eq(usersTable.id, user.id));
  }

  await recordEvent(
    { id: base.eventId, type: base.eventType } as Stripe.Event,
    customerId, inv.subscription as string ?? null, user?.id ?? null,
    "processed", undefined, undefined, undefined,
    (inv.amount_paid as number) ?? null, inv.currency
  );

  return { ...base, processed: true, userId: user?.id };
}

// ── Payment failed ────────────────────────────────────────────────────────────

async function handlePaymentFailed(
  inv: Stripe.Invoice,
  base: WebhookProcessResult
): Promise<WebhookProcessResult> {
  const customerId = inv.customer as string;
  const user = await findUserByCustomerId(customerId);

  if (user) {
    await db.update(usersTable)
      .set({ subscriptionStatus: "past_due" })
      .where(eq(usersTable.id, user.id));
  }

  await recordEvent(
    { id: base.eventId, type: base.eventType } as Stripe.Event,
    customerId, inv.subscription as string ?? null, user?.id ?? null,
    "processed"
  );

  return { ...base, processed: true, userId: user?.id };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findUserByCustomerId(customerId: string) {
  const [user] = await db
    .select({ id: usersTable.id, subscriptionTier: usersTable.subscriptionTier, subscriptionStatus: usersTable.subscriptionStatus })
    .from(usersTable)
    .where(eq(usersTable.stripeCustomerId, customerId))
    .limit(1);
  return user ?? null;
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  const MAP: Record<string, string> = {
    active:             "active",
    trialing:           "trialing",
    past_due:           "past_due",
    canceled:           "cancelled",
    unpaid:             "unpaid",
    incomplete:         "inactive",
    incomplete_expired: "inactive",
    paused:             "inactive",
  };
  return MAP[status] ?? "inactive";
}

async function recordEvent(
  event: Stripe.Event,
  customerId: string | null,
  subscriptionId: string | null,
  userId: number | null,
  status: "processed" | "error",
  errorMessage?: string,
  tierBefore?: string,
  tierAfter?: string,
  amountCents?: number | null,
  currency?: string
): Promise<void> {
  try {
    await db.insert(apexBillingEventsTable).values({
      stripeEventId:  event.id,
      eventType:      event.type,
      customerId:     customerId ?? undefined,
      subscriptionId: subscriptionId ?? undefined,
      userId:         userId ?? undefined,
      tierBefore:     tierBefore ?? undefined,
      tierAfter:      tierAfter ?? undefined,
      amountCents:    amountCents ?? undefined,
      currency:       currency ?? undefined,
      status,
      errorMessage:   errorMessage ?? undefined,
      rawPayload:     JSON.stringify(event).slice(0, 8000),
    });
  } catch (err) {
    logger.error({ err }, "Failed to record billing event");
  }
}
