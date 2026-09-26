/**
 * Apex AI OS — Workflow Engine
 *
 * The central execution layer for Apex AI OS.
 * Transforms AI-generated plans into step-by-step executable pipelines.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  Prompt → AI creates Workflow definition                         │
 * │      ↓                                                           │
 * │  createWorkflow() registers it in the engine + DB               │
 * │      ↓                                                           │
 * │  runWorkflow(id) builds ExecutionContext                         │
 * │      ↓                                                           │
 * │  executeStep() per step: condition check → handler → log        │
 * │      ↓                                                           │
 * │  WorkflowExecutionResult → Memory System → optional chain       │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Public API:
 *   createWorkflow()        — Register a workflow (from scratch or template)
 *   runWorkflow()           — Execute a workflow by ID
 *   executeStep()           — Execute a single step (exported for testing)
 *   updateWorkflow()        — Update workflow fields
 *   getWorkflow()           — Look up a workflow by ID
 *   listWorkflows()         — List all workflows (optionally filtered by project)
 *   deleteWorkflow()        — Remove a workflow
 *   listTemplates()         — List built-in workflow template types
 *   instantiateTemplate()   — Create a workflow from a template
 */

import { randomUUID } from "node:crypto";
import { db, apexOsProjectsTable, apexOsMemoryLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { evaluateCondition, getHandler } from "./stepHandlers";
import { instantiateTemplate, getTemplateSummaries } from "./workflowTemplates";
import type {
  Workflow,
  WorkflowStep,
  WorkflowType,
  WorkflowTrigger,
  WorkflowUpdateInput,
  ExecutionContext,
  WorkflowExecutionResult,
  StepLog,
  StepHandlerResult,
} from "./workflowTypes";

// ── In-memory registry ─────────────────────────────────────────────────────────
//
// Fast O(1) lookups during execution.
// Source of truth is the DB; this is a write-through cache.
// Populated on first access (lazy load from DB).

const _registry = new Map<string, Workflow>();

// ── Engine configuration ───────────────────────────────────────────────────────

const ENGINE_CONFIG = {
  stepTimeoutMs: 30_000,
  defaultRetries: 0,
  maxStepsPerWorkflow: 30,
  maxConcurrentExecutions: 20,
  maxChainDepth: 5,
  executionHistoryLimit: 100,
} as const;

// Track running executions to enforce limits
const _runningExecutions = new Map<string, boolean>();

// ── createWorkflow ─────────────────────────────────────────────────────────────

/**
 * Register a new workflow.
 *
 * If type is a built-in template type, the template is used as the base
 * and `definition` is merged over it as overrides.
 * If type is "custom", `definition.steps` must be provided.
 *
 * The workflow is added to the in-memory registry AND persisted to the
 * project's `workflows` JSONB column in the DB.
 */
export async function createWorkflow(
  definition: Partial<Workflow> & {
    name: string;
    type: WorkflowType;
    projectId?: number;
  },
): Promise<Workflow> {
  // Resolve steps from template or definition
  let workflow: Workflow;

  if (definition.type !== "custom") {
    const template = instantiateTemplate(definition.type, definition);
    if (!template) throw new Error(`Unknown workflow type: ${definition.type}`);
    workflow = template;
  } else {
    if (!definition.steps?.length) {
      throw new Error("Custom workflow requires at least one step");
    }
    workflow = {
      id: definition.id ?? `wf-${randomUUID().slice(0, 8)}`,
      name: definition.name,
      description: definition.description ?? "",
      type: "custom",
      trigger: definition.trigger ?? "manual",
      steps: definition.steps,
      enabled: definition.enabled ?? true,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: definition.tags ?? [],
      chainTo: definition.chainTo,
      chainOnError: definition.chainOnError,
      projectId: definition.projectId,
      sessionId: definition.sessionId,
    };
  }

  if (workflow.steps.length > ENGINE_CONFIG.maxStepsPerWorkflow) {
    throw new Error(`Workflow exceeds ${ENGINE_CONFIG.maxStepsPerWorkflow} steps`);
  }

  // Ensure unique step IDs
  const seen = new Set<string>();
  workflow.steps.forEach((s, i) => {
    if (!s.stepId) s.stepId = `step-${i + 1}`;
    if (seen.has(s.stepId)) s.stepId = `${s.stepId}-${i}`;
    seen.add(s.stepId);
  });

  workflow.projectId = definition.projectId;

  // Write-through to in-memory registry
  _registry.set(workflow.id, workflow);

  // Persist to DB if projectId is provided
  if (definition.projectId) {
    await _persistWorkflowToDB(definition.projectId, workflow);
  }

  logger.info(
    { workflowId: workflow.id, type: workflow.type, stepCount: workflow.steps.length, projectId: definition.projectId },
    "WorkflowEngine: workflow created",
  );

  return workflow;
}

// ── runWorkflow ────────────────────────────────────────────────────────────────

/**
 * Execute a workflow by ID.
 *
 * @param workflowId   ID of the workflow to run
 * @param projectId    Project that owns this workflow (for DB lookup + telemetry)
 * @param contextData  Initial data to populate ExecutionContext.data
 * @param chainDepth   Internal — prevents infinite chain recursion
 */
export async function runWorkflow(
  workflowId: string,
  projectId?: number,
  contextData: Record<string, unknown> = {},
  chainDepth = 0,
): Promise<WorkflowExecutionResult> {
  if (chainDepth > ENGINE_CONFIG.maxChainDepth) {
    throw new Error(`Max chain depth (${ENGINE_CONFIG.maxChainDepth}) exceeded`);
  }

  if (_runningExecutions.size >= ENGINE_CONFIG.maxConcurrentExecutions) {
    throw new Error("Engine at capacity — too many concurrent executions");
  }

  // Resolve workflow from registry → DB fallback
  let workflow = _registry.get(workflowId);
  if (!workflow && projectId) {
    workflow = await _loadWorkflowFromDB(workflowId, projectId);
  }
  if (!workflow) {
    throw new Error(`Workflow '${workflowId}' not found`);
  }

  if (!workflow.enabled) {
    throw new Error(`Workflow '${workflow.name}' is disabled`);
  }

  const executionId = randomUUID();
  const startedAt = new Date().toISOString();

  // Register running execution
  _runningExecutions.set(executionId, true);

  // Build initial execution context
  const context: ExecutionContext = {
    workflowId,
    executionId,
    projectId: projectId ?? workflow.projectId,
    sessionId: contextData.sessionId as string | undefined,
    userId: contextData.userId as string | undefined,
    trigger: workflow.trigger,
    startedAt,
    data: { ...contextData, ...(workflow.projectId ? { projectId: workflow.projectId } : {}) },
    stepOutputs: {},
    errors: [],
  };

  logger.info(
    { workflowId, executionId, trigger: workflow.trigger, stepCount: workflow.steps.length, chainDepth },
    "WorkflowEngine: execution started",
  );

  const stepLogs: StepLog[] = [];
  let stepsSucceeded = 0;
  let stepsFailed = 0;
  let stepsSkipped = 0;
  let fatalError: string | undefined;

  // ── Execute steps ────────────────────────────────────────────────────────────
  for (const step of workflow.steps) {
    const stepLog = await executeStep(step, context);
    stepLogs.push(stepLog);

    if (stepLog.status === "skipped") {
      stepsSkipped++;
    } else if (stepLog.status === "failure") {
      stepsFailed++;
      context.errors.push(stepLog.error ?? `Step ${step.stepId} failed`);
      // Non-fatal by default — continue to next step
    } else {
      stepsSucceeded++;
      // Cache step output for condition evaluation
      context.stepOutputs[step.stepId] = stepLog.output;
      // Merge context updates
      if (stepLog.output && typeof stepLog.output === "object") {
        const out = stepLog.output as Record<string, unknown>;
        if (out._contextUpdate && typeof out._contextUpdate === "object") {
          Object.assign(context.data, out._contextUpdate);
        }
      }
    }
  }

  const completedAt = new Date().toISOString();
  const totalDurationMs = stepLogs.reduce((sum, l) => sum + l.durationMs, 0);

  const overallStatus: WorkflowExecutionResult["status"] =
    fatalError ? "failure"
    : stepsFailed === workflow.steps.length ? "failure"
    : stepsFailed > 0 ? "partial"
    : stepsSkipped === workflow.steps.length ? "skipped"
    : "success";

  const result: WorkflowExecutionResult = {
    executionId,
    workflowId,
    workflowName: workflow.name,
    workflowType: workflow.type,
    projectId: context.projectId,
    trigger: workflow.trigger,
    status: overallStatus,
    startedAt,
    completedAt,
    totalDurationMs,
    stepsTotal: workflow.steps.length,
    stepsSucceeded,
    stepsFailed,
    stepsSkipped,
    stepLogs,
    error: fatalError,
  };

  // Cleanup
  _runningExecutions.delete(executionId);

  logger.info(
    { workflowId, executionId, status: overallStatus, totalDurationMs, stepsSucceeded, stepsFailed, stepsSkipped },
    "WorkflowEngine: execution complete",
  );

  // ── Persist to memory system ─────────────────────────────────────────────────
  await _logExecutionToMemory(result, workflow);

  // ── Persist execution history to project ─────────────────────────────────────
  if (context.projectId) {
    await _persistExecutionHistory(context.projectId, result);
    // Update workflow lastRunAt
    await _updateWorkflowLastRun(context.projectId, workflowId, overallStatus);
  }

  // ── Workflow chaining ────────────────────────────────────────────────────────
  const chainTarget = overallStatus === "failure"
    ? workflow.chainOnError
    : workflow.chainTo;

  if (chainTarget) {
    result.chainedTo = chainTarget;
    logger.info({ chainTarget, chainDepth: chainDepth + 1 }, "WorkflowEngine: chaining to next workflow");
    // Chain asynchronously — don't block the current result
    runWorkflow(chainTarget, context.projectId, context.data, chainDepth + 1).catch((err) => {
      logger.error({ err, chainTarget }, "WorkflowEngine: chain workflow failed");
    });
  }

  return result;
}

// ── executeStep ────────────────────────────────────────────────────────────────

/**
 * Execute a single workflow step.
 *
 * Lifecycle:
 *   1. Evaluate condition — skip if false
 *   2. Dispatch to registered handler
 *   3. Retry on failure (up to step.retries times)
 *   4. Record full StepLog (timing, output, success/failure)
 *   5. Merge handler's contextUpdate into context.data
 */
export async function executeStep(
  step: WorkflowStep,
  context: ExecutionContext,
): Promise<StepLog> {
  const stepStart = Date.now();
  const startedAt = new Date().toISOString();

  // ── 1. Condition check ───────────────────────────────────────────────────────
  const conditionResult = evaluateCondition(step.condition, context);

  if (!conditionResult) {
    logger.debug(
      { stepId: step.stepId, condition: step.condition },
      "WorkflowEngine: step skipped — condition false",
    );
    return {
      stepId: step.stepId,
      action: step.action,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - stepStart,
      status: "skipped",
      output: null,
      outputDescription: step.output,
      conditionResult: false,
      retryCount: 0,
      inputSnapshot: step.input,
    };
  }

  // ── 2. Dispatch to handler ───────────────────────────────────────────────────
  const handler = getHandler(step.action);

  const maxAttempts = 1 + (step.retries ?? ENGINE_CONFIG.defaultRetries);
  let lastResult: StepHandlerResult | null = null;
  let retryCount = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      lastResult = await _withTimeout(
        handler!(step, context),
        step.timeoutMs ?? ENGINE_CONFIG.stepTimeoutMs,
        `Step '${step.stepId}' timed out`,
      );

      if (lastResult.success) break; // Success — stop retrying

      if (attempt < maxAttempts) {
        retryCount++;
        logger.warn(
          { stepId: step.stepId, attempt, maxAttempts, error: lastResult.error },
          "WorkflowEngine: step failed — retrying",
        );
        await _sleep(200 * attempt); // Exponential back-off (simple)
      }
    } catch (err) {
      lastResult = {
        success: false,
        output: null,
        error: err instanceof Error ? err.message : "Unknown error",
      };
      if (attempt < maxAttempts) {
        retryCount++;
        await _sleep(200 * attempt);
      }
    }
  }

  const result = lastResult!;

  // ── 3. Merge context update ──────────────────────────────────────────────────
  if (result.success && result.contextUpdate) {
    Object.assign(context.data, result.contextUpdate);
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - stepStart;
  const status = result.success ? (retryCount > 0 ? "retried" : "success") : "failure";

  logger.debug(
    { stepId: step.stepId, action: step.action, status, durationMs, retryCount },
    "WorkflowEngine: step complete",
  );

  return {
    stepId: step.stepId,
    action: step.action,
    startedAt,
    completedAt,
    durationMs,
    status,
    output: result.output,
    outputDescription: step.output,
    error: result.error,
    retryCount,
    conditionResult: conditionResult,
    inputSnapshot: step.input,
  };
}

