/**
 * Apex AI OS — AI Autopilot System
 * ─────────────────────────────────
 * Monitors runtime behavior and improves the app automatically.
 * Operates in four modes; applies only targeted, diff-based patches.
 *
 * Connections:
 *   → Workflow Engine  — reads failures, applies workflow-level patches
 *   → Memory System    — reads interaction logs, writes fix feedback
 *   → AI Studio        — uses improveFromFeedback() for AI-powered repairs
 *
 * Pipeline:
 *   monitorSystem()
 *     → detectError(log)          classify each log entry
 *     → analyzeFailure(events)    find root cause + pattern
 *     → generateFix(analysis)     produce targeted patch descriptor
 *     → applyFix(fix)             apply or suggest based on mode
 *     → [feedback stored]         { error, cause, fix, result } → memory
 *
 * "Never randomly rewrite entire system — only targeted, diff-based fixes."
 */

import { randomUUID } from "node:crypto";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import {
  getWorkflow,
  listWorkflows,
  updateWorkflow,
  runWorkflow,
} from "../workflows/workflowEngine";
import {
  getRecent,
  getByProject,
  getSummary,
  analyzePatterns,
  log as memoryLog,
} from "../modules/ai-os/services/memoryService";
import { improveFromFeedback } from "../modules/ai-os/services/aiService";
// Local interface matching ApexOsMemoryLog shape (avoids cross-package TS resolution issues)
interface MemoryLogEntry {
  id:         number;
  projectId:  number | null;
  sessionId:  string | null;
  type:       string;
  content:    string | null;
  metadata:   Record<string, unknown> | null;
  success:    boolean | null;
  durationMs: number | null;
  createdAt?: Date | string;
}
import type { Workflow, WorkflowStep } from "../workflows/workflowTypes";

// ── Enums ──────────────────────────────────────────────────────────────────────

export enum AutopilotMode {
  OFF             = "OFF",
  SUGGEST         = "SUGGEST",
  AUTO_FIX        = "AUTO_FIX",
  FULL_AUTONOMOUS = "FULL_AUTONOMOUS",
}

export type ErrorClass =
  | "WORKFLOW_FAILURE"    // A workflow step failed or workflow completed with errors
  | "API_ERROR"           // HTTP 4xx/5xx logged in memory
  | "SLOW_PERFORMANCE"    // Action duration exceeded threshold
  | "USER_FRICTION"       // Same session failing repeatedly
  | "MEMORY_ANOMALY";     // Unexpected pattern in memory logs

export type RootCauseType =
  | "TRANSIENT"        // One-off; may self-resolve
  | "SYSTEMIC"         // Recurring; needs systematic fix
  | "CONFIGURATION"    // Wrong retry/timeout/condition config
  | "RESOURCE"         // External dependency or quota issue
  | "LOGIC_ERROR";     // Bug in step handler or condition logic

export type PatchType =
  | "RETRY_CONFIG"     // Increase retry count on failing step
  | "TIMEOUT_ADJUST"   // Increase step timeout
  | "WORKFLOW_PATCH"   // Modify step condition or action
  | "STEP_DISABLE"     // Disable a consistently failing step
  | "MEMORY_INSIGHT"   // Add pattern insight to memory for future guidance
  | "AI_REPAIR";       // AI-generated code/config fix (FULL_AUTONOMOUS only)

export type FixResult =
  | "pending"
  | "applied"
  | "failed"
  | "suggested"
  | "rejected";

// ── Core interfaces ────────────────────────────────────────────────────────────

export interface AutopilotEvent {
  id: string;
  type: ErrorClass;
  severity: "low" | "medium" | "high" | "critical";
  source: string;              // e.g. "workflow:wf-abc123:step-2", "api:/api/os/memory"
  message: string;
  context: {
    workflowId?: string;
    stepId?: string;
    action?: string;
    durationMs?: number;
    failureCount?: number;
    sessionId?: string;
    endpoint?: string;
    errorMessage?: string;
    logIds?: number[];
  };
  detectedAt: string;
  projectId?: number;
}

export interface FailureAnalysis {
  id: string;
  events: AutopilotEvent[];
  rootCause: string;
  rootCauseType: RootCauseType;
  confidence: number;          // 0-1
  affectedSystems: string[];   // e.g. ["workflow:wf-abc123", "api:/api/os/memory"]
  recommendation: string;
  suggestedPatchType: PatchType;
  analysedAt: string;
}

export interface DiffEntry {
  from: unknown;
  to: unknown;
}

export interface PatchDescriptor {
  type: PatchType;
  target: string;              // "workflow:{id}", "workflow:{id}:step:{stepId}", "memory", "api:{path}"
  description: string;
  diff: Record<string, DiffEntry>;
  safeToAutoApply: boolean;    // true = applies in AUTO_FIX, false = requires FULL_AUTONOMOUS
}

/**
 * Feedback record as specified — stored in the memory system after every fix attempt.
 * { error, cause, fix, result }
 */
export interface AutopilotFix {
  id: string;
  error: AutopilotEvent;       // The detected error event
  cause: string;               // Human-readable root cause
  fix: PatchDescriptor;        // What was changed (diff-based)
  result: FixResult;           // Outcome
  appliedAt?: string;
  mode: AutopilotMode;         // Mode active when fix was attempted
  storedInMemory: boolean;     // Whether feedback was persisted
  aiSuggestion?: string;       // For AI_REPAIR type: the AI's suggestion text
}

