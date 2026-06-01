/**
 * Apex AI OS — AI Studio Intelligence Layer
 * ─────────────────────────────────────────
 * Converts natural language prompts into fully structured application blueprints.
 *
 * Pipeline:
 *   prompt
 *     → detectAppType()          classify: SaaS / game / marketplace / ...
 *     → decomposePrompt()        extract: intent + features + architecture + workflows
 *     → generateProjectBlueprint()  produce: full structured JSON blueprint
 *     → generateCode()           produce: frontend + backend scaffolding
 *     → createWorkflowsFromBlueprint()  register workflows in the engine
 *     → logToMemory()            persist everything to the memory system
 *
 * Public API:
 *   generateProject(prompt, options?)         — Full pipeline (main entry point)
 *   detectAppType(prompt)                     — App type classification
 *   decomposePrompt(prompt, appType)          — Multi-stage decomposition
 *   generateCode(blueprint)                   — Code structure generation
 *   createWorkflowsFromBlueprint(blueprint, projectId?)  — Auto-create workflows
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { randomUUID } from "node:crypto";
import { db, apexOsProjectsTable, apexOsMemoryLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { createWorkflow } from "../workflows/workflowEngine";
import type { WorkflowType, WorkflowTrigger, WorkflowStep } from "../workflows/workflowTypes";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AppType =
  | "saas"
  | "game"
  | "marketplace"
  | "chat"
  | "dashboard"
  | "ecommerce"
  | "social"
  | "portfolio"
  | "blog"
  | "ai_tool"
  | "api"
  | "mobile"
  | "unknown";

export interface ProjectFeature {
  name: string;
  description: string;
  priority: "high" | "medium" | "low";
  complexity: "simple" | "moderate" | "complex";
  workflowTrigger?: string;
}

export interface ProjectPage {
  name: string;
  route: string;
  description: string;
  auth_required: boolean;
  components: string[];
}

export interface BackendService {
  name: string;
  description: string;
  methods: string[];
  dependencies: string[];
}

export interface DbField {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "uuid" | "json" | "text";
  required: boolean;
  unique?: boolean;
  default?: string;
  references?: string;
}

export interface DbTable {
  name: string;
  description: string;
  fields: DbField[];
  relationships: string[];
  indexes: string[];
}

export interface ApiRoute {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  auth_required: boolean;
  request_body?: string;
  response: string;
}

export interface BlueprintWorkflow {
  name: string;
  description: string;
  trigger: string;
  steps: { action: string; description: string; condition?: string }[];
  type: "user_signup_flow" | "ai_app_generation_flow" | "error_repair_flow" | "deployment_flow" | "custom";
}

export interface TechStack {
  frontend: string;
  backend: string;
  database: string;
  auth: string;
  hosting: string;
  additional: string[];
}

export interface CodeStructure {
  frontend: {
    root: string;
    dirs: string[];
    key_files: { path: string; purpose: string }[];
  };
  backend: {
    root: string;
    dirs: string[];
    key_files: { path: string; purpose: string }[];
  };
}

// ── Main blueprint type ────────────────────────────────────────────────────────

export interface ProjectBlueprint {
  project_name: string;
  app_type: AppType;
  description: string;
  tagline: string;
  tech_stack: TechStack;
  features: ProjectFeature[];
  pages: ProjectPage[];
  backend_services: BackendService[];
  database_schema: { tables: DbTable[] };
  api_routes: ApiRoute[];
  workflows: BlueprintWorkflow[];
  code_structure: CodeStructure;
  estimated_complexity: "simple" | "moderate" | "complex" | "enterprise";
  estimated_hours: number;
  generated_at: string;
}

// ── Generated code type ────────────────────────────────────────────────────────

export interface GeneratedCodeFile {
  path: string;
  content: string;
  language: string;
  description: string;
}

export interface GeneratedCode {
  frontend: {
    structure: Record<string, string[]>;
    components: GeneratedCodeFile[];
    pages: GeneratedCodeFile[];
    config: GeneratedCodeFile[];
  };
  backend: {
    structure: Record<string, string[]>;
    services: GeneratedCodeFile[];
    middleware: GeneratedCodeFile[];
    routes: GeneratedCodeFile[];
  };
  api_routes: ApiRoute[];
  db_schema: {
    sql: string;
    models: GeneratedCodeFile[];
  };
  entry_points: {
    frontend: string;
    backend: string;
  };
}

// ── Full generation result ─────────────────────────────────────────────────────

export interface StudioGenerationResult {
  sessionId: string;
  projectId?: number;
  prompt: string;
  appType: AppType;
  blueprint: ProjectBlueprint;
  code: GeneratedCode;
  workflowIds: string[];
  memoryLogId?: number;
  tokensUsed: number;
  durationMs: number;
  stages: {
    detection: number;
    decomposition: number;
    blueprint: number;
    codeGen: number;
    workflows: number;
  };
}

// ── Options ────────────────────────────────────────────────────────────────────

export interface GenerateProjectOptions {
  projectId?: number;
  sessionId?: string;
  model?: string;
  skipCodeGen?: boolean;
  skipWorkflows?: boolean;
  skipMemory?: boolean;
}

// ── AI model config ────────────────────────────────────────────────────────────

const MODEL = "gpt-5.2";
const MAX_TOKENS_BLUEPRINT = 7000;
const MAX_TOKENS_CODE = 6000;

// ── App type detection ─────────────────────────────────────────────────────────

const APP_TYPE_PATTERNS: Record<AppType, string[]> = {
  saas: ["saas", "subscription", "plan", "billing", "tenant", "enterprise", "b2b", "recurring", "seats"],
  game: ["game", "puzzle", "rpg", "shooter", "platformer", "score", "level", "player", "leaderboard", "arcade", "unity", "phaser"],
  marketplace: ["marketplace", "sell", "buy", "vendor", "product", "listing", "auction", "bid", "seller", "buyer", "shop"],
  chat: ["chat", "messaging", "conversation", "dm", "direct message", "real-time", "socket", "inbox", "slack", "discord"],
  dashboard: ["dashboard", "analytics", "chart", "metric", "report", "visualization", "kpi", "stat", "graph", "monitor", "admin panel"],
  ecommerce: ["ecommerce", "e-commerce", "store", "cart", "checkout", "payment", "stripe", "order", "product", "inventory", "shopify"],
  social: ["social", "profile", "feed", "follow", "like", "post", "community", "forum", "twitter", "instagram", "network"],
  portfolio: ["portfolio", "personal site", "resume", "cv", "showcase", "gallery", "about me", "landing page", "personal brand"],
  blog: ["blog", "cms", "content management", "article", "editorial", "news", "markdown", "medium", "ghost", "wordpress"],
  ai_tool: ["ai", "gpt", "openai", "llm", "chatbot", "assistant", "generative", "ml", "machine learning", "embeddings", "ai-powered"],
  api: ["api", "rest api", "graphql", "microservice", "endpoint", "service", "backend only", "sdk", "webhook", "integration"],
  mobile: ["mobile app", "ios app", "android app", "react native", "expo", "app store", "play store", "native app"],
  unknown: [],
};

/**
 * Detect the application type from a natural language prompt.
 * Uses keyword matching first (fast), then AI classification for ambiguous inputs.
 */
