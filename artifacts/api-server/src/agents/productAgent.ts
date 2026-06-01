/**
 * Product Agent — Apex Multi-Agent System
 *
 * Specialization: Feature planning, user story implementation, product roadmaps,
 *                 requirements analysis, feature extensions.
 *
 * analyze() — breaks down the feature request into user stories and tasks
 * execute() — plans the feature, writes implementation code, creates workflows
 *             Hands off to builderAgent for scaffolding or uiAgent for new UI.
 */

import { BaseAgent } from "./agentBase";
import type { AgentId, AgentTask, AgentAnalysis, AgentOutput, AgentHandoff } from "./types";

const ANALYZE_PROMPT = `You are the Apex Product Agent analyzer.
Break down the feature request and return JSON only — no markdown, no backticks.

{
  "taskType": "string (new_feature|enhancement|user_story|api_extension|integration|workflow)",
  "complexity": "low|medium|high",
  "estimatedSteps": number,
  "requiredCapabilities": ["product-planning", "feature-design", "api-design"],
  "handoffRequired": ["builder"|"ui"] or [],
  "reasoning": "brief product assessment and user value proposition"
}`;

const EXECUTE_PROMPT = `You are the Apex Product Agent — a senior product manager and full-stack engineer.
Break down feature requests into user stories, plan the implementation, and write the code.
Return JSON only — no markdown, no backticks.

{
  "summary": "What feature was planned and implemented",
  "userStories": [
    {
      "as": "a user",
      "iWant": "to be able to...",
      "soThat": "I can...",
      "acceptanceCriteria": ["criterion 1", "criterion 2"]
    }
  ],
  "featurePlan": {
    "overview": "high-level implementation approach",
    "components": ["list of components/modules to create or modify"],
    "dataModel": ["any new DB tables or fields needed"],
    "apiRoutes": ["new API endpoints needed"],
    "workflows": ["automated workflows to create"]
  },
  "changes": [
    {
      "file": "src/path/to/file.ts",
      "description": "What this implements",
      "after": "full implementation"
    }
  ],
  "suggestions": ["product improvements for the next iteration"],
  "nextSteps": ["follow-up features to consider"],
  "metrics": {
    "userStoriesImplemented": 0,
    "apiRoutesAdded": 0,
    "componentsCreated": 0,
    "estimatedDevHours": 0
  }
}`;

export class ProductAgent extends BaseAgent {
  readonly agentId: AgentId = "product";

  async analyze(task: AgentTask): Promise<AgentAnalysis> {
    const prompt = [
      `Feature request: ${task.prompt}`,
      task.context ? `Product context: ${task.context}` : "",
      task.priorOutput ? `Existing system: ${task.priorOutput.result.summary}` : "",
    ].filter(Boolean).join("\n");

    const raw = await this.callAIJson<AgentAnalysis>(ANALYZE_PROMPT, prompt, { temperature: 0.4 });
    return {
      taskType: raw.taskType ?? "new_feature",
      complexity: raw.complexity ?? "medium",
      estimatedSteps: raw.estimatedSteps ?? 4,
      requiredCapabilities: raw.requiredCapabilities ?? ["product-planning", "implementation"],
      handoffRequired: (raw.handoffRequired ?? ["builder"]) as AgentId[],
      reasoning: raw.reasoning ?? "Feature request analyzed",
    };
  }

  async execute(task: AgentTask): Promise<AgentOutput> {
    const startedAt = new Date();

    const analysis = await this.analyze(task);

    const existingContext = task.files?.slice(0, 3)
      .map((f) => `// ${f.path}\n${f.content.slice(0, 400)}`)
      .join("\n\n") ?? "";

    const priorContext = task.priorOutput
      ? `Prior output from ${task.priorOutput.agentName}: ${task.priorOutput.result.summary}`
      : "";

    const userPrompt = [
      `Feature request: ${task.prompt}`,
      task.context ? `Product context: ${task.context}` : "",
      priorContext,
      existingContext ? `Existing codebase:\n${existingContext}` : "",
    ].filter(Boolean).join("\n\n");

    const raw = await this.callAIJson<{
      summary: string;
      userStories: Array<{
        as: string;
        iWant: string;
        soThat: string;
        acceptanceCriteria: string[];
      }>;
      featurePlan: {
        overview: string;
        components: string[];
        dataModel: string[];
        apiRoutes: string[];
        workflows: string[];
      };
      changes: Array<{ file: string; description: string; after: string }>;
      suggestions: string[];
      nextSteps: string[];
      metrics: Record<string, number>;
    }>(EXECUTE_PROMPT, userPrompt, { temperature: 0.6, maxTokens: 6000 });

    const handoffs: AgentHandoff[] = [];

    if (analysis.handoffRequired?.includes("builder")) {
      handoffs.push({
        agentId: "builder",
        reason: "Scaffold the new feature components and API routes",
        context: `Product agent planned: ${raw.featurePlan?.overview ?? "new feature"}. Components: ${raw.featurePlan?.components?.join(", ") ?? "TBD"}`,
        priority: "required",
      });
    }
    if (analysis.handoffRequired?.includes("ui")) {
      handoffs.push({
        agentId: "ui",
        reason: "Design the UI for the new feature",
        context: `New UI components needed: ${raw.featurePlan?.components?.slice(0, 3).join(", ") ?? "TBD"}`,
        priority: "recommended",
      });
    }

    const memoryLogId = await this.log(
      task,
      `Feature planned: ${raw.summary ?? "feature"}. Stories: ${raw.userStories?.length ?? 0}`,
      true,
      Date.now() - startedAt.getTime(),
      {
        userStoriesCount: raw.userStories?.length ?? 0,
        apiRoutesPlanned: raw.featurePlan?.apiRoutes?.length ?? 0,
        complexity: analysis.complexity,
      }
    );

    return this.buildOutput(task, analysis, {
      summary: raw.summary ?? "Feature planned and implemented",
      changes: (raw.changes ?? []).map((c) => ({
        file: c.file,
        description: c.description,
        after: c.after,
      })),
      suggestions: raw.suggestions ?? [],
      nextSteps: raw.nextSteps ?? [],
      metrics: raw.metrics ?? {},
      data: {
        userStories: raw.userStories ?? [],
        featurePlan: raw.featurePlan ?? {},
      },
    }, {
      status: handoffs.length > 0 ? "handed_off" : "success",
      handoffs,
      memoryLogId,
      startedAt,
    });
  }
}

export const productAgent = new ProductAgent();