// ── updateWorkflow ─────────────────────────────────────────────────────────────

/**
 * Update a workflow's fields.
 * Bumps the version and updatedAt timestamp.
 * Syncs to both in-memory registry and DB.
 */
export async function updateWorkflow(
  workflowId: string,
  updates: WorkflowUpdateInput,
  projectId?: number,
): Promise<Workflow> {
  let workflow = _registry.get(workflowId);
  if (!workflow && projectId) {
    workflow = await _loadWorkflowFromDB(workflowId, projectId);
  }
  if (!workflow) throw new Error(`Workflow '${workflowId}' not found`);

  const updated: Workflow = {
    ...workflow,
    ...updates,
    id: workflow.id,
    type: workflow.type,
    version: workflow.version + 1,
    updatedAt: new Date().toISOString(),
  };

  _registry.set(workflowId, updated);

  if (projectId ?? workflow.projectId) {
    await _persistWorkflowToDB(projectId ?? workflow.projectId!, updated, true);
  }

  logger.info(
    { workflowId, version: updated.version, updatedFields: Object.keys(updates) },
    "WorkflowEngine: workflow updated",
  );

  return updated;
}

// ── getWorkflow ────────────────────────────────────────────────────────────────

export async function getWorkflow(
  workflowId: string,
  projectId?: number,
): Promise<Workflow | null> {
  return (
    _registry.get(workflowId) ??
    (projectId ? (await _loadWorkflowFromDB(workflowId, projectId)) ?? null : null)
  );
}

