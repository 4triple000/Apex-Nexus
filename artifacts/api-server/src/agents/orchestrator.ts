/**
 * Apex Multi-Agent Orchestrator
 *
 * The central dispatcher for the multi-agent system.
 *
 * Core functions:
 *   routeTask(task)     — Classify task → dispatch to correct agent
 *   runAgent(id, task)  — Run a specific agent by ID
 *   runPipeline(steps)  — Chain multiple agents, passing output → input
 *   listAgents()        — Describe all registered agents
 *
 * Routing logic:
 *   "build" / "create" / "scaffold"   → builderAgent
 *   "fix" / "bug" / "error"           → debugAgent
 *   "ui" / "design" / "style"         → uiAgent
 *   "optimize" / "performance"        → optimizerAgent
 *   "feature" / "add" / "implement"   → productAgent
 *
 * Agent chaining:
 *   builderAgent  → uiAgent     (polish UI after scaffold)
 *   builderAgent  → debugAgent  (validate generated code)
 *   productAgent  → builderAgent (scaffold after planning)
 *   debugAgent    → optimizerAgent (perf issues found during debug)
 *
 * Memory:
 *   Every routeTask() call logs the routing decision to memory.
 *   Each agent independently logs its own execution.
 */

import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import { log as logMemory } from "../modules/ai-os/services/memoryService";
import { openai } from "@workspace/integrations-openai-ai-server";

import { builderAgent } from "./builderAgent";
import { debugAgent } from "./debugAgent";
import { uiAgent } from "./uiAgent";
import { optimizerAgent } from "./optimizerAgent";
import { productAgent } from "./productAgent";

import {
  AGENT_METADATA,
  type AgentId,
  type AgentTask,
  type AgentOutput,
  type RouteDecision,
  type PipelineResult,
  type PipelineStep,
} from "./types";

// ── Agent registry ─────────────────────────────────────────────────────────────

const AGENT_REGISTRY = {
  builder: builderAgent,
  debug: debugAgent,
  ui: uiAgent,
  optimizer: optimizerAgent,
  product: productAgent,
} as const;

// ── Keyword-based routing table ────────────────────────────────────────────────

const ROUTING_TABLE: Array<{ patterns: RegExp[]; agentId: AgentId; pipeline: AgentId[] }> = [
  {
    agentId: "debug",
    pipeline: ["debug"],
    patterns: [
      /\b(fix|debug|bug|error|crash|broken|failing|exception|not working|issue|problem|undefined|null|traceback|stack trace|regression)\b/i,
    ],
  },
  {
    agentId: "optimizer",
    pipeline: ["optimizer"],
    patterns: [
      /\b(optimi[sz]e|performance|slow|speed up|bundle size|memory leak|cache|faster|latency|query|n\+1)\b/i,
    ],
  },
  {
    agentId: "ui",
    pipeline: ["ui"],
    patterns: [
      /\b(ui|ux|design|style|layout|visual|look|appearance|responsive|mobile|accessibility|dark mode|color|font|spacing|animation|component)\b/i,
    ],
  },
  {
    agentId: "product",
    pipeline: ["product", "builder", "ui"],
    patterns: [
      /\b(add feature|new feature|implement|user stor|requirements|roadmap|enhance|extend|integration|add \w+ feature)\b/i,
    ],
  },
  {
    agentId: "builder",
    pipeline: ["builder", "ui"],
    patterns: [
      /\b(build|create|generate|scaffold|new app|new project|make|set up|initialize|bootstrap)\b/i,
    ],
  },
];

// ── AI-powered fallback classifier ────────────────────────────────────────────

