/**
 * Debug Agent — Apex Multi-Agent System
 *
 * Specialization: Error analysis, root cause identification, surgical bug fixes.
 *
 * analyze() — classifies the error type, severity, and affected scope
 * execute() — traces the error, identifies root cause, applies minimal targeted fix
 *             Hands off to optimizer if performance is root cause,
 *             or uiAgent if the fix affects rendering.
 */

import { BaseAgent } from "./agentBase";
import type { AgentId, AgentTask, AgentAnalysis, AgentOutput, AgentHandoff } from "./types";

const ANALYZE_PROMPT = `You are the Apex Debug Agent analyzer.
Classify the bug/error and return JSON only — no markdown, no backticks.

{
  "taskType": "string (runtime_error|type_error|logic_bug|performance_bug|ui_glitch|network_error|data_error)",
  "complexity": "low|medium|high",
  "estimatedSteps": number,
  "requiredCapabilities": ["root-cause-analysis", "code-patching"],
  "handoffRequired": ["optimizer"] or ["ui"] or [],
  "reasoning": "brief diagnosis"
}`;

const EXECUTE_PROMPT = `You are the Apex Debug Agent — an expert debugger and code surgeon.
Analyze the bug, trace its root cause, and provide a minimal targeted fix.
Return JSON only — no markdown, no backticks.

{
  "summary": "What was wrong and how it was fixed",
  "rootCause": "The specific root cause of the bug",
  "errorType": "runtime_error|type_error|logic_bug|performance_bug|ui_glitch|network_error",
  "severity": "critical|high|medium|low",
  "changes": [
    {
      "file": "src/path/to/file.ts",
      "description": "What was changed and why",
      "before": "the buggy code snippet",
      "after": "the fixed code snippet"
    }
  ],
  "suggestions": ["how to prevent this class of bug in future"],
  "nextSteps": ["recommended follow-up actions"],
  "metrics": {
    "linesChanged": 0,
    "filesAffected": 0,
    "confidenceScore": 0
  }
}

Rules:
- Make the MINIMAL change that fixes the root cause
- Never rewrite files that are not broken
- Explain the root cause clearly
- Include before/after for every fix
- Confidence score 0-100`;

export class DebugAgent extends BaseAgent {
  readonly agentId: AgentId = "debug";

  async analyze(task: AgentTask): Promise<AgentAnalysis> {
    const prompt = [
      `Error/Bug report: ${task.prompt}`,
      task.context ? `Context: ${task.context}` : "",
      task.files?.length ? `Files: ${task.files.length} provided` : "",
    ].filter(Boolean).join("\n");

    const raw = await this.callAIJson<AgentAnalysis>(ANALYZE_PROMPT, prompt, { temperature: 0.2 });
    return {
      taskType: raw.taskType ?? "runtime_error",
      complexity: raw.complexity ?? "medium",
      estimatedSteps: raw.estimatedSteps ?? 3,
      requiredCapabilities: raw.requiredCapabilities ?? ["root-cause-analysis", "code-patching"],
      handoffRequired: (raw.handoffRequired ?? []) as AgentId[],
      reasoning: raw.reasoning ?? "Bug analysis started",
    };
  }

  async execute(task: AgentTask): Promise<AgentOutput> {
    const startedAt = new Date();

    const analysis = await this.analyze(task);

    const fileContext = task.files?.map((f) =>
      `// FILE: ${f.path}\n${f.content.slice(0, 800)}`
    ).join("\n\n---\n\n") ?? "";

    const userPrompt = [
      `Bug/Error: ${task.prompt}`,
      task.context ? `Additional context: ${task.context}` : "",
      fileContext ? `Code to debug:\n${fileContext}` : "",
      task.priorOutput ? `Builder agent previously created: ${task.priorOutput.result.summary}` : "",
    ].filter(Boolean).join("\n\n");

    const raw = await this.callAIJson<{
      summary: string;
      rootCause: string;
      errorType: string;
      severity: string;
      changes: Array<{ file: string; description: string; before: string; after: string }>;
      suggestions: string[];
      nextSteps: string[];
      metrics: Record<string, number>;
    }>(EXECUTE_PROMPT, userPrompt, { temperature: 0.2, maxTokens: 4096 });

    const handoffs: AgentHandoff[] = [];

    if (analysis.handoffRequired?.includes("optimizer")) {
      handoffs.push({
        agentId: "optimizer",
        reason: "Root cause is performance-related — needs optimization",
        context: `Debug found performance issue: ${raw.rootCause ?? "unknown"}`,
        priority: "recommended",
      });
    }
    if (analysis.handoffRequired?.includes("ui")) {
      handoffs.push({
        agentId: "ui",
        reason: "Fix affects UI rendering — needs visual validation",
        context: `Debug changed UI code: ${raw.changes?.[0]?.file ?? "unknown file"}`,
        priority: "optional",
      });
    }

    const memoryLogId = await this.log(
      task,
      `Fixed: ${raw.summary ?? "bug resolved"}. Root cause: ${raw.rootCause ?? "unknown"}`,
      true,
      Date.now() - startedAt.getTime(),
      {
        errorType: raw.errorType,
        severity: raw.severity,
        filesAffected: raw.changes?.length ?? 0,
        rootCause: raw.rootCause,
      }
    );

    return this.buildOutput(task, analysis, {
      summary: raw.summary ?? "Bug fixed",
      changes: raw.changes ?? [],
      suggestions: raw.suggestions ?? [],
      nextSteps: raw.nextSteps ?? [],
      metrics: raw.metrics ?? {},
      data: {
        rootCause: raw.rootCause,
        errorType: raw.errorType,
        severity: raw.severity,
      },
    }, {
      status: handoffs.length > 0 ? "handed_off" : "success",
      handoffs,
      memoryLogId,
      startedAt,
    });
  }
}

export const debugAgent = new DebugAgent();
