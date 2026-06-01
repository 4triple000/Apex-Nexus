/**
 * Apex Deployment System — Main Orchestrator
 *
 * deployProject(config) runs the full deployment workflow:
 *   1. bundle_frontend  — Vite production build
 *   2. prepare_backend  — Deps install + TS compile
 *   3. run_tests        — Test suite (skippable)
 *   4. deploy_frontend  — Vercel (if target includes frontend)
 *   5. deploy_backend   — Render or Railway (if target includes backend)
 *   6. verify           — HTTP health checks on live URLs
 *
 * On any step failure:
 *   - Stops the pipeline
 *   - Sends error context to debugAgent for analysis
 *   - Returns full result including debug output
 *
 * All credentials come from environment variables — nothing hardcoded.
 */

import { randomUUID } from "crypto";
import { logger as appLogger } from "../../lib/logger";
import { DeploymentLogger } from "./DeploymentLogger";
import { bundleFrontend  } from "./steps/bundleFrontend";
import { prepareBackend  } from "./steps/prepareBackend";
import { runTests        } from "./steps/runTests";
import { verifyDeployment } from "./steps/verifyDeployment";
import { deployToVercel  } from "./providers/vercel";
import { deployToRender  } from "./providers/render";
import { deployToRailway } from "./providers/railway";
import { runAgent } from "../../agents/orchestrator";
import type {
  DeploymentConfig,
  DeploymentResult,
  VercelDeployMeta,
  RenderDeployMeta,
  RailwayDeployMeta,
} from "./types";

// ── Public entry point ─────────────────────────────────────────────────────────

export async function deployProject(config: DeploymentConfig): Promise<DeploymentResult> {
  const deploymentId = randomUUID();
  const startedAt    = new Date().toISOString();
  const dl           = new DeploymentLogger();

  appLogger.info({ deploymentId, config }, "Deploy: starting");
  dl.info(`Deployment ID: ${deploymentId}`);
  dl.info(`Project: ${config.projectName} (id=${config.projectId})`);
  dl.info(`Target: ${config.target}`);

  let frontendUrl: string | undefined;
  let backendUrl:  string | undefined;
  let vercel:   VercelDeployMeta  | undefined;
  let render:   RenderDeployMeta  | undefined;
  let railway:  RailwayDeployMeta | undefined;
  let failError: Error | null = null;
  const simulatedUrls = new Set<string>();

  // ── Step 1: Bundle Frontend ──────────────────────────────────────────────────
  if (config.target !== "backend") {
    dl.startStep("bundle_frontend");
    try {
      await bundleFrontend(config, dl);
      dl.completeStep("bundle_frontend");
    } catch (err: unknown) {
      failError = toError(err);
      dl.failStep("bundle_frontend", failError.message);
      return await buildFailedResult(deploymentId, config, startedAt, dl, failError);
    }
  } else {
    dl.skipStep("bundle_frontend", "backend-only deployment");
  }

  // ── Step 2: Prepare Backend ──────────────────────────────────────────────────
  if (config.target !== "frontend") {
    dl.startStep("prepare_backend");
    try {
      await prepareBackend(config, dl);
      dl.completeStep("prepare_backend");
    } catch (err: unknown) {
      failError = toError(err);
      dl.failStep("prepare_backend", failError.message);
      return await buildFailedResult(deploymentId, config, startedAt, dl, failError);
    }
  } else {
    dl.skipStep("prepare_backend", "frontend-only deployment");
  }

  // ── Step 3: Run Tests ────────────────────────────────────────────────────────
  dl.startStep("run_tests");
  try {
    const testResult = await runTests(config, dl);
    if (testResult.failed > 0) {
      throw new Error(`${testResult.failed} test(s) failed — deployment blocked`);
    }
    dl.completeStep("run_tests");
  } catch (err: unknown) {
    failError = toError(err);
    dl.failStep("run_tests", failError.message);
    return await buildFailedResult(deploymentId, config, startedAt, dl, failError);
  }

  // ── Step 4: Deploy Frontend ──────────────────────────────────────────────────
  if (config.target !== "backend") {
    dl.startStep("deploy_frontend");
    const provider = config.frontendProvider ?? "vercel";
    dl.info(`Provider: ${provider}`);
    try {
      vercel = await deployToVercel({
        projectName: config.projectName,
        frontendDir: config.frontendDir,
        env: config.env,
        logger: dl,
      });
      frontendUrl = vercel.url;
      if (vercel.simulated) simulatedUrls.add(frontendUrl);
      dl.completeStep("deploy_frontend");
    } catch (err: unknown) {
      failError = toError(err);
      dl.failStep("deploy_frontend", failError.message);
      return await buildFailedResult(deploymentId, config, startedAt, dl, failError);
    }
  } else {
    dl.skipStep("deploy_frontend", "backend-only deployment");
  }

  // ── Step 5: Deploy Backend ───────────────────────────────────────────────────
  if (config.target !== "frontend") {
    dl.startStep("deploy_backend");
    const provider = config.backendProvider ?? "render";
    dl.info(`Provider: ${provider}`);
    try {
      if (provider === "railway") {
        railway = await deployToRailway({
          projectName: config.projectName,
          backendDir:  config.backendDir,
          env: config.env,
          logger: dl,
        });
        backendUrl = railway.url;
        if (railway.simulated) simulatedUrls.add(backendUrl);
      } else {
        render = await deployToRender({
          projectName: config.projectName,
          backendDir:  config.backendDir,
          env: config.env,
          logger: dl,
        });
        backendUrl = render.url;
        if (render.simulated) simulatedUrls.add(backendUrl);
      }
      dl.completeStep("deploy_backend");
    } catch (err: unknown) {
      failError = toError(err);
      dl.failStep("deploy_backend", failError.message);
      return await buildFailedResult(deploymentId, config, startedAt, dl, failError);
    }
  } else {
    dl.skipStep("deploy_backend", "frontend-only deployment");
  }

  // ── Step 6: Verify ───────────────────────────────────────────────────────────
  dl.startStep("verify");
  const urlsToVerify = [frontendUrl, backendUrl].filter((u): u is string => !!u);
  try {
    const verifyResults = await verifyDeployment(urlsToVerify, dl, simulatedUrls);
    const anyUnhealthy = verifyResults.some(r => r.status === "unreachable");
    if (anyUnhealthy) {
      throw new Error("One or more deployment URLs are unreachable after verification");
    }
    dl.completeStep("verify");
  } catch (err: unknown) {
    failError = toError(err);
    dl.failStep("verify", failError.message);
    return await buildFailedResult(deploymentId, config, startedAt, dl, failError);
  }

  // ── All steps passed ─────────────────────────────────────────────────────────
  const completedAt = new Date().toISOString();
  const totalDurationMs = Date.now() - new Date(startedAt).getTime();
  const live_url = frontendUrl ?? backendUrl;

  dl.info(`Deployment complete! Live URL: ${live_url}`);
  dl.info(`Total duration: ${totalDurationMs}ms`);

  appLogger.info({ deploymentId, live_url, totalDurationMs }, "Deploy: success");

  return {
    deploymentId,
    projectId: config.projectId,
    projectName: config.projectName,
    status: "success",
    live_url,
    frontend_url: frontendUrl,
    backend_url:  backendUrl,
    steps: dl.getSteps(),
    logs:  dl.getFlatLogs(),
    startedAt,
    completedAt,
    totalDurationMs,
    vercel,
    render,
    railway,
  };
}