// ── listWorkflows ──────────────────────────────────────────────────────────────

export function listWorkflows(projectId?: number): Workflow[] {
  const all = [..._registry.values()];
  return projectId ? all.filter((w) => w.projectId === projectId) : all;
}

// ── deleteWorkflow ─────────────────────────────────────────────────────────────

export async function deleteWorkflow(
  workflowId: string,
  projectId?: number,
): Promise<void> {
  _registry.delete(workflowId);

  if (projectId) {
    const [project] = await db
      .select({ workflows: apexOsProjectsTable.workflows })
      .from(apexOsProjectsTable)
      .where(eq(apexOsProjectsTable.id, projectId))
      .limit(1);

    if (project) {
      const filtered = (project.workflows ?? []).filter((w: { id: string }) => w.id !== workflowId);
      await db
        .update(apexOsProjectsTable)
        .set({ workflows: filtered as typeof project.workflows, updatedAt: new Date() })
        .where(eq(apexOsProjectsTable.id, projectId));
    }
  }

  logger.info({ workflowId, projectId }, "WorkflowEngine: workflow deleted");
}

// ── listTemplates ──────────────────────────────────────────────────────────────

export function listTemplates() {
  return getTemplateSummaries();
}

// ── instantiateTemplate (re-export) ───────────────────────────────────────────

