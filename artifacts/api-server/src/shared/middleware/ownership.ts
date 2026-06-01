/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  OWNERSHIP ENFORCEMENT MIDDLEWARE                                        ║
 * ║  Each user can only read/write their own projects, files, deployments    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import type { Response, NextFunction } from "express";
import type { ApexRequest } from "../types";
import { db, devosProjectsTable, apexDeploymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { forbidden, notFound, serverError } from "../utils/response";
import { logger } from "../../lib/logger";

// ── requireProjectOwner ───────────────────────────────────────────────────────
// Reads :id or :projectId from req.params, verifies sessionId ownership.
// Attaches project to req.body._project for downstream use.

export async function requireProjectOwner(
  req:  ApexRequest & { params: Record<string, string> },
  res:  Response,
  next: NextFunction,
): Promise<void> {
  const projectId = parseInt(req.params["id"] ?? req.params["projectId"] ?? "");
  if (isNaN(projectId)) { forbidden(res, "Invalid project ID"); return; }

  const sessionId = req.sessionId;
  if (!sessionId) { forbidden(res, "Session required to access project"); return; }

  try {
    const [project] = await db
      .select()
      .from(devosProjectsTable)
      .where(eq(devosProjectsTable.id, projectId))
      .limit(1);

    if (!project) { notFound(res, "Project not found"); return; }

    if (project.sessionId !== sessionId) {
      // If user has a userId, also check if the project belongs to any session
      // of this user — for future multi-session support. For now strict check.
      forbidden(res, "You do not have permission to access this project");
      return;
    }

    // Attach for downstream handlers
    (req as ApexRequest & { _project?: typeof project })._project = project;
    next();
  } catch (err) {
    logger.error({ err }, "[ownership] project check error");
    serverError(res, "Failed to verify project ownership");
  }
}

// ── requireDeploymentOwner ────────────────────────────────────────────────────

export async function requireDeploymentOwner(
  req:  ApexRequest & { params: Record<string, string> },
  res:  Response,
  next: NextFunction,
): Promise<void> {
  const deploymentId = parseInt(req.params["deploymentId"] ?? req.params["id"] ?? "");
  if (isNaN(deploymentId)) { forbidden(res, "Invalid deployment ID"); return; }

  const sessionId = req.sessionId;
  if (!sessionId) { forbidden(res, "Session required to access deployment"); return; }

  try {
    const [deployment] = await db
      .select()
      .from(apexDeploymentsTable)
      .where(eq(apexDeploymentsTable.id, deploymentId))
      .limit(1);

    if (!deployment) { notFound(res, "Deployment not found"); return; }

    if (deployment.sessionId !== sessionId) {
      forbidden(res, "You do not have permission to access this deployment");
      return;
    }

    (req as ApexRequest & { _deployment?: typeof deployment })._deployment = deployment;
    next();
  } catch (err) {
    logger.error({ err }, "[ownership] deployment check error");
    serverError(res, "Failed to verify deployment ownership");
  }
}
