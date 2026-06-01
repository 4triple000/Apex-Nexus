/**
 * Apex AI OS — Workflow Engine Type Definitions
 *
 * Single source of truth for all workflow interfaces.
 * Distinct from the simplified OsWorkflow type in the AI OS module —
 * these types carry full execution context, conditions, and rich logging.
 */

// ── Core schema ───────────────────────────────────────────────────────────────

/**
 * A single executable step within a workflow.
 *
 * @param stepId     Unique identifier within the workflow
 * @param action     The action type to dispatch (matches a registered handler)
 * @param input      Input payload passed to the handler
 * @param output     Expected output description (for validation/docs)
 * @param condition  Optional guard expression — step is skipped if false
 * @param retries    How many times to retry on failure (default 0)
 * @param timeoutMs  Per-step timeout override (default: engine config)
 */
export interface WorkflowStep {
  stepId: string;
  action: WorkflowAction;
  input?: Record<string, unknown>;
  output?: string;
  condition?: string;
  retries?: number;
  timeoutMs?: number;
}

/**
 * Top-level workflow definition. Stored in the apex_os_projects.workflows
 * JSON column and optionally in the in-memory registry.
 *
 * @param trigger  Event or condition that initiates the workflow
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  type: WorkflowType;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  projectId?: number;
  sessionId?: string;
  enabled: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  chainTo?: string;          // Optional: workflow ID to chain to on success
  chainOnError?: string;     // Optional: workflow ID to chain to on error
}

// ── Trigger types ─────────────────────────────────────────────────────────────

export type WorkflowTrigger =
  | "manual"               // User triggers explicitly
  | "user.signup"          // New user registered
  | "user.login"           // User logged in
  | "prompt.received"      // AI prompt submitted
  | "project.created"      // New project created
  | "project.updated"      // Project code was changed
  | "build.complete"       // AI generation completed
  | "error.detected"       // An error was logged to memory
  | "deploy.requested"     // User requests deployment
  | "autopilot.scan"       // Autopilot system initiated
  | "memory.threshold"     // Memory log count exceeded threshold
  | "schedule.daily"       // Daily scheduled run
  | "chain"                // Triggered by another workflow's chainTo
  | string;                // Custom trigger

// ── Workflow types ─────────────────────────────────────────────────────────────

export type WorkflowType =
  | "user_signup_flow"
  | "ai_app_generation_flow"
  | "error_repair_flow"
  | "deployment_flow"
  | "custom";

// ── Action types (the verbs a step can perform) ───────────────────────────────

export type WorkflowAction =
  // Validation
  | "validate.input"
  | "validate.schema"
  | "validate.email"
  | "validate.code"
  // Data / state
  | "create.record"
  | "update.record"
  | "delete.record"
  | "fetch.data"
  // AI
  | "ai.generate"
  | "ai.analyze"
  | "ai.improve"
  | "ai.repair"
  | "ai.summarize"
  // Notifications
  | "notify.email"
  | "notify.webhook"
  | "notify.log"
  // Build / deploy
  | "build.plan"
  | "build.code"
  | "build.preview"
  | "deploy.stage"
  | "deploy.production"
  | "deploy.healthcheck"
  // Error handling
  | "error.diagnose"
  | "error.patch"
  | "error.rollback"
  // Memory
  | "memory.log"
  | "memory.analyze"
  | "memory.clear"
  // Flow control
  | "flow.wait"
  | "flow.branch"
  | "flow.chain"
  // Custom (catch-all)
  | string;

// ── Execution context ──────────────────────────────────────────────────────────

/**
 * Mutable context passed through the entire workflow execution.
 * Each step can read and write to this object.
 */
export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  projectId?: number;
  sessionId?: string;
  userId?: string;
  trigger: WorkflowTrigger;
  startedAt: string;

  // Runtime data — steps accumulate outputs here
  data: Record<string, unknown>;

  // Step output cache — keyed by stepId
  stepOutputs: Record<string, unknown>;

  // Accumulated errors (execution continues unless step marks fatal)
  errors: string[];

  // Chain payload — passed when workflow is triggered by another workflow
  chainPayload?: Record<string, unknown>;
}

// ── Step execution results ────────────────────────────────────────────────────

export interface StepLog {
  stepId: string;
  action: WorkflowAction;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: "success" | "failure" | "skipped" | "retried";
  output: unknown;
  outputDescription?: string;
  error?: string;
  retryCount: number;
  conditionResult?: boolean | "skipped";
  inputSnapshot?: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  executionId: string;
  workflowId: string;
  workflowName: string;
  workflowType: WorkflowType;
  projectId?: number;
  trigger: WorkflowTrigger;
  status: "success" | "failure" | "partial" | "skipped";
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  stepsTotal: number;
  stepsSucceeded: number;
  stepsFailed: number;
  stepsSkipped: number;
  stepLogs: StepLog[];
  chainedTo?: string;
  error?: string;
}

// ── Registry types ────────────────────────────────────────────────────────────

export type StepHandler = (
  step: WorkflowStep,
  context: ExecutionContext,
) => Promise<StepHandlerResult>;

export interface StepHandlerResult {
  success: boolean;
  output: unknown;
  error?: string;
  contextUpdate?: Record<string, unknown>;  // Merged into context.data
}

export interface WorkflowUpdateInput {
  name?: string;
  description?: string;
  trigger?: WorkflowTrigger;
  steps?: WorkflowStep[];
  enabled?: boolean;
  tags?: string[];
  chainTo?: string;
  chainOnError?: string;
}
