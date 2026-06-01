/**
 * Apex Deployment System — API Router
 *
 * Routes:
 *   POST /deploy/:projectId          — Start deployment workflow
 *   GET  /deploy/:projectId/status   — Poll deployment status (in-memory registry)
 *   GET  /deploy/providers           — List available providers and their status
 *
 * All credentials are injected via environment variables. No hardcoded values.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { deployProject } from "../../server/deployment/deployProject";
import { injectSession } from "../../shared/middleware/auth";
import { success, badRequest, serverError, notFound } from "../../shared/utils/response";
import { logger } from "../../lib/logger";
import type { DeploymentConfig, DeploymentResult } from "../../server/deployment/types";

const router: IRouter = Router();
router.use(injectSession);

// ── In-memory deployment registry (recent deployments) ────────────────────────
// In production: replace with DB table for persistence
const deploymentRegistry = new Map<string, DeploymentResult & { runningAt?: string }>();

// ── POST /deploy/:projectId ────────────────────────────────────────────────────

const DeployBodySchema = z.object({
  projectName:      z.string().min(1).max(120),
  target:           z.enum(["frontend", "backend", "fullstack"]).default("fullstack"),
  frontendDir:      z.string().optional(),
  backendDir:       z.string().optional(),
  frontendProvider: z.enum(["vercel"]).default("vercel"),
  backendProvider:  z.enum(["render", "railway"]).default("render"),
  env:              z.record(z.string()).optional(),
  skipTests:        z.boolean().optional().default(false),
});

router.post("/deploy/:projectId", async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) {
    badRequest(res, "projectId must be a number");
    return;
  }

  const parsed = DeployBodySchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.issues.map(i => i.message).join("; "));
    return;
  }

  const config: DeploymentConfig = {
    projectId,
    ...parsed.data,
  };

  logger.info({ projectId, config }, "Deployment request received");

  try {
    // Mark as running in registry
    const runningKey = String(projectId);
    deploymentRegistry.set(runningKey, {
      deploymentId: "pending",
      projectId,
      projectName: config.projectName,
      status: "running",
      steps: [],
      logs: [`[${new Date().toISOString()}] Deployment started`],
      startedAt: new Date().toISOString(),
      runningAt: new Date().toISOString(),
    });

    const result = await deployProject(config);

    // Store final result
    deploymentRegistry.set(result.deploymentId, result);
    deploymentRegistry.delete(runningKey);

    // Limit registry size (keep last 50)
    if (deploymentRegistry.size > 50) {
      const oldest = Array.from(deploymentRegistry.keys())[0];
      deploymentRegistry.delete(oldest);
    }

    logger.info({ deploymentId: result.deploymentId, status: result.status }, "Deployment finished");

    success(res, {
      deploymentId:    result.deploymentId,
      projectId:       result.projectId,
      projectName:     result.projectName,
      status:          result.status,
      live_url:        result.live_url,
      frontend_url:    result.frontend_url,
      backend_url:     result.backend_url,
      totalDurationMs: result.totalDurationMs,
      steps: result.steps.map(s => ({
        name:        s.name,
        label:       s.label,
        status:      s.status,
        durationMs:  s.durationMs,
        error:       s.error,
        logCount:    s.logs.length,
      })),
      logs:            result.logs,
      error:           result.error,
      debugAgentOutput: result.debugAgentOutput ?? null,
      providers: {
        vercel:  result.vercel  ?? null,
        render:  result.render  ?? null,
        railway: result.railway ?? null,
      },
      startedAt:   result.startedAt,
      completedAt: result.completedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ projectId, error: msg }, "Deployment router error");
    serverError(res, `Deployment failed: ${msg}`);
  }
});

// ── GET /deploy/:projectId/status ──────────────────────────────────────────────

router.get("/deploy/:projectId/status", (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) {
    badRequest(res, "projectId must be a number");
    return;
  }

  // Look for running or recently completed deployment
  const running = deploymentRegistry.get(String(projectId));
  if (running) {
    success(res, {
      status:      running.status,
      live_url:    running.live_url ?? null,
      steps:       running.steps ?? [],
      logs:        running.logs ?? [],
      startedAt:   running.startedAt,
      completedAt: running.completedAt ?? null,
    });
    return;
  }

  // Search by deploymentId
  const byId = Array.from(deploymentRegistry.values())
    .find(d => d.projectId === projectId);

  if (!byId) {
    notFound(res, `No deployment found for projectId ${projectId}`);
    return;
  }

  success(res, {
    status:      byId.status,
    live_url:    byId.live_url ?? null,
    steps:       byId.steps,
    logs:        byId.logs,
    startedAt:   byId.startedAt,
    completedAt: byId.completedAt ?? null,
  });
});

// ── GET /deploy/providers ──────────────────────────────────────────────────────

router.get("/deploy/providers", (_req, res) => {
  const providers = [
    {
      id:          "vercel",
      name:        "Vercel",
      type:        "frontend",
      description: "Zero-config deployment for Vite, Next.js, React apps",
      configured:  !!process.env.VERCEL_TOKEN,
      requiredEnv: ["VERCEL_TOKEN"],
      optionalEnv: ["VERCEL_TEAM_ID"],
      docsUrl:     "https://vercel.com/docs/rest-api",
    },
    {
      id:          "render",
      name:        "Render",
      type:        "backend",
      description: "Auto-scaling Node.js / Express backend deployments",
      configured:  !!process.env.RENDER_API_KEY,
      requiredEnv: ["RENDER_API_KEY"],
      optionalEnv: ["RENDER_SERVICE_ID"],
      docsUrl:     "https://render.com/docs/api",
    },
    {
      id:          "railway",
      name:        "Railway",
      type:        "backend",
      description: "Container-native backend deployments with instant rollbacks",
      configured:  !!process.env.RAILWAY_API_TOKEN,
      requiredEnv: ["RAILWAY_API_TOKEN"],
      optionalEnv: ["RAILWAY_PROJECT_ID"],
      docsUrl:     "https://docs.railway.app/reference/public-api",
    },
  ];

  success(res, {
    providers,
    simulationMode: providers.every(p => !p.configured),
    message: providers.some(p => !p.configured)
      ? "Some providers not configured — set required env vars to enable live deployment"
      : "All providers configured",
  });
});

export default router;
