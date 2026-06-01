/**
 * AI Studio Projects — stores AI-generated applications.
 *
 * Each project carries:
 *  - A structured plan (metadata, features, tech stack, DB schema, workflows)
 *  - Source code files
 *  - Self-contained HTML preview
 *  - Full chat history
 *  - Interaction/feedback logs for the self-improving system
 */

import { pgTable, serial, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Workflow types ─────────────────────────────────────────────────────────────

export interface AiStudioWorkflowStep {
  id: string;
  action: string;
  input?: string;
  output?: string;
  conditions?: string;
}

export interface AiStudioWorkflow {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  steps: AiStudioWorkflowStep[];
}

// ── Plan types ─────────────────────────────────────────────────────────────────

export interface AiStudioDatabaseTable {
  table: string;
  fields: string[];
}

export interface AiStudioFile {
  path: string;
  content: string;
  language: string;
}

export interface AiStudioChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface AiStudioPlan {
  project_name: string;
  app_type: string;
  description: string;
  features: string[];
  pages: string[];
  tech_stack: string[];
  database_schema?: AiStudioDatabaseTable[];
  api_routes?: string[];
  workflows?: AiStudioWorkflow[];
  backend?: { framework?: string; database?: string };
  apis?: string[];
}

// ── Interaction log (self-improving system) ───────────────────────────────────

export interface AiStudioInteractionLog {
  timestamp: string;
  type: "generate" | "edit" | "workflow_run" | "autopilot_fix" | "error";
  prompt?: string;
  success: boolean;
  durationMs?: number;
  errorMessage?: string;
  insight?: string;
}

// ── Autopilot issue ───────────────────────────────────────────────────────────

export interface AutopilotIssue {
  id: string;
  severity: "error" | "warn" | "info";
  title: string;
  description: string;
  component: string;
  suggestedFix: string;
  appliedAt?: string;
}

// ── Table ─────────────────────────────────────────────────────────────────────

export const aiStudioProjectsTable = pgTable("ai_studio_projects", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id"),
  title: text("title").notNull().default("Untitled Project"),
  description: text("description"),
  appType: text("app_type"),
  plan: jsonb("plan").$type<AiStudioPlan>(),
  files: jsonb("files").$type<AiStudioFile[]>().notNull().default([]),
  previewHtml: text("preview_html"),
  chatHistory: jsonb("chat_history").$type<AiStudioChatMessage[]>().notNull().default([]),
  interactionLogs: jsonb("interaction_logs").$type<AiStudioInteractionLog[]>().default([]),
  buildCount: integer("build_count").default(1),
  editCount: integer("edit_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiStudioProjectSchema = createInsertSchema(aiStudioProjectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AiStudioProject = typeof aiStudioProjectsTable.$inferSelect;
export type InsertAiStudioProject = z.infer<typeof insertAiStudioProjectSchema>;
