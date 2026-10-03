/**
 * Mobile app database schema.
 * Separate from web studio conversations — clean isolation.
 */

import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./social";

// ─── CONVERSATIONS ─────────────────────────────────────────────────────────────
export const mobileConversationsTable = pgTable("mobile_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New Chat"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Last message time, for sorting the history list */
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMobileConversationSchema = createInsertSchema(mobileConversationsTable).omit({ id: true, createdAt: true });
export type MobileConversation = typeof mobileConversationsTable.$inferSelect;

// ─── MESSAGES ──────────────────────────────────────────────────────────────────
export const mobileMessagesTable = pgTable("mobile_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => mobileConversationsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  /** Which AI answered (assistant messages), and the exact model when the provider picks one */
  provider: text("provider"),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMobileMessageSchema = createInsertSchema(mobileMessagesTable).omit({ id: true, createdAt: true });
export type MobileMessage = typeof mobileMessagesTable.$inferSelect;

// ─── MEMORY ────────────────────────────────────────────────────────────────────
// Simple key-value memory extracted from conversations
export const mobileMemoryTable = pgTable("mobile_memory", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // "goal" | "interest" | "preference" | "fact"
  key: text("key").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMobileMemorySchema = createInsertSchema(mobileMemoryTable).omit({ id: true, createdAt: true, updatedAt: true });
export type MobileMemory = typeof mobileMemoryTable.$inferSelect;
