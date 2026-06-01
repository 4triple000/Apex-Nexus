/**
 * Apex AI OS — Built-in Workflow Templates
 *
 * Four pre-defined production workflow types that can be instantiated
 * for any project. Each is a factory function that returns a complete
 * Workflow object ready for registration.
 *
 * Templates:
 *   user_signup_flow        — New user registration pipeline
 *   ai_app_generation_flow  — Prompt → plan → code → preview
 *   error_repair_flow       — Detect → diagnose → patch → verify
 *   deployment_flow         — Test → build → lint → deploy → healthcheck
 */

import { randomUUID } from "node:crypto";
import type { Workflow, WorkflowType } from "./workflowTypes";

// ── Template factory ──────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

// ── 1. user_signup_flow ───────────────────────────────────────────────────────

export function createUserSignupFlow(overrides: Partial<Workflow> = {}): Workflow {
  const id = overrides.id ?? makeId("wf-signup");
  return {
    id,
    name: "User Signup Flow",
    description: "End-to-end new user registration: validate → create profile → send welcome email → log to memory",
    type: "user_signup_flow",
    trigger: "user.signup",
    enabled: true,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
    tags: ["auth", "onboarding"],
    steps: [
      {
        stepId: "signup-validate-input",
        action: "validate.input",
        input: { required: ["email", "password"] },
        output: "Input fields validated",
        condition: "always",
      },
      {
        stepId: "signup-validate-email",
        action: "validate.email",
        output: "Email format verified",
        condition: "steps.signup-validate-input.success",
      },
      {
        stepId: "signup-create-profile",
        action: "create.record",
        input: { entity: "user_profile" },
        output: "User profile created in database",
        condition: "steps.signup-validate-email.success",
      },
      {
        stepId: "signup-send-welcome",
        action: "notify.email",
        input: { subject: "Welcome to Apex AI OS", template: "welcome" },
        output: "Welcome email delivered",
        condition: "steps.signup-create-profile.success",
      },
      {
        stepId: "signup-log-memory",
        action: "memory.log",
        input: { type: "workflow", message: "New user signup completed" },
        output: "Signup event logged to memory",
        condition: "always",
      },
    ],
    ...overrides,
  };
}

// ── 2. ai_app_generation_flow ──────────────────────────────────────────────────

export function createAiAppGenerationFlow(overrides: Partial<Workflow> = {}): Workflow {
  const id = overrides.id ?? makeId("wf-gen");
  return {
    id,
    name: "AI App Generation Flow",
    description: "Full prompt-to-app pipeline: parse prompt → generate plan → build code → generate preview → log results",
    type: "ai_app_generation_flow",
    trigger: "prompt.received",
    enabled: true,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
    tags: ["ai", "generation", "core"],
    steps: [
      {
        stepId: "gen-validate-prompt",
        action: "validate.input",
        input: { required: ["prompt"] },
        output: "Prompt validated",
        condition: "always",
      },
      {
        stepId: "gen-build-plan",
        action: "build.plan",
        output: "Application plan created: features, pages, tech stack, API routes",
        condition: "steps.gen-validate-prompt.success",
      },
      {
        stepId: "gen-ai-generate",
        action: "ai.generate",
        input: { mode: "full_stack" },
        output: "AI-generated code, components, and configuration",
        condition: "steps.gen-build-plan.success",
      },
      {
        stepId: "gen-validate-code",
        action: "validate.code",
        output: "Generated code syntax verified",
        condition: "steps.gen-ai-generate.success",
      },
      {
        stepId: "gen-build-preview",
        action: "build.preview",
        output: "Live preview HTML generated",
        condition: "steps.gen-ai-generate.success",
      },
      {
        stepId: "gen-log-output",
        action: "memory.log",
        input: { type: "ai_output" },
        output: "Generation results persisted to memory",
        condition: "always",
      },
      {
        stepId: "gen-summarize",
        action: "ai.summarize",
        output: "Executive summary of what was built",
        condition: "steps.gen-validate-code.success",
      },
    ],
    ...overrides,
  };
}

// ── 3. error_repair_flow ───────────────────────────────────────────────────────

