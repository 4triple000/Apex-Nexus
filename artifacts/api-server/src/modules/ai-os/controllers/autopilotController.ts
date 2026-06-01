/**
 * Apex AI OS — Autopilot Controller
 *
 * HTTP handlers for the AI Autopilot system.
 * All heavy logic lives in /src/core/autopilot.ts.
 *
 * POST /api/os/autopilot/scan      — Run full pipeline (monitor → analyze → fix)
 * POST /api/os/autopilot/detect    — Classify a single log entry into an event
 * POST /api/os/autopilot/fix       — Apply a specific fix by ID or data
 * GET  /api/os/autopilot/state     — Current autopilot mode + aggregate stats
 * PUT  /api/os/autopilot/mode      — Change autopilot mode
 * GET  /api/os/autopilot/history   — Fix history (recent fixes + feedback loop)
 * GET  /api/os/autopilot/events    — Detected events (monitor only, no fix)
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../../lib/logger";
import { success, created, badRequest, serverError } from "../../../shared/utils/response";
import {
  AutopilotMode,
  monitorSystem,
  detectError,
  analyzeFailure,
  generateFix,
  applyFix,
  runScan,
  getState,
  setMode,
  getFixHistory,
} from "../../../core/autopilot";
import type { AutopilotEvent } from "../../../core/autopilot";
import { getByProject, getRecent } from "../services/memoryService";

// ── Validation schemas ─────────────────────────────────────────────────────────

const scanSchema = z.object({
  projectId:   z.number().int().positive().optional(),
  mode:        z.nativeEnum(AutopilotMode).optional(),
  logLimit:    z.number().int().min(10).max(500).default(100),
  thresholds:  z.object({
    slowMs:               z.number().min(1000).max(120_000).optional(),
    frictionCount:        z.number().min(2).max(20).optional(),
    criticalFailureRate:  z.number().min(0.1).max(1).optional(),
  }).optional(),
});

const modeSchema = z.object({
  mode: z.nativeEnum(AutopilotMode),
});

const detectSchema = z.object({
  log: z.object({
    id:         z.number(),
    projectId:  z.number().nullable().optional(),
    sessionId:  z.string().nullable().optional(),
    type:       z.string(),
    content:    z.string().nullable().optional(),
    metadata:   z.record(z.string(), z.unknown()).nullable().optional(),
    success:    z.boolean().nullable().optional(),
    durationMs: z.number().nullable().optional(),
    createdAt:  z.string().or(z.date()).optional(),
  }),
});

const fixSchema = z.object({
  fixData: z.object({
    id:    z.string(),
    error: z.record(z.string(), z.unknown()),
    cause: z.string(),
    fix:   z.record(z.string(), z.unknown()),
    result: z.string(),
    mode:  z.nativeEnum(AutopilotMode),
    storedInMemory: z.boolean().default(false),
  }),
  mode: z.nativeEnum(AutopilotMode).optional(),
});

const historySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
});

const eventsSchema = z.object({
  projectId:  z.coerce.number().int().positive().optional(),
  logLimit:   z.coerce.number().int().min(10).max(500).default(100),
});

// ── POST /api/os/autopilot/scan ───────────────────────────────────────────────

export async function scanHandler(req: Request, res: Response): Promise<void> {
  const parsed = scanSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const { projectId, mode, logLimit, thresholds } = parsed.data;
  logger.info({ projectId, mode, logLimit }, "Autopilot: POST /scan");

  try {
    const result = await runScan({ projectId, mode, logLimit, thresholds });

    created(res, {
      scanId:          result.scanId,
      scannedAt:       result.scannedAt,
      mode:            result.mode,
      projectId:       result.projectId,
      logsScanned:     result.logsScanned,
      summary:         result.summary,
      events:          result.eventsDetected,
      analyses:        result.analyses,
      fixes:           result.fixes,
    });
  } catch (err) {
    logger.error({ err }, "Autopilot: scan error");
    serverError(res, "Autopilot scan failed");
  }
}

// ── POST /api/os/autopilot/detect ─────────────────────────────────────────────

export async function detectHandler(req: Request, res: Response): Promise<void> {
  const parsed = detectSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const logEntry = parsed.data.log as Parameters<typeof detectError>[0];
  const event = detectError(logEntry);

  success(res, {
    log:    parsed.data.log,
    event,
    isIssue: event !== null,
  });
}

// ── POST /api/os/autopilot/fix ────────────────────────────────────────────────

export async function fixHandler(req: Request, res: Response): Promise<void> {
  const parsed = fixSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const { fixData, mode } = parsed.data;
  const state = getState();

  try {
    const applied = await applyFix(
      fixData as unknown as Parameters<typeof applyFix>[0],
      mode ?? state.mode,
    );
    success(res, { fix: applied });
  } catch (err) {
    logger.error({ err }, "Autopilot: apply fix error");
    serverError(res, "Fix application failed");
  }
}

// ── GET /api/os/autopilot/state ───────────────────────────────────────────────

export async function stateHandler(req: Request, res: Response): Promise<void> {
  const state = getState();
  success(res, {
    mode:                 state.mode,
    enabled:              state.enabled,
    lastScanAt:           state.lastScanAt,
    lastScanId:           state.lastScanId,
    totalScans:           state.totalScans,
    totalFixesApplied:    state.totalFixesApplied,
    totalFixesSuggested:  state.totalFixesSuggested,
    totalErrorsDetected:  state.totalErrorsDetected,
    fixHistoryCount:      state.fixHistory.length,
    availableModes:       Object.values(AutopilotMode).map((m) => ({
      mode:        m,
      description: MODE_DESCRIPTIONS[m],
    })),
  });
}

// ── PUT /api/os/autopilot/mode ────────────────────────────────────────────────

export async function setModeHandler(req: Request, res: Response): Promise<void> {
  const parsed = modeSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, `Invalid mode. Valid modes: ${Object.values(AutopilotMode).join(", ")}`);
    return;
  }

  setMode(parsed.data.mode);
  const state = getState();

  success(res, {
    mode:        state.mode,
    enabled:     state.enabled,
    description: MODE_DESCRIPTIONS[state.mode],
    message:     `Autopilot mode set to ${state.mode}`,
  });
}

// ── GET /api/os/autopilot/history ─────────────────────────────────────────────

export async function historyHandler(req: Request, res: Response): Promise<void> {
  const parsed = historySchema.safeParse(req.query);
  const projectId = parsed.success ? parsed.data.projectId : undefined;

  const history = getFixHistory(projectId);

  success(res, {
    total:   history.length,
    fixes:   history.map((f) => ({
      id:           f.id,
      result:       f.result,
      mode:         f.mode,
      appliedAt:    f.appliedAt,
      patchType:    f.fix.type,
      target:       f.fix.target,
      description:  f.fix.description,
      cause:        f.cause,
      errorClass:   f.error.type,
      errorSeverity: f.error.severity,
      errorSource:  f.error.source,
      aiSuggestion: f.aiSuggestion,
      safeToAutoApply: f.fix.safeToAutoApply,
    })),
    applied:   history.filter((f) => f.result === "applied").length,
    suggested: history.filter((f) => f.result === "suggested").length,
    failed:    history.filter((f) => f.result === "failed").length,
  });
}

// ── GET /api/os/autopilot/events ──────────────────────────────────────────────

export async function eventsHandler(req: Request, res: Response): Promise<void> {
  const parsed = eventsSchema.safeParse(req.query);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid query");
    return;
  }

  const { projectId, logLimit } = parsed.data;

  try {
    const events = await monitorSystem({ projectId, logLimit });

    const grouped = events.reduce((acc, e) => {
      (acc[e.type] ??= []).push(e);
      return acc;
    }, {} as Record<string, AutopilotEvent[]>);

    success(res, {
      total:          events.length,
      events,
      byType:         Object.fromEntries(
        Object.entries(grouped).map(([k, v]) => [k, v.length]),
      ),
      critical:       events.filter((e) => e.severity === "critical").length,
      high:           events.filter((e) => e.severity === "high").length,
      medium:         events.filter((e) => e.severity === "medium").length,
      low:            events.filter((e) => e.severity === "low").length,
    });
  } catch (err) {
    logger.error({ err }, "Autopilot: events scan error");
    serverError(res, "Events scan failed");
  }
}

// ── Mode descriptions ──────────────────────────────────────────────────────────

const MODE_DESCRIPTIONS: Record<AutopilotMode, string> = {
  [AutopilotMode.OFF]:             "Autopilot disabled — no monitoring or fixes",
  [AutopilotMode.SUGGEST]:         "Monitor + analyze + generate fix suggestions (never auto-applies)",
  [AutopilotMode.AUTO_FIX]:        "Monitor + apply safe fixes automatically (retry/timeout adjustments)",
  [AutopilotMode.FULL_AUTONOMOUS]: "Monitor + apply all fixes including AI-generated patches",
};
