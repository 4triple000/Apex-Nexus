/**
 * Apex Deployment System — Render Provider
 *
 * Calls the Render REST API to create or re-deploy a backend service.
 * Credentials: RENDER_API_KEY (required)
 *
 * If RENDER_API_KEY is not set → runs in simulation mode.
 */

import type { RenderDeployMeta } from "../types";
import type { DeploymentLogger } from "../DeploymentLogger";

const RENDER_API = "https://api.render.com/v1";

export async function deployToRender(opts: {
  projectName: string;
  backendDir?: string;
  env?: Record<string, string>;
  logger: DeploymentLogger;
}): Promise<RenderDeployMeta> {
  const apiKey = process.env.RENDER_API_KEY;
  const existingServiceId = process.env.RENDER_SERVICE_ID;
  const { projectName, backendDir, env = {}, logger } = opts;

  // ── Simulation mode ──────────────────────────────────────────────────────────
  if (!apiKey) {
    logger.warn("RENDER_API_KEY not set — running in simulation mode");
    await simulateDelay(1500);
    const fakeServiceId = `srv-sim-${Date.now()}`;
    const fakeDeployId  = `dep-sim-${Date.now()}`;
    const fakeUrl = `https://${projectName.toLowerCase().replace(/\s+/g, "-")}.onrender.com`;
    logger.info(`[SIM] Render service deployed: ${fakeUrl}`);
    return {
      serviceId: fakeServiceId,
      deployId:  fakeDeployId,
      url:       fakeUrl,
      status:    "live",
      simulated: true,
    };
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // ── Re-deploy existing service ───────────────────────────────────────────────
  if (existingServiceId) {
    logger.info(`Re-deploying Render service ${existingServiceId} ...`);

    // Update env vars first
    if (Object.keys(env).length > 0) {
      logger.info("Updating environment variables ...");
      const envRes = await fetch(`${RENDER_API}/services/${existingServiceId}/env-vars`, {
        method:  "PUT",
        headers,
        body: JSON.stringify(
          Object.entries(env).map(([key, value]) => ({ key, value }))
        ),
      });
      if (!envRes.ok) logger.warn(`Env var update failed: ${envRes.status}`);
    }

    const deployRes = await fetch(
      `${RENDER_API}/services/${existingServiceId}/deploys`,
      { method: "POST", headers, body: JSON.stringify({ clearCache: "do_not_clear" }) }
    );

    if (!deployRes.ok) {
      const err = await deployRes.text();
      throw new Error(`Render deploy error ${deployRes.status}: ${err}`);
    }

    const deploy = await deployRes.json() as { id: string; status: string };
    const svcUrl = `https://${projectName.toLowerCase().replace(/\s+/g, "-")}.onrender.com`;
    logger.info(`Render deploy triggered: ${deploy.id}`);

    await pollRenderDeploy(existingServiceId, deploy.id, apiKey, logger);

    return {
      serviceId: existingServiceId,
      deployId:  deploy.id,
      url:       svcUrl,
      status:    "live",
    };
  }

  // ── Create new service ───────────────────────────────────────────────────────
  logger.info("Creating new Render web service ...");
  const serviceName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const createRes = await fetch(`${RENDER_API}/services`, {
    method:  "POST",
    headers,
    body: JSON.stringify({
      type: "web_service",
      name: serviceName,
      rootDir: backendDir ?? ".",
      envVars: Object.entries(env).map(([key, value]) => ({ key, value })),
      plan: "free",
      region: "oregon",
      buildCommand: "pnpm install && pnpm build",
      startCommand: "pnpm start",
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Render create service error ${createRes.status}: ${err}`);
  }

  const svc = await createRes.json() as {
    service: { id: string; serviceDetails: { url: string } };
    deployId: string;
  };

  const serviceId = svc.service.id;
  const deployId  = svc.deployId;
  const svcUrl    = svc.service.serviceDetails?.url ?? `https://${serviceName}.onrender.com`;

  logger.info(`Render service created: ${serviceId}`);
  logger.info(`Service URL: ${svcUrl}`);

  await pollRenderDeploy(serviceId, deployId, apiKey, logger);

  return { serviceId, deployId, url: svcUrl, status: "live" };
}

async function pollRenderDeploy(
  serviceId: string,
  deployId: string,
  apiKey: string,
  logger: DeploymentLogger,
  maxMs = 180_000,
  intervalMs = 8_000
): Promise<void> {
  const deadline = Date.now() + maxMs;
  const headers  = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
  let attempts = 0;

  while (Date.now() < deadline) {
    await simulateDelay(intervalMs);
    attempts++;

    const res = await fetch(
      `${RENDER_API}/services/${serviceId}/deploys/${deployId}`,
      { headers }
    );

    if (!res.ok) {
      logger.warn(`Render poll attempt ${attempts} failed: ${res.status}`);
      continue;
    }

    const d = await res.json() as { status: string };
    logger.info(`Render deploy status: ${d.status} (attempt ${attempts})`);

    if (d.status === "live")     return;
    if (d.status === "failed")   throw new Error("Render deployment failed");
    if (d.status === "canceled") throw new Error("Render deployment cancelled");
  }

  throw new Error("Render deployment timed out after 180s");
}

function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
