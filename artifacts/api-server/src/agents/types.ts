/**
 * Apex Multi-Agent System — Shared Types
 *
 * All agents implement the AgentInterface.
 * The orchestrator routes tasks to the correct agent using routeTask().
 * Agents communicate via structured AgentOutput → AgentInput handoffs.
 */

// ── Agent identity ─────────────────────────────────────────────────────────────

export type AgentId =
  | "builder"
  | "debug"
  | "ui"
  | "optimizer"
  | "product";

export const AGENT_METADATA: Record<AgentId, { name: string; description: string; icon: string; triggers: string[] }> = {
  builder: {
    name: "Builder Agent",
    description: "Generates full app structures, scaffolds projects, writes code from scratch",
    icon: "🏗️",
    triggers: [
      "build", "create", "generate", "scaffold", "new app", "new project",
      "make a", "build me", "create a", "set up",
    ],
  },
  debug: {
    name: "Debug Agent",
    description: "Analyzes errors, traces root causes, applies targeted fixes",
    icon: "🐛",
    triggers: [
      "fix", "bug", "error", "broken", "crash", "failing", "debug",
      "not working", "issue", "problem", "exception",
    ],
  },
  ui: {
    name: "UI Agent",
    description: "Improves interface design, accessibility, responsiveness, and user experience",
    icon: "🎨",
    triggers: [
      "ui", "ux", "design", "style", "improve ui", "look better",
      "redesign", "layout", "visual", "component", "color", "font",
    ],
  },
  optimizer: {
    name: "Optimizer Agent",
    description: "Improves performance, reduces bundle size, optimizes queries and algorithms",
    icon: "⚡",
    triggers: [
      "optimize", "performance", "slow", "speed", "bundle", "memory",
      "efficient", "faster", "cache", "database query", "load time",
    ],
  },
  product: {
    name: "Product Agent",
    description: "Adds features, plans product roadmaps, implements user stories",
    icon: "🚀",
    triggers: [
      "add feature", "add", "feature", "roadmap", "user story",
      "requirement", "implement", "extend", "enhance", "new feature",
    ],
  },
};

// ── Task input ─────────────────────────────────────────────────────────────────

export interface AgentFile {
  path: string;
  content: string;
  language?: string;
}

export interface AgentTask {
  id: string;
  prompt: string;
  projectId?: number;
  sessionId?: string;
  context?: string;
  files?: AgentFile[];
  priorOutput?: AgentOutput | null;
  metadata?: Record<string, unknown>;
}

// ── Analysis output ────────────────────────────────────────────────────────────

export interface AgentAnalysis {
  taskType: string;
  complexity: "low" | "medium" | "high";
  estimatedSteps: number;
  requiredCapabilities: string[];
  handoffRequired?: AgentId[];
  reasoning: string;
}

// ── Execution result ───────────────────────────────────────────────────────────

export interface AgentChange {
  file: string;
  description: string;
  before?: string;
  after?: string;
}

export interface AgentResult {
  summary: string;
  changes?: AgentChange[];
  suggestions?: string[];
  metrics?: Record<string, number>;
  code?: string;
  nextSteps?: string[];
  data?: Record<string, unknown>;
}

export interface AgentHandoff {
  agentId: AgentId;
  reason: string;
  context: string;
  priority: "required" | "recommended" | "optional";
}

export interface AgentOutput {
  taskId: string;
  agentId: AgentId;
  agentName: string;
  agentIcon: string;
  status: "success" | "error" | "partial" | "handed_off";
  analysis: AgentAnalysis;
  result: AgentResult;
  handoffs?: AgentHandoff[];
  memoryLogId?: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  error?: string;
}

// ── Pipeline ───────────────────────────────────────────────────────────────────

export interface PipelineStep {
  agentId: AgentId;
  reason: string;
}

export interface PipelineResult {
  pipelineId: string;
  task: string;
  steps: AgentOutput[];
  finalOutput: AgentOutput;
  totalDurationMs: number;
  agentsUsed: AgentId[];
  startedAt: string;
  completedAt: string;
}

// ── Route result ───────────────────────────────────────────────────────────────

export interface RouteDecision {
  primaryAgent: AgentId;
  confidence: number;
  reasoning: string;
  pipeline: PipelineStep[];
}

// ── Agent interface contract ───────────────────────────────────────────────────

export interface AgentInterface {
  readonly agentId: AgentId;
  analyze(task: AgentTask): Promise<AgentAnalysis>;
  execute(task: AgentTask): Promise<AgentOutput>;
}
