/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  UNIFIED PROJECTS API                                                    ║
 * ║  /api/projects — CRUD with ownership enforcement + deploy integration    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router, type IRouter } from "express";
import { z }                    from "zod";
import { db, devosProjectsTable, devosFilesTable, apexDeploymentsTable } from "@workspace/db";
import { eq, desc, and }        from "drizzle-orm";
import { optionalAuth }         from "../shared/middleware/requireAuth";
import { requireProjectOwner }  from "../shared/middleware/ownership";
import {
  success, created, badRequest, notFound, serverError,
} from "../shared/utils/response";
import type { ApexRequest }     from "../shared/types";
import { logger }               from "../lib/logger";

const router: IRouter = Router();

// All routes use optionalAuth (works for both session-id and JWT users)
router.use(optionalAuth as any);

// ── GET /projects — list user's projects ─────────────────────────────────────

router.get("/projects", async (req: ApexRequest, res): Promise<void> => {
  const sessionId = req.sessionId;
  if (!sessionId) {
    success(res, { projects: [], total: 0 });
    return;
  }

  const limit  = Math.min(parseInt(req.query["limit"] as string ?? "50"), 100);
  const offset = parseInt(req.query["offset"] as string ?? "0");

  try {
    const projects = await db
      .select()
      .from(devosProjectsTable)
      .where(eq(devosProjectsTable.sessionId, sessionId))
      .orderBy(desc(devosProjectsTable.updatedAt))
      .limit(limit)
      .offset(offset);

    success(res, { projects, total: projects.length, offset, limit });
  } catch (err) {
    logger.error({ err }, "[projects] list error");
    serverError(res);
  }
});

// ── POST /projects — create project ──────────────────────────────────────────