export interface AutopilotScanResult {
  scanId: string;
  scannedAt: string;
  mode: AutopilotMode;
  projectId?: number;
  logsScanned: number;
  eventsDetected: AutopilotEvent[];
  analyses: FailureAnalysis[];
  fixes: AutopilotFix[];
  summary: {
    totalEvents: number;
    totalAnalyses: number;
    fixesApplied: number;
    fixesSuggested: number;
    fixesFailed: number;
    fixesRejected: number;
    criticalIssues: number;
    highIssues: number;
  };
}

export interface AutopilotState {
  mode: AutopilotMode;
  enabled: boolean;
  lastScanAt?: string;
  lastScanId?: string;
  totalScans: number;
  totalFixesApplied: number;
  totalFixesSuggested: number;
  totalErrorsDetected: number;
  fixHistory: AutopilotFix[];  // In-memory ring buffer (last MAX_FIX_HISTORY)
}

export interface MonitorOptions {
  projectId?: number;
  logLimit?: number;
  thresholds?: {
    slowMs?: number;           // ms above which a step is "slow" (default: 5000)
    frictionCount?: number;    // failures in same session = friction (default: 3)
    criticalFailureRate?: number;  // % failures = critical (default: 0.5)
  };
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULTS = {
  SLOW_THRESHOLD_MS:       5_000,
  FRICTION_COUNT:          3,
  CRITICAL_FAILURE_RATE:   0.5,
  LOG_SCAN_LIMIT:          100,
  MAX_FIX_HISTORY:         50,
  RETRY_INCREMENT:         2,
  TIMEOUT_MULTIPLIER:      1.5,
  MAX_TIMEOUT_MS:          60_000,
  AI_MODEL:                "gpt-5.2",
} as const;

// ── Singleton state ────────────────────────────────────────────────────────────

let _state: AutopilotState = {
  mode:                 AutopilotMode.SUGGEST,
  enabled:              true,
  totalScans:           0,
  totalFixesApplied:    0,
  totalFixesSuggested:  0,
  totalErrorsDetected:  0,
  fixHistory:           [],
};

// ── State accessors ────────────────────────────────────────────────────────────

export function getState(): Readonly<AutopilotState> {
  return { ..._state, fixHistory: [..._state.fixHistory] };
}

export function setMode(mode: AutopilotMode): void {
  logger.info({ from: _state.mode, to: mode }, "Autopilot: mode changed");
  _state.mode = mode;
  _state.enabled = mode !== AutopilotMode.OFF;
}

export function getFixHistory(projectId?: number): AutopilotFix[] {
  if (!projectId) return [..._state.fixHistory];
  return _state.fixHistory.filter((f) => f.error.projectId === projectId);
}

function pushFixToHistory(fix: AutopilotFix): void {
  _state.fixHistory.push(fix);
  if (_state.fixHistory.length > DEFAULTS.MAX_FIX_HISTORY) {
    _state.fixHistory.shift();
  }
}

// ── JSON extraction utility ────────────────────────────────────────────────────

function extractJson(raw: string): string | null {
  if (!raw?.trim()) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]?.trim().startsWith("{")) return fenced[1].trim();
  const first = raw.indexOf("{");
  const last  = raw.lastIndexOf("}");
  if (first !== -1 && last > first) return raw.slice(first, last + 1);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. detectError — classify a single memory log entry into an AutopilotEvent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a single memory log entry.
 * Returns null if the log represents a healthy operation.
 */
export function detectError(log: MemoryLogEntry): AutopilotEvent | null {
  const meta = (log.metadata ?? {}) as Record<string, unknown>;

  // ── SLOW_PERFORMANCE ──────────────────────────────────────────────────────
  if (
    log.durationMs !== null &&
    log.durationMs > DEFAULTS.SLOW_THRESHOLD_MS
  ) {
    const severity =
      log.durationMs > DEFAULTS.SLOW_THRESHOLD_MS * 4 ? "critical" :
      log.durationMs > DEFAULTS.SLOW_THRESHOLD_MS * 2 ? "high"     :
      log.durationMs > DEFAULTS.SLOW_THRESHOLD_MS * 1.5 ? "medium" :
      "low";

    return {
      id: randomUUID(),
      type: "SLOW_PERFORMANCE",
      severity,
      source: buildSource(log, meta),
      message: `Slow operation: ${log.durationMs}ms (threshold: ${DEFAULTS.SLOW_THRESHOLD_MS}ms)`,
      context: {
        workflowId:  meta.workflowId as string | undefined,
        stepId:      meta.stepId    as string | undefined,
        action:      meta.action    as string | undefined,
        durationMs:  log.durationMs,
        sessionId:   log.sessionId ?? undefined,
        logIds:      [log.id],
      },
      detectedAt: new Date().toISOString(),
      projectId:  log.projectId ?? undefined,
    };
  }

  // ── WORKFLOW_FAILURE ──────────────────────────────────────────────────────
  if (log.success === false && log.type === "workflow") {
    const severity =
      (meta.failureRate as number ?? 0) > 0.8 ? "critical" :
      (meta.failureRate as number ?? 0) > 0.5 ? "high"     :
      "medium";

    return {
      id: randomUUID(),
      type: "WORKFLOW_FAILURE",
      severity,
      source: buildSource(log, meta),
      message: log.content ?? "Workflow execution failed",
      context: {
        workflowId:   meta.workflowId   as string | undefined,
        stepId:       meta.stepId       as string | undefined,
        action:       meta.action       as string | undefined,
        durationMs:   log.durationMs    ?? undefined,
        errorMessage: meta.error        as string | undefined,
        sessionId:    log.sessionId     ?? undefined,
        logIds:       [log.id],
      },
      detectedAt: new Date().toISOString(),
      projectId:  log.projectId ?? undefined,
    };
  }

  // ── API_ERROR ─────────────────────────────────────────────────────────────
  if (log.success === false && log.type === "prompt") {
    return {
      id: randomUUID(),
      type: "API_ERROR",
      severity: "medium",
      source: `api:${(meta.endpoint as string) ?? "/api/unknown"}`,
      message: log.content ?? "API request failed",
      context: {
        endpoint:     meta.endpoint     as string | undefined,
        errorMessage: meta.error        as string | undefined,
        sessionId:    log.sessionId     ?? undefined,
        logIds:       [log.id],
      },
      detectedAt: new Date().toISOString(),
      projectId:  log.projectId ?? undefined,
    };
  }

  return null;
}

