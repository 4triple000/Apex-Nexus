import { pgTable, text, integer, boolean, timestamp, serial, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── USER PROFILES ────────────────────────────────────────────────────────────
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  username: text("username").notNull(),
  avatarEmoji: text("avatar_emoji").notNull().default("🎮"),
  bio: text("bio"),
  followersCount: integer("followers_count").notNull().default(0),
  followingCount: integer("following_count").notNull().default(0),
  // Email/password auth (for mobile app)
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  // Google OAuth
  googleId: text("google_id").unique(),
  avatarUrl: text("avatar_url"),
  // Monetization fields
  subscriptionTier: text("subscription_tier").notNull().default("free"), // "free" | "pro" | "creator_pro"
  subscriptionStatus: text("subscription_status").notNull().default("inactive"), // "active" | "inactive"
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, followersCount: true, followingCount: true, createdAt: true });
export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// ─── FOLLOWS ──────────────────────────────────────────────────────────────────
export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull(),
  followingId: integer("following_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.followerId, t.followingId)]);

export type Follow = typeof followsTable.$inferSelect;

// ─── PROJECT LIKES ────────────────────────────────────────────────────────────
export const projectLikesTable = pgTable("project_likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  projectId: integer("project_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.projectId)]);

export type ProjectLike = typeof projectLikesTable.$inferSelect;

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // "like" | "follow" | "remix"
  message: text("message").notNull(),
  relatedUserId: integer("related_user_id"),
  relatedProjectId: integer("related_project_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
