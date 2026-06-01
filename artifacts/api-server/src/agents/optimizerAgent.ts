/**
 * Optimizer Agent — Apex Multi-Agent System
 *
 * Specialization: Performance optimization, bundle reduction, query tuning,
 *                 algorithm improvements, caching strategies.
 *
 * analyze() — profiles the performance bottlenecks and categorizes them
 * execute() — applies targeted optimizations, measures impact, suggests caching
 *             and lazy-loading strategies. Does NOT change behavior — only speed.
 */

import { BaseAgent } from "./agentBase";
import type { AgentId, AgentTask, AgentAnalysis, AgentOutput, AgentHandoff } from "./types";

const ANALYZE_PROMPT = `You are the Apex Optimizer Agent analyzer.
Classify the performance issue and return JSON only — no markdown, no backticks.

{
  "taskType": "string (bundle_size|render_perf|db_query|api_latency|memory_leak|algorithm|caching)",
  "complexity": "low|medium|high",
  "estimatedSteps": number,
  "requiredCapabilities": ["profiling", "caching", "code-splitting", "query-optimization"],
  "handoffRequired": ["debug"] or [],
  "reasoning": "brief performance assessment"
}`;

const EXECUTE_PROMPT = `You are the Apex Optimizer Agent — a performance engineering expert.
Analyze performance bottlenecks and apply targeted optimizations WITHOUT changing behavior.
Return JSON only — no markdown, no backticks.

Optimization strategies to consider:
- React: memo(), useMemo(), useCallback(), lazy(), Suspense
- Bundle: code-splitting, tree-shaking, dynamic imports
- DB: index hints, query restructuring, pagination, connection pooling
- API: response caching, ETags, compression, batching
- Algorithms: O(n) → O(log n), memoization, reduce re-computation
- Assets: lazy loading, image optimization, prefetching

{
  "summary": "What was optimized and expected performance gain",
  "bottlenecks": [
    {
      "area": "where the bottleneck is",
      "currentBehavior": "what is slow/inefficient",
      "estimatedImpact": "high|medium|low",
      "fixApplied": "what optimization was applied"
    }
  ],
  "changes": [
    {
      "file": "src/path/to/file.ts",
      "description": "Optimization applied",
      "before": "unoptimized code",
      "after": "optimized code"
    }
  ],
  "suggestions": ["further optimizations to consider"],
  "nextSteps": ["monitoring and measurement recommendations"],
  "metrics": {
    "estimatedSpeedupPercent": 0,
    "bundleReductionKb": 0,
    "queriesOptimized": 0,
    "filesChanged": 0
  }
}`;

export class OptimizerAgent extends BaseAgent {
  readonly agentId: AgentId = "optimizer";

  async analyze(task: AgentTask): Promise<AgentAnalysis> {
    const prompt = [
      `Performance issue: ${task.prompt}`,
      task.context ? `System context: ${task.context}` : "",
      task.files?.length ? `${task.files.length} files provided for analysis` : "",
    ].filter(Boolean).join("\n");

    const raw = await this.callAIJson<AgentAnalysis>(ANALYZE_PROMPT, prompt, { temperature: 0.2 });
    return {
      taskType: raw.taskType ?? "render_perf",
      complexity: raw.complexity ?? "medium",
      estimatedSteps: raw.estimatedSteps ?? 3,
      requiredCapabilities: raw.requiredCapabilities ?? ["profiling", "optimization"],
      handoffRequired: (raw.handoffRequired ?? []) as AgentId[],
      reasoning: raw.reasoning ?? "Performance bottleneck identified",
    };
  }

  async execute(task: AgentTask): Promise<AgentOutput> {
    const startedAt = new Date();

    const analysis = await this.analyze(task);

    const fileContext = task.files?.slice(0, 4)
      .map((f) => `// ${f.path}\n${f.content.slice(0, 600)}`)
      .join("\n\n---\n\n") ?? "";

    const userPrompt = [
      `Performance optimization task: ${task.prompt}`,
      task.context ? `System context: ${task.context}` : "",
      fileContext ? `Code to optimize:\n${fileContext}` : "",
      task.priorOutput ? `Prior agent summary: ${task.priorOutput.result.summary}` : "",
    ].filter(Boolean).join("\n\n");

    const raw = await this.callAIJson<{
      summary: string;
      bottlenecks: Array<{
        area: string;
        currentBehavior: string;
        estimatedImpact: string;
        fixApplied: string;
      }>;
      changes: Array<{ file: string; description: string; before: string; after: string }>;
      suggestions: string[];
      nextSteps: string[];
      metrics: Record<string, number>;
    }>(EXECUTE_PROMPT, userPrompt, { temperature: 0.3, maxTokens: 5000 });

    const handoffs: AgentHandoff[] = [];

    if (analysis.handoffRequired?.includes("debug")) {
      handoffs.push({
        agentId: "debug",
        reason: "Verify optimizations did not break existing functionality",
        context: `Optimizer changed ${raw.changes?.length ?? 0} files. Validate no regressions.`,
        priority: "optional",
      });
    }

    const memoryLogId = await this.log(
      task,
      `Optimized: ${raw.summary ?? "performance improved"}. Bottlenecks: ${raw.bottlenecks?.length ?? 0}`,
      true,
      Date.now() - startedAt.getTime(),
      {
        estimatedSpeedupPercent: raw.metrics?.estimatedSpeedupPercent,
        bottlenecksFound: raw.bottlenecks?.length ?? 0,
        filesChanged: raw.changes?.length ?? 0,
      }
    );

    return this.buildOutput(task, analysis, {
      summary: raw.summary ?? "Performance optimized",
      changes: raw.changes ?? [],
      suggestions: raw.suggestions ?? [],
      nextSteps: raw.nextSteps ?? [],
      metrics: raw.metrics ?? {},
      data: { bottlenecks: raw.bottlenecks ?? [] },
    }, {
      status: handoffs.length > 0 ? "handed_off" : "success",
      handoffs,
      memoryLogId,
      startedAt,
    });
  }
}

export const optimizerAgent = new OptimizerAgent();
