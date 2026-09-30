import { pgTable, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

/** 7-day open-and-use streak per user. `lastDay` is the user's local date (YYYY-MM-DD) of the last check-in. */
export const userStreaksTable = pgTable("user_streaks", {
  userId: integer("user_id").primaryKey(),
  streak: integer("streak").notNull().default(0),
  best: integer("best").notNull().default(0),
  lastDay: text("last_day"),
  avatarLook: boolean("avatar_look").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserStreak = typeof userStreaksTable.$inferSelect;
