import { pgTable, text, integer, boolean, jsonb, timestamp, serial, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── GAME FEED ENTRIES ────────────────────────────────────────────────────────

export const gameFeedTable = pgTable("game_feed_entries", {
  id:               serial("id").primaryKey(),
  name:             text("name").notNull(),
  creatorName:      text("creator_name").notNull().default("AI"),
  createdBy:        text("created_by").notNull().default("ai"),  // "ai" | "user"
  gameConfig:       jsonb("game_config").notNull(),
  likeCount:        integer("like_count").notNull().default(0),
  playCount:        integer("play_count").notNull().default(0),
  tags:             text("tags").array().notNull().default([]),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Remix / lineage system
  remixable:        boolean("remixable").notNull().default(true),
  isRemix:          boolean("is_remix").notNull().default(false),
  originalGameId:   integer("original_game_id"),
  originalGameName: text("original_game_name"),
  // Retention & engagement analytics
  completionCount:      integer("completion_count").notNull().default(0),
  totalPlayDurationMs:  integer("total_play_duration_ms").notNull().default(0),
  replayCount:          integer("replay_count").notNull().default(0),
});

export const insertGameFeedSchema = createInsertSchema(gameFeedTable).omit({
  id: true, likeCount: true, playCount: true, createdAt: true,
  completionCount: true, totalPlayDurationMs: true, replayCount: true,
});
export type GameFeedEntry    = typeof gameFeedTable.$inferSelect;
export type InsertGameFeed   = z.infer<typeof insertGameFeedSchema>;

// ─── GAME FEED LIKES (per session — dedup) ────────────────────────────────────

export const gameFeedLikesTable = pgTable("game_feed_likes", {
  id:        serial("id").primaryKey(),
  entryId:   integer("entry_id").notNull(),
  sessionId: text("session_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.entryId, t.sessionId)]);

export type GameFeedLike = typeof gameFeedLikesTable.$inferSelect;
