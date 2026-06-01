/**
 * Apex Billing — Usage Tracking Schema
 *
 * apex_usage_logs: One row per user per action per calendar date.
 *   Action types: "build" | "ai_call" | "deployment"
 *   Uses UPSERT (ON CONFLICT) to increment counters atomically.
 *
 * apex_billing_events: Immutable audit log of all Stripe webhook events.
 */

import { pgTable, text, integer, timestamp, serial, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Per-user daily usage counters ─────────────────────────────────────────────

export const apexUsageLogsTable = pgTable(
  "apex_usage_logs",
  {
    id:         serial("id").primaryKey(),
    userId:     integer("user_id").notNull(),
    sessionId:  text("session_id"),
    action:     text("action").notNull(), // "build" | "ai_call" | "deployment"
    periodDate: date("period_date").notNull(), // YYYY-MM-DD (daily bucket)
    count:      integer("count").notNull().default(0),
    updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.action, t.periodDate)]
);

export const insertApexUsageLogSchema = createInsertSchema(apexUsageLogsTable)
  .omit({ id: true, updatedAt: true });
export type InsertApexUsageLog = z.infer<typeof insertApexUsageLogSchema>;
export type ApexUsageLog = typeof apexUsageLogsTable.$inferSelect;

// ── Stripe event audit log ─────────────────────────────────────────────────────

export const apexBillingEventsTable = pgTable("apex_billing_events", {
  id:              serial("id").primaryKey(),
  stripeEventId:   text("stripe_event_id").notNull().unique(),
  eventType:       text("event_type").notNull(),
  customerId:      text("customer_id"),
  subscriptionId:  text("subscription_id"),
  userId:          integer("user_id"),
  tierBefore:      text("tier_before"),
  tierAfter:       text("tier_after"),
  amountCents:     integer("amount_cents"),
  currency:        text("currency"),
  status:          text("status").notNull().default("processed"), // "processed" | "error"
  errorMessage:    text("error_message"),
  rawPayload:      text("raw_payload"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertApexBillingEventSchema = createInsertSchema(apexBillingEventsTable)
  .omit({ id: true, createdAt: true });
export type InsertApexBillingEvent = z.infer<typeof insertApexBillingEventSchema>;
export type ApexBillingEvent = typeof apexBillingEventsTable.$inferSelect;
