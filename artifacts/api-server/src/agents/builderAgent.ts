/**
 * Builder Agent — Apex Multi-Agent System
 *
 * Specialization: App scaffolding, full-stack code generation, project setup.
 *
 * analyze() — classifies the build task, identifies complexity, recommends pipeline
 * execute() — generates project structure, components, API routes, and wires handoffs
 *             to uiAgent (for polish) and debugAgent (for validation)
 */

import { randomUUID } from "crypto";
import { BaseAgent } from "./agentBase";
import type { AgentId, AgentTask, AgentAnalysis, AgentOutput, AgentHandoff } from "./types";

const ANALYZE_PROMPT = `You are the Apex Builder Agent analyzer.
Analyze the build task and return JSON only — no markdown, no backticks.

{
  "taskType": "string (scaffold|api|component|fullstack|database|auth)",
  "complexity": "low|medium|high",
  "estimatedSteps": number,
  "requiredCapabilities": ["list of capabilities needed"],
  "handoffRequired": ["ui"|"debug"|"optimizer"|"product"] or [],
  "reasoning": "brief explanation"
}`;

const EXECUTE_PROMPT = `You are the Apex Builder Agent — a full-stack code generation engine.
Generate a structured implementation plan and code for the requested build task.
Return JSON only — no markdown, no backticks.

{
  "summary": "What was built",
  "changes": [
    {
      "file": "src/components/MyComponent.tsx",
      "description": "What this file does",
      "after": "full file content here"
    }
  ],
  "suggestions": ["list of recommended next steps"],
  "nextSteps": ["what the product agent should implement next"],
  "metrics": {
    "filesGenerated": 0,
    "linesOfCode": 0,
    "componentsCreated": 0
  }
}

Rules:
- Generate real, working code — no placeholders
- Use React + TypeScript + Tailwind CSS
- Include proper imports and type annotations
- Keep components under 200 lines
- Return at most 5 files per call`;

export class BuilderAgent extends BaseAgent {
  readonly agentId: AgentId = "builder";

  async analyze(task: AgentTask): Promise<AgentAnalysis> {
    const prompt = `Task: ${task.prompt}\n\nContext: ${task.context ?? "none"}\n\nFiles: ${task.files?.length ?? 0} existing files`;
    const raw = await this.callAIJson<AgentAnalysis>(ANALYZE_PROMPT, prompt, { temperature: 0.3 });
    return {
      taskType: raw.taskType ?? "fullstack",
      complexity: raw.complexity ?? "medium",
      estimatedSteps: raw.estimatedSteps ?? 4,
      requiredCapabilities: raw.requiredCapabilities ?? ["scaffolding", "code-generation"],
      handoffRequired: (raw.handoffRequired ?? ["ui"]) as AgentId[],
      reasoning: raw.reasoning ?? "Build task identified",
    };
  }

  async execute(task: AgentTask): Promise<AgentOutput> {
    const startedAt = new Date();

    const analysis = await this.analyze(task);

    const fileContext = task.files?.slice(0, 3)
      .map((f) => `// ${f.path}\n${f.content.slice(0, 500)}`)
      .join("\n\n") ?? "";

    const userPrompt = [
      `Build task: ${task.prompt}`,
      task.context ? `Project context: ${task.context}` : "",
      fileContext ? `Existing files:\n${fileContext}` : "",
      task.priorOutput ? `Prior agent output: ${task.priorOutput.result.summary}` : "",
    ].filter(Boolean).join("\n\n");

    const raw = await this.callAIJson<{
      summary: string;
      changes: Array<{ file: string; description: string; after: string }>;
      suggestions: string[];
      nextSteps: string[];
      metrics: Record<string, number>;
    }>(EXECUTE_PROMPT, userPrompt, { temperature: 0.6, maxTokens: 6000 });

    const handoffs: AgentHandoff[] = [];

    if (analysis.handoffRequired?.includes("ui")) {
      handoffs.push({
        agentId: "ui",
        reason: "Apply UI polish and ensure consistent design system",
        context: `Builder created ${raw.changes?.length ?? 0} files. Apply styling, accessibility, and visual consistency.`,
        priority: "recommended",
      });
    }
    if (analysis.handoffRequired?.includes("debug")) {
      handoffs.push({
        agentId: "debug",
        reason: "Validate generated code and fix potential issues",
        context: `Validate the generated code for correctness, missing imports, and type errors.`,
        priority: "optional",
      });
    }

    const memoryLogId = await this.log(
      task,
      `Built: ${raw.summary ?? "app scaffold"}. Files: ${raw.changes?.length ?? 0}`,
      true,
      Date.now() - startedAt.getTime(),
      { filesGenerated: raw.changes?.length ?? 0, complexity: analysis.complexity }
    );

    return this.buildOutput(task, analysis, {
      summary: raw.summary ?? "App scaffold generated",
      changes: (raw.changes ?? []).map((c) => ({
        file: c.file,
        description: c.description,
        after: c.after,
      })),
      suggestions: raw.suggestions ?? [],
      nextSteps: raw.nextSteps ?? [],
      metrics: raw.metrics ?? { filesGenerated: raw.changes?.length ?? 0 },
    }, {
      status: handoffs.length > 0 ? "handed_off" : "success",
      handoffs,
      memoryLogId,
      startedAt,
    });
  }
}

export const builderAgent = new BuilderAgent();
