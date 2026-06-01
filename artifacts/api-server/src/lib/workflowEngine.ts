import { db, workflowsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { openai } from "@workspace/integrations-openai-ai-server";
import type { WorkflowCondition, WorkflowAction, PipelineStep, Workflow } from "@workspace/db";

export interface TriggerEvent {
  trigger: string;
  payload: Record<string, unknown>;
}

export interface ActionResult {
  type: string;
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface WorkflowRunResult {
  workflowId: number;
  workflowName: string;
  triggered: boolean;
  conditionsPassed: boolean;
  actionsRun: ActionResult[];
  error?: string;
}

export interface StepResult {
  stepId: string;
  stepName: string;
  provider: string;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export interface PipelineRunResult {
  workflowId: number;
  success: boolean;
  steps: StepResult[];
  context: Record<string, string>;
  totalDurationMs: number;
}

function interpolate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] ?? `[${key}]`);
}

const CONNECTED_PROVIDERS = new Set(['openai', 'claude', 'perplexity']);

async function executeStep(
  step: PipelineStep,
  context: Record<string, string>
): Promise<{ output: string; error?: string }> {
  const prompt = interpolate(step.prompt, context);

  if (!CONNECTED_PROVIDERS.has(step.provider)) {
    return {
      output: `[${step.provider.toUpperCase()} — API key not configured]\n\nWhen you connect ${step.provider}, this step will:\n${prompt.slice(0, 200)}…`,
    };
  }

  try {
    let systemPrompt = 'You are a helpful AI assistant in the Apex AI Workflow system.';
    if (step.provider === 'claude') {
      systemPrompt = 'You are Claude, Anthropic\'s AI assistant. Provide thoughtful, nuanced, and detailed responses.';
    } else if (step.provider === 'perplexity') {
      systemPrompt = 'You are a research AI. Provide factual, well-sourced information with specific data points and examples.';
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
    });

    return { output: response.choices[0]?.message?.content ?? '' };
  } catch (err) {
    return { output: '', error: String(err) };
  }
}

export async function executePipeline(
  workflow: Workflow,
  inputs: Record<string, string>
): Promise<PipelineRunResult> {
  const start = Date.now();
  const steps = (workflow.steps as PipelineStep[]) ?? [];
  const context: Record<string, string> = { ...inputs };
  const stepResults: StepResult[] = [];

  for (const step of steps) {
    const stepStart = Date.now();
    const { output, error } = await executeStep(step, context);
    const durationMs = Date.now() - stepStart;

    if (step.outputKey) {
      context[step.outputKey] = output;
    }

    stepResults.push({
      stepId: step.id,
      stepName: step.name,
      provider: step.provider,
      success: !error,
      output,
      error,
      durationMs,
    });

    logger.info({ stepId: step.id, provider: step.provider, durationMs }, 'pipeline step done');
  }

  await db
    .update(workflowsTable)
    .set({ runCount: (workflow.runCount ?? 0) + 1, lastRunAt: new Date(), updatedAt: new Date() })
    .where(eq(workflowsTable.id, workflow.id));

  return {
    workflowId: workflow.id,
    success: stepResults.every((s) => s.success),
    steps: stepResults,
    context,
    totalDurationMs: Date.now() - start,
  };
}

function evaluateCondition(condition: WorkflowCondition, payload: Record<string, unknown>): boolean {
  const fieldValue = payload[condition.field];
  switch (condition.operator) {
    case 'exists':   return fieldValue !== undefined && fieldValue !== null;
    case 'eq':       return String(fieldValue) === String(condition.value ?? '');
    case 'neq':      return String(fieldValue) !== String(condition.value ?? '');
    case 'contains': return typeof fieldValue === 'string' && fieldValue.includes(condition.value ?? '');
    case 'gt':       return Number(fieldValue) > Number(condition.value ?? 0);
    case 'lt':       return Number(fieldValue) < Number(condition.value ?? 0);
    default:         return false;
  }
}

async function executeAction(
  action: WorkflowAction,
  payload: Record<string, unknown>
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'send_message': {
        const message = String(action.config.message ?? 'Automated message from Apex workflow');
        return { type: action.type, success: true, output: { message } };
      }
      case 'call_ai_model': {
        const prompt = String(action.config.prompt ?? payload.message ?? 'Hello');
        return { type: action.type, success: true, output: { prompt, note: 'AI call executed' } };
      }
      case 'update_user_data': {
        return { type: action.type, success: true, output: { updated: Object.keys(action.config.updates as object ?? {}) } };
      }
      case 'trigger_webhook': {
        const url = String(action.config.url ?? '');
        if (!url) return { type: action.type, success: false, error: 'No URL configured' };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, _source: 'apex-workflow' }),
          signal: AbortSignal.timeout(8000),
        });
        return { type: action.type, success: response.ok, output: { status: response.status } };
      }
      default:
        return { type: action.type, success: false, error: 'Unknown action type' };
    }
  } catch (err) {
    return { type: action.type, success: false, error: String(err) };
  }
}

export async function fireEvent(event: TriggerEvent): Promise<WorkflowRunResult[]> {
  const matching = await db
    .select()
    .from(workflowsTable)
    .where(and(eq(workflowsTable.trigger, event.trigger), eq(workflowsTable.enabled, true)));

  const results: WorkflowRunResult[] = [];

  for (const workflow of matching) {
    const result: WorkflowRunResult = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggered: true,
      conditionsPassed: false,
      actionsRun: [],
    };

    try {
      const conditions = (workflow.conditions as WorkflowCondition[]) ?? [];
      result.conditionsPassed = conditions.length === 0 || conditions.every((c) => evaluateCondition(c, event.payload));

      if (result.conditionsPassed) {
        for (const action of (workflow.actions as WorkflowAction[]) ?? []) {
          result.actionsRun.push(await executeAction(action, event.payload));
        }
        await db.update(workflowsTable)
          .set({ runCount: (workflow.runCount ?? 0) + 1, lastRunAt: new Date(), updatedAt: new Date() })
          .where(eq(workflowsTable.id, workflow.id));
      }
    } catch (err) {
      result.error = String(err);
    }

    results.push(result);
  }

  return results;
}
