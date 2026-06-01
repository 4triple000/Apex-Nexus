/**
 * Apex AI OS — Workflow Controller
 *
 * Handles all OS-level workflow operations.
 * Delegates execution to the core WorkflowEngine in /workflows/workflowEngine.ts
 *
 * GET    /api/os/workflows?projectId=      — List workflows for a project
 * POST   /api/os/workflows                 — Create a workflow (custom or template)
 * POST   /api/os/workflows/from-template   — Instantiate a built-in template
 * POST   /api/os/workflows/validate        — Validate without saving
 * GET    /api/os/workflows/templates       — List built-in template types
 * GET    /api/os/workflows/history         — Execution history for a project
 * GET    /api/os/workflows/:id             — Get a single workflow
 * PUT    /api/os/workflows/:id             — Update a workflow
 * DELETE /api/os/workflows/:id             — Remove a workflow
 * POST   /api/os/workflows/:id/run         — Execute a workflow
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../../lib/logger";
import { success, created, badRequest, notFound, serverError } from "../../../shared/utils/response";
import * as memoryService from "../services/memoryService";

// ── Import from the core workflow engine ──────────────────────────────────────
import {
  createWorkflow,
  runWorkflow,
  getWorkflow,
  listWorkflows,
  deleteWorkflow,
  updateWorkflow,
  listTemplates,
  instantiateTemplate,
} from "../../../workflows/workflowEngine";

import { getExecutionHistory } from "../services/workflowEngine"; // DB history helper
import type { WorkflowType, WorkflowTrigger, WorkflowUpdateInput } from "../../../workflows/workflowTypes";

// ── Validation schemas ─────────────────────────────────────────────────────────

const stepSchema = z.object({
  stepId: z.string().optional(),
  action: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.string().max(500).optional(),
  condition: z.string().max(300).optional(),
  retries: z.number().int().min(0).max(5).optional(),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
});

const WORKFLOW_TYPES = [
  "user_signup_flow",
  "ai_app_generation_flow",
  "error_repair_flow",
  "deployment_flow",
  "custom",
] as const;

const createSchema = z.object({
  projectId: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(600).optional().default(""),
  type: z.enum(WORKFLOW_TYPES).default("custom"),
  trigger: z.string().default("manual"),
  steps: z.array(stepSchema).max(30).optional(),
  enabled: z.boolean().default(true),
  tags: z.array(z.string().max(30)).max(10).optional(),
  chainTo: z.string().optional(),
  chainOnError: z.string().optional(),
});

const fromTemplateSchema = z.object({
  projectId: z.number().int().positive().optional(),
  type: z.enum(["user_signup_flow", "ai_app_generation_flow", "error_repair_flow", "deployment_flow"]),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(600).optional(),
  trigger: z.string().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  chainTo: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(600).optional(),
  trigger: z.string().optional(),
  steps: z.array(stepSchema).max(30).optional(),
  enabled: z.boolean().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  chainTo: z.string().optional(),
  chainOnError: z.string().optional(),
});

const runSchema = z.object({
  projectId: z.number().int().positive().optional(),
  contextData: z.record(z.string(), z.unknown()).optional().default({}),
});

// ── GET /api/os/workflow-templates ────────────────────────────────────────────

export async function listWorkflowTemplates(req: Request, res: Response): Promise<void> {
  success(res, { templates: listTemplates() });
}

// ── GET /api/os/workflows?projectId=... ───────────────────────────────────────

export async function listWorkflowsHandler(req: Request, res: Response): Promise<void> {
  const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
  if (req.query.projectId && isNaN(projectId!)) {
    badRequest(res, "projectId must be an integer");
    return;
  }

  try {
    const workflows = listWorkflows(projectId);
    success(res, { projectId, workflows, total: workflows.length });
  } catch (err) {
    logger.error({ err }, "workflowController.listWorkflows error");
    serverError(res, "Failed to list workflows");
  }
}

// ── POST /api/os/workflows ────────────────────────────────────────────────────

export async function createWorkflowHandler(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const body = parsed.data;

  try {
    const workflow = await createWorkflow({
      name: body.name,
      description: body.description,
      type: body.type as WorkflowType,
      trigger: body.trigger as WorkflowTrigger,
      steps: body.steps,
      projectId: body.projectId,
      enabled: body.enabled,
      tags: body.tags,
      chainTo: body.chainTo,
      chainOnError: body.chainOnError,
    });

    if (body.projectId) {
      await memoryService.log({
        projectId: body.projectId,
        type: "workflow",
        content: `Workflow registered: ${workflow.name} [${workflow.type}]`,
        metadata: { workflowId: workflow.id, stepCount: workflow.steps.length, type: workflow.type },
        success: true,
      });
    }

    created(res, { workflow });
  } catch (err) {
    logger.error({ err }, "workflowController.createWorkflow error");
    serverError(res, err instanceof Error ? err.message : "Failed to create workflow");
  }
}

// ── POST /api/os/workflows/from-template ──────────────────────────────────────

export async function createFromTemplateHandler(req: Request, res: Response): Promise<void> {
  const parsed = fromTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const body = parsed.data;

  try {
    const workflow = await createWorkflow({
      name: body.name ?? body.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: body.description,
      type: body.type as WorkflowType,
      trigger: body.trigger as WorkflowTrigger | undefined,
      projectId: body.projectId,
      tags: body.tags,
      chainTo: body.chainTo,
    });

    if (body.projectId) {
      await memoryService.log({
        projectId: body.projectId,
        type: "workflow",
        content: `Template workflow created: ${workflow.name} [${body.type}]`,
        metadata: { workflowId: workflow.id, template: body.type, stepCount: workflow.steps.length },
        success: true,
      });
    }

    created(res, { workflow, templateType: body.type });
  } catch (err) {
    logger.error({ err }, "workflowController.createFromTemplate error");
    serverError(res, err instanceof Error ? err.message : "Failed to instantiate template");
  }
}

// ── POST /api/os/workflows/validate ──────────────────────────────────────────

export async function validateWorkflowHandler(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const body = parsed.data;

  if (body.type === "custom" && !body.steps?.length) {
    errors.push("Custom workflows require at least one step");
  }
  if (body.steps && body.steps.length > 30) {
    errors.push("Maximum 30 steps per workflow");
  }
  if (!body.trigger) {
    warnings.push("No trigger specified — defaults to 'manual'");
  }
  if (!body.description) {
    warnings.push("No description provided — recommended for documentation");
  }
  body.steps?.forEach((s, i) => {
    if (!s.action) errors.push(`Step ${i + 1} is missing an action`);
  });

  success(res, { valid: errors.length === 0, errors, warnings });
}

// ── GET /api/os/workflows/history ─────────────────────────────────────────────

export async function getExecutionHistoryHandler(req: Request, res: Response): Promise<void> {
  const projectId = parseInt(req.query.projectId as string);
  const limit = parseInt(req.query.limit as string) || 20;

  if (isNaN(projectId)) {
    badRequest(res, "projectId query param required (integer)");
    return;
  }

  try {
    const history = await getExecutionHistory(projectId, Math.min(limit, 50));
    success(res, { projectId, history, total: history.length });
  } catch (err) {
    logger.error({ err }, "workflowController.getExecutionHistory error");
    serverError(res, "Failed to get execution history");
  }
}

// ── GET /api/os/workflows/:id ─────────────────────────────────────────────────

export async function getWorkflowHandler(req: Request, res: Response): Promise<void> {
  const workflowId = req.params.id;
  const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

  if (!workflowId) { badRequest(res, "Workflow ID required"); return; }

  try {
    const workflow = await getWorkflow(workflowId, projectId);
    if (!workflow) { notFound(res, `Workflow '${workflowId}' not found`); return; }
    success(res, { workflow });
  } catch (err) {
    logger.error({ err }, "workflowController.getWorkflow error");
    serverError(res, "Failed to get workflow");
  }
}

// ── PUT /api/os/workflows/:id ─────────────────────────────────────────────────

export async function updateWorkflowHandler(req: Request, res: Response): Promise<void> {
  const workflowId = req.params.id;
  const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

  if (!workflowId) { badRequest(res, "Workflow ID required"); return; }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    badRequest(res, "No fields to update");
    return;
  }

  try {
    const updated = await updateWorkflow(workflowId, parsed.data as WorkflowUpdateInput, projectId);
    success(res, { workflow: updated });
  } catch (err) {
    logger.error({ err }, "workflowController.updateWorkflow error");
    serverError(res, err instanceof Error ? err.message : "Failed to update workflow");
  }
}

// ── DELETE /api/os/workflows/:id ─────────────────────────────────────────────

export async function deleteWorkflowHandler(req: Request, res: Response): Promise<void> {
  const workflowId = req.params.id;
  const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

  if (!workflowId) { badRequest(res, "Workflow ID required"); return; }

  try {
    await deleteWorkflow(workflowId, projectId);
    success(res, { deleted: true, workflowId, projectId });
  } catch (err) {
    logger.error({ err }, "workflowController.deleteWorkflow error");
    serverError(res, err instanceof Error ? err.message : "Failed to delete workflow");
  }
}

// ── POST /api/os/workflows/:id/run ────────────────────────────────────────────

export async function runWorkflowHandler(req: Request, res: Response): Promise<void> {
  const workflowId = req.params.id;
  if (!workflowId) { badRequest(res, "Workflow ID required"); return; }

  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const { projectId, contextData } = parsed.data;
  logger.info({ workflowId, projectId }, "AI OS: workflow run requested");

  try {
    const result = await runWorkflow(workflowId, projectId, contextData);

    success(res, {
      execution: {
        executionId: result.executionId,
        workflowId: result.workflowId,
        workflowName: result.workflowName,
        workflowType: result.workflowType,
        status: result.status,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        totalDurationMs: result.totalDurationMs,
        stepsTotal: result.stepsTotal,
        stepsSucceeded: result.stepsSucceeded,
        stepsFailed: result.stepsFailed,
        stepsSkipped: result.stepsSkipped,
        chainedTo: result.chainedTo,
        error: result.error,
        // Full step-by-step log
        stepLogs: result.stepLogs.map((l) => ({
          stepId: l.stepId,
          action: l.action,
          status: l.status,
          durationMs: l.durationMs,
          output: l.output,
          outputDescription: l.outputDescription,
          error: l.error,
          retryCount: l.retryCount,
          conditionResult: l.conditionResult,
        })),
      },
    });
  } catch (err) {
    logger.error({ err }, "workflowController.runWorkflow error");
    serverError(res, err instanceof Error ? err.message : "Workflow execution failed");
  }
}
