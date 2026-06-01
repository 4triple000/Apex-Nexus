import { pgTable, text, integer, timestamp, serial, numeric } from "drizzle-orm/pg-core";

// ─── PURCHASES ────────────────────────────────────────────────────────────────
// Tracks one-time project purchases (who bought what)
export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  projectId: integer("project_id").notNull(),
  amount: integer("amount").notNull(), // cents
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Purchase = typeof purchasesTable.$inferSelect;

// ─── CREATOR EARNINGS ─────────────────────────────────────────────────────────
// Tracks earnings per creator per sale (80% creator / 20% platform)
export const earningsTable = pgTable("earnings", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull(),
  buyerUserId: integer("buyer_user_id"),
  sourceProjectId: integer("source_project_id").notNull(),
  grossAmount: integer("gross_amount").notNull(), // cents — total paid
  platformFee: integer("platform_fee").notNull(), // cents — 20%
  netAmount: integer("net_amount").notNull(), // cents — 80% to creator
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Earning = typeof earningsTable.$inferSelect;
