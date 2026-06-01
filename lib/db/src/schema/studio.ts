import { pgTable, text, integer, boolean, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studioProjectsTable = pgTable("studio_projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull().default("automation"), // game | ai_tool | app | automation | media
  description: text("description"),
  nodes: jsonb("nodes").notNull().default([]),
  edges: jsonb("edges").notNull().default([]),
  viewport: jsonb("viewport"), // { x: number, y: number, zoom: number } — null = use fitView
  thumbnail: text("thumbnail").default("⚡"),
  isPublished: boolean("is_published").notNull().default(false),
  runCount: integer("run_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStudioProjectSchema = createInsertSchema(studioProjectsTable).omit({
  id: true, runCount: true, createdAt: true, updatedAt: true,
});

export type StudioProject = typeof studioProjectsTable.$inferSelect;
export type InsertStudioProject = z.infer<typeof insertStudioProjectSchema>;
