import { pgTable, text, integer, boolean, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workflowsTable = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("custom"),
  trigger: text("trigger").notNull().default("manual"),
  conditions: jsonb("conditions").notNull().default([]),
  actions: jsonb("actions").notNull().default([]),
  steps: jsonb("steps").notNull().default([]),
  isTemplate: boolean("is_template").notNull().default(false),
  shareCode: text("share_code"),
  authorName: text("author_name"),
  enabled: boolean("enabled").notNull().default(true),
  runCount: integer("run_count").notNull().default(0),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkflowSchema = createInsertSchema(workflowsTable).omit({
  id: true,
  runCount: true,
  lastRunAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflowsTable.$inferSelect;

export const WorkflowConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["eq", "neq", "contains", "gt", "lt", "exists"]),
  value: z.string().optional(),
});

export const WorkflowActionSchema = z.object({
  type: z.enum(["send_message", "call_ai_model", "update_user_data", "trigger_webhook"]),
  config: z.record(z.string(), z.unknown()),
});

export const PipelineStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  prompt: z.string(),
  outputKey: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

export type WorkflowCondition = z.infer<typeof WorkflowConditionSchema>;
export type WorkflowAction = z.infer<typeof WorkflowActionSchema>;
export type PipelineStep = z.infer<typeof PipelineStepSchema>;