router.post("/projects", async (req: ApexRequest, res): Promise<void> => {
  const sessionId = req.sessionId;
  if (!sessionId) { badRequest(res, "Session required to create a project"); return; }

  const schema = z.object({
    name:        z.string().min(1).max(100),
    description: z.string().max(500).default(""),
    language:    z.enum(["javascript", "python", "html"]).default("javascript"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Validation failed");
    return;
  }

  try {
    const [project] = await db
      .insert(devosProjectsTable)
      .values({ ...parsed.data, sessionId })
      .returning();

    created(res, { project, message: "Project created" });
  } catch (err) {
    logger.error({ err }, "[projects] create error");
    serverError(res);
  }
});

// ── GET /projects/:id — get project with files + deployment ──────────────────

router.get("/projects/:id", requireProjectOwner as any, async (req: ApexRequest & { params: Record<string, string>; _project?: any }, res): Promise<void> => {
  const project = req._project;
  const projectId = parseInt(req.params["id"]!);

  try {
    const [files, deployments] = await Promise.all([
      db.select().from(devosFilesTable)
        .where(eq(devosFilesTable.projectId, projectId))
        .orderBy(devosFilesTable.path),
      db.select({
        id:        apexDeploymentsTable.id,
        slug:      apexDeploymentsTable.slug,
        status:    apexDeploymentsTable.status,
        url:       apexDeploymentsTable.url,
        version:   apexDeploymentsTable.version,
        updatedAt: apexDeploymentsTable.updatedAt,
      })
      .from(apexDeploymentsTable)
      .where(eq(apexDeploymentsTable.projectId, projectId))
      .orderBy(desc(apexDeploymentsTable.version))
      .limit(5),
    ]);

    success(res, {
      project,
      files,
      deployments,
      latestDeployment: deployments[0] ?? null,
    });
  } catch (err) {
    logger.error({ err }, "[projects] GET /:id error");
    serverError(res);
  }
});

// ── PUT /projects/:id — update project metadata ───────────────────────────────

router.put("/projects/:id", requireProjectOwner as any, async (req: ApexRequest & { params: Record<string, string> }, res): Promise<void> => {
  const projectId = parseInt(req.params["id"]!);
  const schema = z.object({
    name:        z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    language:    z.enum(["javascript", "python", "html"]).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Validation failed");
    return;
  }

  if (Object.keys(parsed.data).filter(k => (parsed.data as Record<string, unknown>)[k] !== undefined).length === 0) {
    badRequest(res, "No fields to update");
    return;
  }

  try {
    const [updated] = await db
      .update(devosProjectsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(devosProjectsTable.id, projectId))
      .returning();

    success(res, { project: updated, message: "Project updated" });
  } catch (err) {
    logger.error({ err }, "[projects] PUT /:id error");
    serverError(res);
  }
});

// ── DELETE /projects/:id — delete project + all files ────────────────────────

router.delete("/projects/:id", requireProjectOwner as any, async (req: ApexRequest & { params: Record<string, string> }, res): Promise<void> => {
  const projectId = parseInt(req.params["id"]!);

  try {
    // Delete files first (FK dependency)
    const deletedFiles = await db
      .delete(devosFilesTable)
      .where(eq(devosFilesTable.projectId, projectId))
      .returning({ id: devosFilesTable.id });

    await db
      .delete(devosProjectsTable)
      .where(eq(devosProjectsTable.id, projectId));

    success(res, {
      deleted:      true,
      projectId,
      filesDeleted: deletedFiles.length,
      message:      "Project and all its files deleted",
    });
  } catch (err) {
    logger.error({ err }, "[projects] DELETE /:id error");
    serverError(res);
  }
});

// ── GET /projects/:id/files — list files ─────────────────────────────────────

router.get("/projects/:id/files", requireProjectOwner as any, async (req: ApexRequest & { params: Record<string, string> }, res): Promise<void> => {
  const projectId = parseInt(req.params["id"]!);

  try {
    const files = await db
      .select()
      .from(devosFilesTable)
      .where(eq(devosFilesTable.projectId, projectId))
      .orderBy(devosFilesTable.path);

    success(res, { files, total: files.length });
  } catch (err) {
    logger.error({ err }, "[projects] GET /:id/files error");
    serverError(res);
  }
});

// ── POST /projects/:id/files — create/replace a file ─────────────────────────

router.post("/projects/:id/files", requireProjectOwner as any, async (req: ApexRequest & { params: Record<string, string> }, res): Promise<void> => {
  const projectId = parseInt(req.params["id"]!);
  const schema = z.object({
    path:     z.string().min(1).max(255),
    content:  z.string().max(500_000),
    language: z.enum(["javascript", "python", "html", "css", "json", "markdown", "text"]).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Validation failed");
    return;
  }

  const { path, content, language } = parsed.data;
  const lang = language ?? inferLanguage(path);

  try {
    // Upsert by (projectId, path)
    const [existing] = await db
      .select({ id: devosFilesTable.id })
      .from(devosFilesTable)
      .where(and(
        eq(devosFilesTable.projectId, projectId),
        eq(devosFilesTable.path, path),
      ))
      .limit(1);

    let file;
    if (existing) {
      [file] = await db
        .update(devosFilesTable)
        .set({ content, language: lang, updatedAt: new Date() })
        .where(eq(devosFilesTable.id, existing.id))
        .returning();
      success(res, { file, action: "updated" });
    } else {
      [file] = await db
        .insert(devosFilesTable)
        .values({ projectId, path, content, language: lang })
        .returning();
      created(res, { file, action: "created" });
    }

    // Touch project updatedAt
    await db
      .update(devosProjectsTable)
      .set({ updatedAt: new Date() })
      .where(eq(devosProjectsTable.id, projectId));

  } catch (err) {
    logger.error({ err }, "[projects] POST /:id/files error");
    serverError(res);
  }
});

// ── DELETE /projects/:id/files/:fileId ───────────────────────────────────────

router.delete("/projects/:id/files/:fileId", requireProjectOwner as any, async (req: ApexRequest & { params: Record<string, string> }, res): Promise<void> => {
  const fileId = parseInt(req.params["fileId"]!);

  try {
    const [deleted] = await db
      .delete(devosFilesTable)
      .where(eq(devosFilesTable.id, fileId))
      .returning({ id: devosFilesTable.id });

    if (!deleted) { notFound(res, "File not found"); return; }
    success(res, { deleted: true, fileId });
  } catch (err) {
    logger.error({ err }, "[projects] DELETE /:id/files/:fileId error");
    serverError(res);
  }
});

// ── POST /projects/:id/deploy — one-click deploy ─────────────────────────────

router.post("/projects/:id/deploy", requireProjectOwner as any, async (req: ApexRequest & { params: Record<string, string> }, res): Promise<void> => {
  // Delegate to the deploy engine's existing endpoint
  const projectId = parseInt(req.params["id"]!);
  const sessionId = req.sessionId!;

  try {
    const files = await db
      .select()
      .from(devosFilesTable)
      .where(eq(devosFilesTable.projectId, projectId));

    if (files.length === 0) {
      badRequest(res, "Project has no files to deploy");
      return;
    }

    // project is already attached by requireProjectOwner — re-read to get language
    const [project] = await db
      .select()
      .from(devosProjectsTable)
      .where(eq(devosProjectsTable.id, projectId))
      .limit(1);

    if (!project) { notFound(res, "Project not found"); return; }

    // Build slug from project name + id
    const slug   = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}-${projectId.toString(36).padStart(4, "0")}`;
    const domain = process.env["REPLIT_DEV_DOMAIN"] ?? "localhost";
    const url    = `https://${domain}/api/apps/${slug}/`;

    const existing = await db
      .select()
      .from(apexDeploymentsTable)
      .where(eq(apexDeploymentsTable.projectId, projectId))
      .orderBy(desc(apexDeploymentsTable.version))
      .limit(1);

    const version       = (existing[0]?.version ?? 0) + 1;
    const filesSnapshot = files.map(f => ({ path: f.path, content: f.content, language: f.language }));

    let deploymentId: number;
    if (existing[0]) {
      await db.update(apexDeploymentsTable)
        .set({ status: "building", version, filesSnapshot, updatedAt: new Date(), error: null })
        .where(eq(apexDeploymentsTable.id, existing[0].id));
      deploymentId = existing[0].id;
    } else {
      const [ins] = await db.insert(apexDeploymentsTable).values({
        projectId, slug, name: project.name, status: "building",
        language: project.language, filesSnapshot, version, sessionId, provider: "apex",
      }).returning();
      deploymentId = ins!.id;
    }

    success(res, { deploymentId, slug, url, status: "building", version });

    // Async: mark live after response is sent
    setImmediate(async () => {
      try {
        await db.update(apexDeploymentsTable)
          .set({ status: "live", url, updatedAt: new Date() })
          .where(eq(apexDeploymentsTable.id, deploymentId));
      } catch (e) {
        await db.update(apexDeploymentsTable)
          .set({ status: "failed", error: String(e), updatedAt: new Date() })
          .where(eq(apexDeploymentsTable.id, deploymentId));
      }
    });

  } catch (err) {
    logger.error({ err }, "[projects] POST /:id/deploy error");
    serverError(res);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", ts: "javascript", mjs: "javascript",
    py: "python",
    html: "html", htm: "html",
    css: "css",
    json: "json",
    md: "markdown",
  };
  return map[ext] ?? "text";
}

export default router;
