import {
  pgTable, text, integer, boolean, timestamp, serial, jsonb, index
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Connected Accounts ───────────────────────────────────────────────────────
// Stores OAuth tokens / credentials for each linked social platform account.

export const connectedAccountsTable = pgTable("connected_accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  platform: text("platform").notNull(),
  platformUserId: text("platform_user_id").notNull(),
  platformUsername: text("platform_username"),
  platformIcon: text("platform_icon"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  metadata: jsonb("metadata").default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("ca_user_platform_idx").on(t.userId, t.platform),
]);

// ─── AI Suggestions ───────────────────────────────────────────────────────────
// Platform-agnostic store of AI-generated reply suggestions per conversation.

export const aiSuggestionsTable = pgTable("ai_suggestions", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  platform: text("platform").notNull().default("demo"),
  suggestions: jsonb("suggestions").notNull().default([]),
  triggerMessageId: integer("trigger_message_id"),
  model: text("model").default("gpt-4o-mini"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("ai_sug_conv_idx").on(t.conversationId),
]);

// ─── Platform Message Log ─────────────────────────────────────────────────────
// Audit log for all outbound/inbound platform API calls — useful for debugging.

export const platformMessageLogTable = pgTable("platform_message_log", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  direction: text("direction").notNull(),
  externalConversationId: text("external_conversation_id"),
  externalMessageId: text("external_message_id"),
  payload: jsonb("payload").default({}),
  statusCode: integer("status_code"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("pml_platform_idx").on(t.platform),
]);

// ─── Schemas + Types ──────────────────────────────────────────────────────────

export const insertConnectedAccountSchema = createInsertSchema(connectedAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiSuggestionSchema = createInsertSchema(aiSuggestionsTable).omit({ id: true, generatedAt: true });
export const insertPlatformMessageLogSchema = createInsertSchema(platformMessageLogTable).omit({ id: true, createdAt: true });

export type ConnectedAccount = typeof connectedAccountsTable.$inferSelect;
export type AiSuggestion = typeof aiSuggestionsTable.$inferSelect;
export type PlatformMessageLog = typeof platformMessageLogTable.$inferSelect;

export type InsertConnectedAccount = z.infer<typeof insertConnectedAccountSchema>;
export type InsertAiSuggestion = z.infer<typeof insertAiSuggestionSchema>;

// ─── Platform Types ───────────────────────────────────────────────────────────

export const SUPPORTED_PLATFORMS = ["instagram", "messenger", "demo"] as const;
export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];

export type NormalizedMessage = {
  platform: SupportedPlatform;
  conversation_id: string;
  external_user_id: string;
  message_text: string;
  timestamp: number;
  raw?: unknown;
};
