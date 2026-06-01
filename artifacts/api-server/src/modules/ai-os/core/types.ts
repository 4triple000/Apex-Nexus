/**
 * Apex AI OS — Core TypeScript Types
 *
 * Single source of truth for all AI OS interfaces.
 * Import from here, not from individual modules.
 */

import type { OsWorkflow, OsWorkflowStep, OsProjectPlan, WorkflowExecutionLog } from "@workspace/db";

// Re-export DB types
export type { OsWorkflow, OsWorkflowStep, OsProjectPlan, WorkflowExecutionLog };

// ── Generation ─────────────────────────────────────────────────────────────────

export interface GenerationResult {
  plan: OsProjectPlan;
  generatedCode: string;
  previewHtml: string;
  workflows: OsWorkflow[];
  summary: string;
  tokensUsed: number;
  durationMs: number;
}

// ── Improvement ────────────────────────────────────────────────────────────────

export type ImprovementType =
  | "performance"
  | "security"
  | "ux"
  | "code_quality"
  | "bug_fix"
  | "workflow_optimization";

export interface ImprovementSuggestion {
  id: string;
  type: ImprovementType;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  affectedFile?: string;
  patch?: string;
  applied: boolean;
}

export interface ImprovementResult {
  projectId: number;
  suggestions: ImprovementSuggestion[];
  appliedCount: number;
  summary: string;
  updatedCode?: string;
  durationMs: number;
}

export interface ImprovementContext {
  prompt?: string;
  errorLogs?: string[];
  userFeedback?: string;
  performanceMetrics?: Record<string, number>;
}

// ── Workflow engine ────────────────────────────────────────────────────────────

export interface WorkflowStepResult {
  stepId: string;
  action: string;
  status: "done" | "error" | "skipped";
  output?: string;
  durationMs: number;
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  workflowName: string;
  projectId: number;
  status: "running" | "complete" | "error";
  startedAt: string;
  completedAt?: string;
  stepResults: WorkflowStepResult[];
  totalDurationMs: number;
  error?: string;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Memory system ──────────────────────────────────────────────────────────────

export type MemoryLogType = "prompt" | "error" | "workflow" | "fix" | "ai_output" | "improvement" | "autopilot";

export interface CreateMemoryLogInput {
  projectId?: number;
  sessionId?: string;
  type: MemoryLogType;
  content: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
  durationMs?: number;
}

export interface PatternInsight {
  pattern: string;
  frequency: number;
  impact: "positive" | "negative" | "neutral";
  recommendation: string;
  affectedProjects: number[];
}

// ── API request/response shapes ────────────────────────────────────────────────

export interface CreateProjectBody {
  name: string;
  description?: string;
  prompt: string;
  sessionId?: string;
}

export interface UpdateProjectBody {
  name?: string;
  description?: string;
  status?: "active" | "archived";
}

export interface GenerateAiBody {
  prompt: string;
  projectId?: number;
  sessionId?: string;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface ImproveAiBody {
  projectId: number;
  context?: ImprovementContext;
  autoApply?: boolean;
}

export interface RunWorkflowBody {
  projectId: number;
  workflowId: string;
  input?: Record<string, unknown>;
}

export interface CreateWorkflowBody {
  projectId: number;
  name: string;
  description: string;
  triggers: string[];
  steps: Omit<OsWorkflowStep, "status">[];
}

export interface LogMemoryBody {
  projectId?: number;
  sessionId?: string;
  type: MemoryLogType;
  content: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
  durationMs?: number;
}
