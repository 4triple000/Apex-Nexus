import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * A game someone is making in the Apex Engine.
 * target: "apex" (plays right away), "mobile" (iOS/Android) or "pc" (computer/console).
 * engine: "apex", "unity" or "unreal". Mobile and PC games are planned in Apex and built on a computer.
 */
export const gameProjectsTable = pgTable("game_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  target: text("target").notNull().default("apex"),
  engine: text("engine").notNull().default("apex"),
  template: text("template"),
  prompt: text("prompt"),
  /** Apex game config: the playable game (or the quick prototype for Unity/Unreal games) */
  config: jsonb("config"),
  /** Game plan: pitch, core loop, controls, mechanics, levels, characters, art, checklist */
  plan: jsonb("plan"),
  /** Game settings such as multiplayer */
  settings: jsonb("settings"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("game_projects_user_idx").on(t.userId)]);

export type GameProject = typeof gameProjectsTable.$inferSelect;
