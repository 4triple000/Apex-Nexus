import { pgTable, text, integer, jsonb, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── APEX DEPLOYMENTS ──────────────────────────────────────────────────────────

export type DeployStatus   = "pending" | "building" | "live" | "failed";
export type DeployLanguage = "html" | "javascript" | "python";
export type DeployProvider = "apex";

export interface DeployedFile { path: string; content: string; language: string; }

export const apexDeploymentsTable = pgTable("apex_deployments", {
  id:            serial("id").primaryKey(),
  projectId:     integer("project_id").notNull(),
  slug:          text("slug").notNull().unique(),
  name:          text("name").notNull(),
  status:        text("status").notNull().default("pending"),     // DeployStatus
  url:           text("url"),
  language:      text("language").notNull().default("html"),      // DeployLanguage
  filesSnapshot: jsonb("files_snapshot").notNull().default("[]"), // DeployedFile[]
  previewHtml:   text("preview_html"),                            // generated wrapper for JS/Python
  version:       integer("version").notNull().default(1),
  error:         text("error"),
  provider:      text("provider").notNull().default("apex"),
  sessionId:     text("session_id").notNull(),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeploymentSchema = createInsertSchema(apexDeploymentsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type ApexDeployment       = typeof apexDeploymentsTable.$inferSelect;
export type InsertApexDeployment = z.infer<typeof insertDeploymentSchema>;
