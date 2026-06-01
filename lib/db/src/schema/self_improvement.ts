/**
 * Apex AI OS — Self-Improving System Schema
 *
 * Two tables power the learning loop:
 *   apex_os_improvement_versions — versioned before/after records for every improvement
 *   apex_os_project_scores       — stability/efficiency/success scores per project
 *
 * Rules:
 *   • Never delete data — all improvements are additive
 *   • Always version — every change gets a semantic version (v{major}.{minor}.{patch})
 *   • Store before/after — full state captured at improvement time
 */

import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── apex_os_improvement_versions ──────────────────────────────────────────────

export const apexOsImprovementVersionsTable = pgTable(
  "apex_os_improvement_versions",
  {
    id: serial("id").primaryKey(),

    version:    text("version").notNull(),           // e.g. "v1.3.2"
    targetType: text("target_type").notNull(),       // "generation_model" | "workflow_template" | "prompt_config" | "retry_policy"
    targetId:   text("target_id").notNull(),         // e.g. "gpt-5.2", "app_generation_flow", "wf-abc123:step-3"

    rationale:   text("rationale").notNull(),
    beforeState: jsonb("before_state")
      .$type<Record<string, unknown>>()
      .notNull(),
    afterState:  jsonb("after_state")
      .$type<Record<string, unknown>>()
      .notNull(),

    patternIds:   jsonb("pattern_ids").$type<string[]>().notNull().default([]),
    patternTypes: jsonb("pattern_types").$type<string[]>().notNull().default([]),

    loopId:   text("loop_id"),           // the runLearningLoop() call that created this
    projectId: integer("project_id"),    // null = system-wide improvement

    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const insertApexOsImprovementVersionSchema = createInsertSchema(
  apexOsImprovementVersionsTable,
).omit({ id: true, appliedAt: true });

export type ApexOsImprovementVersion =
  typeof apexOsImprovementVersionsTable.$inferSelect;
export type InsertApexOsImprovementVersion = z.infer<
  typeof insertApexOsImprovementVersionSchema
>;

// ── apex_os_project_scores ────────────────────────────────────────────────────

export const apexOsProjectScoresTable = pgTable("apex_os_project_scores", {
  id: serial("id").primaryKey(),

  projectId: integer("project_id").notNull(),

  stabilityScore:   real("stability_score").notNull(),   // 0-100
  efficiencyScore:  real("efficiency_score").notNull(),  // 0-100
  successRateScore: real("success_rate_score").notNull(),// 0-100
  overallScore:     real("overall_score").notNull(),     // weighted 0-100
  grade:            text("grade").notNull(),             // A B C D F

  sampleSize:   integer("sample_size").notNull(),
  loopId:       text("loop_id"),
  computedAt:   timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertApexOsProjectScoreSchema = createInsertSchema(
  apexOsProjectScoresTable,
).omit({ id: true, computedAt: true });

export type ApexOsProjectScore = typeof apexOsProjectScoresTable.$inferSelect;
export type InsertApexOsProjectScore = z.infer<
  typeof insertApexOsProjectScoreSchema
>;
