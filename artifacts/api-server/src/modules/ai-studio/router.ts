/**
 * AI Studio Router — Apex AI OS Edition
 * Mounts at /api/studio/ai/*
 *
 * Endpoints:
 *   POST /studio/ai/generate              — Generate new app from prompt
 *   POST /studio/ai/edit                  — Iterative editing
 *   POST /studio/ai/save                  — Persist project changes
 *   POST /studio/ai/workflow/run          — Execute (simulate) a workflow
 *   POST /studio/ai/autopilot/scan        — Scan project for issues
 *   POST /studio/ai/autopilot/fix         — Apply an autopilot fix
 *   GET  /studio/ai/projects              — List projects for session
 *   GET  /studio/ai/projects/:id          — Get single project
 *   DELETE /studio/ai/projects/:id        — Delete project
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, aiStudioProjectsTable } from "@workspace/db";
import type { AiStudioChatMessage, AiStudioInteractionLog } from "@workspace/db";
import { generateApp, editApp } from "./generator";
import { scanProject, applyFix } from "./autopilot";
import { success, badRequest, notFound, serverError } from "../../shared/utils/response";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

// ── POST /studio/ai/generate ───────────────────────────────────────────────────
router.post("/studio/ai/generate", async (req, res): Promise<void> => {
  const schema = z.object({
    prompt: z.string().min(3, "Prompt too short").max(2000),
    sessionId: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const { prompt, sessionId } = parsed.data;
  const startMs = Date.now();

  try {
    logger.info({ prompt: prompt.slice(0, 80) }, "Generating AI Studio app");
    const result = await generateApp(prompt);
    const durationMs = Date.now() - startMs;

    const userMsg: AiStudioChatMessage = {
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: AiStudioChatMessage = {
      role: "assistant",
      content: `✨ Built **${result.plan.project_name}** — ${result.summary}\n\nI've generated ${result.files.length} files and ${result.plan.workflows?.length ?? 0} automated workflows. You can edit anything via chat, or check the Workflows and Monitor tabs.`,
      timestamp: new Date().toISOString(),
    };

    const interactionLog: AiStudioInteractionLog = {
      timestamp: new Date().toISOString(),
      type: "generate",
      prompt,
      success: true,
      durationMs,
    };

    const [saved] = await db
      .insert(aiStudioProjectsTable)
      .values({
        sessionId: sessionId ?? "anonymous",
        title: result.plan.project_name,
        description: result.plan.description,
        appType: result.plan.app_type,
        plan: result.plan,
        files: result.files,
        previewHtml: result.previewHtml,
        chatHistory: [userMsg, assistantMsg],
        interactionLogs: [interactionLog],
        buildCount: 1,
        editCount: 0,
      })
      .returning({ id: aiStudioProjectsTable.id });

    success(res, {
      projectId: saved!.id,
      plan: result.plan,
      files: result.files,
      previewHtml: result.previewHtml,
      summary: result.summary,
      chatHistory: [userMsg, assistantMsg],
      durationMs,
    });
  } catch (err) {
    logger.error({ err }, "AI Studio generate error");
    serverError(res, "Generation failed — please try again");
  }
});

// ── POST /studio/ai/edit ───────────────────────────────────────────────────────
router.post("/studio/ai/edit", async (req, res): Promise<void> => {
  const schema = z.object({
    projectId: z.number().int().positive(),
    request: z.string().min(1).max(2000),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const { projectId, request } = parsed.data;
  const startMs = Date.now();

  try {
    const [project] = await db
      .select()
      .from(aiStudioProjectsTable)
      .where(eq(aiStudioProjectsTable.id, projectId))
      .limit(1);

    if (!project) { notFound(res, "Project not found"); return; }
    if (!project.plan) { badRequest(res, "Project has no plan — please regenerate"); return; }

    const result = await editApp(
      request,
      project.plan,
      project.files ?? [],
      project.previewHtml ?? "",
      project.chatHistory ?? [],
    );

    const existingFiles = [...(project.files ?? [])];
    for (const changed of result.files) {
      const idx = existingFiles.findIndex((f) => f.path === changed.path);
      if (idx >= 0) existingFiles[idx] = changed;
      else existingFiles.push(changed);
    }

    const userMsg: AiStudioChatMessage = {
      role: "user",
      content: request,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: AiStudioChatMessage = {
      role: "assistant",
      content: result.summary,
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [...(project.chatHistory ?? []), userMsg, assistantMsg].slice(-50);

    const newLog: AiStudioInteractionLog = {
      timestamp: new Date().toISOString(),
      type: "edit",
      prompt: request,
      success: true,
      durationMs: Date.now() - startMs,
    };
    const updatedLogs = [...(project.interactionLogs ?? []), newLog].slice(-100);

    await db
      .update(aiStudioProjectsTable)
      .set({
        files: existingFiles,
        previewHtml: result.previewHtml,
        chatHistory: updatedHistory,
        interactionLogs: updatedLogs,
        editCount: (project.editCount ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(aiStudioProjectsTable.id, projectId));

    success(res, {
      projectId,
      files: existingFiles,
      previewHtml: result.previewHtml,
      changedFiles: result.changedFiles,
      summary: result.summary,
      chatHistory: updatedHistory,
    });
  } catch (err) {
    logger.error({ err }, "AI Studio edit error");
    serverError(res, "Edit failed — please try again");
  }
});

// ── POST /studio/ai/save ───────────────────────────────────────────────────────
router.post("/studio/ai/save", async (req, res): Promise<void> => {
  const schema = z.object({
    projectId: z.number().int().positive(),
    title: z.string().min(1).max(100).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  try {
    await db
      .update(aiStudioProjectsTable)
      .set({
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
        updatedAt: new Date(),
      })
      .where(eq(aiStudioProjectsTable.id, parsed.data.projectId));

    success(res, { saved: true, projectId: parsed.data.projectId });
  } catch (err) {
    logger.error({ err }, "AI Studio save error");
    serverError(res, "Save failed");
  }
});

// ── POST /studio/ai/workflow/run ──────────────────────────────────────────────
router.post("/studio/ai/workflow/run", async (req, res): Promise<void> => {
  const schema = z.object({
    projectId: z.number().int().positive(),
    workflowId: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const { projectId, workflowId } = parsed.data;

  try {
    const [project] = await db
      .select({ plan: aiStudioProjectsTable.plan, interactionLogs: aiStudioProjectsTable.interactionLogs })
      .from(aiStudioProjectsTable)
      .where(eq(aiStudioProjectsTable.id, projectId))
      .limit(1);

    if (!project) { notFound(res, "Project not found"); return; }

    const workflow = (project.plan?.workflows ?? []).find((w) => w.id === workflowId);
    if (!workflow) { notFound(res, "Workflow not found"); return; }

    // Log the workflow run
    const newLog: AiStudioInteractionLog = {
      timestamp: new Date().toISOString(),
      type: "workflow_run",
      prompt: `Run workflow: ${workflow.name}`,
      success: true,
      durationMs: workflow.steps.length * 400,
    };
    const updatedLogs = [...(project.interactionLogs ?? []), newLog].slice(-100);

    await db
      .update(aiStudioProjectsTable)
      .set({ interactionLogs: updatedLogs, updatedAt: new Date() })
      .where(eq(aiStudioProjectsTable.id, projectId));

    success(res, {
      workflowId,
      workflowName: workflow.name,
      steps: workflow.steps.map((s, i) => ({
        ...s,
        delayMs: i * 400 + 200,
      })),
      totalDurationMs: workflow.steps.length * 400 + 500,
    });
  } catch (err) {
    logger.error({ err }, "AI Studio workflow run error");
    serverError(res, "Failed to run workflow");
  }
});

// ── POST /studio/ai/autopilot/scan ────────────────────────────────────────────
router.post("/studio/ai/autopilot/scan", async (req, res): Promise<void> => {
  const schema = z.object({
    projectId: z.number().int().positive(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  try {
    const [project] = await db
      .select()
      .from(aiStudioProjectsTable)
      .where(eq(aiStudioProjectsTable.id, parsed.data.projectId))
      .limit(1);

    if (!project) { notFound(res, "Project not found"); return; }
    if (!project.plan) { badRequest(res, "Project has no plan"); return; }

    const result = await scanProject(project.plan, project.files ?? [], project.previewHtml ?? "");

    success(res, {
      projectId: parsed.data.projectId,
      issues: result.issues,
      healthScore: result.healthScore,
      observations: result.observations,
      improvements: result.improvements,
    });
  } catch (err) {
    logger.error({ err }, "Autopilot scan error");
    serverError(res, "Scan failed");
  }
});

// ── POST /studio/ai/autopilot/fix ─────────────────────────────────────────────
router.post("/studio/ai/autopilot/fix", async (req, res): Promise<void> => {
  const schema = z.object({
    projectId: z.number().int().positive(),
    issueId: z.string(),
    issue: z.object({
      id: z.string(),
      severity: z.enum(["error", "warn", "info"]),
      title: z.string(),
      description: z.string(),
      component: z.string(),
      suggestedFix: z.string(),
    }),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const { projectId, issue } = parsed.data;

  try {
    const [project] = await db
      .select()
      .from(aiStudioProjectsTable)
      .where(eq(aiStudioProjectsTable.id, projectId))
      .limit(1);

    if (!project) { notFound(res, "Project not found"); return; }
    if (!project.plan) { badRequest(res, "Project has no plan"); return; }

    const result = await applyFix(issue, project.plan, project.files ?? [], project.previewHtml ?? "");

    const existingFiles = [...(project.files ?? [])];
    for (const changed of result.files) {
      const idx = existingFiles.findIndex((f) => f.path === changed.path);
      if (idx >= 0) existingFiles[idx] = changed;
      else existingFiles.push(changed);
    }

    const newLog: AiStudioInteractionLog = {
      timestamp: new Date().toISOString(),
      type: "autopilot_fix",
      prompt: issue.title,
      success: true,
      insight: result.fixDescription,
    };
    const updatedLogs = [...(project.interactionLogs ?? []), newLog].slice(-100);

    await db
      .update(aiStudioProjectsTable)
      .set({
        files: existingFiles,
        previewHtml: result.previewHtml,
        interactionLogs: updatedLogs,
        updatedAt: new Date(),
      })
      .where(eq(aiStudioProjectsTable.id, projectId));

    success(res, {
      projectId,
      previewHtml: result.previewHtml,
      files: existingFiles,
      changedFiles: result.changedFiles,
      fixDescription: result.fixDescription,
    });
  } catch (err) {
    logger.error({ err }, "Autopilot fix error");
    serverError(res, "Fix failed");
  }
});

// ── GET /studio/ai/projects ────────────────────────────────────────────────────
router.get("/studio/ai/projects", async (req, res): Promise<void> => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) { badRequest(res, "sessionId query param required"); return; }

  try {
    const projects = await db
      .select({
        id: aiStudioProjectsTable.id,
        title: aiStudioProjectsTable.title,
        description: aiStudioProjectsTable.description,
        appType: aiStudioProjectsTable.appType,
        buildCount: aiStudioProjectsTable.buildCount,
        editCount: aiStudioProjectsTable.editCount,
        createdAt: aiStudioProjectsTable.createdAt,
        updatedAt: aiStudioProjectsTable.updatedAt,
      })
      .from(aiStudioProjectsTable)
      .where(eq(aiStudioProjectsTable.sessionId, sessionId))
      .orderBy(desc(aiStudioProjectsTable.updatedAt))
      .limit(50);

    success(res, { projects });
  } catch (err) {
    logger.error({ err }, "AI Studio list projects error");
    serverError(res, "Failed to load projects");
  }
});

// ── GET /studio/ai/projects/:id ────────────────────────────────────────────────
router.get("/studio/ai/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { badRequest(res, "Invalid project ID"); return; }

  try {
    const [project] = await db
      .select()
      .from(aiStudioProjectsTable)
      .where(eq(aiStudioProjectsTable.id, id))
      .limit(1);

    if (!project) { notFound(res, "Project not found"); return; }
    success(res, { project });
  } catch (err) {
    logger.error({ err }, "AI Studio get project error");
    serverError(res, "Failed to load project");
  }
});

// ── DELETE /studio/ai/projects/:id ────────────────────────────────────────────
router.delete("/studio/ai/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { badRequest(res, "Invalid project ID"); return; }

  try {
    await db.delete(aiStudioProjectsTable).where(eq(aiStudioProjectsTable.id, id));
    success(res, { deleted: true, projectId: id });
  } catch (err) {
    logger.error({ err }, "AI Studio delete project error");
    serverError(res, "Failed to delete project");
  }
});

export default router;