export function createErrorRepairFlow(overrides: Partial<Workflow> = {}): Workflow {
  const id = overrides.id ?? makeId("wf-repair");
  return {
    id,
    name: "Error Repair Flow",
    description: "Autonomous error recovery: detect → diagnose → analyze memory → generate patch → apply → verify",
    type: "error_repair_flow",
    trigger: "error.detected",
    enabled: true,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
    tags: ["autopilot", "repair", "error"],
    chainOnError: undefined,
    steps: [
      {
        stepId: "repair-analyze-memory",
        action: "memory.analyze",
        output: "Recent error patterns extracted from memory",
        condition: "always",
      },
      {
        stepId: "repair-diagnose",
        action: "error.diagnose",
        output: "Root cause identified, severity scored, fix strategies mapped",
        condition: "always",
      },
      {
        stepId: "repair-ai-repair",
        action: "ai.repair",
        output: "AI-generated patches for each identified error",
        condition: "steps.repair-diagnose.success",
      },
      {
        stepId: "repair-validate-patch",
        action: "validate.code",
        output: "Patch syntax and logic verified",
        condition: "steps.repair-ai-repair.success",
      },
      {
        stepId: "repair-apply-patch",
        action: "error.patch",
        output: "Fix applied to project codebase",
        condition: "steps.repair-validate-patch.success",
      },
      {
        stepId: "repair-update-record",
        action: "update.record",
        input: { entity: "project", fields: ["generatedCode", "status"] },
        output: "Project record updated with repaired code",
        condition: "steps.repair-apply-patch.success",
      },
      {
        stepId: "repair-log-fix",
        action: "memory.log",
        input: { type: "fix" },
        output: "Repair outcome logged to memory for future self-improvement",
        condition: "always",
      },
    ],
    ...overrides,
  };
}

// ── 4. deployment_flow ────────────────────────────────────────────────────────

export function createDeploymentFlow(overrides: Partial<Workflow> = {}): Workflow {
  const id = overrides.id ?? makeId("wf-deploy");
  return {
    id,
    name: "Deployment Flow",
    description: "Production deployment pipeline: validate → stage → test → deploy production → healthcheck → notify",
    type: "deployment_flow",
    trigger: "deploy.requested",
    enabled: true,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
    tags: ["deployment", "production", "ci-cd"],
    steps: [
      {
        stepId: "deploy-validate-code",
        action: "validate.code",
        output: "Codebase validated and ready for deployment",
        condition: "always",
      },
      {
        stepId: "deploy-validate-schema",
        action: "validate.schema",
        output: "Database schema verified",
        condition: "steps.deploy-validate-code.success",
      },
      {
        stepId: "deploy-stage",
        action: "deploy.stage",
        output: "Application deployed to staging environment",
        condition: "steps.deploy-validate-schema.success",
      },
      {
        stepId: "deploy-ai-analyze-staging",
        action: "ai.analyze",
        input: { mode: "staging_review" },
        output: "AI staging environment analysis complete",
        condition: "steps.deploy-stage.success",
      },
      {
        stepId: "deploy-production",
        action: "deploy.production",
        output: "Application live in production",
        condition: "steps.deploy-stage.success",
        retries: 1,
      },
      {
        stepId: "deploy-healthcheck",
        action: "deploy.healthcheck",
        output: "Production health checks all passing",
        condition: "steps.deploy-production.success",
      },
      {
        stepId: "deploy-notify",
        action: "notify.webhook",
        input: { url: "webhook://deploy-complete", event: "deployment.success" },
        output: "Deployment success notification delivered",
        condition: "steps.deploy-healthcheck.success",
      },
      {
        stepId: "deploy-log-memory",
        action: "memory.log",
        input: { type: "workflow", message: "Deployment pipeline complete" },
        output: "Deployment event logged to memory",
        condition: "always",
      },
    ],
    ...overrides,
  };
}

// ── Template registry ─────────────────────────────────────────────────────────

const TEMPLATE_FACTORIES: Record<
  WorkflowType,
  ((overrides?: Partial<Workflow>) => Workflow) | null
> = {
  user_signup_flow: createUserSignupFlow,
  ai_app_generation_flow: createAiAppGenerationFlow,
  error_repair_flow: createErrorRepairFlow,
  deployment_flow: createDeploymentFlow,
  custom: null,
};

/**
 * Instantiate a workflow from a built-in type template.
 * Returns null for "custom" type (user must supply their own steps).
 */
export function instantiateTemplate(
  type: WorkflowType,
  overrides?: Partial<Workflow>,
): Workflow | null {
  const factory = TEMPLATE_FACTORIES[type];
  return factory ? factory(overrides ?? {}) : null;
}

/**
 * Return all available template types.
 */
export function listTemplateTypes(): WorkflowType[] {
  return Object.keys(TEMPLATE_FACTORIES) as WorkflowType[];
}

/**
 * Return a skeleton (metadata only) for each template type.
 */
export function getTemplateSummaries(): { type: WorkflowType; name: string; description: string; trigger: string; stepCount: number }[] {
  return [
    {
      type: "user_signup_flow",
      name: "User Signup Flow",
      description: "End-to-end new user registration pipeline",
      trigger: "user.signup",
      stepCount: 5,
    },
    {
      type: "ai_app_generation_flow",
      name: "AI App Generation Flow",
      description: "Prompt → plan → code → preview pipeline",
      trigger: "prompt.received",
      stepCount: 7,
    },
    {
      type: "error_repair_flow",
      name: "Error Repair Flow",
      description: "Autonomous error detection and self-repair pipeline",
      trigger: "error.detected",
      stepCount: 7,
    },
    {
      type: "deployment_flow",
      name: "Deployment Flow",
      description: "Stage → test → production → healthcheck CI/CD pipeline",
      trigger: "deploy.requested",
      stepCount: 8,
    },
  ];
}
