import { pgTable, text, integer, boolean, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studioMarketplaceTable = pgTable("studio_marketplace_items", {
  id: serial("id").primaryKey(),
  studioProjectId: integer("studio_project_id"), // null if published standalone
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("automation"), // game|ai_tool|app|automation|media
  thumbnail: text("thumbnail").notNull().default("⚡"),
  authorId: integer("author_id"), // FK to users.id (null for legacy items)
  authorName: text("author_name").notNull().default("Apex User"),
  nodes: jsonb("nodes").notNull().default([]),
  edges: jsonb("edges").notNull().default([]),
  isPublic: boolean("is_public").notNull().default(true),
  // Monetization fields
  price: integer("price").notNull().default(0), // cents (0 = free)
  isPaid: boolean("is_paid").notNull().default(false),
  accessType: text("access_type").notNull().default("free"), // "free" | "paid" | "subscription"
  likes: integer("likes").notNull().default(0),
  plays: integer("plays").notNull().default(0),
  remixes: integer("remixes").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStudioMarketplaceSchema = createInsertSchema(studioMarketplaceTable).omit({
  id: true, likes: true, plays: true, remixes: true, publishedAt: true, updatedAt: true,
});

export type StudioMarketplaceItem = typeof studioMarketplaceTable.$inferSelect;
export type InsertStudioMarketplaceItem = z.infer<typeof insertStudioMarketplaceSchema>;