export { instantiateTemplate };

// ── Private helpers ────────────────────────────────────────────────────────────

async function _persistWorkflowToDB(
  projectId: number,
  workflow: Workflow,
  isUpdate = false,
): Promise<void> {
  try {
    const [project] = await db
      .select({ workflows: apexOsProjectsTable.workflows })
      .from(apexOsProjectsTable)
      .where(eq(apexOsProjectsTable.id, projectId))
      .limit(1);

    if (!project) return;

    // The JSONB column is typed for AI-OS workflows but also stores engine workflows
    const existing = (project.workflows ?? []) as unknown as Workflow[];
    const updated = isUpdate
      ? existing.map((w) => (w.id === workflow.id ? workflow : w))
      : [...existing.filter((w) => w.id !== workflow.id), workflow];

    await db
      .update(apexOsProjectsTable)
      .set({ workflows: updated as unknown as typeof project.workflows, updatedAt: new Date() })
      .where(eq(apexOsProjectsTable.id, projectId));
  } catch (err) {
    logger.error({ err, workflowId: workflow.id, projectId }, "WorkflowEngine: DB persist failed");
  }
}

async function _loadWorkflowFromDB(
  workflowId: string,
  projectId: number,
): Promise<Workflow | undefined> {
  try {
    const [project] = await db
      .select({ workflows: apexOsProjectsTable.workflows })
      .from(apexOsProjectsTable)
      .where(eq(apexOsProjectsTable.id, projectId))
      .limit(1);

    const found = (project?.workflows ?? []).find((w: { id: string }) => w.id === workflowId) as Workflow | undefined;
    if (found) _registry.set(workflowId, found); // Cache for future lookups
    return found;
  } catch {
    return undefined;
  }
}

