/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX BUILDER AGENT — Routes                                             ║
 * ║  POST /api/builder-agent/generate   — SSE: prompt → full app            ║
 * ║  POST /api/builder-agent/edit       — SSE: instruction → edited app     ║
 * ║  GET  /api/builder-agent/project/:id — project + all files              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router } from "express";
import { z } from "zod";
import { db, devosProjectsTable, devosFilesTable, apexDeploymentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { generateApp, editApp, type SseEvent } from "../services/builderAgent";
import { badRequest, notFound, success } from "../../../shared/utils/response";
import { logger } from "../../../lib/logger";
import type { ApexRequest } from "../../../shared/types";

const router = Router();

// ── SSE helpers ────────────────────────────────────────────────────────────────

function setupSse(req: ApexRequest, res: import("express").Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: SseEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    // @ts-ignore — flush if compression middleware is present
    if (typeof res.flush === "function") res.flush();
  };

  req.on("close", () => { /* client disconnected */ });
  return send;
}

// ── POST /api/builder-agent/generate ──────────────────────────────────────────

router.post("/builder-agent/generate", async (req: ApexRequest, res) => {
  const schema = z.object({
    prompt:    z.string().min(3).max(2000),
    sessionId: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Validation failed");
    return;
  }

  const { prompt, sessionId } = parsed.data;
  const send = setupSse(req, res);

  try {
    await generateApp(prompt, sessionId, send);
  } catch (err) {
    logger.error({ err }, "[builder-agent] generate error");
    send({ type: "error", message: "An unexpected error occurred. Please try again." });
  } finally {
    res.end();
  }
});

// ── POST /api/builder-agent/edit ──────────────────────────────────────────────

router.post("/builder-agent/edit", async (req: ApexRequest, res) => {
  const schema = z.object({
    projectId:   z.number().int().positive(),
    instruction: z.string().min(3).max(2000),
    sessionId:   z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Validation failed");
    return;
  }

  const { projectId, instruction, sessionId } = parsed.data;
  const send = setupSse(req, res);

  try {
    await editApp(projectId, instruction, sessionId, send);
  } catch (err) {
    logger.error({ err }, "[builder-agent] edit error");
    send({ type: "error", message: "An unexpected error occurred. Please try again." });
  } finally {
    res.end();
  }
});

// ── GET /api/builder-agent/project/:id ───────────────────────────────────────

router.get("/builder-agent/project/:id", async (req: ApexRequest, res) => {
  const projectId = parseInt(String(req.params["id"] ?? "0"));
  if (!projectId) { badRequest(res, "Invalid project ID"); return; }

  try {
    const [project] = await db
      .select()
      .from(devosProjectsTable)
      .where(eq(devosProjectsTable.id, projectId))
      .limit(1);

    if (!project) { notFound(res, "Project not found"); return; }

    const files = await db
      .select()
      .from(devosFilesTable)
      .where(eq(devosFilesTable.projectId, projectId));

    const [deployment] = await db
      .select()
      .from(apexDeploymentsTable)
      .where(eq(apexDeploymentsTable.projectId, projectId))
      .orderBy(desc(apexDeploymentsTable.version))
      .limit(1);

    success(res, { project, files, deployment: deployment ?? null });
  } catch (err) {
    logger.error({ err }, "[builder-agent] get project error");
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// ── GET /api/builder-agent/projects ──────────────────────────────────────────

router.get("/builder-agent/projects", async (req: ApexRequest, res) => {
  const sessionId = req.query["sessionId"] as string | undefined;
  if (!sessionId) { success(res, { projects: [] }); return; }

  try {
    const projects = await db
      .select()
      .from(devosProjectsTable)
      .where(eq(devosProjectsTable.sessionId, sessionId))
      .orderBy(desc(devosProjectsTable.updatedAt));

    success(res, { projects });
  } catch (err) {
    logger.error({ err }, "[builder-agent] list projects error");
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

export default router;
