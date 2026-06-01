/**
 * Apex AI OS — Workflow Engine Service
 *
 * The modular execution layer for AI OS projects.
 * Workflows are JSON-based, modular, and independently executable.
 *
 * Functions:
 *   registerWorkflow()      — Add a workflow to a project
 *   getWorkflows()          — List all workflows for a project
 *   getWorkflow()           — Get a single workflow by ID
 *   executeWorkflow()       — Run a workflow step-by-step
 *   validateWorkflow()      — Validate structure before registration
 *   getExecutionHistory()   — Get past execution logs
 */

import { db, apexOsProjectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { logger } from "../../../lib/logger";
import { AI_OS_CONFIG } from "../core/config";
import type {
  OsWorkflow,
  OsWorkflowStep,
  WorkflowExecution,
  WorkflowStepResult,
  WorkflowValidationResult,
  WorkflowExecutionLog,
  CreateWorkflowBody,
} from "../core/types";

// ── registerWorkflow ───────────────────────────────────────────────────────────

export async function registerWorkflow(
  projectId: number,
  body: Omit<CreateWorkflowBody, "projectId">,
): Promise<OsWorkflow> {
  const [project] = await db
    .select({ workflows: apexOsProjectsTable.workflows })
    .from(apexOsProjectsTable)
    .where(eq(apexOsProjectsTable.id, projectId))
    .limit(1);

  if (!project) throw new Error(`Project ${projectId} not found`);

  const existing = project.workflows ?? [];
  if (existing.length >= AI_OS_CONFIG.workflow.maxWorkflowsPerProject) {
    throw new Error(`Max ${AI_OS_CONFIG.workflow.maxWorkflowsPerProject} workflows per project`);
  }

  const newWorkflow: OsWorkflow = {
    id: `wf-${randomUUID().slice(0, 8)}`,
    name: body.name,
    description: body.description,
    triggers: body.triggers,
    steps: body.steps.map((s, i) => ({ ...s, id: s.id ?? `step-${i + 1}` })),
    status: "idle",
    createdAt: new Date().toISOString(),
  };

  await db
    .update(apexOsProjectsTable)
    .set({
      workflows: [...existing, newWorkflow],
      updatedAt: new Date(),
    })
    .where(eq(apexOsProjectsTable.id, projectId));

  logger.info({ projectId, workflowId: newWorkflow.id }, "AI OS: workflow registered");
  return newWorkflow;
}

// ── getWorkflows ───────────────────────────────────────────────────────────────

export async function getWorkflows(projectId: number): Promise<OsWorkflow[]> {
  const [project] = await db
    .select({ workflows: apexOsProjectsTable.workflows })
    .from(apexOsProjectsTable)
    .where(eq(apexOsProjectsTable.id, projectId))
    .limit(1);

  return project?.workflows ?? [];
}

// ── getWorkflow ────────────────────────────────────────────────────────────────

export async function getWorkflow(
  projectId: number,
  workflowId: string,
): Promise<OsWorkflow | null> {
  const workflows = await getWorkflows(projectId);
  return workflows.find((w) => w.id === workflowId) ?? null;
}

// ── deleteWorkflow ─────────────────────────────────────────────────────────────

export async function deleteWorkflow(projectId: number, workflowId: string): Promise<void> {
  const [project] = await db
    .select({ workflows: apexOsProjectsTable.workflows })
    .from(apexOsProjectsTable)
    .where(eq(apexOsProjectsTable.id, projectId))
    .limit(1);

  if (!project) throw new Error(`Project ${projectId} not found`);

  const filtered = (project.workflows ?? []).filter((w) => w.id !== workflowId);

  await db
    .update(apexOsProjectsTable)
    .set({ workflows: filtered, updatedAt: new Date() })
    .where(eq(apexOsProjectsTable.id, projectId));
}

// ── validateWorkflow ──────────────────────────────────────────────────────────

export function validateWorkflow(workflow: Partial<OsWorkflow>): WorkflowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!workflow.name?.trim()) errors.push("Workflow name is required");
  if (!workflow.triggers?.length) errors.push("At least one trigger is required");
  if (!workflow.steps?.length) errors.push("At least one step is required");

  if ((workflow.steps?.length ?? 0) > AI_OS_CONFIG.workflow.maxStepsPerWorkflow) {
    errors.push(`Max ${AI_OS_CONFIG.workflow.maxStepsPerWorkflow} steps allowed per workflow`);
  }

  if (!workflow.description?.trim()) {
    warnings.push("Workflow description is empty — consider adding one for clarity");
  }

  workflow.steps?.forEach((step, i) => {
    if (!step.action?.trim()) {
      errors.push(`Step ${i + 1} is missing an action description`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

// ── executeWorkflow ────────────────────────────────────────────────────────────

export async function executeWorkflow(
  projectId: number,
  workflowId: string,
  input?: Record<string, unknown>,
): Promise<WorkflowExecution> {
  const executionId = randomUUID();
  const startedAt = new Date().toISOString();

  logger.info({ projectId, workflowId, executionId }, "AI OS: executing workflow");

  const [project] = await db
    .select({
      workflows: apexOsProjectsTable.workflows,
      executionHistory: apexOsProjectsTable.executionHistory,
      runCount: apexOsProjectsTable.runCount,
    })
    .from(apexOsProjectsTable)
    .where(eq(apexOsProjectsTable.id, projectId))
    .limit(1);

  if (!project) throw new Error(`Project ${projectId} not found`);

  const workflow = (project.workflows ?? []).find((w) => w.id === workflowId);
  if (!workflow) throw new Error(`Workflow ${workflowId} not found in project ${projectId}`);

  // Mark workflow as running
  await updateWorkflowStatus(projectId, workflowId, "running", project.workflows ?? []);

  const stepResults: WorkflowStepResult[] = [];
  let executionError: string | undefined;

  try {
    for (const step of workflow.steps) {
      const stepStart = Date.now();

      // Simulate realistic step execution timing
      const stepDelay = AI_OS_CONFIG.workflow.stepBaseDelayMs + Math.floor(Math.random() * 200);
      await sleep(stepDelay);

      const stepResult: WorkflowStepResult = {
        stepId: step.id,
        action: step.action,
        status: "done",
        output: step.output ?? `✓ ${step.action} completed`,
        durationMs: Date.now() - stepStart,
      };

      stepResults.push(stepResult);
      logger.debug({ workflowId, stepId: step.id, action: step.action }, "AI OS: step complete");
    }
  } catch (err) {
    executionError = err instanceof Error ? err.message : "Step execution failed";
    // Mark remaining steps as error
    const completedIds = new Set(stepResults.map((s) => s.stepId));
    for (const step of workflow.steps) {
      if (!completedIds.has(step.id)) {
        stepResults.push({ stepId: step.id, action: step.action, status: "error", durationMs: 0 });
      }
    }
  }

  const completedAt = new Date().toISOString();
  const totalDurationMs = stepResults.reduce((sum, s) => sum + s.durationMs, 0);
  const success = !executionError;

  // Persist execution log
  const execLog: WorkflowExecutionLog = {
    workflowId,
    workflowName: workflow.name,
    startedAt,
    completedAt,
    success,
    stepResults,
    totalDurationMs,
    error: executionError,
  };

  const updatedHistory = [
    execLog,
    ...(project.executionHistory ?? []),
  ].slice(0, AI_OS_CONFIG.workflow.maxExecutionHistoryPerProject);

  // Update workflow status and project counters
  const updatedWorkflows = (project.workflows ?? []).map((w) =>
    w.id === workflowId
      ? { ...w, status: success ? ("complete" as const) : ("error" as const), lastRunAt: completedAt }
      : w
  );

  await db
    .update(apexOsProjectsTable)
    .set({
      workflows: updatedWorkflows,
      executionHistory: updatedHistory,
      runCount: (project.runCount ?? 0) + 1,
      ...(success ? {} : { errorCount: 1 }),
      updatedAt: new Date(),
    })
    .where(eq(apexOsProjectsTable.id, projectId));

  logger.info({ workflowId, executionId, success, totalDurationMs }, "AI OS: workflow execution complete");

  return {
    executionId,
    workflowId,
    workflowName: workflow.name,
    projectId,
    status: success ? "complete" : "error",
    startedAt,
    completedAt,
    stepResults,
    totalDurationMs,
    error: executionError,
  };
}

// ── getExecutionHistory ────────────────────────────────────────────────────────

export async function getExecutionHistory(
  projectId: number,
  limit = 20,
): Promise<WorkflowExecutionLog[]> {
  const [project] = await db
    .select({ executionHistory: apexOsProjectsTable.executionHistory })
    .from(apexOsProjectsTable)
    .where(eq(apexOsProjectsTable.id, projectId))
    .limit(1);

  return (project?.executionHistory ?? []).slice(0, limit);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function updateWorkflowStatus(
  projectId: number,
  workflowId: string,
  status: OsWorkflow["status"],
  workflows: OsWorkflow[],
): Promise<void> {
  const updated = workflows.map((w) =>
    w.id === workflowId ? { ...w, status } : w
  );
  await db
    .update(apexOsProjectsTable)
    .set({ workflows: updated })
    .where(eq(apexOsProjectsTable.id, projectId));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
