/**
 * Apex AI OS — Memory Service
 *
 * The self-improving memory and interaction log system.
 * Every action in the AI OS is stored here for pattern analysis.
 *
 * Functions:
 *   log()              — Write an interaction to memory
 *   getByProject()     — Get logs for a specific project
 *   getByType()        — Filter logs by type
 *   getRecent()        — Get the N most recent logs
 *   analyzePatterns()  — Run pattern analysis across logs
 *   clear()            — Clear logs for a project
 *   getSummary()       — Get aggregate stats
 */

import { db, apexOsMemoryLogsTable } from "@workspace/db";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { logger } from "../../../lib/logger";
import { AI_OS_CONFIG } from "../core/config";
import { analyzeForPatterns } from "./aiService";
import type { CreateMemoryLogInput, PatternInsight, MemoryLogType } from "../core/types";
import type { ApexOsMemoryLog } from "@workspace/db";

// ── log ────────────────────────────────────────────────────────────────────────

export async function log(input: CreateMemoryLogInput): Promise<ApexOsMemoryLog> {
  const [inserted] = await db
    .insert(apexOsMemoryLogsTable)
    .values({
      projectId: input.projectId ?? null,
      sessionId: input.sessionId ?? null,
      type: input.type,
      content: input.content,
      metadata: input.metadata ?? {},
      success: input.success ?? null,
      durationMs: input.durationMs ?? null,
    })
    .returning();

  logger.debug({ type: input.type, projectId: input.projectId }, "AI OS: memory logged");
  return inserted!;
}

// ── getByProject ───────────────────────────────────────────────────────────────

export async function getByProject(
  projectId: number,
  options?: {
    type?: MemoryLogType;
    limit?: number;
    offset?: number;
  },
): Promise<ApexOsMemoryLog[]> {
  const limit = Math.min(options?.limit ?? 50, AI_OS_CONFIG.memory.maxLogsReturnedPerQuery);
  const offset = options?.offset ?? 0;

  const conditions = [eq(apexOsMemoryLogsTable.projectId, projectId)];
  if (options?.type) {
    conditions.push(eq(apexOsMemoryLogsTable.type, options.type));
  }

  return db
    .select()
    .from(apexOsMemoryLogsTable)
    .where(and(...conditions))
    .orderBy(desc(apexOsMemoryLogsTable.timestamp))
    .limit(limit)
    .offset(offset);
}

// ── getBySession ───────────────────────────────────────────────────────────────

export async function getBySession(
  sessionId: string,
  limit = 50,
): Promise<ApexOsMemoryLog[]> {
  return db
    .select()
    .from(apexOsMemoryLogsTable)
    .where(eq(apexOsMemoryLogsTable.sessionId, sessionId))
    .orderBy(desc(apexOsMemoryLogsTable.timestamp))
    .limit(Math.min(limit, AI_OS_CONFIG.memory.maxLogsReturnedPerQuery));
}

// ── getByType ──────────────────────────────────────────────────────────────────

export async function getByType(
  type: MemoryLogType,
  limit = 50,
): Promise<ApexOsMemoryLog[]> {
  return db
    .select()
    .from(apexOsMemoryLogsTable)
    .where(eq(apexOsMemoryLogsTable.type, type))
    .orderBy(desc(apexOsMemoryLogsTable.timestamp))
    .limit(Math.min(limit, AI_OS_CONFIG.memory.maxLogsReturnedPerQuery));
}

// ── getRecent ──────────────────────────────────────────────────────────────────

export async function getRecent(limit = 20): Promise<ApexOsMemoryLog[]> {
  return db
    .select()
    .from(apexOsMemoryLogsTable)
    .orderBy(desc(apexOsMemoryLogsTable.timestamp))
    .limit(Math.min(limit, AI_OS_CONFIG.memory.maxLogsReturnedPerQuery));
}

// ── analyzePatterns ────────────────────────────────────────────────────────────

export async function analyzePatterns(projectId?: number): Promise<PatternInsight[]> {
  const logs = projectId
    ? await getByProject(projectId, { limit: 100 })
    : await getRecent(100);

  return analyzeForPatterns(logs);
}

// ── clear ──────────────────────────────────────────────────────────────────────

export async function clear(projectId: number): Promise<{ cleared: number }> {
  const result = await db
    .delete(apexOsMemoryLogsTable)
    .where(eq(apexOsMemoryLogsTable.projectId, projectId))
    .returning({ id: apexOsMemoryLogsTable.id });

  logger.info({ projectId, cleared: result.length }, "AI OS: memory cleared");
  return { cleared: result.length };
}

// ── getSummary ─────────────────────────────────────────────────────────────────

export interface MemorySummary {
  projectId?: number;
  totalLogs: number;
  byType: Record<string, number>;
  successRate: number;
  avgDurationMs: number;
  firstLogAt: string | null;
  lastLogAt: string | null;
}

export async function getSummary(projectId?: number): Promise<MemorySummary> {
  const conditions = projectId
    ? [eq(apexOsMemoryLogsTable.projectId, projectId)]
    : [];

  const logs = await db
    .select()
    .from(apexOsMemoryLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(apexOsMemoryLogsTable.timestamp))
    .limit(500);

  if (logs.length === 0) {
    return {
      projectId,
      totalLogs: 0,
      byType: {},
      successRate: 0,
      avgDurationMs: 0,
      firstLogAt: null,
      lastLogAt: null,
    };
  }

  const byType = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.type] = (acc[l.type] ?? 0) + 1;
    return acc;
  }, {});

  const logsWithSuccess = logs.filter((l) => l.success !== null && l.success !== undefined);
  const successRate = logsWithSuccess.length > 0
    ? (logsWithSuccess.filter((l) => l.success === true).length / logsWithSuccess.length) * 100
    : 100;

  const logsWithDuration = logs.filter((l) => l.durationMs != null);
  const avgDurationMs = logsWithDuration.length > 0
    ? logsWithDuration.reduce((sum, l) => sum + (l.durationMs ?? 0), 0) / logsWithDuration.length
    : 0;

  return {
    projectId,
    totalLogs: logs.length,
    byType,
    successRate: Math.round(successRate),
    avgDurationMs: Math.round(avgDurationMs),
    firstLogAt: logs[logs.length - 1]?.timestamp?.toISOString() ?? null,
    lastLogAt: logs[0]?.timestamp?.toISOString() ?? null,
  };
}
