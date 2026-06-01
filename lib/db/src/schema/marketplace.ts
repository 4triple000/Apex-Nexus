import {
  pgTable, text, integer, boolean, timestamp, serial, jsonb, real
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketplaceItemsTable = pgTable("marketplace_items", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  tags: jsonb("tags").default([]),
  category: text("category").default("custom"),
  thumbnailEmoji: text("thumbnail_emoji").default("⚡"),
  authorName: text("author_name").default("Apex User"),
  isPublic: boolean("is_public").notNull().default(true),
  playCount: integer("play_count").notNull().default(0),
  ratingAvg: real("rating_avg").default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  remixCount: integer("remix_count").notNull().default(0),
  rankingScore: real("ranking_score").default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workflowRatingsTable = pgTable("workflow_ratings", {
  id: serial("id").primaryKey(),
  marketplaceItemId: integer("marketplace_item_id").notNull(),
  workflowId: integer("workflow_id").notNull(),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workflowPlaysTable = pgTable("workflow_plays", {
  id: serial("id").primaryKey(),
  marketplaceItemId: integer("marketplace_item_id").notNull(),
  workflowId: integer("workflow_id").notNull(),
  sessionDurationMs: integer("session_duration_ms"),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workflowRemixesTable = pgTable("workflow_remixes", {
  id: serial("id").primaryKey(),
  sourceWorkflowId: integer("source_workflow_id").notNull(),
  remixedWorkflowId: integer("remixed_workflow_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketplaceItemSchema = createInsertSchema(marketplaceItemsTable).omit({
  id: true, playCount: true, ratingAvg: true, ratingCount: true, remixCount: true,
  rankingScore: true, publishedAt: true, updatedAt: true,
});

export type MarketplaceItem = typeof marketplaceItemsTable.$inferSelect;
export type WorkflowRating = typeof workflowRatingsTable.$inferSelect;
export type WorkflowPlay = typeof workflowPlaysTable.$inferSelect;
export type WorkflowRemix = typeof workflowRemixesTable.$inferSelect;
export type InsertMarketplaceItem = z.infer<typeof insertMarketplaceItemSchema>;
