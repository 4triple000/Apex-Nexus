/**
 * Apex Deployment System — Shared Types
 *
 * Defines the complete contract for deploy requests, results, steps, and providers.
 * All credentials are resolved from environment variables — nothing hardcoded.
 */

// ── Status ─────────────────────────────────────────────────────────────────────

export type DeploymentStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

// ── Providers ──────────────────────────────────────────────────────────────────

export type FrontendProvider = "vercel";
export type BackendProvider  = "render" | "railway";
export type DeploymentProvider = FrontendProvider | BackendProvider;

// ── Step names — the ordered workflow ─────────────────────────────────────────

export type StepName =
  | "bundle_frontend"
  | "prepare_backend"
  | "run_tests"
  | "deploy_frontend"
  | "deploy_backend"
  | "verify";

// ── Individual step record ─────────────────────────────────────────────────────

export interface DeploymentStep {
  name: StepName;
  label: string;
  status: DeploymentStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  logs: string[];
  error?: string;
}

// ── Project config passed into deployProject() ────────────────────────────────

export interface DeploymentConfig {
  projectId: number;
  projectName: string;
  /** Which parts to deploy */
  target: "frontend" | "backend" | "fullstack";
  /** Root dir of the frontend bundle (relative to repo root) */
  frontendDir?: string;
  /** Root dir of the backend service */
  backendDir?: string;
  /** Provider to use for frontend deployment (default: vercel) */
  frontendProvider?: FrontendProvider;
  /** Provider to use for backend deployment (default: render) */
  backendProvider?: BackendProvider;
  /** Extra env vars to inject into the deployed service */
  env?: Record<string, string>;
  /** Skip test step */
  skipTests?: boolean;
}

// ── Provider-specific deployment metadata ─────────────────────────────────────

export interface VercelDeployMeta {
  deploymentId: string;
  url: string;
  inspectUrl?: string;
  readyState: string;
  /** true when running without real credentials */
  simulated?: boolean;
}

export interface RenderDeployMeta {
  serviceId: string;
  deployId: string;
  url: string;
  status: string;
  simulated?: boolean;
}

export interface RailwayDeployMeta {
  projectId: string;
  deploymentId: string;
  url: string;
  status: string;
  simulated?: boolean;
}

// ── Final result returned by deployProject() ──────────────────────────────────

export interface DeploymentResult {
  deploymentId: string;
  projectId: number;
  projectName: string;
  status: DeploymentStatus;
  /** Canonical public URL (frontend URL if fullstack) */
  live_url?: string;
  frontend_url?: string;
  backend_url?: string;
  steps: DeploymentStep[];
  /** Flat log array for quick display */
  logs: string[];
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  error?: string;
  /** Populated when deploy fails and debugAgent runs */
  debugAgentOutput?: unknown;
  /** Provider-specific metadata */
  vercel?: VercelDeployMeta;
  render?: RenderDeployMeta;
  railway?: RailwayDeployMeta;
}
