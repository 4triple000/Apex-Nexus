/**
 * Apex AI OS — Configuration & Constants
 */

export const AI_OS_CONFIG = {
  // AI model settings
  model: {
    primary: "gpt-5.2",
    fallback: "gpt-4o",
    temperature: {
      generate: 0.7,
      improve: 0.2,
      analyze: 0.1,
    },
    maxTokens: {
      generate: 8000,
      improve: 5000,
      analyze: 3000,
    },
  },

  // Workflow engine
  workflow: {
    maxStepsPerWorkflow: 20,
    maxWorkflowsPerProject: 50,
    stepTimeoutMs: 30_000,
    executionTimeoutMs: 120_000,
    maxExecutionHistoryPerProject: 100,
    stepBaseDelayMs: 300,
  },

  // Memory / self-improving system
  memory: {
    maxLogsPerProject: 1000,
    maxLogsReturnedPerQuery: 100,
    patternAnalysisMinLogs: 5,
    insightExtractionEnabled: true,
  },

  // Generation
  generation: {
    previewHtmlMaxChars: 4000,
    fileMaxChars: 800,
    maxFilesPerProject: 10,
  },

  // API version
  version: "1.0.0",
  apiPrefix: "/api",
} as const;

// ── Route paths ────────────────────────────────────────────────────────────────

export const ROUTES = {
  projects:  "/api/projects",
  workflows: "/api/os/workflows",   // /api/workflows is taken by visual studio
  memory:    "/api/os/memory",      // /api/memory is taken by chat memory module
  aiGenerate: "/api/ai/generate",
  aiImprove:  "/api/ai/improve",
} as const;

// ── System prompts ─────────────────────────────────────────────────────────────

export const SYSTEM_PROMPTS = {
  generate: `You are Apex AI OS — an autonomous full-stack application generation engine.

CRITICAL: Return ONLY raw JSON. NO markdown fences. NO backticks. Start immediately with {.

JSON structure:
{
  "plan": {
    "goal": "One sentence goal",
    "features": ["feat 1", "feat 2", "feat 3", "feat 4"],
    "pages": ["Home", "Dashboard"],
    "tech_stack": ["React", "Tailwind CSS", "Node.js"],
    "database_schema": [{ "table": "users", "fields": ["id", "email", "name"] }],
    "api_routes": ["POST /api/auth/login", "GET /api/dashboard/stats"]
  },
  "generated_code": "// Main application code (concise, key components only)",
  "preview_html": "<!DOCTYPE html>...</html>",
  "workflows": [
    {
      "id": "workflow-1",
      "name": "Workflow Name",
      "description": "What this workflow does",
      "triggers": ["Trigger event"],
      "steps": [
        { "id": "s1", "action": "Action description", "output": "Expected output" }
      ],
      "status": "idle",
      "createdAt": "ISO_TIMESTAMP"
    }
  ],
  "summary": "One sentence summary of what was built."
}

PREVIEW HTML RULES:
- Standalone, self-contained <!DOCTYPE html>
- Use: <script src="https://cdn.tailwindcss.com"></script>
- Dark theme: bg #0D0D0D, cards #161B22
- Gold accent #FFCC33
- Working JS interactivity (tabs, buttons, data)
- Realistic placeholder data
- Under 4000 characters total

Keep generated_code under 2000 characters (key structural code only).`,

  improve: `You are Apex AI OS in SELF-IMPROVEMENT MODE.

CRITICAL: Return ONLY raw JSON. No markdown fences. Start with {.

{
  "suggestions": [
    {
      "id": "imp-1",
      "type": "performance" | "security" | "ux" | "code_quality" | "bug_fix" | "workflow_optimization",
      "title": "Short title",
      "description": "Detailed description of the issue and improvement",
      "priority": "high" | "medium" | "low",
      "affectedFile": "optional file path",
      "patch": "optional: the actual code change to apply"
    }
  ],
  "updated_code": "optional: improved generated_code if applying high-priority fixes",
  "summary": "Summary of improvements found and applied."
}

Analyze for: performance, security vulnerabilities, UX issues, code quality, workflow inefficiencies.
Return 3-6 prioritized suggestions. Be specific and actionable.`,
} as const;
