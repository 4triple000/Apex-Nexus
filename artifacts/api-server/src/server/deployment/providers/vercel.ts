/**
 * Apex Deployment System — Vercel Provider
 *
 * Calls the Vercel REST API to deploy a frontend project.
 * Credentials: VERCEL_TOKEN (required), VERCEL_TEAM_ID (optional)
 *
 * If VERCEL_TOKEN is not set → runs in simulation mode (returns a mock URL).
 */

import type { VercelDeployMeta } from "../types";
import type { DeploymentLogger } from "../DeploymentLogger";

const VERCEL_API = "https://api.vercel.com";

interface VercelDeployPayload {
  name: string;
  gitSource?: {
    type: "github";
    repoId: string;
    ref: string;
  };
  projectSettings?: {
    framework?: string;
    buildCommand?: string;
    outputDirectory?: string;
    installCommand?: string;
    rootDirectory?: string;
  };
  env?: { key: string; value: string; type: "plain" | "secret" }[];
  target?: "production" | "preview";
}

export async function deployToVercel(opts: {
  projectName: string;
  frontendDir?: string;
  env?: Record<string, string>;
  logger: DeploymentLogger;
}): Promise<VercelDeployMeta> {
  const token   = process.env.VERCEL_TOKEN;
  const teamId  = process.env.VERCEL_TEAM_ID;
  const { projectName, frontendDir, env = {}, logger } = opts;

  // ── Simulation mode ──────────────────────────────────────────────────────────
  if (!token) {
    logger.warn("VERCEL_TOKEN not set — running in simulation mode");
    await simulateDelay(2000);
    const fakeId  = `dpl_sim_${Date.now()}`;
    const fakeUrl = `https://${projectName.toLowerCase().replace(/\s+/g, "-")}-${fakeId.slice(-8)}.vercel.app`;
    logger.info(`[SIM] Vercel deployment created: ${fakeUrl}`);
    return {
      deploymentId: fakeId,
      url: fakeUrl,
      inspectUrl: `https://vercel.com/dashboard`,
      readyState: "READY",
      simulated: true,
    };
  }

  // ── Real Vercel API call ─────────────────────────────────────────────────────
  logger.info("Calling Vercel API v13/deployments ...");

  const payload: VercelDeployPayload = {
    name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    target: "production",
    projectSettings: {
      framework: "vite",
      buildCommand: "pnpm build",
      outputDirectory: "dist",
      installCommand: "pnpm install",
      rootDirectory: frontendDir,
    },
    env: Object.entries(env).map(([key, value]) => ({ key, value, type: "plain" })),
  };

  const qp = teamId ? `?teamId=${teamId}` : "";
  const res = await fetch(`${VERCEL_API}/v13/deployments${qp}`, {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    id: string;
    url: string;
    inspectorUrl?: string;
    readyState: string;
  };

  logger.info(`Vercel deployment created: https://${data.url}`);
  logger.info(`Inspect at: ${data.inspectorUrl ?? "https://vercel.com"}`);

  // Poll until ready (max 120s)
  const finalState = await pollVercelDeployment(data.id, token, teamId, logger);

  return {
    deploymentId: data.id,
    url: `https://${data.url}`,
    inspectUrl: data.inspectorUrl,
    readyState: finalState,
  };
}

async function pollVercelDeployment(
  deployId: string,
  token: string,
  teamId: string | undefined,
  logger: DeploymentLogger,
  maxMs = 120_000,
  intervalMs = 5_000
): Promise<string> {
  const deadline = Date.now() + maxMs;
  const qp = teamId ? `?teamId=${teamId}` : "";
  let attempts = 0;

  while (Date.now() < deadline) {
    await simulateDelay(intervalMs);
    attempts++;

    const res = await fetch(`${VERCEL_API}/v13/deployments/${deployId}${qp}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      logger.warn(`Vercel poll attempt ${attempts} failed: ${res.status}`);
      continue;
    }

    const d = await res.json() as { readyState: string };
    logger.info(`Vercel readyState: ${d.readyState} (attempt ${attempts})`);

    if (d.readyState === "READY")      return "READY";
    if (d.readyState === "ERROR")      throw new Error("Vercel deployment errored");
    if (d.readyState === "CANCELED")   throw new Error("Vercel deployment cancelled");
  }

  throw new Error("Vercel deployment timed out after 120s");
}

function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
