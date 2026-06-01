/**
 * Apex Deployment System — Deployment Logger
 *
 * A step-aware log collector that tracks individual steps and their logs.
 * Provides a flat log view and structured step view for the final result.
 */

import type { DeploymentStep, StepName, DeploymentStatus } from "./types";

const STEP_LABELS: Record<StepName, string> = {
  bundle_frontend:  "Bundle Frontend",
  prepare_backend:  "Prepare Backend",
  run_tests:        "Run Tests",
  deploy_frontend:  "Deploy to Vercel",
  deploy_backend:   "Deploy to Render / Railway",
  verify:           "Verify Live Deployment",
};

export class DeploymentLogger {
  private steps: Map<StepName, DeploymentStep> = new Map();
  private activeStep: StepName | null = null;
  private flatLogs: string[] = [];

  // ── Step lifecycle ───────────────────────────────────────────────────────────

  startStep(name: StepName): void {
    this.activeStep = name;
    const step: DeploymentStep = {
      name,
      label: STEP_LABELS[name],
      status: "running",
      startedAt: new Date().toISOString(),
      logs: [],
    };
    this.steps.set(name, step);
    this.info(`▶ ${step.label}`);
  }

  completeStep(name: StepName): void {
    const step = this.steps.get(name);
    if (!step) return;
    step.status = "success";
    step.completedAt = new Date().toISOString();
    step.durationMs = Date.now() - new Date(step.startedAt).getTime();
    this.info(`✓ ${step.label} completed (${step.durationMs}ms)`);
  }

  failStep(name: StepName, error: string): void {
    const step = this.steps.get(name);
    if (!step) return;
    step.status = "failed";
    step.error = error;
    step.completedAt = new Date().toISOString();
    step.durationMs = Date.now() - new Date(step.startedAt).getTime();
    this.error(`✗ ${step.label} failed: ${error}`);
  }

  skipStep(name: StepName, reason: string): void {
    const step: DeploymentStep = {
      name,
      label: STEP_LABELS[name],
      status: "cancelled",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      logs: [`⊘ Skipped: ${reason}`],
    };
    this.steps.set(name, step);
    this.flatLogs.push(`[SKIP] ${step.label}: ${reason}`);
  }

  // ── Log helpers ──────────────────────────────────────────────────────────────

  info(message: string): void {
    this.append("INFO", message);
  }

  warn(message: string): void {
    this.append("WARN", message);
  }

  error(message: string): void {
    this.append("ERROR", message);
  }

  private append(level: string, message: string): void {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}`;
    this.flatLogs.push(line);
    if (this.activeStep) {
      const step = this.steps.get(this.activeStep);
      if (step) step.logs.push(line);
    }
  }

  // ── Accessors ────────────────────────────────────────────────────────────────

  getSteps(): DeploymentStep[] {
    return Array.from(this.steps.values());
  }

  getFlatLogs(): string[] {
    return [...this.flatLogs];
  }

  getStepStatus(name: StepName): DeploymentStatus | undefined {
    return this.steps.get(name)?.status;
  }
}
