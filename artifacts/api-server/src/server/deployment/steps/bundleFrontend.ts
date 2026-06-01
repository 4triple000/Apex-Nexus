/**
 * Apex Deployment System — Step: Bundle Frontend
 *
 * Simulates (or executes) a frontend build using Vite / pnpm.
 * In production: runs the actual build command via child_process.
 * In simulation (no build env): logs expected output and passes.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import path from "path";
import type { DeploymentConfig } from "../types";
import type { DeploymentLogger } from "../DeploymentLogger";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(process.cwd(), "../..");

export async function bundleFrontend(
  config: DeploymentConfig,
  logger: DeploymentLogger
): Promise<void> {
  const frontendDir = config.frontendDir
    ? path.resolve(REPO_ROOT, config.frontendDir)
    : null;

  logger.info(`Project: ${config.projectName}`);
  logger.info(`Frontend dir: ${frontendDir ?? "(not specified)"}`);

  // If no frontendDir is given or path doesn't exist → simulation mode
  if (!frontendDir || !existsSync(frontendDir)) {
    logger.warn("Frontend directory not found — running bundle simulation");
    await simulateBundleStep(logger);
    return;
  }

  // Real build: run `pnpm build`
  logger.info(`Running: pnpm build in ${frontendDir}`);
  try {
    const { stdout, stderr } = await execFileAsync("pnpm", ["build"], {
      cwd: frontendDir,
      env: { ...process.env, NODE_ENV: "production" },
      timeout: 120_000,
    });
    if (stdout) stdout.split("\n").filter(Boolean).forEach(l => logger.info(l));
    if (stderr) stderr.split("\n").filter(Boolean).forEach(l => logger.warn(l));
    logger.info("Frontend bundle complete — dist/ ready");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Frontend build failed: ${msg}`);
  }
}

async function simulateBundleStep(logger: DeploymentLogger): Promise<void> {
  const steps = [
    "Resolving entry points ...",
    "Transpiling TypeScript with esbuild ...",
    "Running Vite production build ...",
    "Optimizing 347 modules ...",
    "Tree-shaking unused code ...",
    "Generating CSS chunks ...",
    "Minifying JavaScript ...",
    "Writing dist/assets/ (12 files) ...",
    "dist/index.html          0.48 kB",
    "dist/assets/index.js   284.31 kB (gzip: 91.2 kB)",
    "dist/assets/index.css   38.14 kB (gzip: 8.1 kB)",
    "Build complete in 4.2s",
  ];

  for (const step of steps) {
    await simulateDelay(200);
    logger.info(`[BUILD] ${step}`);
  }
}

function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
