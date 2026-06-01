import { pgTable, text, integer, jsonb, timestamp, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── DEV OS PROJECTS ──────────────────────────────────────────────────────────

export const devosProjectsTable = pgTable("devos_projects", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description").notNull().default(""),
  sessionId:   text("session_id").notNull(),
  language:    text("language").notNull().default("javascript"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDevosProjectSchema = createInsertSchema(devosProjectsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type DevosProject       = typeof devosProjectsTable.$inferSelect;
export type InsertDevosProject = z.infer<typeof insertDevosProjectSchema>;

// ─── DEV OS FILES ─────────────────────────────────────────────────────────────

export const devosFilesTable = pgTable("devos_files", {
  id:        serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  path:      text("path").notNull(),          // e.g. "src/index.js"
  content:   text("content").notNull().default(""),
  language:  text("language").notNull().default("javascript"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDevosFileSchema = createInsertSchema(devosFilesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type DevosFile       = typeof devosFilesTable.$inferSelect;
export type InsertDevosFile = z.infer<typeof insertDevosFileSchema>;

// ─── DEV OS EXECUTION LOGS ────────────────────────────────────────────────────

export const devosLogsTable = pgTable("devos_logs", {
  id:          serial("id").primaryKey(),
  projectId:   integer("project_id").notNull(),
  fileId:      integer("file_id"),                          // nullable
  type:        text("type").notNull(),                      // "stdout"|"error"|"perf"|"info"|"ai"|"build"
  message:     text("message").notNull(),
  durationMs:  integer("duration_ms"),
  exitCode:    integer("exit_code").notNull().default(0),
  metadata:    jsonb("metadata"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDevosLogSchema = createInsertSchema(devosLogsTable).omit({
  id: true, createdAt: true,
});
export type DevosLog       = typeof devosLogsTable.$inferSelect;
export type InsertDevosLog = z.infer<typeof insertDevosLogSchema>;
