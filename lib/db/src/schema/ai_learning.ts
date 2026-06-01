import { pgTable, text, integer, boolean, timestamp, serial, jsonb, real } from "drizzle-orm/pg-core";

// ─── AI INTERACTION TRACKING ──────────────────────────────────────────────────
// Every AI output is logged here so we can measure what succeeds
export const aiInteractionsTable = pgTable("ai_interactions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id"), // null = anonymous
  interactionType: text("interaction_type").notNull(), // "chat" | "dm_reply" | "studio_output" | "autopilot"
  context: text("context"), // original user prompt / context
  aiOutput: text("ai_output").notNull(), // what the AI produced
  provider: text("provider"), // "openai" | "claude" | "perplexity"
  tone: text("tone"), // detected tone: "confident" | "flirty" | "humorous" | "professional" | "casual"
  projectId: integer("project_id"), // linked project if applicable
  // Success signals
  wasAccepted: boolean("was_accepted"), // did user send/use it?
  gotReply: boolean("got_reply"), // did they get a response back?
  engagementScore: real("engagement_score").default(0), // 0-1 computed score
  responseTimeMs: integer("response_time_ms"),
  // Metadata
  metadata: jsonb("metadata"), // any extra signals
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiInteraction = typeof aiInteractionsTable.$inferSelect;

// ─── USER AI PREFERENCES ──────────────────────────────────────────────────────
// Learned per-user preferences that personalize future AI outputs
export const userAiPrefsTable = pgTable("user_ai_prefs", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: integer("user_id"),
  // Learned style preferences
  preferredTone: text("preferred_tone").default("balanced"), // "confident" | "flirty" | "humorous" | "professional" | "casual" | "balanced"
  preferredLength: text("preferred_length").default("medium"), // "short" | "medium" | "long"
  preferredStyle: text("preferred_style").default("direct"), // "direct" | "elaborate" | "question-driven"
  // Success rates per tone (0-1)
  toneSuccessRates: jsonb("tone_success_rates").default({}), // { confident: 0.8, humorous: 0.6, ... }
  // Top-performing topics
  topTopics: jsonb("top_topics").default([]), // ["fitness", "business", "dating"]
  // Personalization metadata
  totalInteractions: integer("total_interactions").notNull().default(0),
  successfulInteractions: integer("successful_interactions").notNull().default(0),
  lastLearnedAt: timestamp("last_learned_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserAiPrefs = typeof userAiPrefsTable.$inferSelect;

// ─── AI SYSTEM INSIGHTS ───────────────────────────────────────────────────────
// System-generated insights from the learning cycle
export const aiInsightsTable = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  insightType: text("insight_type").notNull(), // "trend" | "optimization" | "recommendation" | "personalization"
  scope: text("scope").notNull(), // "global" | "user" | "project"
  sessionId: text("session_id"), // null = global insight
  userId: integer("user_id"),
  projectId: integer("project_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  actionLabel: text("action_label"), // e.g. "Apply Fix", "Try Template"
  actionPayload: jsonb("action_payload"), // data for the action
  confidence: real("confidence").notNull().default(0.7), // 0-1
  impactEstimate: text("impact_estimate"), // "+30% engagement"
  isApplied: boolean("is_applied").notNull().default(false),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiInsight = typeof aiInsightsTable.$inferSelect;

// ─── PROJECT PERFORMANCE ──────────────────────────────────────────────────────
// Extended analytics snapshot computed during learning cycles
export const projectPerformanceTable = pgTable("project_performance", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().unique(),
  // Engagement metrics
  totalPlays: integer("total_plays").notNull().default(0),
  uniqueUsers: integer("unique_users").notNull().default(0),
  avgEngagementSeconds: real("avg_engagement_seconds").default(0),
  completionRate: real("completion_rate").default(0), // 0-1
  repeatUsageRate: real("repeat_usage_rate").default(0), // 0-1
  // Performance score (0-100) computed by learning engine
  performanceScore: real("performance_score").default(0),
  trendScore: real("trend_score").default(0), // rising / falling
  // Category tags detected from content
  detectedTags: jsonb("detected_tags").default([]),
  // Learning metadata
  lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectPerformance = typeof projectPerformanceTable.$inferSelect;
