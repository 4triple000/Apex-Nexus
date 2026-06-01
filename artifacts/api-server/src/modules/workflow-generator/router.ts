/**
 * AI Workflow Generator — Express Router
 *
 * Endpoints:
 *   POST /api/ai/generate-workflow   — Convert natural language → workflow JSON
 *   POST /api/ai/validate-workflow   — Validate a workflow JSON (without saving)
 *   POST /api/ai/save-workflow       — Save a generated workflow to the DB
 *   GET  /api/ai/workflow-schema     — Return supported triggers/actions for the frontend
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, workflowsTable } from "@workspace/db";
import { success, badRequest, serverError } from "../../shared/utils/response";
import { logger } from "../../lib/logger";
import { generateWorkflow, updateWorkflow } from "./generator";
import { validateAndFix, buildPreview, parseAiOutput } from "./validator";
import {
  SUPPORTED_TRIGGERS,
  SUPPORTED_ACTIONS,
  TRIGGER_DESCRIPTIONS,
  ACTION_DESCRIPTIONS,
  GeneratedWorkflowSchema,
} from "./schema";

const router: IRouter = Router();

// ── GET /api/ai/workflow-schema ────────────────────────────────────────────────
// Returns the supported triggers and actions for frontend reference (schema explorer)
router.get("/ai/workflow-schema", (_req, res): void => {
  success(res, {
    triggers: SUPPORTED_TRIGGERS.map((t) => ({
      value: t,
      label: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: TRIGGER_DESCRIPTIONS[t],
    })),
    actions: SUPPORTED_ACTIONS.map((a) => ({
      value: a,
      label: a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: ACTION_DESCRIPTIONS[a],
    })),
    conditionOperators: [
      { value: "eq", label: "Equals" },
      { value: "neq", label: "Not Equals" },
      { value: "contains", label: "Contains" },
      { value: "gt", label: "Greater Than" },
      { value: "lt", label: "Less Than" },
      { value: "exists", label: "Exists" },
    ],
  });
});

// ── POST /api/ai/generate-workflow ─────────────────────────────────────────────
// Main endpoint: convert natural language prompt → structured workflow JSON
router.post("/ai/generate-workflow", async (req, res): Promise<void> => {
  const bodySchema = z.object({
    prompt: z.string().min(5, "Prompt must be at least 5 characters").max(1000, "Prompt too long"),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid request body");
    return;
  }

  try {
    const result = await generateWorkflow(parsed.data.prompt);

    success(res, {
      ...result,
      // Never expose the raw AI output to clients in production
      rawAiOutput: process.env.NODE_ENV === "development" ? result.rawAiOutput : undefined,
    });
  } catch (err) {
    logger.error({ err }, "Workflow generation failed");
    serverError(res, "Failed to generate workflow. Please try again.");
  }
});

// ── POST /api/ai/update-workflow ───────────────────────────────────────────────
// Edit an existing workflow using a natural language change request (maintains conversation context)
router.post("/ai/update-workflow", async (req, res): Promise<void> => {
  const bodySchema = z.object({
    currentWorkflow: z.unknown(),
    request: z.string().min(2, "Request too short").max(1000, "Request too long"),
    conversationHistory: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })
      )
      .default([]),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid request body");
    return;
  }

  try {
    const result = await updateWorkflow(
      parsed.data.currentWorkflow as object,
      parsed.data.request,
      parsed.data.conversationHistory
    );

    success(res, {
      ...result,
      rawAiOutput: process.env.NODE_ENV === "development" ? result.rawAiOutput : undefined,
    });
  } catch (err) {
    logger.error({ err }, "Workflow update failed");
    serverError(res, "Failed to update workflow. Please try again.");
  }
});

// ── POST /api/ai/validate-workflow ─────────────────────────────────────────────
// Validate a raw workflow object (for preview without saving)
router.post("/ai/validate-workflow", (req, res): void => {
  const bodySchema = z.object({
    workflow: z.unknown(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, "Expected { workflow: object }");
    return;
  }

  // Accept both raw JSON object or a JSON string
  let candidate = parsed.data.workflow;
  if (typeof candidate === "string") {
    const { parsed: p, parseError } = parseAiOutput(candidate);
    if (parseError) {
      badRequest(res, `Invalid JSON: ${parseError}`);
      return;
    }
    candidate = p;
  }

  const report = validateAndFix(candidate);

  if (!report.workflow) {
    success(res, {
      valid: false,
      autoFixed: false,
      issues: report.issues,
      workflow: null,
      preview: null,
    });
    return;
  }

  const preview = buildPreview(report.workflow);
  success(res, {
    valid: report.valid,
    autoFixed: report.autoFixed,
    issues: report.issues,
    workflow: report.workflow,
    preview,
  });
});

// ── POST /api/ai/save-workflow ─────────────────────────────────────────────────
// Save a validated (and optionally auto-fixed) workflow to the database
router.post("/ai/save-workflow", async (req, res): Promise<void> => {
  const bodySchema = z.object({
    workflow: z.unknown(),
    overrideId: z.number().int().positive().optional(), // Update existing workflow
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, "Expected { workflow: object }");
    return;
  }

  // Validate the workflow before saving
  const report = validateAndFix(parsed.data.workflow);
  if (!report.valid || !report.workflow) {
    success(res, {
      saved: false,
      issues: report.issues,
      message: "Workflow failed validation. Fix the issues and try again.",
    });
    return;
  }

  const wf = report.workflow;

  try {
    if (parsed.data.overrideId) {
      // Update existing workflow
      await db
        .update(workflowsTable)
        .set({
          name: wf.name,
          description: wf.description,
          trigger: wf.trigger,
          conditions: wf.conditions,
          actions: wf.actions.map((a) => ({ type: a.type, config: a.data })),
          category: wf.category,
          updatedAt: new Date(),
        })
        .where(eq(workflowsTable.id, parsed.data.overrideId));

      success(res, {
        saved: true,
        workflowId: parsed.data.overrideId,
        autoFixed: report.autoFixed,
        issues: report.issues,
        message: "Workflow updated successfully",
      }, 200);
    } else {
      // Insert new workflow
      const [saved] = await db
        .insert(workflowsTable)
        .values({
          name: wf.name,
          description: wf.description,
          trigger: wf.trigger,
          conditions: wf.conditions,
          actions: wf.actions.map((a) => ({ type: a.type, config: a.data })),
          category: wf.category,
          enabled: true,
        })
        .returning({ id: workflowsTable.id, name: workflowsTable.name, trigger: workflowsTable.trigger });

      success(res, {
        saved: true,
        workflowId: saved!.id,
        workflowName: saved!.name,
        autoFixed: report.autoFixed,
        issues: report.issues,
        message: "Workflow saved and ready to run",
      }, 201);
    }
  } catch (err) {
    logger.error({ err }, "Failed to save workflow to DB");
    serverError(res, "Failed to save workflow");
  }
});

export default router;