async function _logExecutionToMemory(
  result: WorkflowExecutionResult,
  workflow: Workflow,
): Promise<void> {
  try {
    await db.insert(apexOsMemoryLogsTable).values({
      projectId: result.projectId ?? null,
      sessionId: null,
      type: "workflow",
      content: `Workflow '${result.workflowName}' [${result.workflowType}] — ${result.status} in ${result.totalDurationMs}ms`,
      metadata: {
        executionId: result.executionId,
        workflowId: result.workflowId,
        workflowType: result.workflowType,
        trigger: result.trigger,
        status: result.status,
        stepsTotal: result.stepsTotal,
        stepsSucceeded: result.stepsSucceeded,
        stepsFailed: result.stepsFailed,
        stepsSkipped: result.stepsSkipped,
        totalDurationMs: result.totalDurationMs,
        chainedTo: result.chainedTo,
        // Store abbreviated step log (action + status + durationMs only)
        stepSummary: result.stepLogs.map((l) => ({
          stepId: l.stepId,
          action: l.action,
          status: l.status,
          durationMs: l.durationMs,
          error: l.error,
        })),
      },
      success: result.status === "success" || result.status === "partial",
      durationMs: result.totalDurationMs,
    });
  } catch (err) {
    logger.error({ err }, "WorkflowEngine: failed to log execution to memory");
  }
}

async function _persistExecutionHistory(
  projectId: number,
  result: WorkflowExecutionResult,
): Promise<void> {
  try {
    const [project] = await db
      .select({
        executionHistory: apexOsProjectsTable.executionHistory,
        runCount: apexOsProjectsTable.runCount,
        errorCount: apexOsProjectsTable.errorCount,
      })
      .from(apexOsProjectsTable)
      .where(eq(apexOsProjectsTable.id, projectId))
      .limit(1);

    if (!project) return;

    const historyEntry = {
      workflowId: result.workflowId,
      workflowName: result.workflowName,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      success: result.status === "success",
      stepResults: result.stepLogs.map((l) => ({
        stepId: l.stepId,
        action: l.action,
        status: l.status as "done" | "error" | "skipped",
        output: typeof l.output === "string" ? l.output : JSON.stringify(l.output),
        durationMs: l.durationMs,
      })),
      totalDurationMs: result.totalDurationMs,
      error: result.error,
    };

    const updatedHistory = [
      historyEntry,
      ...(project.executionHistory ?? []),
    ].slice(0, ENGINE_CONFIG.executionHistoryLimit);

    await db
      .update(apexOsProjectsTable)
      .set({
        executionHistory: updatedHistory as typeof project.executionHistory,
        runCount: (project.runCount ?? 0) + 1,
        errorCount: result.status === "failure"
          ? (project.errorCount ?? 0) + 1
          : (project.errorCount ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(apexOsProjectsTable.id, projectId));
  } catch (err) {
    logger.error({ err }, "WorkflowEngine: failed to persist execution history");
  }
}

async function _updateWorkflowLastRun(
  projectId: number,
  workflowId: string,
  status: string,
): Promise<void> {
  try {
    const [project] = await db
      .select({ workflows: apexOsProjectsTable.workflows })
      .from(apexOsProjectsTable)
      .where(eq(apexOsProjectsTable.id, projectId))
      .limit(1);

    if (!project) return;

    const updated = (project.workflows ?? []).map((w: { id: string; lastRunAt?: string; status?: string }) =>
      w.id === workflowId
        ? { ...w, lastRunAt: new Date().toISOString(), status: status === "success" ? "complete" : status === "failure" ? "error" : "idle" }
        : w
    );

    await db
      .update(apexOsProjectsTable)
      .set({ workflows: updated as typeof project.workflows })
      .where(eq(apexOsProjectsTable.id, projectId));
  } catch {
    // Non-critical — don't throw
  }
}

function _withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

function _sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
