/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX METRICS API — Real runtime telemetry from the database            ║
 * ║  GET /api/metrics/project/:id   — per-project execution stats           ║
 * ║  GET /api/metrics/platform      — global platform stats                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router, type IRouter } from "express";
import { db, devosLogsTable, devosFilesTable, devosProjectsTable, apexDeploymentsTable } from "@workspace/db";
import { eq, desc, count, and, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── GET /api/metrics/project/:id ──────────────────────────────────────────────
router.get("/metrics/project/:id", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params["id"]!);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneDayAgo     = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [recentLogs, allLogs, deployments, files] = await Promise.all([
      // Last 10 minutes — for requests/min calculation
      db.select()
        .from(devosLogsTable)
        .where(and(
          eq(devosLogsTable.projectId, projectId),
          gte(devosLogsTable.createdAt, tenMinutesAgo),
        ))
        .orderBy(desc(devosLogsTable.createdAt)),

      // Last 100 overall — for error rate, avg latency
      db.select()
        .from(devosLogsTable)
        .where(eq(devosLogsTable.projectId, projectId))
        .orderBy(desc(devosLogsTable.createdAt))
        .limit(100),

      // All deployments for this project
      db.select()
        .from(apexDeploymentsTable)
        .where(eq(apexDeploymentsTable.projectId, projectId))
        .orderBy(desc(apexDeploymentsTable.createdAt)),

      // File count
      db.select({ count: count() })
        .from(devosFilesTable)
        .where(eq(devosFilesTable.projectId, projectId)),
    ]);

    const totalLogs     = allLogs.length;
    const successCount  = allLogs.filter((l) => l.exitCode === 0).length;
    const failCount     = totalLogs - successCount;
    const errorRate     = totalLogs > 0 ? (failCount / totalLogs) * 100 : 0;
    const avgLatency    = totalLogs > 0
      ? allLogs.reduce((sum, l) => sum + (l.durationMs ?? 0), 0) / totalLogs
      : 0;

    // Requests per minute over last 10 minutes (10-minute window)
    const requestsPerMin = recentLogs.length / 10;

    // Session uptime: time since first log entry
    const firstLog = allLogs[allLogs.length - 1];
    const lastLog  = allLogs[0];

    // Memory usage: rough estimate from file content sizes
    const totalBytes = await db.select({ total: sql<number>`coalesce(sum(length(content)), 0)` })
      .from(devosFilesTable)
      .where(eq(devosFilesTable.projectId, projectId));
    const memoryMB = ((totalBytes[0]?.total ?? 0) / (1024 * 1024));

    res.json({
      ok: true,
      projectId,
      metrics: {
        requestsPerMin:    Math.round(requestsPerMin * 10) / 10,
        errorRate:         Math.round(errorRate * 100) / 100,
        avgLatencyMs:      Math.round(avgLatency),
        totalExecutions:   totalLogs,
        successRate:       totalLogs > 0 ? Math.round((successCount / totalLogs) * 100) : 100,
        memoryMB:          Math.round(memoryMB * 100) / 100,
        deploymentCount:   deployments.length,
        fileCount:         files[0]?.count ?? 0,
        latestDeployment:  deployments[0] ?? null,
        lastExecutionAt:   lastLog?.createdAt ?? null,
        uptimeSince:       firstLog?.createdAt ?? null,
        recentActivity:    recentLogs.length,
      },
    });
  } catch (err) {
    logger.error({ err, projectId }, "Metrics project fetch error");
    res.status(500).json({ error: "Failed to compute metrics" });
  }
});

// ── GET /api/metrics/platform ─────────────────────────────────────────────────
router.get("/metrics/platform", async (req, res): Promise<void> => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [projectCount, logCount, recentLogs, deployCount] = await Promise.all([
      db.select({ count: count() }).from(devosProjectsTable),
      db.select({ count: count() }).from(devosLogsTable),
      db.select({ count: count() })
        .from(devosLogsTable)
        .where(gte(devosLogsTable.createdAt, oneDayAgo)),
      db.select({ count: count() }).from(apexDeploymentsTable),
    ]);

    res.json({
      ok: true,
      platform: {
        totalProjects:       projectCount[0]?.count ?? 0,
        totalExecutions:     logCount[0]?.count ?? 0,
        executionsLast24h:   recentLogs[0]?.count ?? 0,
        totalDeployments:    deployCount[0]?.count ?? 0,
      },
    });
  } catch (err) {
    logger.error({ err }, "Metrics platform fetch error");
    res.status(500).json({ error: "Failed to compute platform metrics" });
  }
});

export default router;