export function detectAppType(prompt: string): AppType {
  const lower = prompt.toLowerCase();
  const scores: Record<AppType, number> = {} as Record<AppType, number>;
  let maxScore = 0;
  let detected: AppType = "unknown";

  for (const [type, keywords] of Object.entries(APP_TYPE_PATTERNS) as [AppType, string[]][]) {
    if (type === "unknown") continue;
    const score = keywords.reduce((sum, kw) => {
      // Use word-boundary regex to avoid false substring matches
      // e.g. "graph" should not match inside "photography"
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const pattern = new RegExp(`\\b${escaped}\\b`, "i");
      if (pattern.test(lower)) {
        // Exact phrase match scores higher than single word
        return sum + (kw.includes(" ") ? 2 : 1);
      }
      return sum;
    }, 0);

    scores[type] = score;
    if (score > maxScore) {
      maxScore = score;
      detected = type;
    }
  }

  // Require at least one keyword match — otherwise "unknown"
  return maxScore > 0 ? detected : "unknown";
}

// ── JSON extraction utility ────────────────────────────────────────────────────

function extractJson(raw: string): string | null {
  if (!raw?.trim()) return null;

  // 1. Try parsing the entire response directly
  try { JSON.parse(raw); return raw; } catch {}

  // 2. Try markdown code fence (```json ... ``` or ``` ... ```)
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]?.trim()) {
    const candidate = fenced[1].trim();
    try { JSON.parse(candidate); return candidate; } catch {}
  }

  // 3. Try extracting from first { to last }
  const first = raw.indexOf("{");
  const last  = raw.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const candidate = raw.slice(first, last + 1);
    try { JSON.parse(candidate); return candidate; } catch {}
    // 4. As last resort strip control chars and retry
    const cleaned = candidate.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ");
    try { JSON.parse(cleaned); return cleaned; } catch {}
  }

  return null;
}

// ── Prompt decomposition ────────────────────────────────────────────────────────

export interface PromptDecomposition {
  intent: string;
  target_users: string;
  core_problem: string;
  key_features: string[];
  technical_requirements: string[];
  data_entities: string[];
  suggested_app_type: AppType;
  complexity_estimate: "simple" | "moderate" | "complex" | "enterprise";
  suggested_workflows: { name: string; trigger: string; purpose: string }[];
}

const DECOMPOSE_SYSTEM_PROMPT = `You are the Apex AI OS intent analyzer. Break down a user's app request into structured components.

CRITICAL: Return ONLY raw JSON. No markdown. Start with {.

{
  "intent": "One sentence: what is this app's core purpose?",
  "target_users": "Who are the primary users?",
  "core_problem": "What problem does it solve?",
  "key_features": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "technical_requirements": ["auth", "real-time", "payments", "file uploads", "search", etc.],
  "data_entities": ["User", "Product", "Order", etc.],
  "suggested_app_type": "saas|game|marketplace|chat|dashboard|ecommerce|social|portfolio|blog|ai_tool|api|mobile",
  "complexity_estimate": "simple|moderate|complex|enterprise",
  "suggested_workflows": [
    {
      "name": "workflow name",
      "trigger": "triggering event",
      "purpose": "what this workflow automates"
    }
  ]
}

Be specific and accurate. Extract 4-6 key features. Identify the correct app type.`;