function buildSource(log: MemoryLogEntry, meta: Record<string, unknown>): string {
  if (meta.workflowId && meta.stepId) return `workflow:${meta.workflowId}:step:${meta.stepId}`;
  if (meta.workflowId)               return `workflow:${meta.workflowId}`;
  if (meta.endpoint)                 return `api:${meta.endpoint}`;
  if (log.sessionId)                 return `session:${log.sessionId}`;
  return `memory:${log.type}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. monitorSystem — scan logs and return all detected events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan recent memory logs for issues.
 * Also detects USER_FRICTION (same session failing repeatedly) and
 * MEMORY_ANOMALY (high overall failure rate).
 */
export async function monitorSystem(
  options: MonitorOptions = {},
): Promise<AutopilotEvent[]> {
  const slow        = options.thresholds?.slowMs           ?? DEFAULTS.SLOW_THRESHOLD_MS;
  const friction    = options.thresholds?.frictionCount    ?? DEFAULTS.FRICTION_COUNT;
  const critRate    = options.thresholds?.criticalFailureRate ?? DEFAULTS.CRITICAL_FAILURE_RATE;
  const limit       = options.logLimit ?? DEFAULTS.LOG_SCAN_LIMIT;

  logger.info(
    { projectId: options.projectId, limit, mode: _state.mode },
    "Autopilot: monitorSystem start",
  );

  // Fetch recent logs
  const logs: MemoryLogEntry[] = options.projectId
    ? await getByProject(options.projectId, { limit })
    : await getRecent(limit);

  const events: AutopilotEvent[] = [];

  // ── Per-log classification ─────────────────────────────────────────────────
  for (const log of logs) {
    const event = detectError(log);
    if (event) {
      // Apply custom slow threshold from options
      if (event.type === "SLOW_PERFORMANCE" && log.durationMs! <= slow) continue;
      events.push(event);
    }
  }

  // ── USER_FRICTION detection ────────────────────────────────────────────────
  // Group failures by sessionId — if same session has ≥ frictionCount failures = friction
  const sessionFailures = new Map<string, MemoryLogEntry[]>();
  for (const log of logs) {
    if (log.success === false && log.sessionId) {
      const arr = sessionFailures.get(log.sessionId) ?? [];
      arr.push(log);
      sessionFailures.set(log.sessionId, arr);
    }
  }
  for (const [sessionId, failedLogs] of sessionFailures) {
    if (failedLogs.length >= friction) {
      const severity = failedLogs.length >= friction * 3 ? "critical" :
                       failedLogs.length >= friction * 2 ? "high"     : "medium";
      events.push({
        id:       randomUUID(),
        type:     "USER_FRICTION",
        severity,
        source:   `session:${sessionId}`,
        message:  `Session ${sessionId} failed ${failedLogs.length} times (threshold: ${friction})`,
        context: {
          sessionId,
          failureCount: failedLogs.length,
          logIds: failedLogs.map((l) => l.id),
        },
        detectedAt: new Date().toISOString(),
        projectId:  failedLogs[0]?.projectId ?? undefined,
      });
    }
  }

  // ── MEMORY_ANOMALY detection ───────────────────────────────────────────────
  // If overall failure rate exceeds critical threshold
  if (logs.length >= 10) {
    const failCount = logs.filter((l) => l.success === false).length;
    const rate      = failCount / logs.length;
    if (rate > critRate) {
      events.push({
        id:       randomUUID(),
        type:     "MEMORY_ANOMALY",
        severity: rate > 0.8 ? "critical" : "high",
        source:   "memory:aggregate",
        message:  `High system-wide failure rate: ${Math.round(rate * 100)}% of last ${logs.length} operations failed`,
        context:  { failureCount: failCount },
        detectedAt: new Date().toISOString(),
        projectId:  options.projectId,
      });
    }
  }

  _state.totalErrorsDetected += events.length;
  logger.info({ eventCount: events.length }, "Autopilot: monitorSystem complete");

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. analyzeFailure — root cause analysis on a set of events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze detected events to identify root causes and recommended actions.
 * Groups related events, runs AI pattern analysis for complex cases.
 */
export async function analyzeFailure(
  events: AutopilotEvent[],
  projectId?: number,
): Promise<FailureAnalysis[]> {
  if (events.length === 0) return [];

  logger.info({ eventCount: events.length }, "Autopilot: analyzeFailure start");

  const analyses: FailureAnalysis[] = [];

  // Group events by type for batch analysis
  const groups = groupBy(events, (e) => e.type);

  for (const [errorClass, groupEvents] of Object.entries(groups)) {
    const analysis = await analyzeGroup(errorClass as ErrorClass, groupEvents, projectId);
    if (analysis) analyses.push(analysis);
  }

  logger.info({ analysisCount: analyses.length }, "Autopilot: analyzeFailure complete");
  return analyses;
}

async function analyzeGroup(
  errorClass: ErrorClass,
  events: AutopilotEvent[],
  projectId?: number,
): Promise<FailureAnalysis | null> {
  const count = events.length;

  // ── WORKFLOW_FAILURE analysis ──────────────────────────────────────────────
  if (errorClass === "WORKFLOW_FAILURE") {
    // Group by workflowId to find which workflows are failing
    const wfGroups = groupBy(events, (e) => e.context.workflowId ?? "unknown");
    const worstWf  = Object.entries(wfGroups).sort((a, b) => b[1].length - a[1].length)[0];

    if (!worstWf) return null;
    const [wfId, wfEvents] = worstWf;

    // Check if it's a specific step that keeps failing
    const stepGroups = groupBy(wfEvents, (e) => e.context.stepId ?? "unknown");
    const worstStep  = Object.entries(stepGroups).sort((a, b) => b[1].length - a[1].length)[0];
    const stepId     = worstStep?.[0] !== "unknown" ? worstStep?.[0] : undefined;

    const rootCauseType: RootCauseType = count >= 5 ? "SYSTEMIC" : count >= 2 ? "CONFIGURATION" : "TRANSIENT";

    return {
      id:              randomUUID(),
      events,
      rootCause:       stepId
        ? `Step "${stepId}" in workflow "${wfId}" is failing consistently (${count}x in recent history)`
        : `Workflow "${wfId}" is failing consistently (${count}x in recent history)`,
      rootCauseType,
      confidence:      Math.min(0.95, 0.5 + count * 0.1),
      affectedSystems: [`workflow:${wfId}`, ...(stepId ? [`workflow:${wfId}:step:${stepId}`] : [])],
      recommendation:  stepId
        ? `Increase retries on step "${stepId}" or adjust its condition expression`
        : `Review workflow "${wfId}" for consistent step failures; consider error_repair_flow`,
      suggestedPatchType: count >= 5 ? "WORKFLOW_PATCH" : "RETRY_CONFIG",
      analysedAt:      new Date().toISOString(),
    };
  }

  // ── SLOW_PERFORMANCE analysis ──────────────────────────────────────────────
  if (errorClass === "SLOW_PERFORMANCE") {
    const avgMs = events.reduce((s, e) => s + (e.context.durationMs ?? 0), 0) / count;
    const worstMs = Math.max(...events.map((e) => e.context.durationMs ?? 0));

    const wfIds = [...new Set(events.map((e) => e.context.workflowId).filter(Boolean))] as string[];

    return {
      id:              randomUUID(),
      events,
      rootCause:       `${count} slow operation(s) detected. Average: ${Math.round(avgMs)}ms, Worst: ${worstMs}ms`,
      rootCauseType:   avgMs > DEFAULTS.SLOW_THRESHOLD_MS * 3 ? "RESOURCE" : "CONFIGURATION",
      confidence:      0.8,
      affectedSystems: wfIds.map((id) => `workflow:${id}`).concat(count > 3 ? ["system:performance"] : []),
      recommendation:  `Increase step timeouts for consistently slow steps. Consider caching or reducing AI call frequency.`,
      suggestedPatchType: "TIMEOUT_ADJUST",
      analysedAt:      new Date().toISOString(),
    };
  }

  // ── USER_FRICTION analysis ─────────────────────────────────────────────────
  if (errorClass === "USER_FRICTION") {
    const sessions = [...new Set(events.map((e) => e.context.sessionId).filter(Boolean))];
    const totalFails = events.reduce((s, e) => s + (e.context.failureCount ?? 0), 0);

    return {
      id:              randomUUID(),
      events,
      rootCause:       `${sessions.length} user session(s) experiencing repeated failures (${totalFails} total failures)`,
      rootCauseType:   "LOGIC_ERROR",
      confidence:      0.75,
      affectedSystems: ["api:user-facing", "memory:session"],
      recommendation:  `Investigate the most-failed actions across sessions. Add better error recovery and user guidance.`,
      suggestedPatchType: "MEMORY_INSIGHT",
      analysedAt:      new Date().toISOString(),
    };
  }

  // ── API_ERROR analysis ─────────────────────────────────────────────────────
  if (errorClass === "API_ERROR") {
    const endpoints = [...new Set(events.map((e) => e.context.endpoint).filter(Boolean))];
    return {
      id:              randomUUID(),
      events,
      rootCause:       `${count} API error(s) on endpoints: ${endpoints.join(", ")}`,
      rootCauseType:   count > 5 ? "SYSTEMIC" : "TRANSIENT",
      confidence:      0.7,
      affectedSystems: endpoints.map((ep) => `api:${ep}`),
      recommendation:  `Check error logs for these endpoints. Likely input validation or auth issues.`,
      suggestedPatchType: "MEMORY_INSIGHT",
      analysedAt:      new Date().toISOString(),
    };
  }

  // ── MEMORY_ANOMALY — run AI pattern analysis ───────────────────────────────
  if (errorClass === "MEMORY_ANOMALY") {
    try {
      const aiPatterns = await analyzePatterns(projectId);
      const topPattern = aiPatterns[0];

      return {
        id:              randomUUID(),
        events,
        rootCause:       topPattern?.pattern ?? "System-wide anomaly detected in memory logs",
        rootCauseType:   "SYSTEMIC",
        confidence:      topPattern ? 0.85 : 0.5,
        affectedSystems: ["memory:aggregate", "system:health"],
        recommendation:  topPattern?.recommendation ?? "Review recent changes and monitor failure trends",
        suggestedPatchType: "AI_REPAIR",
        analysedAt:      new Date().toISOString(),
      };
    } catch {
      return {
        id:              randomUUID(),
        events,
        rootCause:       "System-wide anomaly detected in memory logs",
        rootCauseType:   "SYSTEMIC",
        confidence:      0.5,
        affectedSystems: ["memory:aggregate"],
        recommendation:  "Review system health — high failure rate detected across multiple components",
        suggestedPatchType: "MEMORY_INSIGHT",
        analysedAt:      new Date().toISOString(),
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. generateFix — produce a targeted patch descriptor from a failure analysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a targeted fix for a failure analysis.
 * Deterministic for simple patches (RETRY_CONFIG, TIMEOUT_ADJUST).
 * AI-powered for complex patches (WORKFLOW_PATCH, AI_REPAIR).
 */
export async function generateFix(
  analysis: FailureAnalysis,
  mode: AutopilotMode,
): Promise<AutopilotFix[]> {
  if (mode === AutopilotMode.OFF) return [];

  logger.info(
    { analysisId: analysis.id, patchType: analysis.suggestedPatchType },
    "Autopilot: generateFix start",
  );

  const fixes: AutopilotFix[] = [];

  for (const event of analysis.events) {
    const patch = await buildPatch(analysis, event, mode);
    if (!patch) continue;

    const fix: AutopilotFix = {
      id:              randomUUID(),
      error:           event,
      cause:           analysis.rootCause,
      fix:             patch,
      result:          "pending",
      mode,
      storedInMemory:  false,
    };

    fixes.push(fix);

    // De-duplicate: if the same target already has a fix in this batch, skip
    if (fixes.filter((f) => f.fix.target === patch.target).length > 1) {
      fixes.pop();
    }
  }

  logger.info({ fixCount: fixes.length }, "Autopilot: generateFix complete");
  return fixes;
}

async function buildPatch(
  analysis: FailureAnalysis,
  event: AutopilotEvent,
  mode: AutopilotMode,
): Promise<PatchDescriptor | null> {
  const { suggestedPatchType } = analysis;

  // ── RETRY_CONFIG (deterministic, safe to auto-apply) ──────────────────────
  if (suggestedPatchType === "RETRY_CONFIG" && event.context.workflowId) {
    try {
      const wf = await getWorkflow(event.context.workflowId);
      if (!wf) return null;

      const step = event.context.stepId
        ? wf.steps.find((s) => s.stepId === event.context.stepId)
        : wf.steps[0];
      if (!step) return null;

      const currentRetries = step.retries ?? 0;
      const newRetries     = Math.min(currentRetries + DEFAULTS.RETRY_INCREMENT, 5);

      return {
        type:    "RETRY_CONFIG",
        target:  `workflow:${wf.id}:step:${step.stepId}`,
        description: `Increase retries on step "${step.stepId}" from ${currentRetries} to ${newRetries}`,
        diff: {
          [`steps.${step.stepId}.retries`]: { from: currentRetries, to: newRetries },
        },
        safeToAutoApply: true,
      };
    } catch {
      return null;
    }
  }

  // ── TIMEOUT_ADJUST (deterministic, safe to auto-apply) ────────────────────
  if (suggestedPatchType === "TIMEOUT_ADJUST" && event.context.workflowId) {
    try {
      const wf = await getWorkflow(event.context.workflowId);
      if (!wf) return null;

      // Find the slowest step or the specific step
      const step = event.context.stepId
        ? wf.steps.find((s) => s.stepId === event.context.stepId)
        : wf.steps[0];
      if (!step) return null;

      const currentTimeout = step.timeoutMs ?? 30_000;
      const newTimeout     = Math.min(
        Math.round(currentTimeout * DEFAULTS.TIMEOUT_MULTIPLIER),
        DEFAULTS.MAX_TIMEOUT_MS,
      );

      if (newTimeout === currentTimeout) return null;

      return {
        type:    "TIMEOUT_ADJUST",
        target:  `workflow:${wf.id}:step:${step.stepId}`,
        description: `Increase timeout on step "${step.stepId}" from ${currentTimeout}ms to ${newTimeout}ms`,
        diff: {
          [`steps.${step.stepId}.timeoutMs`]: { from: currentTimeout, to: newTimeout },
        },
        safeToAutoApply: true,
      };
    } catch {
      return null;
    }
  }

  // ── MEMORY_INSIGHT (always safe) ──────────────────────────────────────────
  if (suggestedPatchType === "MEMORY_INSIGHT") {
    return {
      type:    "MEMORY_INSIGHT",
      target:  "memory:insights",
      description: `Record pattern: ${analysis.rootCause}`,
      diff: {
        "memory.insight": {
          from: null,
          to: {
            pattern:        analysis.rootCause,
            rootCauseType:  analysis.rootCauseType,
            recommendation: analysis.recommendation,
            confidence:     analysis.confidence,
          },
        },
      },
      safeToAutoApply: true,
    };
  }

  // ── WORKFLOW_PATCH (AI-generated, not safe for AUTO_FIX) ──────────────────
  if (suggestedPatchType === "WORKFLOW_PATCH" && event.context.workflowId) {
    const patch = await aiGenerateWorkflowPatch(event, analysis);
    return patch;
  }

  // ── AI_REPAIR (AI-generated, FULL_AUTONOMOUS only) ────────────────────────
  if (suggestedPatchType === "AI_REPAIR" && mode === AutopilotMode.FULL_AUTONOMOUS) {
    const patch = await aiGenerateRepairPatch(event, analysis);
    return patch;
  }

  // ── STEP_DISABLE (fallback for critical unrecoverable steps) ──────────────
  if (
    event.severity === "critical" &&
    event.context.workflowId &&
    event.context.stepId
  ) {
    return {
      type:    "STEP_DISABLE",
      target:  `workflow:${event.context.workflowId}:step:${event.context.stepId}`,
      description: `Disable step "${event.context.stepId}" — critical failure rate`,
      diff: {
        [`steps.${event.context.stepId}.condition`]: {
          from: "always",
          to:   "never",
        },
      },
      safeToAutoApply: false,
    };
  }

  return null;
}

async function aiGenerateWorkflowPatch(
  event: AutopilotEvent,
  analysis: FailureAnalysis,
): Promise<PatchDescriptor | null> {
  try {
    const wf = event.context.workflowId ? await getWorkflow(event.context.workflowId) : null;
    if (!wf) return null;

    const step = event.context.stepId
      ? wf.steps.find((s) => s.stepId === event.context.stepId)
      : null;

    const prompt = `You are the Apex AI OS patch generator. Suggest a targeted fix for a failing workflow step.

Workflow: ${wf.name} (${wf.id})
Failing step: ${step?.stepId ?? "unknown"} — action: ${step?.action ?? "unknown"}
Current condition: ${step?.condition ?? "always"}
Error: ${event.context.errorMessage ?? "Unknown error"}
Root cause: ${analysis.rootCause}
Recommendation: ${analysis.recommendation}

Return ONLY raw JSON with this exact shape:
{
  "condition_change": "new condition expression or null if no change",
  "action_change": "new action or null if no change",
  "retry_change": <number or null>,
  "reasoning": "one sentence explanation"
}`;

    const response = await openai.chat.completions.create({
      model: DEFAULTS.AI_MODEL,
      max_completion_tokens: 300,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const jsonStr = extractJson(raw);
    if (!jsonStr) return null;

    const suggestion = JSON.parse(jsonStr) as {
      condition_change?: string;
      action_change?:    string;
      retry_change?:     number;
      reasoning?:        string;
    };

    const diff: Record<string, DiffEntry> = {};
    if (suggestion.condition_change && step) {
      diff[`steps.${step.stepId}.condition`] = { from: step.condition ?? "always", to: suggestion.condition_change };
    }
    if (suggestion.retry_change !== null && step) {
      diff[`steps.${step.stepId}.retries`] = { from: step.retries ?? 0, to: suggestion.retry_change };
    }

    if (Object.keys(diff).length === 0) return null;

    return {
      type:    "WORKFLOW_PATCH",
      target:  `workflow:${wf.id}:step:${step?.stepId ?? "unknown"}`,
      description: suggestion.reasoning ?? `AI-suggested patch for step "${step?.stepId}"`,
      diff,
      safeToAutoApply: false,
    };
  } catch (err) {
    logger.warn({ err }, "Autopilot: AI workflow patch generation failed");
    return null;
  }
}

async function aiGenerateRepairPatch(
  event: AutopilotEvent,
  analysis: FailureAnalysis,
): Promise<PatchDescriptor | null> {
  try {
    const prompt = `You are the Apex AI OS self-repair engine. Suggest a targeted system-level fix.

Error class: ${event.type}
Severity: ${event.severity}
Source: ${event.source}
Error: ${event.message}
Root cause: ${analysis.rootCause} (${analysis.rootCauseType})
Recommendation: ${analysis.recommendation}

Return ONLY raw JSON:
{
  "fix_description": "Short description of the fix",
  "target_component": "Which component needs fixing",
  "suggested_config_change": { "key": "new_value" },
  "reasoning": "Why this fix addresses the root cause"
}`;

    const response = await openai.chat.completions.create({
      model: DEFAULTS.AI_MODEL,
      max_completion_tokens: 400,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const jsonStr = extractJson(raw);
    if (!jsonStr) return null;

    const suggestion = JSON.parse(jsonStr) as {
      fix_description?:        string;
      target_component?:       string;
      suggested_config_change?: Record<string, unknown>;
      reasoning?:              string;
    };

    const diff: Record<string, DiffEntry> = {};
    if (suggestion.suggested_config_change) {
      for (const [k, v] of Object.entries(suggestion.suggested_config_change)) {
        diff[k] = { from: null, to: v };
      }
    }

    return {
      type:    "AI_REPAIR",
      target:  suggestion.target_component ?? event.source,
      description: suggestion.fix_description ?? "AI-generated system repair",
      diff,
      safeToAutoApply: false,
    };
  } catch (err) {
    logger.warn({ err }, "Autopilot: AI repair patch generation failed");
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. applyFix — apply or suggest a fix based on current mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a fix based on the current autopilot mode.
 * Targeted patch application — never rewrites entire modules.
 *
 * Mode logic:
 *   OFF             → always reject
 *   SUGGEST         → mark suggested, store in memory, return description
 *   AUTO_FIX        → apply only safeToAutoApply patches; suggest the rest
 *   FULL_AUTONOMOUS → apply all patches including AI_REPAIR
 */
export async function applyFix(
  fix: AutopilotFix,
  mode: AutopilotMode = _state.mode,
): Promise<AutopilotFix> {
  const updated = { ...fix, mode };

  if (mode === AutopilotMode.OFF) {
    updated.result = "rejected";
    logger.info({ fixId: fix.id, mode }, "Autopilot: fix rejected (mode OFF)");
    return persistFix(updated);
  }

  // SUGGEST mode — never apply, always return suggestion
  if (mode === AutopilotMode.SUGGEST) {
    updated.result = "suggested";
    updated.aiSuggestion = formatSuggestion(fix);
    _state.totalFixesSuggested++;
    logger.info({ fixId: fix.id, target: fix.fix.target }, "Autopilot: fix suggested");
    return persistFix(updated);
  }

  // AUTO_FIX — apply only safe patches
  if (mode === AutopilotMode.AUTO_FIX && !fix.fix.safeToAutoApply) {
    updated.result = "suggested";
    updated.aiSuggestion = formatSuggestion(fix);
    _state.totalFixesSuggested++;
    logger.info({ fixId: fix.id }, "Autopilot: unsafe fix suggested (not applied in AUTO_FIX)");
    return persistFix(updated);
  }

  // AUTO_FIX (safe) or FULL_AUTONOMOUS — apply the patch
  try {
    await executePatch(fix.fix);
    updated.result    = "applied";
    updated.appliedAt = new Date().toISOString();
    _state.totalFixesApplied++;
    logger.info({ fixId: fix.id, target: fix.fix.target, type: fix.fix.type }, "Autopilot: fix applied");
  } catch (err) {
    updated.result = "failed";
    logger.error({ err, fixId: fix.id }, "Autopilot: fix application failed");
  }

  return persistFix(updated);
}

/**
 * Execute a targeted patch against the affected system.
 * Only modifies the specific step/config indicated by the diff.
 */
async function executePatch(patch: PatchDescriptor): Promise<void> {
  const [system, id, , stepId] = patch.target.split(":");

  // ── Workflow-level patches ─────────────────────────────────────────────────
  if (system === "workflow" && id) {
    const wf = await getWorkflow(id);
    if (!wf) throw new Error(`Workflow ${id} not found`);

    const updatedSteps = wf.steps.map((step: WorkflowStep) => {
      if (stepId && step.stepId !== stepId) return step;

      const modified = { ...step };

      for (const [diffKey, { to }] of Object.entries(patch.diff)) {
        const parts = diffKey.split(".");
        const lastKey = parts[parts.length - 1];

        if (lastKey === "retries")    modified.retries   = to as number;
        if (lastKey === "timeoutMs")  modified.timeoutMs = to as number;
        if (lastKey === "condition")  modified.condition  = to as string;
        if (lastKey === "action")     modified.action    = to as typeof step.action;
      }

      return modified;
    });

    await updateWorkflow(id, { steps: updatedSteps });
    return;
  }

  // ── Memory insight patches ─────────────────────────────────────────────────
  if (system === "memory") {
    const insightEntry = patch.diff["memory.insight"]?.to as Record<string, unknown> | undefined;
    if (insightEntry) {
      await memoryLog({
        type:    "ai_output",
        content: `Autopilot insight: ${insightEntry["pattern"]}`,
        metadata: {
          action:         "autopilot_insight",
          pattern:        insightEntry["pattern"],
          rootCauseType:  insightEntry["rootCauseType"],
          recommendation: insightEntry["recommendation"],
          confidence:     insightEntry["confidence"],
          source:         "autopilot",
        },
        success:    true,
        durationMs: 0,
      });
    }
    return;
  }

  // ── AI_REPAIR — trigger error_repair_flow if available ────────────────────
  if (patch.type === "AI_REPAIR") {
    const repairWorkflows = listWorkflows().filter((w: Workflow) => w.type === "error_repair_flow");
    if (repairWorkflows.length > 0) {
      const repairWf = repairWorkflows[0]!;
      await runWorkflow(repairWf.id, undefined, {
        errors:         Object.keys(patch.diff),
        patchTarget:    patch.target,
        patchDesc:      patch.description,
        autopilotFix:   true,
      });
    }
    return;
  }
}

async function persistFix(fix: AutopilotFix): Promise<AutopilotFix> {
  // Store feedback loop: { error, cause, fix, result } → memory system
  try {
    await memoryLog({
      projectId:  fix.error.projectId ?? null,
      sessionId:  fix.error.context.sessionId ?? null,
      type:       "autopilot",
      content:    `Autopilot ${fix.result}: ${fix.fix.description}`,
      metadata: {
        fixId:          fix.id,
        errorClass:     fix.error.type,
        errorSeverity:  fix.error.severity,
        errorSource:    fix.error.source,
        cause:          fix.cause,
        patchType:      fix.fix.type,
        patchTarget:    fix.fix.target,
        patchDiff:      fix.fix.diff,
        result:         fix.result,
        mode:           fix.mode,
        appliedAt:      fix.appliedAt,
        safeToAutoApply: fix.fix.safeToAutoApply,
        aiSuggestion:   fix.aiSuggestion,
      },
      success:    fix.result === "applied",
      durationMs: 0,
    });

    const withMemory = { ...fix, storedInMemory: true };
    pushFixToHistory(withMemory);
    return withMemory;
  } catch (err) {
    logger.error({ err }, "Autopilot: failed to persist fix to memory");
    pushFixToHistory(fix);
    return fix;
  }
}

function formatSuggestion(fix: AutopilotFix): string {
  const lines = [
    `Suggested fix: ${fix.fix.description}`,
    `Target: ${fix.fix.target}`,
    `Changes:`,
    ...Object.entries(fix.fix.diff).map(
      ([k, { from, to }]) => `  ${k}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`,
    ),
  ];
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. runScan — full pipeline: monitor → detect → analyze → fix → apply
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the complete autopilot pipeline.
 * This is the primary entry point for programmatic use.
 */
export async function runScan(
  options: MonitorOptions & { mode?: AutopilotMode } = {},
): Promise<AutopilotScanResult> {
  const mode = options.mode ?? _state.mode;

  if (mode === AutopilotMode.OFF) {
    return emptyResult(mode, options.projectId);
  }

  const scanId    = randomUUID();
  const scannedAt = new Date().toISOString();

  logger.info({ scanId, mode, projectId: options.projectId }, "Autopilot: runScan start");

  // Stage 1: Fetch & scan logs
  const logLimit = options.logLimit ?? DEFAULTS.LOG_SCAN_LIMIT;
  const rawLogs  = options.projectId
    ? await getByProject(options.projectId, { limit: logLimit })
    : await getRecent(logLimit);

  // Stage 2: Detect events
  const events = await monitorSystem(options);

  // Stage 3: Analyze failures
  const analyses = await analyzeFailure(events, options.projectId);

  // Stage 4 & 5: Generate + apply fixes for each analysis
  const allFixes: AutopilotFix[] = [];
  for (const analysis of analyses) {
    const fixes = await generateFix(analysis, mode);
    for (const fix of fixes) {
      const applied = await applyFix(fix, mode);
      allFixes.push(applied);
    }
  }

  // Update state
  _state.totalScans++;
  _state.lastScanAt  = scannedAt;
  _state.lastScanId  = scanId;

  const summary = {
    totalEvents:    events.length,
    totalAnalyses:  analyses.length,
    fixesApplied:   allFixes.filter((f) => f.result === "applied").length,
    fixesSuggested: allFixes.filter((f) => f.result === "suggested").length,
    fixesFailed:    allFixes.filter((f) => f.result === "failed").length,
    fixesRejected:  allFixes.filter((f) => f.result === "rejected").length,
    criticalIssues: events.filter((e) => e.severity === "critical").length,
    highIssues:     events.filter((e) => e.severity === "high").length,
  };

  logger.info({ scanId, ...summary }, "Autopilot: runScan complete");

  return {
    scanId,
    scannedAt,
    mode,
    projectId:       options.projectId,
    logsScanned:     rawLogs.length,
    eventsDetected:  events,
    analyses,
    fixes:           allFixes,
    summary,
  };
}

function emptyResult(mode: AutopilotMode, projectId?: number): AutopilotScanResult {
  return {
    scanId:    randomUUID(),
    scannedAt: new Date().toISOString(),
    mode,
    projectId,
    logsScanned:     0,
    eventsDetected:  [],
    analyses:        [],
    fixes:           [],
    summary: {
      totalEvents: 0, totalAnalyses: 0, fixesApplied: 0,
      fixesSuggested: 0, fixesFailed: 0, fixesRejected: 0,
      criticalIssues: 0, highIssues: 0,
    },
  };
}

// ── Utility ────────────────────────────────────────────────────────────────────

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = keyFn(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
