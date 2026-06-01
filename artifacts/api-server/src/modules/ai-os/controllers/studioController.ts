/**
 * Apex AI OS — AI Studio Controller
 *
 * HTTP handlers for the AI Studio intelligence layer.
 * Delegates all work to /services/aiStudio.ts.
 *
 * POST /api/os/studio/generate     — Full pipeline: prompt → blueprint + code + workflows
 * POST /api/os/studio/detect-type  — Classify app type from a prompt (fast, no AI call)
 * POST /api/os/studio/decompose    — Stage 2 only: decompose prompt into structured intent
 * POST /api/os/studio/blueprint    — Stage 3 only: generate blueprint from decomposition
 * POST /api/os/studio/code         — Stage 4 only: generate code from a blueprint
 * GET  /api/os/studio/app-types    — List all supported app types with descriptions
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../../lib/logger";
import { success, created, badRequest, serverError } from "../../../shared/utils/response";
import {
  generateProject,
  detectAppType,
  decomposePrompt,
  generateProjectBlueprint,
  generateCode,
  createWorkflowsFromBlueprint,
  getTechStack,
} from "../../../services/aiStudio";
import type { AppType } from "../../../services/aiStudio";

// ── App type descriptions ──────────────────────────────────────────────────────

const APP_TYPE_DESCRIPTIONS: Record<AppType, { label: string; description: string; examples: string[] }> = {
  saas: {
    label: "SaaS Platform",
    description: "Multi-tenant software-as-a-service with subscriptions and billing",
    examples: ["CRM system", "Project management tool", "Analytics platform"],
  },
  game: {
    label: "Game",
    description: "Interactive game with scoring, levels, or real-time multiplayer",
    examples: ["Puzzle game", "RPG", "Multiplayer shooter", "Leaderboard app"],
  },
  marketplace: {
    label: "Marketplace",
    description: "Two-sided platform connecting buyers and sellers",
    examples: ["Freelance marketplace", "Product marketplace", "Service booking"],
  },
  chat: {
    label: "Chat / Messaging",
    description: "Real-time messaging and communication platform",
    examples: ["Team chat app", "Customer support chat", "Video calling app"],
  },
  dashboard: {
    label: "Dashboard / Analytics",
    description: "Data visualization and monitoring interface",
    examples: ["Business analytics", "IoT monitoring", "Financial dashboard"],
  },
  ecommerce: {
    label: "E-Commerce",
    description: "Online store with cart, checkout, and payment processing",
    examples: ["Online store", "Digital product shop", "Subscription box"],
  },
  social: {
    label: "Social Network",
    description: "Community platform with profiles, feeds, and social interactions",
    examples: ["Social media app", "Forum platform", "Community hub"],
  },
  portfolio: {
    label: "Portfolio / Personal Site",
    description: "Personal branding site showcasing work and skills",
    examples: ["Developer portfolio", "Photography showcase", "Resume site"],
  },
  blog: {
    label: "Blog / CMS",
    description: "Content management and publishing platform",
    examples: ["Tech blog", "Newsletter platform", "News site"],
  },
  ai_tool: {
    label: "AI Tool",
    description: "AI-powered application using LLMs or machine learning",
    examples: ["AI writing assistant", "Image generator", "Chatbot", "AI search"],
  },
  api: {
    label: "API / Backend Service",
    description: "Headless backend service or API for other applications",
    examples: ["REST API", "GraphQL service", "Microservice", "SDK backend"],
  },
  mobile: {
    label: "Mobile App",
    description: "Native or cross-platform mobile application",
    examples: ["iOS app", "Android app", "React Native app"],
  },
  unknown: {
    label: "General Application",
    description: "Custom application with flexible architecture",
    examples: ["Custom tool", "Internal tool", "Prototype"],
  },
};

// ── Validation schemas ─────────────────────────────────────────────────────────

const generateSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters").max(3000),
  projectId: z.number().int().positive().optional(),
  sessionId: z.string().max(100).optional(),
  skipCodeGen: z.boolean().default(false),
  skipWorkflows: z.boolean().default(false),
  skipMemory: z.boolean().default(false),
  model: z.string().optional(),
});

const detectSchema = z.object({
  prompt: z.string().min(3).max(1000),
});

const decomposeSchema = z.object({
  prompt: z.string().min(10).max(3000),
  appType: z.string().optional(),
});

const blueprintSchema = z.object({
  prompt: z.string().min(10).max(3000),
  appType: z.string().optional(),
  decomposition: z.record(z.string(), z.unknown()).optional(),
});

const codeSchema = z.object({
  blueprint: z.record(z.string(), z.unknown()),
});

// ── POST /api/os/studio/generate ──────────────────────────────────────────────

export async function generateHandler(req: Request, res: Response): Promise<void> {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const body = parsed.data;
  logger.info({ prompt: body.prompt.slice(0, 80), projectId: body.projectId }, "AI Studio: POST /generate");

  try {
    const result = await generateProject(body.prompt, {
      projectId: body.projectId,
      sessionId: body.sessionId,
      model: body.model,
      skipCodeGen: body.skipCodeGen,
      skipWorkflows: body.skipWorkflows,
      skipMemory: body.skipMemory,
    });

    created(res, {
      sessionId: result.sessionId,
      projectId: result.projectId,
      memoryLogId: result.memoryLogId,
      appType: result.appType,
      blueprint: result.blueprint,
      code: result.code,
      workflowIds: result.workflowIds,
      tokensUsed: result.tokensUsed,
      durationMs: result.durationMs,
      stages: result.stages,
      summary: {
        projectName: result.blueprint.project_name,
        description: result.blueprint.description,
        tagline: result.blueprint.tagline,
        estimatedComplexity: result.blueprint.estimated_complexity,
        estimatedHours: result.blueprint.estimated_hours,
        featureCount: result.blueprint.features.length,
        pageCount: result.blueprint.pages.length,
        tableCount: result.blueprint.database_schema.tables.length,
        apiRouteCount: result.blueprint.api_routes.length,
        workflowCount: result.workflowIds.length,
        techStack: result.blueprint.tech_stack,
      },
    });
  } catch (err) {
    logger.error({ err }, "AI Studio: generate error");
    serverError(res, "Studio generation failed — please try again");
  }
}

// ── POST /api/os/studio/detect-type ───────────────────────────────────────────

export async function detectTypeHandler(req: Request, res: Response): Promise<void> {
  const parsed = detectSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const { prompt } = parsed.data;
  const appType = detectAppType(prompt);
  const info = APP_TYPE_DESCRIPTIONS[appType];

  success(res, {
    prompt: prompt.slice(0, 100),
    appType,
    label: info.label,
    description: info.description,
    examples: info.examples,
    confidence: appType !== "unknown" ? "high" : "low",
  });
}

// ── POST /api/os/studio/decompose ─────────────────────────────────────────────

export async function decomposeHandler(req: Request, res: Response): Promise<void> {
  const parsed = decomposeSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const { prompt, appType: appTypeOverride } = parsed.data;
  const appType = (appTypeOverride as AppType | undefined) ?? detectAppType(prompt);

  try {
    const decomposition = await decomposePrompt(prompt, appType);
    success(res, { appType, decomposition });
  } catch (err) {
    logger.error({ err }, "AI Studio: decompose error");
    serverError(res, "Prompt decomposition failed");
  }
}

// ── POST /api/os/studio/blueprint ─────────────────────────────────────────────

export async function blueprintHandler(req: Request, res: Response): Promise<void> {
  const parsed = blueprintSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  const { prompt, appType: appTypeOverride, decomposition: decompOverride } = parsed.data;
  const appType = (appTypeOverride as AppType | undefined) ?? detectAppType(prompt);

  try {
    let decomp = decompOverride as Awaited<ReturnType<typeof decomposePrompt>> | undefined;
    if (!decomp) {
      decomp = await decomposePrompt(prompt, appType);
    }

    const techStack = getTechStack(appType);
    const blueprint = await generateProjectBlueprint(prompt, decomp, appType, techStack);
    success(res, { appType, blueprint });
  } catch (err) {
    logger.error({ err }, "AI Studio: blueprint error");
    serverError(res, "Blueprint generation failed");
  }
}

// ── POST /api/os/studio/code ──────────────────────────────────────────────────

export async function codeHandler(req: Request, res: Response): Promise<void> {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  try {
    const code = await generateCode(parsed.data.blueprint as unknown as Parameters<typeof generateCode>[0]);
    success(res, { code });
  } catch (err) {
    logger.error({ err }, "AI Studio: code gen error");
    serverError(res, "Code generation failed");
  }
}

// ── GET /api/os/studio/app-types ──────────────────────────────────────────────

export async function listAppTypesHandler(req: Request, res: Response): Promise<void> {
  const types = Object.entries(APP_TYPE_DESCRIPTIONS).map(([type, info]) => ({
    type,
    ...info,
  }));
  success(res, { types, total: types.length });
}
