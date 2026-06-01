/**
 * UI Agent — Apex Multi-Agent System
 *
 * Specialization: Interface design, accessibility, responsiveness, visual polish.
 *
 * analyze() — identifies UI issues, design system gaps, a11y problems
 * execute() — rewrites/patches UI components with improved design, animations,
 *             proper spacing, color contrast, and responsive breakpoints.
 *             Hands off to debugAgent if broken after changes.
 */

import { BaseAgent } from "./agentBase";
import type { AgentId, AgentTask, AgentAnalysis, AgentOutput, AgentHandoff } from "./types";

const ANALYZE_PROMPT = `You are the Apex UI Agent analyzer.
Classify the UI improvement task and return JSON only — no markdown, no backticks.

{
  "taskType": "string (visual_design|accessibility|responsive|animation|component_refactor|design_system|dark_mode)",
  "complexity": "low|medium|high",
  "estimatedSteps": number,
  "requiredCapabilities": ["tailwind", "accessibility", "design-systems"],
  "handoffRequired": ["debug"] or [],
  "reasoning": "brief design assessment"
}`;

const EXECUTE_PROMPT = `You are the Apex UI Agent — an expert UI/UX designer and frontend developer.
Improve the user interface with modern design principles, accessibility, and responsiveness.
Return JSON only — no markdown, no backticks.

Design principles to apply:
- Dark mode first: background #0D0D0D, surface #111, border #1C1C1E
- Gold accent: #FFCC33 for primary actions
- Clean typography: Inter font, proper hierarchy
- Micro-interactions: hover states, transitions, subtle animations
- Accessibility: ARIA labels, keyboard nav, focus rings, contrast ≥ 4.5:1
- Responsive: mobile-first, sm/md/lg/xl breakpoints

{
  "summary": "What UI improvements were made",
  "designDecisions": ["list of key design choices and why"],
  "changes": [
    {
      "file": "src/components/MyComponent.tsx",
      "description": "What was changed and the design rationale",
      "before": "old code snippet",
      "after": "improved code with Tailwind classes and accessibility"
    }
  ],
  "suggestions": ["additional UI improvements for future"],
  "nextSteps": ["what to address next"],
  "metrics": {
    "componentsImproved": 0,
    "accessibilityFixes": 0,
    "responsiveBreakpoints": 0
  }
}`;

export class UIAgent extends BaseAgent {
  readonly agentId: AgentId = "ui";

  async analyze(task: AgentTask): Promise<AgentAnalysis> {
    const prompt = [
      `UI task: ${task.prompt}`,
      task.context ? `Context: ${task.context}` : "",
      task.priorOutput ? `Prior work: ${task.priorOutput.result.summary}` : "",
    ].filter(Boolean).join("\n");

    const raw = await this.callAIJson<AgentAnalysis>(ANALYZE_PROMPT, prompt, { temperature: 0.3 });
    return {
      taskType: raw.taskType ?? "visual_design",
      complexity: raw.complexity ?? "medium",
      estimatedSteps: raw.estimatedSteps ?? 3,
      requiredCapabilities: raw.requiredCapabilities ?? ["tailwind", "accessibility"],
      handoffRequired: (raw.handoffRequired ?? []) as AgentId[],
      reasoning: raw.reasoning ?? "UI improvement identified",
    };
  }

  async execute(task: AgentTask): Promise<AgentOutput> {
    const startedAt = new Date();

    const analysis = await this.analyze(task);

    const fileContext = task.files?.slice(0, 4)
      .map((f) => `// ${f.path}\n${f.content.slice(0, 700)}`)
      .join("\n\n---\n\n") ?? "";

    const priorSummary = task.priorOutput?.result.summary ?? "";
    const priorChanges = (task.priorOutput?.result.changes ?? [])
      .slice(0, 2)
      .map((c) => `${c.file}: ${c.description}`)
      .join("\n");

    const userPrompt = [
      `UI improvement request: ${task.prompt}`,
      task.context ? `Design context: ${task.context}` : "",
      priorSummary ? `Previously built by Builder Agent: ${priorSummary}` : "",
      priorChanges ? `Files to improve:\n${priorChanges}` : "",
      fileContext ? `Current code:\n${fileContext}` : "",
    ].filter(Boolean).join("\n\n");

    const raw = await this.callAIJson<{
      summary: string;
      designDecisions: string[];
      changes: Array<{ file: string; description: string; before: string; after: string }>;
      suggestions: string[];
      nextSteps: string[];
      metrics: Record<string, number>;
    }>(EXECUTE_PROMPT, userPrompt, { temperature: 0.7, maxTokens: 5000 });

    const handoffs: AgentHandoff[] = [];

    if (analysis.handoffRequired?.includes("debug")) {
      handoffs.push({
        agentId: "debug",
        reason: "Verify UI changes did not break functionality",
        context: `UI agent modified ${raw.changes?.length ?? 0} components. Check for broken event handlers or state issues.`,
        priority: "optional",
      });
    }

    const memoryLogId = await this.log(
      task,
      `UI improved: ${raw.summary ?? "components polished"}`,
      true,
      Date.now() - startedAt.getTime(),
      {
        componentsImproved: raw.changes?.length ?? 0,
        designDecisions: raw.designDecisions?.length ?? 0,
      }
    );

    return this.buildOutput(task, analysis, {
      summary: raw.summary ?? "UI improvements applied",
      changes: raw.changes ?? [],
      suggestions: raw.suggestions ?? [],
      nextSteps: raw.nextSteps ?? [],
      metrics: raw.metrics ?? {},
      data: { designDecisions: raw.designDecisions ?? [] },
    }, {
      status: handoffs.length > 0 ? "handed_off" : "success",
      handoffs,
      memoryLogId,
      startedAt,
    });
  }
}

export const uiAgent = new UIAgent();
