/**
 * Apex AI OS — Project Controller
 *
 * Handles CRUD operations for AI OS projects.
 * Each project is the top-level container: it holds a plan, generated code,
 * workflows, execution history, and a telemetry counter set.
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { db, apexOsProjectsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../../lib/logger";
import { success, created, badRequest, notFound, serverError } from "../../../shared/utils/response";
import * as memoryService from "../services/memoryService";
import type { CreateProjectBody, UpdateProjectBody } from "../core/types";

// ── Validation schemas ─────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  prompt: z.string().min(3).max(4000),
  sessionId: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

const listSchema = z.object({
  sessionId: z.string().optional(),
  status: z.enum(["active", "building", "ready", "error", "archived"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── GET /api/projects ─────────────────────────────────────────────────────────

export async function listProjects(req: Request, res: Response): Promise<void> {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid query"); return; }

  const { sessionId, limit, offset } = parsed.data;

  try {
    const query = db
      .select({
        id: apexOsProjectsTable.id,
        name: apexOsProjectsTable.name,
        description: apexOsProjectsTable.description,
        prompt: apexOsProjectsTable.prompt,
        status: apexOsProjectsTable.status,
        buildCount: apexOsProjectsTable.buildCount,
        editCount: apexOsProjectsTable.editCount,
        runCount: apexOsProjectsTable.runCount,
        errorCount: apexOsProjectsTable.errorCount,
        tokensUsed: apexOsProjectsTable.tokensUsed,
        createdAt: apexOsProjectsTable.createdAt,
        updatedAt: apexOsProjectsTable.updatedAt,
      })
      .from(apexOsProjectsTable)
      .orderBy(desc(apexOsProjectsTable.updatedAt))
      .limit(limit)
      .offset(offset);

    const projects = sessionId
      ? await query.where(eq(apexOsProjectsTable.sessionId, sessionId))
      : await query;

    success(res, { projects, total: projects.length, limit, offset });
  } catch (err) {
    logger.error({ err }, "projectController.listProjects error");
    serverError(res, "Failed to list projects");
  }
}

// ── POST /api/projects ────────────────────────────────────────────────────────

export async function createProject(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const body = parsed.data as CreateProjectBody;

  try {
    const [project] = await db
      .insert(apexOsProjectsTable)
      .values({
        sessionId: body.sessionId ?? "anonymous",
        name: body.name,
        description: body.description ?? "",
        prompt: body.prompt,
        status: "active",
        buildCount: 0,
        editCount: 0,
        runCount: 0,
        errorCount: 0,
        tokensUsed: 0,
        workflows: [],
        executionHistory: [],
      })
      .returning();

    // Log project creation to memory
    await memoryService.log({
      projectId: project!.id,
      sessionId: body.sessionId,
      type: "prompt",
      content: body.prompt,
      metadata: { name: body.name, action: "project_created" },
      success: true,
    });

    logger.info({ projectId: project!.id }, "AI OS: project created");
    created(res, { project });
  } catch (err) {
    logger.error({ err }, "projectController.createProject error");
    serverError(res, "Failed to create project");
  }
}

// ── GET /api/projects/:id ─────────────────────────────────────────────────────

export async function getProject(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { badRequest(res, "Invalid project ID"); return; }

  try {
    const [project] = await db
      .select()
      .from(apexOsProjectsTable)
      .where(eq(apexOsProjectsTable.id, id))
      .limit(1);

    if (!project) { notFound(res, `Project ${id} not found`); return; }
    success(res, { project });
  } catch (err) {
    logger.error({ err }, "projectController.getProject error");
    serverError(res, "Failed to get project");
  }
}

// ── PUT /api/projects/:id ─────────────────────────────────────────────────────

export async function updateProject(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { badRequest(res, "Invalid project ID"); return; }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const body = parsed.data as UpdateProjectBody;
  if (Object.keys(body).length === 0) { badRequest(res, "No fields to update"); return; }

  try {
    const [updated] = await db
      .update(apexOsProjectsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(apexOsProjectsTable.id, id))
      .returning();

    if (!updated) { notFound(res, `Project ${id} not found`); return; }

    success(res, { project: updated });
  } catch (err) {
    logger.error({ err }, "projectController.updateProject error");
    serverError(res, "Failed to update project");
  }
}

// ── DELETE /api/projects/:id ──────────────────────────────────────────────────

export async function deleteProject(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { badRequest(res, "Invalid project ID"); return; }

  try {
    await db.delete(apexOsProjectsTable).where(eq(apexOsProjectsTable.id, id));
    // Also clear associated memory logs
    await memoryService.clear(id).catch(() => undefined);

    logger.info({ projectId: id }, "AI OS: project deleted");
    success(res, { deleted: true, projectId: id });
  } catch (err) {
    logger.error({ err }, "projectController.deleteProject error");
    serverError(res, "Failed to delete project");
  }
}

// ── GET /api/projects/:id/summary ─────────────────────────────────────────────

export async function getProjectSummary(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { badRequest(res, "Invalid project ID"); return; }

  try {
    const [project] = await db
      .select({
        id: apexOsProjectsTable.id,
        name: apexOsProjectsTable.name,
        status: apexOsProjectsTable.status,
        buildCount: apexOsProjectsTable.buildCount,
        editCount: apexOsProjectsTable.editCount,
        runCount: apexOsProjectsTable.runCount,
        errorCount: apexOsProjectsTable.errorCount,
        tokensUsed: apexOsProjectsTable.tokensUsed,
        workflows: apexOsProjectsTable.workflows,
        createdAt: apexOsProjectsTable.createdAt,
        updatedAt: apexOsProjectsTable.updatedAt,
      })
      .from(apexOsProjectsTable)
      .where(eq(apexOsProjectsTable.id, id))
      .limit(1);

    if (!project) { notFound(res, `Project ${id} not found`); return; }

    const memorySummary = await memoryService.getSummary(id);

    success(res, {
      project,
      memory: memorySummary,
      workflowCount: project.workflows?.length ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "projectController.getProjectSummary error");
    serverError(res, "Failed to get project summary");
  }
}
