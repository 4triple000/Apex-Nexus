/**
 * Apex Multi-Agent System — Base Agent
 *
 * All agents extend this class. Provides:
 *   - callAI()      — Structured AI completion with JSON parsing
 *   - logMemory()   — Write action to the memory system
 *   - buildOutput() — Create a consistent AgentOutput envelope
 *   - elapsed()     — Track duration
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import { log as logMemory } from "../modules/ai-os/services/memoryService";
import type {
  AgentId,
  AgentTask,
  AgentAnalysis,
  AgentOutput,
  AgentResult,
  AgentHandoff,
  AgentInterface,
} from "./types";
import { AGENT_METADATA } from "./types";

const MODEL = "gpt-5.2";

export abstract class BaseAgent implements AgentInterface {
  abstract readonly agentId: AgentId;

  // ── AI call ────────────────────────────────────────────────────────────────

  protected async callAI(
    systemPrompt: string,
    userPrompt: string,
    opts: { temperature?: number; maxTokens?: number } = {}
  ): Promise<string> {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: opts.temperature ?? 0.7,
      max_completion_tokens: opts.maxTokens ?? 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    });
    return response.choices[0]?.message?.content ?? "";
  }

  // ── JSON AI call ───────────────────────────────────────────────────────────

  protected async callAIJson<T = unknown>(
    systemPrompt: string,
    userPrompt: string,
    opts: { temperature?: number; maxTokens?: number } = {}
  ): Promise<T> {
    const raw = await this.callAI(systemPrompt, userPrompt, opts);
    return this.extractJson<T>(raw);
  }

  // ── JSON extraction with 4-layer fallback ─────────────────────────────────

  protected extractJson<T = unknown>(raw: string): T {
    // Layer 1: direct parse
    try { return JSON.parse(raw) as T; } catch { /* continue */ }
    // Layer 2: fenced block
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) { try { return JSON.parse(fence[1]!) as T; } catch { /* continue */ } }
    // Layer 3: first brace-to-brace
    const brace = raw.match(/\{[\s\S]*\}/);
    if (brace) { try { return JSON.parse(brace[0]) as T; } catch { /* continue */ } }
    // Layer 4: strip control chars
    const cleaned = raw.replace(/[\x00-\x1F\x7F]/g, " ");
    const brace2 = cleaned.match(/\{[\s\S]*\}/);
    if (brace2) { try { return JSON.parse(brace2[0]) as T; } catch { /* continue */ } }
    throw new Error(`Could not parse JSON from: ${raw.slice(0, 100)}`);
  }

  // ── Memory logging ─────────────────────────────────────────────────────────

  protected async log(
    task: AgentTask,
    content: string,
    success: boolean,
    durationMs: number,
    metadata?: Record<string, unknown>
  ): Promise<number | undefined> {
    try {
      const entry = await logMemory({
        projectId: task.projectId,
        sessionId: task.sessionId,
        type: "ai_output",
        content: `[${AGENT_METADATA[this.agentId].name}] ${content}`,
        success,
        durationMs,
        metadata: {
          agentId: this.agentId,
          taskId: task.id,
          prompt: task.prompt.slice(0, 200),
          ...metadata,
        },
      });
      return entry.id;
    } catch (err) {
      logger.warn({ err, agentId: this.agentId }, "Agent memory log failed (non-fatal)");
      return undefined;
    }
  }

  // ── Build output envelope ──────────────────────────────────────────────────

  protected buildOutput(
    task: AgentTask,
    analysis: AgentAnalysis,
    result: AgentResult,
    opts: {
      status?: AgentOutput["status"];
      handoffs?: AgentHandoff[];
      memoryLogId?: number;
      startedAt: Date;
      error?: string;
    }
  ): AgentOutput {
    const now = new Date();
    const meta = AGENT_METADATA[this.agentId];
    return {
      taskId: task.id,
      agentId: this.agentId,
      agentName: meta.name,
      agentIcon: meta.icon,
      status: opts.status ?? "success",
      analysis,
      result,
      handoffs: opts.handoffs,
      memoryLogId: opts.memoryLogId,
      startedAt: opts.startedAt.toISOString(),
      completedAt: now.toISOString(),
      durationMs: now.getTime() - opts.startedAt.getTime(),
      error: opts.error,
    };
  }

  // ── Abstract methods every agent must implement ────────────────────────────

  abstract analyze(task: AgentTask): Promise<AgentAnalysis>;
  abstract execute(task: AgentTask): Promise<AgentOutput>;
}