async function classifyWithAI(prompt: string): Promise<RouteDecision> {
  const systemPrompt = `You are the Apex Agent Router. Classify the task and return JSON only — no markdown.

Available agents:
- builder: Build apps from scratch, scaffold components, generate code
- debug: Fix bugs, errors, crashes, find root causes  
- ui: Improve UI/UX, design, accessibility, responsiveness
- optimizer: Performance, speed, bundle size, query optimization
- product: Add features, plan product roadmaps, implement user stories

{
  "primaryAgent": "builder|debug|ui|optimizer|product",
  "confidence": 0.0-1.0,
  "reasoning": "why this agent",
  "pipeline": ["agentId1", "agentId2"]
}

Pipeline rules:
- builder tasks → always end with ui for polish
- product tasks → product then builder then ui
- debug tasks → debug alone or debug then optimizer
- optimizer tasks → optimizer alone or optimizer then debug
- ui tasks → ui alone`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.1,
      max_completion_tokens: 256,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Task: ${prompt}` },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
    const parsed = JSON.parse(json) as RouteDecision;
    return parsed;
  } catch {
    // Fallback to builder
    return {
      primaryAgent: "builder",
      confidence: 0.5,
      reasoning: "Fallback classification — defaulting to builder",
      pipeline: ["builder", "ui"],
    };
  }
}

// ── routeTask — main entry point ───────────────────────────────────────────────

export async function routeTask(
  prompt: string,
  opts: { projectId?: number; sessionId?: string; context?: string; files?: AgentTask["files"]; runPipeline?: boolean } = {}
): Promise<{ decision: RouteDecision; output: AgentOutput; pipeline?: PipelineResult }> {
  const taskId = randomUUID();
  const startedAt = new Date();

  // 1. Keyword routing (fast path, no AI call)
  let decision: RouteDecision | null = null;
  const lower = prompt.toLowerCase();

  for (const rule of ROUTING_TABLE) {
    if (rule.patterns.some((p) => p.test(lower))) {
      decision = {
        primaryAgent: rule.agentId,
        confidence: 0.85,
        reasoning: `Keyword match → ${AGENT_METADATA[rule.agentId].name}`,
        pipeline: rule.pipeline,
      };
      break;
    }
  }

  // 2. AI classification fallback
  if (!decision) {
    decision = await classifyWithAI(prompt);
  }

  logger.info({ taskId, agentId: decision.primaryAgent, confidence: decision.confidence }, "Agent routed");

  // 3. Log routing decision to memory
  try {
    await logMemory({
      projectId: opts.projectId,
      sessionId: opts.sessionId,
      type: "ai_output",
      content: `[Orchestrator] Routed to ${AGENT_METADATA[decision.primaryAgent].name} — "${prompt.slice(0, 100)}"`,
      success: true,
      metadata: {
        taskId,
        decision,
        pipeline: decision.pipeline,
      },
    });
  } catch { /* non-fatal */ }

  // 4. Build the base task
  const baseTask: AgentTask = {
    id: taskId,
    prompt,
    projectId: opts.projectId,
    sessionId: opts.sessionId,
    context: opts.context,
    files: opts.files,
  };

  // 5. Run pipeline or single agent
  if (opts.runPipeline !== false && decision.pipeline.length > 1) {
    const pipeline = await runPipeline(
      decision.pipeline.map((id) => ({ agentId: id, reason: `Orchestrator pipeline` })),
      baseTask
    );
    return { decision, output: pipeline.finalOutput, pipeline };
  }

  // 6. Single agent execution
  const agent = AGENT_REGISTRY[decision.primaryAgent];
  const output = await agent.execute(baseTask);

  return { decision, output };
}

// ── runAgent — run a specific agent by ID ─────────────────────────────────────

export async function runAgent(agentId: AgentId, task: AgentTask): Promise<AgentOutput> {
  const agent = AGENT_REGISTRY[agentId];
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);
  logger.info({ agentId, taskId: task.id }, "Running specific agent");
  return agent.execute(task);
}

// ── runPipeline — chain agents sequentially ────────────────────────────────────

export async function runPipeline(
  steps: PipelineStep[],
  baseTask: AgentTask
): Promise<PipelineResult> {
  const pipelineId = randomUUID();
  const startedAt = new Date();
  const outputs: AgentOutput[] = [];

  logger.info({ pipelineId, steps: steps.map((s) => s.agentId) }, "Pipeline started");

  let currentTask = { ...baseTask };
  let priorOutput: AgentOutput | null = null;

  for (const step of steps) {
    const agent = AGENT_REGISTRY[step.agentId];
    if (!agent) {
      logger.warn({ agentId: step.agentId }, "Unknown agent in pipeline — skipping");
      continue;
    }

    // Pass prior output as context for the next agent
    currentTask = {
      ...currentTask,
      id: randomUUID(),
      priorOutput,
      // Append prior agent's changes as file context for the next agent
      files: priorOutput?.result.changes
        ? [
            ...(currentTask.files ?? []),
            ...priorOutput.result.changes
              .filter((c) => c.after)
              .map((c) => ({ path: c.file, content: c.after!, language: c.file.split(".").pop() })),
          ].slice(0, 6) // cap at 6 files to keep prompts manageable
        : currentTask.files,
    };

    try {
      const output = await agent.execute(currentTask);
      outputs.push(output);
      priorOutput = output;
    } catch (err) {
      logger.error({ err, agentId: step.agentId, pipelineId }, "Agent failed in pipeline");
      // Create error output and continue
      const meta = AGENT_METADATA[step.agentId];
      const errorOutput: AgentOutput = {
        taskId: currentTask.id,
        agentId: step.agentId,
        agentName: meta.name,
        agentIcon: meta.icon,
        status: "error",
        analysis: { taskType: "error", complexity: "low", estimatedSteps: 0, requiredCapabilities: [], reasoning: "Failed" },
        result: { summary: `Agent failed: ${err instanceof Error ? err.message : "unknown error"}` },
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        error: err instanceof Error ? err.message : "unknown error",
      };
      outputs.push(errorOutput);
      // Don't break — continue pipeline with whatever we have
    }
  }

  const completedAt = new Date();
  const finalOutput = outputs[outputs.length - 1] ?? outputs[0];

  // Log pipeline completion
  try {
    await logMemory({
      projectId: baseTask.projectId,
      sessionId: baseTask.sessionId,
      type: "workflow",
      content: `[Orchestrator Pipeline] ${steps.map((s) => AGENT_METADATA[s.agentId].name).join(" → ")} — ${finalOutput?.result.summary ?? "completed"}`,
      success: true,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      metadata: {
        pipelineId,
        agentsUsed: steps.map((s) => s.agentId),
        stepsCompleted: outputs.length,
      },
    });
  } catch { /* non-fatal */ }

  logger.info({ pipelineId, steps: outputs.length, durationMs: completedAt.getTime() - startedAt.getTime() }, "Pipeline complete");

  return {
    pipelineId,
    task: baseTask.prompt,
    steps: outputs,
    finalOutput: finalOutput!,
    totalDurationMs: completedAt.getTime() - startedAt.getTime(),
    agentsUsed: outputs.map((o) => o.agentId),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
}

// ── listAgents — describe all agents ─────────────────────────────────────────

export function listAgents() {
  return Object.entries(AGENT_METADATA).map(([id, meta]) => ({
    id,
    ...meta,
    capabilities: ROUTING_TABLE.find((r) => r.agentId === id as AgentId)?.pipeline ?? [id],
  }));
}
