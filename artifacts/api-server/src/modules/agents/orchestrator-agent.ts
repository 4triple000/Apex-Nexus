/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ORCHESTRATOR AGENT v1                                 ║
 * ║  The Master Intelligence Layer                              ║
 * ║                                                             ║
 * ║  Transforms multi-agent system from reactive (user-driven)  ║
 * ║  to autonomous (system-driven).                             ║
 * ║                                                             ║
 * ║  Cycle:  observe → decide → assign → validate → deploy      ║
 * ║                                                             ║
 * ║  Routes tasks to existing agents:                           ║
 * ║    performance → optimizer                                  ║
 * ║    ui_fix      → ui                                         ║
 * ║    bug_fix     → debug                                      ║
 * ║    feature     → builder / product                          ║
 * ║    testing     → debug                                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { Server as IO } from "socket.io";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";
import { runAgent } from "../../agents/orchestrator";
import type { AgentId } from "../../agents/types";
import autonomousSystem from "../autonomous/index";

// ── Types ──────────────────────────────────────────────────────────────────────

export type OrchestratorPhase =
  | "idle" | "observing" | "deciding" | "assigning" | "validating" | "deploying";

export type TaskType =
  | "performance" | "ui_fix" | "bug_fix" | "feature" | "testing" | "optimization";

export type TaskStatus =
  | "pending" | "assigned" | "running" | "validating"
  | "approved" | "rejected" | "deployed" | "failed";

export interface OrchestratorTask {
  id:              string;
  cycleId:         string;
  type:            TaskType;
  priority:        "critical" | "high" | "medium" | "low";
  title:           string;
  description:     string;
  context:         string;
  assignedAgent:   AgentId;
  agentIcon:       string;
  status:          TaskStatus;
  agentOutput?:    string;
  validationScore?: number;
  validationReason?: string;
  approvedBy?:     "auto" | "admin";
  createdAt:       number;
  completedAt?:    number;
}

export interface OrchestratorCycle {
  id:          string;
  startedAt:   number;
  completedAt: number;
  phase:       OrchestratorPhase;
  tasksGenerated:  number;
  tasksApproved:   number;
  tasksDeployed:   number;
  tasksRejected:   number;
  observation:     string;
  error?:          string;
}

interface OrchestratorObservation {
  metrics:       (typeof autonomousSystem)["metrics"];
  status:        (typeof autonomousSystem)["status"];
  patterns:      string[];
  agentHistory:  string;
  summary:       string;
}

// ── Agent routing table ────────────────────────────────────────────────────────

const TASK_TO_AGENT: Record<TaskType, AgentId> = {
  performance:  "optimizer",
  optimization: "optimizer",
  ui_fix:       "ui",
  bug_fix:      "debug",
  testing:      "debug",
  feature:      "builder",
};

const AGENT_ICONS: Record<AgentId, string> = {
  builder:   "🏗",
  debug:     "🐛",
  ui:        "🎨",
  optimizer: "⚡",
  product:   "🚀",
};

const MIN_VALIDATION_SCORE = 0.65;

// ── Orchestrator Agent ─────────────────────────────────────────────────────────

class OrchestratorAgentSystem {
  private phase:         OrchestratorPhase = "idle";
  private running        = false;
  private autoApply      = false;
  private intervalMs     = 15 * 60_000;  // 15 minutes default
  private timer:         NodeJS.Timeout | null = null;
  private io:            IO | null = null;

  private tasks:         OrchestratorTask[]  = [];   // max 100
  private cycles:        OrchestratorCycle[] = [];   // max 50
  private consecutiveFails = 0;

  // ── Status ────────────────────────────────────────────────────────────────

  get status() {
    return {
      running:          this.running,
      phase:            this.phase,
      autoApply:        this.autoApply,
      intervalMs:       this.intervalMs,
      consecutiveFails: this.consecutiveFails,
      cyclesRun:        this.cycles.length,
      tasksTotal:       this.tasks.length,
      tasksPending:     this.tasks.filter((t) => t.status === "pending").length,
      tasksApproved:    this.tasks.filter((t) => t.status === "approved").length,
      tasksDeployed:    this.tasks.filter((t) => t.status === "deployed").length,
      tasksRejected:    this.tasks.filter((t) => t.status === "rejected").length,
      lastCycle:        this.cycles[0] ?? null,
    };
  }