/**
 * Stage 2: Decompose the prompt into structured intent, features, and architecture hints.
 */
export async function decomposePrompt(
  prompt: string,
  appType: AppType,
): Promise<PromptDecomposition> {
  logger.info({ appType, promptLen: prompt.length }, "AI Studio: decomposePrompt");

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 1500,
      temperature: 0.1,
      messages: [
        { role: "system", content: DECOMPOSE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `App type detected: ${appType}\n\nUser prompt: ${prompt}\n\nReturn structured JSON decomposition.`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const jsonStr = extractJson(raw);
    if (!jsonStr) throw new Error("No JSON in decomposition response");

    return JSON.parse(jsonStr) as PromptDecomposition;
  } catch (err) {
    logger.warn({ err }, "AI Studio: decomposition failed — using fallback");
    return buildFallbackDecomposition(prompt, appType);
  }
}

function buildFallbackDecomposition(prompt: string, appType: AppType): PromptDecomposition {
  return {
    intent: `Build: ${prompt.slice(0, 80)}`,
    target_users: "General users",
    core_problem: "User-defined problem",
    key_features: ["User authentication", "Core functionality", "Data management", "Responsive UI"],
    technical_requirements: ["auth", "database", "api"],
    data_entities: ["User", "Resource"],
    suggested_app_type: appType,
    complexity_estimate: "moderate",
    suggested_workflows: [
      { name: "User Signup Flow", trigger: "user.signup", purpose: "Onboard new users" },
      { name: "Core Action Flow", trigger: "manual", purpose: "Handle primary user actions" },
    ],
  };
}

// ── Tech stack selector ────────────────────────────────────────────────────────

const TECH_STACKS: Record<AppType | "default", TechStack> = {
  saas: {
    frontend: "React 18 + TypeScript + Tailwind CSS + Radix UI",
    backend: "Node.js + Express + TypeScript",
    database: "PostgreSQL + Drizzle ORM",
    auth: "Clerk Auth (JWT + OAuth)",
    hosting: "Vercel (frontend) + Railway (backend)",
    additional: ["Stripe (billing)", "Redis (caching)", "Bull (job queues)", "Resend (email)"],
  },
  game: {
    frontend: "React 18 + TypeScript + Phaser 3 (game engine)",
    backend: "Node.js + Express + WebSocket",
    database: "PostgreSQL (scores) + Redis (sessions)",
    auth: "JWT (simple auth)",
    hosting: "Netlify (static) + Fly.io (backend)",
    additional: ["Socket.io (real-time)", "Howler.js (audio)", "Matter.js (physics)"],
  },
  marketplace: {
    frontend: "Next.js 14 + TypeScript + Tailwind CSS",
    backend: "Node.js + Express + TypeScript",
    database: "PostgreSQL + Drizzle ORM",
    auth: "Clerk Auth",
    hosting: "Vercel (frontend) + Railway (backend)",
    additional: ["Stripe Connect (payments)", "Algolia (search)", "Cloudinary (images)", "SendGrid (email)"],
  },
  chat: {
    frontend: "React 18 + TypeScript + Tailwind CSS",
    backend: "Node.js + Express + Socket.io",
    database: "PostgreSQL + Redis (pub/sub)",
    auth: "JWT + refresh tokens",
    hosting: "Fly.io (full-stack)",
    additional: ["Socket.io (real-time)", "Redis (pub/sub)", "S3 (file uploads)", "Twilio (SMS)"],
  },
  dashboard: {
    frontend: "React 18 + TypeScript + Recharts + Tailwind CSS",
    backend: "Node.js + Express + TypeScript",
    database: "PostgreSQL + TimescaleDB (time-series)",
    auth: "Clerk Auth",
    hosting: "Vercel + Railway",
    additional: ["Recharts (charts)", "date-fns (dates)", "React Query (data fetching)"],
  },
  ecommerce: {
    frontend: "Next.js 14 + TypeScript + Tailwind CSS",
    backend: "Node.js + Express + TypeScript",
    database: "PostgreSQL + Drizzle ORM",
    auth: "Clerk Auth",
    hosting: "Vercel + Railway",
    additional: ["Stripe (payments)", "Cloudinary (product images)", "Algolia (search)", "Resend (email)"],
  },
  social: {
    frontend: "React 18 + TypeScript + Tailwind CSS",
    backend: "Node.js + Express + Socket.io",
    database: "PostgreSQL + Redis (caching)",
    auth: "Clerk Auth (OAuth: Google, GitHub)",
    hosting: "Vercel + Railway",
    additional: ["Socket.io (notifications)", "Cloudinary (media)", "Bull (background jobs)"],
  },
  portfolio: {
    frontend: "Next.js 14 + TypeScript + Tailwind CSS + Framer Motion",
    backend: "Next.js API routes",
    database: "PostgreSQL (contact forms)",
    auth: "None (public)",
    hosting: "Vercel",
    additional: ["Framer Motion (animations)", "Resend (contact form)", "MDX (blog posts)"],
  },
  blog: {
    frontend: "Next.js 14 + TypeScript + Tailwind CSS + MDX",
    backend: "Next.js API routes + Contentlayer",
    database: "PostgreSQL (comments, users)",
    auth: "Clerk Auth",
    hosting: "Vercel",
    additional: ["MDX (content)", "Contentlayer (CMS)", "Algolia (search)", "Giscus (comments)"],
  },
  ai_tool: {
    frontend: "React 18 + TypeScript + Tailwind CSS",
    backend: "Node.js + Express + TypeScript",
    database: "PostgreSQL + pgvector (embeddings)",
    auth: "Clerk Auth",
    hosting: "Vercel + Railway (GPU-optimized)",
    additional: ["OpenAI API", "LangChain (orchestration)", "pgvector (vector search)", "Pinecone (embeddings)"],
  },
  api: {
    frontend: "None (API-only) / Swagger UI (docs)",
    backend: "Node.js + Express + TypeScript + Zod (validation)",
    database: "PostgreSQL + Drizzle ORM",
    auth: "API keys + JWT",
    hosting: "Railway / Fly.io",
    additional: ["Zod (validation)", "Bull (job queues)", "Redis (rate limiting)", "Swagger (docs)"],
  },
  mobile: {
    frontend: "React Native + Expo + TypeScript + NativeWind",
    backend: "Node.js + Express + TypeScript",
    database: "PostgreSQL + Drizzle ORM",
    auth: "Clerk Expo SDK",
    hosting: "EAS Build (mobile) + Railway (backend)",
    additional: ["Expo Router (navigation)", "NativeWind (styling)", "Expo Notifications", "AsyncStorage"],
  },
  unknown: {
    frontend: "React 18 + TypeScript + Tailwind CSS",
    backend: "Node.js + Express + TypeScript",
    database: "PostgreSQL + Drizzle ORM",
    auth: "JWT",
    hosting: "Vercel + Railway",
    additional: [],
  },
  default: {
    frontend: "React 18 + TypeScript + Tailwind CSS",
    backend: "Node.js + Express + TypeScript",
    database: "PostgreSQL + Drizzle ORM",
    auth: "JWT",
    hosting: "Vercel + Railway",
    additional: [],
  },
};

// ── Blueprint generation ───────────────────────────────────────────────────────

const BLUEPRINT_SYSTEM_PROMPT = `You are the Apex AI OS project architect. Generate a complete, production-quality project blueprint.

CRITICAL: Return ONLY raw JSON. No markdown fences, no backticks, no explanation. Start with { immediately.

Required structure:
{
  "project_name": "AppName",
  "description": "2-3 sentence description",
  "tagline": "Short marketing tagline",
  "pages": [
    {
      "name": "Page Name",
      "route": "/route",
      "description": "What this page does",
      "auth_required": true,
      "components": ["ComponentA", "ComponentB"]
    }
  ],
  "backend_services": [
    {
      "name": "ServiceName",
      "description": "What this service does",
      "methods": ["methodA(params): ReturnType", "methodB(): void"],
      "dependencies": ["dependency1"]
    }
  ],
  "database_schema": {
    "tables": [
      {
        "name": "table_name",
        "description": "What this table stores",
        "fields": [
          { "name": "id", "type": "uuid", "required": true, "unique": true },
          { "name": "created_at", "type": "date", "required": true }
        ],
        "relationships": ["belongs_to: other_table"],
        "indexes": ["idx_table_field"]
      }
    ]
  },
  "api_routes": [
    {
      "method": "POST",
      "path": "/api/resource",
      "description": "What this endpoint does",
      "auth_required": true,
      "request_body": "{ field: string }",
      "response": "{ id: string, field: string }"
    }
  ],
  "workflows": [
    {
      "name": "Workflow Name",
      "description": "What this automates",
      "trigger": "event.name",
      "type": "custom",
      "steps": [
        { "action": "validate.input", "description": "Validate user data", "condition": "always" }
      ]
    }
  ],
  "code_structure": {
    "frontend": {
      "root": "src/",
      "dirs": ["components/", "pages/", "hooks/", "lib/", "styles/"],
      "key_files": [
        { "path": "src/App.tsx", "purpose": "Root application component" }
      ]
    },
    "backend": {
      "root": "src/",
      "dirs": ["routes/", "controllers/", "services/", "models/", "middleware/"],
      "key_files": [
        { "path": "src/index.ts", "purpose": "Server entry point" }
      ]
    }
  }
}

RULES:
- Generate 3-6 pages (realistic for the app type)
- Generate 2-5 backend services (specific, not generic)
- Generate 2-4 database tables with real fields
- Generate 5-10 API routes
- Generate 2-4 workflows that match actual features
- Be specific and practical — no "lorem ipsum"`;

/**
 * Stage 3: Generate the full project blueprint from decomposition data.
 */
export async function generateProjectBlueprint(
  prompt: string,
  decomposition: PromptDecomposition,
  appType: AppType,
  techStack: TechStack,
): Promise<ProjectBlueprint> {
  logger.info({ appType, featureCount: decomposition.key_features.length }, "AI Studio: generateProjectBlueprint");

  const userMessage = `
App type: ${appType}
Detected tech stack: ${techStack.frontend} / ${techStack.backend} / ${techStack.database}

Intent: ${decomposition.intent}
Target users: ${decomposition.target_users}
Core problem: ${decomposition.core_problem}
Key features: ${decomposition.key_features.join(", ")}
Technical requirements: ${decomposition.technical_requirements.join(", ")}
Data entities: ${decomposition.data_entities.join(", ")}
Complexity: ${decomposition.complexity_estimate}

User's original prompt: "${prompt}"

Generate the complete project blueprint JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: MAX_TOKENS_BLUEPRINT,
      temperature: 0.3,
      messages: [
        { role: "system", content: BLUEPRINT_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const tokensUsed = response.usage?.total_tokens ?? 0;

    logger.info({ tokensUsed }, "AI Studio: blueprint AI call complete");

    const jsonStr = extractJson(raw);
    if (!jsonStr) throw new Error("No JSON in blueprint response");

    const parsed = JSON.parse(jsonStr) as Partial<ProjectBlueprint>;

    return {
      project_name: parsed.project_name ?? inferProjectName(prompt),
      app_type: appType,
      description: parsed.description ?? decomposition.intent,
      tagline: parsed.tagline ?? `The modern ${appType} platform`,
      tech_stack: techStack,
      features: decomposition.key_features.map((f, i) => ({
        name: f,
        description: `${f} functionality`,
        priority: i < 2 ? "high" : i < 4 ? "medium" : "low",
        complexity: decomposition.complexity_estimate === "simple" ? "simple" : "moderate",
      })),
      pages: parsed.pages ?? buildFallbackPages(appType),
      backend_services: parsed.backend_services ?? buildFallbackServices(appType),
      database_schema: parsed.database_schema ?? buildFallbackSchema(decomposition.data_entities),
      api_routes: parsed.api_routes ?? buildFallbackApiRoutes(appType),
      workflows: parsed.workflows ?? buildFallbackWorkflows(decomposition.suggested_workflows),
      code_structure: parsed.code_structure ?? buildFallbackCodeStructure(appType),
      estimated_complexity: decomposition.complexity_estimate,
      estimated_hours: estimateHours(decomposition.complexity_estimate),
      generated_at: new Date().toISOString(),
    };
  } catch (err) {
    logger.error({ err }, "AI Studio: blueprint generation failed — using fallback");
    return buildFallbackBlueprint(prompt, appType, decomposition, techStack);
  }
}

// ── Code generation ────────────────────────────────────────────────────────────

const CODE_GEN_SYSTEM_PROMPT = `You are the Apex AI OS code scaffolding engine. Generate production-quality code files.

CRITICAL: Return ONLY raw JSON. No markdown fences. Start with {.

{
  "frontend": {
    "structure": { "src/components": ["Button.tsx", "Card.tsx"], "src/pages": ["Home.tsx", "Dashboard.tsx"] },
    "components": [
      {
        "path": "src/components/ComponentName.tsx",
        "content": "import React from 'react';\n\nexport function ComponentName() {\n  return <div>...</div>;\n}\n",
        "language": "typescript",
        "description": "What this component does"
      }
    ],
    "pages": [
      {
        "path": "src/pages/PageName.tsx",
        "content": "// Page code here",
        "language": "typescript",
        "description": "Page description"
      }
    ],
    "config": [
      { "path": "src/lib/api.ts", "content": "// API client config", "language": "typescript", "description": "API client" }
    ]
  },
  "backend": {
    "structure": { "src/routes": ["auth.ts", "users.ts"], "src/services": ["authService.ts"] },
    "services": [
      { "path": "src/services/service.ts", "content": "// Service code", "language": "typescript", "description": "Service purpose" }
    ],
    "middleware": [
      { "path": "src/middleware/auth.ts", "content": "// Auth middleware", "language": "typescript", "description": "Auth check" }
    ],
    "routes": [
      { "path": "src/routes/users.ts", "content": "// Router code", "language": "typescript", "description": "User routes" }
    ]
  },
  "db_schema": {
    "sql": "CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
    "models": [
      { "path": "src/models/user.ts", "content": "// Drizzle schema", "language": "typescript", "description": "User model" }
    ]
  },
  "entry_points": {
    "frontend": "src/main.tsx",
    "backend": "src/index.ts"
  }
}

RULES:
- Generate 2-3 core components (functional, typed, with Tailwind)
- Generate 2-3 pages (matching the blueprint's pages)
- Generate 1-2 backend services (typed, with error handling)
- Generate SQL for ALL database tables
- Keep each file under 30 lines — focus on structure, not verbosity
- Use TypeScript throughout
- Keep total response under 5000 tokens`;

/**
 * Stage 4: Generate code scaffolding from the project blueprint.
 */
export async function generateCode(blueprint: ProjectBlueprint): Promise<GeneratedCode> {
  logger.info(
    { projectName: blueprint.project_name, pageCount: blueprint.pages.length },
    "AI Studio: generateCode",
  );

  const prompt = `
Project: ${blueprint.project_name} (${blueprint.app_type})
Tech: ${blueprint.tech_stack.frontend} / ${blueprint.tech_stack.backend}
Pages: ${blueprint.pages.map((p) => p.name).join(", ")}
Services: ${blueprint.backend_services.map((s) => s.name).join(", ")}
Tables: ${blueprint.database_schema.tables.map((t) => t.name).join(", ")}
Features: ${blueprint.features.map((f) => f.name).join(", ")}

Generate the code scaffold JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: MAX_TOKENS_CODE,
      temperature: 0.2,
      messages: [
        { role: "system", content: CODE_GEN_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const tokensUsed = response.usage?.total_tokens ?? 0;

    logger.info({ tokensUsed }, "AI Studio: code generation complete");

    const jsonStr = extractJson(raw);
    if (!jsonStr) throw new Error("No JSON in code response");

    const parsed = JSON.parse(jsonStr) as Partial<GeneratedCode>;

    return {
      frontend: {
        structure: parsed.frontend?.structure ?? {},
        components: parsed.frontend?.components ?? [],
        pages: parsed.frontend?.pages ?? [],
        config: parsed.frontend?.config ?? [],
      },
      backend: {
        structure: parsed.backend?.structure ?? {},
        services: parsed.backend?.services ?? [],
        middleware: parsed.backend?.middleware ?? [],
        routes: parsed.backend?.routes ?? [],
      },
      api_routes: blueprint.api_routes,
      db_schema: {
        sql: parsed.db_schema?.sql ?? buildFallbackSql(blueprint),
        models: parsed.db_schema?.models ?? [],
      },
      entry_points: parsed.entry_points ?? { frontend: "src/main.tsx", backend: "src/index.ts" },
    };
  } catch (err) {
    logger.error({ err }, "AI Studio: code generation failed — using fallback");
    return buildFallbackCode(blueprint);
  }
}

// ── Workflow auto-creation ─────────────────────────────────────────────────────

/**
 * Stage 5: Auto-create workflows in the engine from the blueprint's workflow definitions.
 * Maps blueprint workflow types to engine workflow types.
 */
export async function createWorkflowsFromBlueprint(
  blueprint: ProjectBlueprint,
  projectId?: number,
): Promise<string[]> {
  const workflowIds: string[] = [];

  for (const bpWf of blueprint.workflows) {
    try {
      const engineType = resolveWorkflowType(bpWf);

      const steps: WorkflowStep[] = bpWf.steps.map((s, i) => ({
        stepId: `step-${i + 1}`,
        action: s.action,
        output: s.description,
        condition: s.condition ?? (i === 0 ? "always" : `steps.step-${i}.success`),
      }));

      const workflow = await createWorkflow({
        name: bpWf.name,
        description: bpWf.description,
        type: engineType,
        trigger: bpWf.trigger as WorkflowTrigger,
        steps: engineType !== "custom" ? undefined : steps,
        projectId,
        tags: ["auto-generated", blueprint.app_type, blueprint.project_name.toLowerCase().replace(/\s+/g, "-")],
      });

      workflowIds.push(workflow.id);
      logger.info({ workflowId: workflow.id, name: bpWf.name, type: engineType }, "AI Studio: auto-created workflow");
    } catch (err) {
      logger.warn({ err, workflowName: bpWf.name }, "AI Studio: failed to create workflow — skipping");
    }
  }

  return workflowIds;
}

function resolveWorkflowType(bpWf: BlueprintWorkflow): WorkflowType {
  if (bpWf.type && bpWf.type !== "custom") return bpWf.type;

  const name = bpWf.name.toLowerCase();
  const trigger = bpWf.trigger.toLowerCase();

  if (trigger.includes("signup") || trigger.includes("register") || name.includes("onboard")) return "user_signup_flow";
  if (trigger.includes("generate") || trigger.includes("build") || trigger.includes("prompt")) return "ai_app_generation_flow";
  if (trigger.includes("error") || trigger.includes("fix") || trigger.includes("repair")) return "error_repair_flow";
  if (trigger.includes("deploy") || trigger.includes("publish") || trigger.includes("launch")) return "deployment_flow";

  return "custom";
}

// ── Memory logging ─────────────────────────────────────────────────────────────

async function logToMemory(
  prompt: string,
  blueprint: ProjectBlueprint,
  result: Omit<StudioGenerationResult, "memoryLogId">,
  projectId?: number,
  sessionId?: string,
): Promise<number | undefined> {
  try {
    const [log] = await db.insert(apexOsMemoryLogsTable).values({
      projectId: projectId ?? null,
      sessionId: sessionId ?? null,
      type: "prompt",
      content: prompt,
      metadata: {
        action: "studio_generate",
        appType: blueprint.app_type,
        projectName: blueprint.project_name,
        featureCount: blueprint.features.length,
        pageCount: blueprint.pages.length,
        tableCount: blueprint.database_schema.tables.length,
        workflowCount: result.workflowIds.length,
        tokensUsed: result.tokensUsed,
        durationMs: result.durationMs,
        stages: result.stages,
      },
      success: true,
      durationMs: result.durationMs,
    }).returning({ id: apexOsMemoryLogsTable.id });

    return log?.id;
  } catch (err) {
    logger.error({ err }, "AI Studio: failed to log to memory");
    return undefined;
  }
}

// ── Main entry point: generateProject ─────────────────────────────────────────

/**
 * Full pipeline: prompt → app type → decomposition → blueprint → code → workflows → memory
 */
export async function generateProject(
  prompt: string,
  options: GenerateProjectOptions = {},
): Promise<StudioGenerationResult> {
  const sessionId = options.sessionId ?? randomUUID().slice(0, 8);
  const totalStart = Date.now();
  const stages = { detection: 0, decomposition: 0, blueprint: 0, codeGen: 0, workflows: 0 };
  let tokensUsed = 0;

  logger.info({ prompt: prompt.slice(0, 100), projectId: options.projectId }, "AI Studio: generateProject start");

  // ── Stage 1: App type detection ──────────────────────────────────────────────
  const t1 = Date.now();
  const appType = detectAppType(prompt);
  stages.detection = Date.now() - t1;
  logger.info({ appType, ms: stages.detection }, "AI Studio: stage 1 — type detected");

  // ── Stage 2: Prompt decomposition ────────────────────────────────────────────
  const t2 = Date.now();
  const decomposition = await decomposePrompt(prompt, appType);
  stages.decomposition = Date.now() - t2;
  logger.info({ ms: stages.decomposition }, "AI Studio: stage 2 — decomposition complete");

  // Resolve tech stack (use detected type or decomposition override)
  const resolvedType = (decomposition.suggested_app_type !== "unknown" ? decomposition.suggested_app_type : appType) as AppType;
  const techStack = TECH_STACKS[resolvedType] ?? TECH_STACKS.default;

  // ── Stage 3: Blueprint generation ─────────────────────────────────────────────
  const t3 = Date.now();
  const blueprint = await generateProjectBlueprint(prompt, decomposition, resolvedType, techStack);
  stages.blueprint = Date.now() - t3;
  logger.info({ ms: stages.blueprint }, "AI Studio: stage 3 — blueprint generated");

  // ── Stage 4: Code generation ──────────────────────────────────────────────────
  let code: GeneratedCode;
  if (!options.skipCodeGen) {
    const t4 = Date.now();
    code = await generateCode(blueprint);
    stages.codeGen = Date.now() - t4;
    logger.info({ ms: stages.codeGen }, "AI Studio: stage 4 — code generated");
  } else {
    code = buildFallbackCode(blueprint);
    stages.codeGen = 0;
  }

  // ── Stage 5: Workflow creation ────────────────────────────────────────────────
  let workflowIds: string[] = [];
  if (!options.skipWorkflows) {
    const t5 = Date.now();
    workflowIds = await createWorkflowsFromBlueprint(blueprint, options.projectId);
    stages.workflows = Date.now() - t5;
    logger.info({ workflowIds, ms: stages.workflows }, "AI Studio: stage 5 — workflows created");
  }

  const durationMs = Date.now() - totalStart;

  const result: Omit<StudioGenerationResult, "memoryLogId"> = {
    sessionId,
    projectId: options.projectId,
    prompt,
    appType: resolvedType,
    blueprint,
    code,
    workflowIds,
    tokensUsed,
    durationMs,
    stages,
  };

  // ── Stage 6: Memory logging ───────────────────────────────────────────────────
  let memoryLogId: number | undefined;
  if (!options.skipMemory) {
    memoryLogId = await logToMemory(prompt, blueprint, result, options.projectId, sessionId);
  }

  logger.info(
    { appType: resolvedType, durationMs, workflowCount: workflowIds.length, stages },
    "AI Studio: generateProject complete",
  );

  return { ...result, memoryLogId };
}

// ── Public tech stack accessor ─────────────────────────────────────────────────

/**
 * Get the recommended tech stack for a given app type.
 * Exported so controllers and other services can access it without duplicating the map.
 */
export function getTechStack(appType: AppType): TechStack {
  return TECH_STACKS[appType] ?? TECH_STACKS.default;
}

// ── Fallback builders ──────────────────────────────────────────────────────────

function inferProjectName(prompt: string): string {
  const clean = prompt.replace(/build|create|make|an?|the|app|application|system|platform/gi, "").trim();
  const words = clean.split(/\s+/).slice(0, 3);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "Apex App";
}

function estimateHours(complexity: string): number {
  return { simple: 40, moderate: 120, complex: 300, enterprise: 800 }[complexity] ?? 120;
}

function buildFallbackPages(appType: AppType): ProjectPage[] {
  const common: ProjectPage[] = [
    { name: "Home", route: "/", description: "Landing page", auth_required: false, components: ["Hero", "Features", "CTA"] },
    { name: "Dashboard", route: "/dashboard", description: "Main user dashboard", auth_required: true, components: ["Sidebar", "StatsGrid", "RecentActivity"] },
    { name: "Settings", route: "/settings", description: "User settings", auth_required: true, components: ["ProfileForm", "PreferencesForm"] },
  ];
  return common;
}

function buildFallbackServices(appType: AppType): BackendService[] {
  return [
    { name: "AuthService", description: "User authentication and session management", methods: ["register(data)", "login(credentials)", "logout(token)", "refreshToken(token)"], dependencies: ["bcrypt", "jsonwebtoken"] },
    { name: "UserService", description: "User profile management", methods: ["getProfile(userId)", "updateProfile(userId, data)", "deleteAccount(userId)"], dependencies: ["database"] },
  ];
}

function buildFallbackSchema(entities: string[]): { tables: DbTable[] } {
  return {
    tables: entities.slice(0, 3).map((entity) => ({
      name: entity.toLowerCase(),
      description: `${entity} data`,
      fields: [
        { name: "id", type: "uuid" as const, required: true, unique: true },
        { name: "created_at", type: "date" as const, required: true },
        { name: "updated_at", type: "date" as const, required: true },
      ],
      relationships: [],
      indexes: [`idx_${entity.toLowerCase()}_id`],
    })),
  };
}

function buildFallbackApiRoutes(appType: AppType): ApiRoute[] {
  return [
    { method: "POST", path: "/api/auth/register", description: "Register new user", auth_required: false, request_body: "{ email, password, name }", response: "{ user, token }" },
    { method: "POST", path: "/api/auth/login", description: "Authenticate user", auth_required: false, request_body: "{ email, password }", response: "{ user, token }" },
    { method: "GET", path: "/api/users/me", description: "Get current user", auth_required: true, response: "{ user }" },
    { method: "GET", path: "/api/health", description: "Health check", auth_required: false, response: "{ status: 'ok' }" },
  ];
}

function buildFallbackWorkflows(suggested: { name: string; trigger: string; purpose: string }[]): BlueprintWorkflow[] {
  return suggested.map((s) => ({
    name: s.name,
    description: s.purpose,
    trigger: s.trigger,
    type: "custom" as const,
    steps: [
      { action: "validate.input", description: "Validate input data", condition: "always" },
      { action: "create.record", description: "Create record in database", condition: "steps.step-1.success" },
      { action: "notify.log", description: "Log event to memory", condition: "always" },
    ],
  }));
}

function buildFallbackCodeStructure(appType: AppType): CodeStructure {
  return {
    frontend: {
      root: "src/",
      dirs: ["components/", "pages/", "hooks/", "lib/", "styles/", "types/"],
      key_files: [
        { path: "src/main.tsx", purpose: "React app entry point" },
        { path: "src/App.tsx", purpose: "Root component with routing" },
        { path: "src/lib/api.ts", purpose: "API client configuration" },
      ],
    },
    backend: {
      root: "src/",
      dirs: ["routes/", "controllers/", "services/", "models/", "middleware/", "lib/"],
      key_files: [
        { path: "src/index.ts", purpose: "Express server entry point" },
        { path: "src/app.ts", purpose: "Express app configuration" },
        { path: "src/middleware/auth.ts", purpose: "JWT authentication middleware" },
      ],
    },
  };
}

function buildFallbackBlueprint(
  prompt: string,
  appType: AppType,
  decomposition: PromptDecomposition,
  techStack: TechStack,
): ProjectBlueprint {
  return {
    project_name: inferProjectName(prompt),
    app_type: appType,
    description: decomposition.intent,
    tagline: `Modern ${appType} built with AI`,
    tech_stack: techStack,
    features: decomposition.key_features.map((f, i) => ({
      name: f,
      description: `${f} functionality`,
      priority: i < 2 ? "high" : "medium",
      complexity: "moderate",
    })),
    pages: buildFallbackPages(appType),
    backend_services: buildFallbackServices(appType),
    database_schema: buildFallbackSchema(decomposition.data_entities),
    api_routes: buildFallbackApiRoutes(appType),
    workflows: buildFallbackWorkflows(decomposition.suggested_workflows),
    code_structure: buildFallbackCodeStructure(appType),
    estimated_complexity: decomposition.complexity_estimate,
    estimated_hours: estimateHours(decomposition.complexity_estimate),
    generated_at: new Date().toISOString(),
  };
}

function buildFallbackSql(blueprint: ProjectBlueprint): string {
  return blueprint.database_schema.tables
    .map(
      (t) =>
        `CREATE TABLE IF NOT EXISTS ${t.name}s (\n  id SERIAL PRIMARY KEY,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);`,
    )
    .join("\n\n");
}

function buildFallbackCode(blueprint: ProjectBlueprint): GeneratedCode {
  return {
    frontend: {
      structure: { "src/components": [], "src/pages": blueprint.pages.map((p) => `${p.name}.tsx`) },
      components: [],
      pages: blueprint.pages.slice(0, 2).map((p) => ({
        path: `src/pages/${p.name}.tsx`,
        content: `import React from 'react';\n\nexport default function ${p.name}() {\n  return (\n    <div className="min-h-screen bg-[#0D0D0D] text-white">\n      <h1>${p.name}</h1>\n    </div>\n  );\n}\n`,
        language: "typescript",
        description: p.description,
      })),
      config: [],
    },
    backend: {
      structure: { "src/routes": [], "src/services": [] },
      services: [],
      middleware: [],
      routes: [],
    },
    api_routes: blueprint.api_routes,
    db_schema: { sql: buildFallbackSql(blueprint), models: [] },
    entry_points: { frontend: "src/main.tsx", backend: "src/index.ts" },
  };
}
