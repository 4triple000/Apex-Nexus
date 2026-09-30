import { pgTable, text, integer, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usageTable = pgTable("usage", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  requestsUsed: integer("requests_used").notNull().default(0),
  // Extra messages for today only (streak rewards); cleared at the daily reset
  bonusRequests: integer("bonus_requests").notNull().default(0),
  tier: text("tier").notNull().default("free"),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUsageSchema = createInsertSchema(usageTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUsage = z.infer<typeof insertUsageSchema>;
export type Usage = typeof usageTable.$inferSelect;
