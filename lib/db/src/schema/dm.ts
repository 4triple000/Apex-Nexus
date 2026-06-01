import {
  pgTable, text, integer, boolean, timestamp, serial, jsonb, real
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dmContactsTable = pgTable("dm_contacts", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  platform: text("platform").notNull().default("demo"),
  externalId: text("external_id"),
  bio: text("bio"),
  personaTraits: jsonb("persona_traits").default({}),
  responseSpeed: text("response_speed").default("medium"),
  interactionNotes: text("interaction_notes"),
  totalInteractions: integer("total_interactions").notNull().default(0),
  lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dmConversationsTable = pgTable("dm_conversations", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  platform: text("platform").notNull().default("demo"),
  externalThreadId: text("external_thread_id"),
  autoReplyEnabled: boolean("auto_reply_enabled").notNull().default(false),
  personalityMode: text("personality_mode").notNull().default("smooth"),
  customPersonalityPrompt: text("custom_personality_prompt"),
  situationMode: text("situation_mode"),
  unreadCount: integer("unread_count").notNull().default(0),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dmMessagesTable = pgTable("dm_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  direction: text("direction").notNull(),
  content: text("content").notNull(),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  replyScore: real("reply_score"),
  platform: text("platform").default("demo"),
  externalMessageId: text("external_message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dmAnalyticsTable = pgTable("dm_analytics", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().unique(),
  responseRate: real("response_rate").default(0),
  ghostRate: real("ghost_rate").default(0),
  avgReplyTimeMs: integer("avg_reply_time_ms").default(0),
  totalMessages: integer("total_messages").default(0),
  aiRepliesUsed: integer("ai_replies_used").default(0),
  topPerformingMessage: text("top_performing_message"),
  winningLines: jsonb("winning_lines").default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDmContactSchema = createInsertSchema(dmContactsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDmConversationSchema = createInsertSchema(dmConversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDmMessageSchema = createInsertSchema(dmMessagesTable).omit({ id: true, createdAt: true });

export type DmContact = typeof dmContactsTable.$inferSelect;
export type DmConversation = typeof dmConversationsTable.$inferSelect;
export type DmMessage = typeof dmMessagesTable.$inferSelect;
export type DmAnalytics = typeof dmAnalyticsTable.$inferSelect;

export type PersonaTraits = {
  humor: number;
  flirtiness: number;
  responsiveness: number;
  tone: string;
  notes: string;
};

export const PERSONALITY_MODES = ["smooth", "funny", "confident", "chill", "romantic", "custom"] as const;
export type PersonalityMode = typeof PERSONALITY_MODES[number];

export const SITUATION_MODES = [
  "first_message", "after_ghosted", "late_night", "setting_up_date", "recovery"
] as const;
export type SituationMode = typeof SITUATION_MODES[number];

export type InsertDmContact = z.infer<typeof insertDmContactSchema>;
export type InsertDmConversation = z.infer<typeof insertDmConversationSchema>;
export type InsertDmMessage = z.infer<typeof insertDmMessageSchema>;
