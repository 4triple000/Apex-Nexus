import { pgTable, serial, integer, text, bigint, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * AI usage per person per day per model. `usageKey` is `user:<id>` for accounts or `guest:<ip>` otherwise.
 * `credits` is what the person was charged; `costMicros` is the estimated real cost in millionths of a dollar
 * (from token counts), so the owner can see what the API keys are costing.
 */
export const aiUsageTable = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    usageKey: text("usage_key").notNull(),
    userId: integer("user_id"),
    day: text("day").notNull(), // YYYY-MM-DD (UTC)
    provider: text("provider").notNull(),
    messages: integer("messages").notNull().default(0),
    ownKeyMessages: integer("own_key_messages").notNull().default(0),
    credits: integer("credits").notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("ai_usage_key_day_provider").on(t.usageKey, t.day, t.provider)],
);

/** Extra credits for one day (e.g. the streak reward). */
export const creditBonusTable = pgTable(
  "credit_bonus",
  {
    id: serial("id").primaryKey(),
    usageKey: text("usage_key").notNull(),
    day: text("day").notNull(),
    credits: integer("credits").notNull().default(0),
  },
  (t) => [unique("credit_bonus_key_day").on(t.usageKey, t.day)],
);

/**
 * Accounts a user has linked. `kind` is "key" (their own AI API key) or "oauth" (an app like GitHub).
 * Secrets are encrypted with AES-256-GCM before they are stored.
 */
export const userConnectorsTable = pgTable(
  "user_connectors",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    connectorId: text("connector_id").notNull(),
    kind: text("kind").notNull(),
    secret: text("secret").notNull(),
    refreshSecret: text("refresh_secret"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    accountLabel: text("account_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("user_connectors_user_connector").on(t.userId, t.connectorId)],
);

export type UserConnector = typeof userConnectorsTable.$inferSelect;

/** Credits a person bought in packs. Never expire; used after the daily allowance runs out. */
export const creditWalletTable = pgTable("credit_wallet", {
  userId: integer("user_id").primaryKey(),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per paid pack (the Stripe checkout session makes it safe to process twice). */
export const creditPurchasesTable = pgTable("credit_purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  packId: text("pack_id").notNull(),
  credits: integer("credits").notNull(),
  amountCents: integer("amount_cents").notNull(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Daily use of the free model pool (Groq, Cerebras, GitHub Models, OpenRouter free).
 * `key` is `model:<id>` (one free model), `group:<name>` (a limit several models share) or `user:<id>` (one person's free messages).
 */
export const freeModelUsageTable = pgTable(
  "free_model_usage",
  {
    id: serial("id").primaryKey(),
    day: text("day").notNull(), // YYYY-MM-DD (UTC)
    key: text("key").notNull(),
    requests: integer("requests").notNull().default(0),
    tokens: bigint("tokens", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("free_model_usage_day_key").on(t.day, t.key)],
);
