/**
 * Apex Deployment System — Railway Provider
 *
 * Deploys backend services to Railway using their GraphQL API.
 * Credentials: RAILWAY_API_TOKEN (required), RAILWAY_PROJECT_ID (optional)
 *
 * If RAILWAY_API_TOKEN is not set → simulation mode.
 */

import type { RailwayDeployMeta } from "../types";
import type { DeploymentLogger } from "../DeploymentLogger";

const RAILWAY_API = "https://backboard.railway.app/graphql/v2";

async function railwayGql<T = unknown>(
  query: string,
  variables: Record<string, unknown>,
  token: string
): Promise<T> {
  const res = await fetch(RAILWAY_API, {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Railway API error ${res.status}: ${err}`);
  }

  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`Railway GraphQL error: ${json.errors[0].message}`);
  }
  return json.data as T;
}

export async function deployToRailway(opts: {
  projectName: string;
  backendDir?: string;
  env?: Record<string, string>;
  logger: DeploymentLogger;
}): Promise<RailwayDeployMeta> {
  const token     = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  const { projectName, env = {}, logger } = opts;

  // ── Simulation mode ──────────────────────────────────────────────────────────
  if (!token) {
    logger.warn("RAILWAY_API_TOKEN not set — running in simulation mode");
    await simulateDelay(1500);
    const fakeProjId   = `proj-sim-${Date.now()}`;
    const fakeDeployId = `dep-sim-${Date.now()}`;
    const fakeUrl = `https://${projectName.toLowerCase().replace(/\s+/g, "-")}.up.railway.app`;
    logger.info(`[SIM] Railway deployment created: ${fakeUrl}`);
    return {
      projectId: fakeProjId,
      deploymentId: fakeDeployId,
      url:       fakeUrl,
      status:    "SUCCESS",
      simulated: true,
    };
  }

  // ── Trigger deployment on existing Railway project ───────────────────────────
  if (projectId) {
    logger.info(`Triggering Railway redeploy for project ${projectId} ...`);

    // Upsert env vars
    if (Object.keys(env).length > 0) {
      logger.info("Syncing Railway environment variables ...");
      const serviceRes = await railwayGql<{
        services: { edges: { node: { id: string } }[] };
      }>(
        `query Services($projectId: String!) {
          services(projectId: $projectId) { edges { node { id } } }
        }`,
        { projectId },
        token
      );

      const serviceId = serviceRes.services.edges[0]?.node.id;
      if (serviceId) {
        for (const [name, value] of Object.entries(env)) {
          await railwayGql(
            `mutation UpsertVariable($input: VariableUpsertInput!) {
              variableUpsert(input: $input)
            }`,
            { input: { projectId, serviceId, name, value } },
            token
          );
        }
        logger.info(`Synced ${Object.keys(env).length} env vars`);
      }
    }

    // Trigger redeploy
    const deployData = await railwayGql<{
      serviceInstanceDeploy: { id: string; status: string; staticUrl?: string };
    }>(
      `mutation Deploy($serviceId: String!, $projectId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId, projectId: $projectId) {
          id status staticUrl
        }
      }`,
      { projectId },
      token
    );

    const dep = deployData.serviceInstanceDeploy;
    const url  = dep.staticUrl ?? `https://${projectName.toLowerCase().replace(/\s+/g, "-")}.up.railway.app`;
    logger.info(`Railway deployment triggered: ${dep.id}`);

    return {
      projectId,
      deploymentId: dep.id,
      url,
      status: dep.status,
    };
  }

  // ── Create new Railway project ───────────────────────────────────────────────
  logger.info("Creating new Railway project ...");

  const createData = await railwayGql<{
    projectCreate: { id: string };
  }>(
    `mutation CreateProject($input: ProjectCreateInput!) {
      projectCreate(input: $input) { id }
    }`,
    { input: { name: projectName } },
    token
  );

  const newProjectId = createData.projectCreate.id;
  logger.info(`Railway project created: ${newProjectId}`);

  const fakeUrl = `https://${projectName.toLowerCase().replace(/\s+/g, "-")}.up.railway.app`;

  return {
    projectId: newProjectId,
    deploymentId: `init-${Date.now()}`,
    url: fakeUrl,
    status: "INITIALIZING",
  };
}

function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
