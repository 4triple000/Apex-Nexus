import { pgTable, serial, integer, text, timestamp, boolean, jsonb, unique, index } from "drizzle-orm/pg-core";

/**
 * Social posts. `kind` decides how the card renders:
 *   text · photo · poll · game (links a game-feed entry) · moment (an answer to the daily Apex Moment)
 * `visibility`: public · followers · private.
 */
export const socialPostsTable = pgTable(
  "social_posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    kind: text("kind").notNull().default("text"),
    body: text("body").notNull().default(""),
    /** Uploaded photo (social_post_media.id) */
    mediaId: integer("media_id"),
    /** Poll choices, e.g. ["Battle Royale", "Search & Destroy"] */
    pollOptions: jsonb("poll_options").$type<string[]>(),
    /** game_feed.id for game posts */
    gameId: integer("game_id"),
    /** Day of the Apex Moment this answers (YYYY-MM-DD) */
    momentDay: text("moment_day"),
    location: text("location"),
    visibility: text("visibility").notNull().default("public"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    reactionCount: integer("reaction_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("social_posts_created_idx").on(t.createdAt), index("social_posts_user_idx").on(t.userId)],
);

/** Photos are resized on the device and kept here until object storage is set up on the server. */
export const socialPostMediaTable = pgTable("social_post_media", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  /** Random part of the photo's URL, so photos can't be found by counting ids */
  key: text("key").notNull().unique(),
  mime: text("mime").notNull(),
  /** base64 */
  data: text("data").notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const postReactionsTable = pgTable(
  "post_reactions",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("post_reactions_post_user").on(t.postId, t.userId)],
);

export const postCommentsTable = pgTable(
  "post_comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull(),
    userId: integer("user_id").notNull(),
    /** Set on replies (one level deep) */
    parentId: integer("parent_id"),
    body: text("body").notNull(),
    reactionCount: integer("reaction_count").notNull().default(0),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("post_comments_post_idx").on(t.postId)],
);

export const commentReactionsTable = pgTable(
  "comment_reactions",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id").notNull(),
    userId: integer("user_id").notNull(),
  },
  (t) => [unique("comment_reactions_comment_user").on(t.commentId, t.userId)],
);

export const pollVotesTable = pgTable(
  "poll_votes",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull(),
    userId: integer("user_id").notNull(),
    option: integer("option").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("poll_votes_post_user").on(t.postId, t.userId)],
);

/** Reports of posts, comments or people, for the owner to review. */
export const contentReportsTable = pgTable("content_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull(),
  targetType: text("target_type").notNull(), // post · comment · user
  targetId: integer("target_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Blocked people: neither sees the other's posts or comments. */
export const userBlocksTable = pgTable(
  "user_blocks",
  {
    id: serial("id").primaryKey(),
    blockerId: integer("blocker_id").notNull(),
    blockedId: integer("blocked_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("user_blocks_pair").on(t.blockerId, t.blockedId)],
);

export type SocialPost = typeof socialPostsTable.$inferSelect;