// ── Failure handler with debugAgent integration ────────────────────────────────

async function buildFailedResult(
  deploymentId: string,
  config: DeploymentConfig,
  startedAt: string,
  dl: DeploymentLogger,
  err: Error
): Promise<DeploymentResult> {
  const completedAt     = new Date().toISOString();
  const totalDurationMs = Date.now() - new Date(startedAt).getTime();

  dl.error(`Pipeline stopped: ${err.message}`);
  dl.info("Sending failure context to Debug Agent for analysis ...");

  appLogger.error({ deploymentId, error: err.message }, "Deploy: failed");

  // ── Invoke debugAgent ────────────────────────────────────────────────────────
  let debugAgentOutput: unknown = null;
  try {
    const failedSteps = dl.getSteps()
      .filter(s => s.status === "failed")
      .map(s => `Step: ${s.label}\nError: ${s.error}\nLogs:\n${s.logs.slice(-5).join("\n")}`)
      .join("\n\n");

    const debugTask = {
      id: randomUUID(),
      prompt: `Apex deployment failed for project "${config.projectName}". Analyze the failure and provide fixes.\n\nError: ${err.message}\n\n${failedSteps}`,
      context: `Deployment target: ${config.target}, frontend provider: ${config.frontendProvider ?? "vercel"}, backend provider: ${config.backendProvider ?? "render"}`,
    };

    debugAgentOutput = await runAgent("debug", debugTask);
    dl.info(`Debug Agent analysis complete — see debugAgentOutput in response`);
  } catch (dbgErr: unknown) {
    const dbgMsg = dbgErr instanceof Error ? dbgErr.message : String(dbgErr);
    dl.warn(`Debug Agent call failed: ${dbgMsg}`);
  }

  return {
    deploymentId,
    projectId: config.projectId,
    projectName: config.projectName,
    status: "failed",
    steps: dl.getSteps(),
    logs:  dl.getFlatLogs(),
    startedAt,
    completedAt,
    totalDurationMs,
    error: err.message,
    debugAgentOutput,
  };
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}