  // ── Control ───────────────────────────────────────────────────────────────

  start(opts?: { intervalMs?: number; autoApply?: boolean }) {
    if (opts?.intervalMs) this.intervalMs = opts.intervalMs;
    if (opts?.autoApply !== undefined) this.autoApply = opts.autoApply;
    this.running = true;
    this.schedule();
    logger.info({ intervalMs: this.intervalMs, autoApply: this.autoApply }, "[Orchestrator] STARTED");
    this.broadcast("apex:orch:started", {});
  }

  pause() {
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    logger.info("[Orchestrator] PAUSED");
    this.broadcast("apex:orch:paused", {});
  }

  private schedule() {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.runCycle().catch((e) => logger.error({ e }, "[Orchestrator] Cycle error"))
        .finally(() => this.schedule());
    }, this.intervalMs);
  }

  async triggerCycle(): Promise<OrchestratorCycle> {
    return this.runCycle();
  }

  // ── Main cycle ─────────────────────────────────────────────────────────────

  private async runCycle(): Promise<OrchestratorCycle> {
    if (this.phase !== "idle") {
      logger.info({ phase: this.phase }, "[Orchestrator] Skipped — already running");
      return this.cycles[0] ?? this.emptyCycle();
    }

    const cycleId   = randomUUID();
    const startedAt = Date.now();
    let tasksGenerated = 0;
    let tasksApproved  = 0;
    let tasksDeployed  = 0;
    let tasksRejected  = 0;
    let observationSummary = "";

    logger.info({ cycleId }, "[Orchestrator] Cycle START");
    this.broadcast("apex:orch:cycle_start", { cycleId });

    try {
      // ── 1. OBSERVE ──────────────────────────────────────────────────────────
      this.setPhase("observing");
      const observation = await this.observe();
      observationSummary = observation.summary;
      logger.info({ summary: observation.summary.slice(0, 120) }, "[Orchestrator] Observed");
      this.broadcast("apex:orch:observed", { summary: observation.summary.slice(0, 200) });

      // ── 2. DECIDE — AI generates tasks ─────────────────────────────────────
      this.setPhase("deciding");
      const newTasks = await this.decide(observation, cycleId);
      tasksGenerated = newTasks.length;

      if (newTasks.length === 0) {
        logger.info("[Orchestrator] No tasks generated — system healthy");
        this.consecutiveFails = 0;
        return this.closeCycle({ cycleId, startedAt, tasksGenerated, tasksApproved, tasksDeployed, tasksRejected, observation: observationSummary });
      }

      this.tasks.unshift(...newTasks);
      if (this.tasks.length > 100) this.tasks = this.tasks.slice(0, 100);
      this.broadcast("apex:orch:tasks_generated", { count: newTasks.length, tasks: newTasks.map((t) => ({ id: t.id, title: t.title, agent: t.assignedAgent })) });

      // ── 3. ASSIGN + RUN ─────────────────────────────────────────────────────
      this.setPhase("assigning");

      for (const task of newTasks) {
        task.status = "running";
        this.broadcast("apex:orch:task_running", { taskId: task.id, agent: task.assignedAgent, title: task.title });

        try {
          const output = await this.assignAndRun(task);
          task.agentOutput = output;
          task.status = "validating";

          // ── 4. VALIDATE ──────────────────────────────────────────────────────
          this.setPhase("validating");
          const { score, reason, approved } = await this.validate(task, output);
          task.validationScore  = score;
          task.validationReason = reason;
          task.completedAt      = Date.now();

          if (approved) {
            tasksApproved++;
            task.status = "approved";
            this.broadcast("apex:orch:task_approved", { taskId: task.id, score, title: task.title });

            // ── 5. DEPLOY ──────────────────────────────────────────────────────
            if (this.autoApply) {
              this.setPhase("deploying");
              task.approvedBy = "auto";
              task.status = "deployed";
              tasksDeployed++;
              this.broadcast("apex:orch:task_deployed", { taskId: task.id, title: task.title });
              logger.info({ taskId: task.id, title: task.title }, "[Orchestrator] Task DEPLOYED");
            }
          } else {
            tasksRejected++;
            task.status = "rejected";
            this.broadcast("apex:orch:task_rejected", { taskId: task.id, score, reason, title: task.title });
          }
        } catch (agentErr) {
          task.status = "failed";
          task.validationReason = String(agentErr);
          tasksRejected++;
          logger.error({ agentErr, taskId: task.id }, "[Orchestrator] Agent run failed");
        }
      }

      this.consecutiveFails = 0;
      return this.closeCycle({ cycleId, startedAt, tasksGenerated, tasksApproved, tasksDeployed, tasksRejected, observation: observationSummary });

    } catch (err) {
      this.consecutiveFails++;
      if (this.consecutiveFails >= 3) {
        this.pause();
        logger.warn("[Orchestrator] Auto-paused after 3 failures");
      }
      return this.closeCycle({ cycleId, startedAt, tasksGenerated, tasksApproved, tasksDeployed, tasksRejected, observation: observationSummary, error: String(err) });
    }
  }

  // ── Observe ───────────────────────────────────────────────────────────────

  private async observe(): Promise<OrchestratorObservation> {
    const metrics = autonomousSystem.metrics;
    const status  = autonomousSystem.status;

    const patterns = status.lastCycle
      ? [`Last cycle: ${status.lastCycle.patternsFound} patterns, deployed: ${status.lastCycle.deployed}`]
      : ["No cycles run yet"];

    const gameModeReport = metrics.gameModes
      .map((m) => `${m.mode}: ${m.sessions} sessions, avgFPS ${m.avgFps}, W/L ${m.wins}/${m.losses}`)
      .join("; ") || "No game sessions";

    const summary = [
      `Events tracked: ${metrics.recentEvents} recent / ${metrics.totalEvents} total`,
      `Active sessions: ${metrics.activeSessions}`,
      `Errors: ${metrics.errorCount}`,
      `Avg FPS: ${metrics.avgFps ?? "N/A"}`,
      `Game modes: ${gameModeReport}`,
      `Autonomous cycles run: ${status.cyclesRun}`,
      `Pending AI suggestions: ${status.pendingSuggestions}`,
    ].join(" | ");

    return { metrics, status, patterns, agentHistory: "", summary };
  }

  // ── Decide ────────────────────────────────────────────────────────────────

  private async decide(
    obs: OrchestratorObservation,
    cycleId: string,
  ): Promise<OrchestratorTask[]> {
    const completion = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0.5,
      max_tokens:  1200,
      messages: [
        {
          role:    "system",
          content: `You are the Apex Orchestrator — a master AI that directs a team of specialized agents to autonomously improve the Apex gaming app.

Available agents:
- optimizer  → performance issues, FPS, lag, load time
- ui         → visual design, usability, mobile HUD
- debug      → bugs, crashes, errors, broken features
- builder    → new feature development, code generation
- product    → feature planning, roadmap decisions

Your job: analyze the system observations and generate 1-3 high-value improvement tasks.
ONLY generate tasks if there are real problems worth fixing.
If the system looks healthy, return an empty array.

Return JSON only:
{
  "tasks": [
    {
      "type": "performance|ui_fix|bug_fix|feature|testing|optimization",
      "priority": "critical|high|medium|low",
      "title": "short task title",
      "description": "detailed task for the agent",
      "context": "why this matters",
      "agent": "optimizer|ui|debug|builder|product"
    }
  ]
}`,
        },
        {
          role:    "user",
          content: `Current system observations:\n${obs.summary}\n\nGame mode details:\n${obs.metrics.gameModes.map((m) => JSON.stringify(m)).join("\n") || "None"}\n\nGenerate improvement tasks:`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { tasks?: Array<{ type: TaskType; priority: string; title: string; description: string; context: string; agent: string }> };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) as typeof parsed : { tasks: [] };
    }

    return (parsed.tasks ?? []).slice(0, 3).map((t) => {
      const agentId = (t.agent as AgentId) in AGENT_ICONS
        ? (t.agent as AgentId)
        : TASK_TO_AGENT[t.type as TaskType] ?? "optimizer";

      return {
        id:           randomUUID(),
        cycleId,
        type:         t.type as TaskType,
        priority:     (t.priority as OrchestratorTask["priority"]) ?? "medium",
        title:        t.title ?? "Untitled Task",
        description:  t.description ?? "",
        context:      t.context ?? "",
        assignedAgent: agentId,
        agentIcon:    AGENT_ICONS[agentId] ?? "🤖",
        status:       "pending" as TaskStatus,
        createdAt:    Date.now(),
      };
    });
  }

  // ── Assign + Run ──────────────────────────────────────────────────────────

  private async assignAndRun(task: OrchestratorTask): Promise<string> {
    logger.info({ agentId: task.assignedAgent, title: task.title }, "[Orchestrator] Running agent");

    const output = await runAgent(task.assignedAgent, {
      id:      task.id,
      prompt:  task.description,
      context: task.context,
    });

    // AgentOutput stores content in result.summary + optional code blocks
    const parts: string[] = [];
    if (output.result?.summary)                   parts.push(output.result.summary);
    if (output.result?.code)                       parts.push(`\`\`\`\n${output.result.code}\n\`\`\``);
    if (output.result?.suggestions?.length)        parts.push(`Suggestions:\n${output.result.suggestions.join("\n")}`);
    if (output.result?.changes?.length)            parts.push(`Changes: ${output.result.changes.map((c) => c.description).join("; ")}`);
    if (output.result?.nextSteps?.length)          parts.push(`Next: ${output.result.nextSteps.slice(0, 3).join(", ")}`);
    return parts.join("\n\n") || output.error || "No output produced";
  }

  // ── Validate ──────────────────────────────────────────────────────────────

  private async validate(
    task: OrchestratorTask,
    agentOutput: string,
  ): Promise<{ score: number; reason: string; approved: boolean }> {
    try {
      const completion = await openai.chat.completions.create({
        model:       "gpt-4o-mini",
        temperature: 0.2,
        max_tokens:  300,
        messages: [
          {
            role:    "system",
            content: `You are a QA validator for the Apex Orchestrator. Evaluate agent output quality.
Return JSON only: { "score": 0.0-1.0, "approved": true|false, "reason": "brief explanation" }
Score guide: 0.9+=excellent, 0.7-0.9=good, 0.5-0.7=marginal, <0.5=reject`,
          },
          {
            role: "user",
            content: `Task: ${task.title}
Type: ${task.type}
Priority: ${task.priority}
Description: ${task.description}

Agent output:
${agentOutput.slice(0, 1500)}

Evaluate this output's quality, relevance, and safety:`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      let result: { score: number; approved: boolean; reason: string };
      try {
        result = JSON.parse(raw) as typeof result;
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        result = m ? JSON.parse(m[0]) as typeof result : { score: 0, approved: false, reason: "Parse error" };
      }

      const score = Math.max(0, Math.min(1, result.score ?? 0));
      return { score, reason: result.reason ?? "", approved: score >= MIN_VALIDATION_SCORE };
    } catch {
      return { score: 0, reason: "Validation failed", approved: false };
    }
  }

  // ── Admin task control ─────────────────────────────────────────────────────

  approveTask(taskId: string): boolean {
    const t = this.tasks.find((t) => t.id === taskId);
    if (!t || t.status !== "approved") return false;
    t.status     = "deployed";
    t.approvedBy = "admin";
    t.completedAt = Date.now();
    this.broadcast("apex:orch:task_deployed", { taskId, title: t.title, by: "admin" });
    return true;
  }

  rejectTask(taskId: string): boolean {
    const t = this.tasks.find((t) => t.id === taskId);
    if (!t) return false;
    t.status = "rejected";
    t.completedAt = Date.now();
    this.broadcast("apex:orch:task_rejected", { taskId, title: t.title, by: "admin" });
    return true;
  }

  retryTask(taskId: string): OrchestratorTask | null {
    const t = this.tasks.find((t) => t.id === taskId);
    if (!t) return null;
    const retry: OrchestratorTask = {
      ...t,
      id:        randomUUID(),
      status:    "pending",
      createdAt: Date.now(),
      completedAt: undefined,
      agentOutput: undefined,
      validationScore: undefined,
      validationReason: undefined,
    };
    this.tasks.unshift(retry);
    return retry;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private setPhase(phase: OrchestratorPhase) {
    this.phase = phase;
    this.broadcast("apex:orch:phase", { phase });
  }

  private closeCycle(opts: {
    cycleId: string; startedAt: number;
    tasksGenerated: number; tasksApproved: number;
    tasksDeployed: number;  tasksRejected: number;
    observation: string;    error?: string;
  }): OrchestratorCycle {
    this.phase = "idle";
    const record: OrchestratorCycle = {
      id:             opts.cycleId,
      startedAt:      opts.startedAt,
      completedAt:    Date.now(),
      phase:          "idle",
      tasksGenerated: opts.tasksGenerated,
      tasksApproved:  opts.tasksApproved,
      tasksDeployed:  opts.tasksDeployed,
      tasksRejected:  opts.tasksRejected,
      observation:    opts.observation,
      error:          opts.error,
    };
    this.cycles.unshift(record);
    if (this.cycles.length > 50) this.cycles.pop();
    this.broadcast("apex:orch:cycle_end", {
      tasksGenerated: record.tasksGenerated,
      tasksApproved:  record.tasksApproved,
      error:          record.error,
    });
    logger.info(
      { cycleId: opts.cycleId, durationMs: Date.now() - opts.startedAt, tasksGenerated: opts.tasksGenerated },
      "[Orchestrator] Cycle COMPLETE",
    );
    return record;
  }

  private emptyCycle(): OrchestratorCycle {
    return { id: "none", startedAt: 0, completedAt: 0, phase: "idle", tasksGenerated: 0, tasksApproved: 0, tasksDeployed: 0, tasksRejected: 0, observation: "" };
  }

  private broadcast(event: string, data: Record<string, unknown>) {
    try { this.io?.emit(event, { ...data, ts: Date.now() }); } catch { /* non-fatal */ }
  }

  attachIO(io: IO) { this.io = io; }

  // ── REST router ───────────────────────────────────────────────────────────

  buildRouter(): Router {
    const r = Router();

    r.get("/agents/orchestrator/status", (_req, res) => {
      res.json({ ...this.status });
    });

    r.get("/agents/orchestrator/tasks", (req, res) => {
      const status = req.query["status"] as string | undefined;
      const limit  = Math.min(Number(req.query["limit"] ?? 50), 100);
      const tasks  = status
        ? this.tasks.filter((t) => t.status === status)
        : this.tasks;
      res.json({ tasks: tasks.slice(0, limit), total: this.tasks.length });
    });

    r.get("/agents/orchestrator/history", (_req, res) => {
      res.json({ cycles: this.cycles });
    });

    r.post("/agents/orchestrator/start", (req, res) => {
      const { intervalMs, autoApply } = req.body as { intervalMs?: number; autoApply?: boolean };
      this.start({ intervalMs, autoApply });
      res.json({ ok: true, status: this.status });
    });

    r.post("/agents/orchestrator/pause", (_req, res) => {
      this.pause();
      res.json({ ok: true });
    });

    r.post("/agents/orchestrator/cycle", async (_req, res) => {
      try {
        const cycle = await this.triggerCycle();
        res.json({ cycle });
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    r.post("/agents/orchestrator/approve/:id", (req, res) => {
      const ok = this.approveTask(req.params["id"]!);
      res.json({ ok });
    });

    r.post("/agents/orchestrator/reject/:id", (req, res) => {
      const ok = this.rejectTask(req.params["id"]!);
      res.json({ ok });
    });

    r.post("/agents/orchestrator/retry/:id", (req, res) => {
      const task = this.retryTask(req.params["id"]!);
      res.json({ ok: !!task, task });
    });

    return r;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

const orchestratorAgent = new OrchestratorAgentSystem();
export default orchestratorAgent;

export function setupOrchestratorAgent(io: IO) {
  orchestratorAgent.attachIO(io);
  orchestratorAgent.start({ intervalMs: 15 * 60_000, autoApply: false });
  logger.info("[Orchestrator] Agent ready — monitor-only mode");
}

export function getOrchestratorRouter(): Router {
  return orchestratorAgent.buildRouter();
}
