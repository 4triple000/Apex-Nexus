import { pgTable, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export interface PromptLibraryEntry { text: string; kind: "chat" | "build"; at: number }

/** Each user's prompt history and saved prompts, so they follow them across devices. */
export const promptLibraryTable = pgTable("prompt_library", {
  userId: integer("user_id").primaryKey(),
  history: jsonb("history").$type<PromptLibraryEntry[]>().notNull().default([]),
  saved: jsonb("saved").$type<PromptLibraryEntry[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
