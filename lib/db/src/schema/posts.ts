import { pgTable, serial, integer, text, timestamp, boolean, jsonb, unique, index, customType } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/**
 * Social posts. `kind` decides how the card renders:
 *   text · photo · poll · game (links a game-feed entry) · moment (an answer to the daily Apex Moment)
 *   debate (two sides in poll_options) · ask (a question with Apex's answer in ai_text)
 *   video (a reel: blob_id is the video, media_id its cover frame) · voice (blob_id is the recording)
 * `visibility`: public · followers · private.
 */
export const socialPostsTable = pgTable(
  "social_posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    kind: text("kind").notNull().default("text"),
    body: text("body").notNull().default(""),
    /** Uploaded photo (social_post_media.id); for reels, the cover frame */
    mediaId: integer("media_id"),
    /** Uploaded video or voice recording (social_media_blobs.id) */
    blobId: integer("blob_id"),
    /** Poll choices, e.g. ["Battle Royale", "Search & Destroy"] */
    pollOptions: jsonb("poll_options").$type<string[]>(),
    /** game_feed.id for game posts */
    gameId: integer("game_id"),
    /** Day of the Apex Moment this answers (YYYY-MM-DD) */
    momentDay: text("moment_day"),
    location: text("location"),
    /** social_challenges.id when this post is a challenge entry */
    challengeId: integer("challenge_id"),
    /** social_circles.id when posted into a circle (only members see it, plus anyone for public circles) */
    circleId: integer("circle_id"),
    /** Apex's answer (ask posts) or the latest summary of both sides (debates) */
    aiText: text("ai_text"),
    aiAt: timestamp("ai_at", { withTimezone: true }),
    visibility: text("visibility").notNull().default("public"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    reactionCount: integer("reaction_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("social_posts_created_idx").on(t.createdAt), index("social_posts_user_idx").on(t.userId), index("social_posts_challenge_idx").on(t.challengeId), index("social_posts_circle_idx").on(t.circleId)],
);

/**
 * Videos (reels) and voice recordings, as raw bytes. Kept in Postgres until object storage is set up;
 * served with byte ranges so phones can stream and seek.
 */
export const socialMediaBlobsTable = pgTable("social_media_blobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  key: text("key").notNull().unique(),
  mime: text("mime").notNull(),
  kind: text("kind").notNull(), // video · audio
  size: integer("size").notNull(),
  durationMs: integer("duration_ms"),
  width: integer("width"),
  height: integer("height"),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Profile extras for Social: cover art and a short tagline line under the name. */
export const socialProfilesTable = pgTable("social_profiles", {
  userId: integer("user_id").primaryKey(),
  cover: text("cover").notNull().default("city"),
  tagline: text("tagline").notNull().default(""),
  interests: text("interests").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
    /** On debates: the side the commenter picked (0 or 1) when they commented */
    side: integer("side"),
    /** An Apex answer the commenter chose to share; ai_prompt is what they asked */
    ai: boolean("ai").notNull().default(false),
    aiPrompt: text("ai_prompt"),
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

/**
 * Challenges: a prompt with a hashtag and an end date. Entries are posts with challenge_id set.
 * Apex's weekly challenge has a slug ("weekly-2026-09-28") and no creator.
 */
export const socialChallengesTable = pgTable("social_challenges", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique(),
  creatorId: integer("creator_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  tag: text("tag").notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  deleted: boolean("deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Stories: a photo or a short text on a colour, gone after 24 hours.
 * Seen by the people who follow the author (and the author).
 */
export const socialStoriesTable = pgTable(
  "social_stories",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    mediaId: integer("media_id"),
    text: text("text").notNull().default(""),
    /** Background for text stories: one of the app's preset names */
    bg: text("bg").notNull().default("night"),
    viewCount: integer("view_count").notNull().default(0),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("social_stories_user_idx").on(t.userId), index("social_stories_expires_idx").on(t.expiresAt)],
);

export const storyViewsTable = pgTable(
  "story_views",
  {
    id: serial("id").primaryKey(),
    storyId: integer("story_id").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("story_views_story_user").on(t.storyId, t.userId)],
);

/**
 * Circles: groups people join to post together. Public circles can be found and joined by anyone;
 * invite-only circles are joined with their invite code.
 */
export const socialCirclesTable = pgTable("social_circles", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  emoji: text("emoji").notNull().default("✨"),
  privacy: text("privacy").notNull().default("public"), // public · invite
  inviteCode: text("invite_code").notNull().unique(),
  memberCount: integer("member_count").notNull().default(1),
  deleted: boolean("deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const circleMembersTable = pgTable(
  "circle_members",
  {
    id: serial("id").primaryKey(),
    circleId: integer("circle_id").notNull(),
    userId: integer("user_id").notNull(),
    role: text("role").notNull().default("member"), // owner · member
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("circle_members_pair").on(t.circleId, t.userId), index("circle_members_user_idx").on(t.userId)],
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
