/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX AUTONOMOUS SYSTEM v1                                  ║
 * ║  Self-Observing · Self-Analyzing · Self-Improving           ║
 * ║                                                             ║
 * ║  Cycle:  observe → analyze → build → test → deploy         ║
 * ║                                                             ║
 * ║  Wraps the existing selfImprovement.ts learning system      ║
 * ║  and adds: game observability, code generation+apply,       ║
 * ║  sandbox validation, real-time WS broadcasting, and         ║
 * ║  full cycle control via REST API.                           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { Router }          from "express";
import type { Server as IO } from "socket.io";
import { randomUUID }       from "node:crypto";
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync,
} from "node:fs";
import path                 from "node:path";
import { openai }           from "@workspace/integrations-openai-ai-server";
import { logger }           from "../../lib/logger";
import {
  analyzeMemory, detectPatterns,
  type DetectedPattern,
} from "../../core/selfImprovement";

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKSPACE      = path.join(process.cwd(), "..", "..");
const SNAPSHOTS_DIR  = path.join(WORKSPACE, ".apex-builder", "snapshots");
const DEV_KEY        = process.env["APEX_BUILDER_KEY"] ?? "apex-dev-2024";
const MAX_EVENTS     = 2000;      // ring buffer size
const CYCLE_INTERVAL = 10 * 60_000; // default: 10 minutes

/** Files the autonomous system will NEVER modify — core stability guarantee */
const PROTECTED_PATHS = new Set([
  "artifacts/apex/src/engine/ApexEngine.ts",
  "artifacts/apex/src/engine/EngineContext.tsx",
  "artifacts/apex/src/engine/useMultiplayer.ts",
  "artifacts/apex/src/App.tsx",
  "artifacts/apex/src/main.tsx",
  "artifacts/api-server/src/index.ts",
  "artifacts/api-server/src/app.ts",
]);

/** Min sandbox score (0–1) required for auto-deploy */
const MIN_DEPLOY_SCORE = 0.70;

// ── Types ──────────────────────────────────────────────────────────────────────

export type CyclePhase =
  | "idle" | "observing" | "analyzing" | "building" | "testing" | "deploying";

export type EventType =
  | "session_start" | "session_end"
  | "page_view"     | "tab_switch"
  | "feature_used"  | "click"
  | "game_start"    | "game_end"    | "game_fail"
  | "fps_sample"    | "error";

export interface ApexEvent {
  id:        string;
  type:      EventType;
  sessionId: string;
  userId?:   string;
  ts:        number;   // Unix ms
  data:      Record<string, unknown>;
}

export interface GameModeMetrics {
  mode:          string;
  sessions:      number;
  wins:          number;
  losses:        number;
  avgFps:        number;
  avgDurationMs: number;
  fpsSamples:    number[];
  failureReasons: Record<string, number>;
}

interface CodeSuggestion {
  id:          string;
  pattern:     DetectedPattern;
  plan:        FeaturePlan;
  sandboxScore: number;
  sandboxReason: string;
  createdAt:   number;
  status:      "pending" | "applied" | "discarded";
  snapshotId?: string;
}

interface FeaturePlan {
  feature:    string;
  description: string;
  files: Array<{
    path:    string;
    action:  "create" | "modify";
    code:    string;
  }>;
  risks:      string[];
}

interface CycleRecord {
  id:          string;
  startedAt:   number;
  completedAt: number;
  phase:       CyclePhase;
  eventsProcessed: number;
  patternsFound: number;
  suggestionGenerated: boolean;
  deployed:    boolean;
  deployedFeature?: string;
  snapshotId?: string;
  error?:      string;
  learningLoop?: {
    input: string; output: string; result: string;
  };
}

// ── Autonomous System ──────────────────────────────────────────────────────────

class AutonomousSystem {
  // ── State ──────────────────────────────────────────────────────────────────
  private phase:         CyclePhase = "idle";
  private running        = false;
  private autoApply      = false;
  private cycleInterval  = CYCLE_INTERVAL;
  private timer:         NodeJS.Timeout | null = null;
  private io:            IO | null = null;

  // ── Data stores ────────────────────────────────────────────────────────────
  private events:        ApexEvent[] = [];          // ring buffer
  private gameModes:     Map<string, GameModeMetrics> = new Map();
  private suggestions:   CodeSuggestion[]  = [];    // max 20
  private cycleHistory:  CycleRecord[]     = [];    // max 50
  private consecutiveFails = 0;

  // ── Metrics ────────────────────────────────────────────────────────────────
  get metrics() {
    const now = Date.now();
    const recentCutoff = now - 60 * 60_000; // last hour
    const recentEvents = this.events.filter((e) => e.ts > recentCutoff);
    const sessions = new Set(recentEvents.map((e) => e.sessionId)).size;
    const errors   = recentEvents.filter((e) => e.type === "error").length;
    const games    = recentEvents.filter((e) => e.type === "game_start").length;
    const allFps   = recentEvents
      .filter((e) => e.type === "fps_sample")
      .map((e) => Number(e.data["fps"] ?? 0));
    const avgFps   = allFps.length
      ? Math.round(allFps.reduce((a, b) => a + b, 0) / allFps.length)
      : null;
    return {
      totalEvents:  this.events.length,
      recentEvents: recentEvents.length,
      activeSessions: sessions,
      errorCount:   errors,
      gameSessions: games,
      avgFps,
      gameModes:    [...this.gameModes.values()],
    };
  }

  get status() {
    return {
      running:       this.running,
      phase:         this.phase,
      autoApply:     this.autoApply,
      cycleIntervalMs: this.cycleInterval,
      consecutiveFails: this.consecutiveFails,
      pendingSuggestions: this.suggestions.filter((s) => s.status === "pending").length,
      totalSuggestions: this.suggestions.length,
      cyclesRun:     this.cycleHistory.length,
      lastCycle:     this.cycleHistory[0] ?? null,
    };
  }

  // ── Event ingestion ────────────────────────────────────────────────────────

  recordEvent(raw: Omit<ApexEvent, "id" | "ts"> & { ts?: number }) {
    const event: ApexEvent = {
      id:        randomUUID(),
      ts:        raw.ts ?? Date.now(),
      type:      raw.type,
      sessionId: raw.sessionId,
      userId:    raw.userId,
      data:      raw.data,
    };

    // Ring buffer
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.shift();

    // Game-mode aggregation
    this.aggregateGameEvent(event);

    // Broadcast to dashboard listeners
    this.io?.emit("apex:obs:event", { type: event.type, ts: event.ts });
  }

  private aggregateGameEvent(e: ApexEvent) {
    const mode = e.data["gameMode"] as string | undefined;
    if (!mode) return;

    let m = this.gameModes.get(mode);
    if (!m) {
      m = { mode, sessions: 0, wins: 0, losses: 0, avgFps: 0, avgDurationMs: 0, fpsSamples: [], failureReasons: {} };
      this.gameModes.set(mode, m);
    }

    if (e.type === "game_start")  m.sessions++;
    if (e.type === "game_end") {
      if (e.data["outcome"] === "won")  m.wins++;
      if (e.data["outcome"] === "lost") m.losses++;
      if (e.data["durationMs"]) {
        m.avgDurationMs = m.avgDurationMs
          ? Math.round((m.avgDurationMs + Number(e.data["durationMs"])) / 2)
          : Number(e.data["durationMs"]);
      }
    }
    if (e.type === "game_fail") {
      const reason = String(e.data["reason"] ?? "unknown");
      m.failureReasons[reason] = (m.failureReasons[reason] ?? 0) + 1;
    }
    if (e.type === "fps_sample" && e.data["gameMode"] === mode) {
      const fps = Number(e.data["fps"] ?? 0);
      m.fpsSamples.push(fps);
      if (m.fpsSamples.length > 200) m.fpsSamples.shift();
      m.avgFps = Math.round(
        m.fpsSamples.reduce((a, b) => a + b, 0) / m.fpsSamples.length,
      );
    }
  }

  // ── Cycle control ──────────────────────────────────────────────────────────

  start(options?: { intervalMs?: number; autoApply?: boolean }) {
    if (options?.intervalMs) this.cycleInterval = options.intervalMs;
    if (options?.autoApply !== undefined) this.autoApply = options.autoApply;
    this.running = true;
    this.scheduleCycle();
    logger.info({ intervalMs: this.cycleInterval, autoApply: this.autoApply }, "[Autonomous] System STARTED");
    this.broadcast("apex:aut:started", { intervalMs: this.cycleInterval });
  }

  pause() {
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    logger.info("[Autonomous] System PAUSED");
    this.broadcast("apex:aut:paused", {});
  }

  private scheduleCycle() {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.runCycle().catch((err) => {
        logger.error({ err }, "[Autonomous] Cycle error");
      }).finally(() => this.scheduleCycle());
    }, this.cycleInterval);
  }

  async triggerCycle(): Promise<CycleRecord> {
    return this.runCycle();
  }

  // ── Main cycle ─────────────────────────────────────────────────────────────

  private async runCycle(): Promise<CycleRecord> {
    if (this.phase !== "idle") {
      logger.info({ phase: this.phase }, "[Autonomous] Cycle skipped — already running");
      return this.cycleHistory[0]!;
    }

    const cycleId  = randomUUID();
    const startedAt = Date.now();
    let record: Partial<CycleRecord> = { id: cycleId, startedAt, phase: "idle" };

    logger.info({ cycleId }, "[Autonomous] Cycle START");
    this.broadcast("apex:aut:cycle_start", { cycleId });

    try {
      // ── 1. OBSERVE ──────────────────────────────────────────────────────────
      this.setPhase("observing");
      const snapshot = [...this.events];
      record.eventsProcessed = snapshot.length;
      logger.info({ count: snapshot.length }, "[Autonomous] Observing");

      await this.sleep(800); // brief pause to let broadcast reach frontend

      // ── 2. ANALYZE ──────────────────────────────────────────────────────────
      this.setPhase("analyzing");

      // Run the existing learning loop on the memory system
      const analysis = await analyzeMemory({ limit: 200 });
      const patterns = analysis.patterns;

      // Additionally derive game-specific patterns
      const gamePatterns = this.analyzeGameMetrics();
      const allPatterns  = [...patterns, ...gamePatterns];
      record.patternsFound = allPatterns.length;

      logger.info({ patterns: allPatterns.length }, "[Autonomous] Analysis complete");
      this.broadcast("apex:aut:analyzed", {
        patterns: allPatterns.length,
        severity: allPatterns[0]?.severity ?? "none",
      });

      // ── 3. BUILD ────────────────────────────────────────────────────────────
      const critical = allPatterns.filter(
        (p) => p.severity === "critical" || p.severity === "high",
      );

      if (critical.length === 0) {
        logger.info("[Autonomous] No critical patterns — skipping build phase");
        record.suggestionGenerated = false;
        this.consecutiveFails = 0;
        return this.closeCycle(record, "idle");
      }

      this.setPhase("building");
      const topPattern = critical[0]!;
      const plan = await this.buildCodeSuggestion(topPattern);

      if (!plan) {
        logger.info("[Autonomous] Build produced no plan");
        record.suggestionGenerated = false;
        return this.closeCycle(record, "idle");
      }

      record.suggestionGenerated = true;

      // ── 4. SANDBOX TEST ─────────────────────────────────────────────────────
      this.setPhase("testing");
      const { score, reason, safe } = await this.sandboxValidate(plan);

      logger.info({ score, safe, reason }, "[Autonomous] Sandbox test complete");
      this.broadcast("apex:aut:tested", { score, safe });

      const suggestion: CodeSuggestion = {
        id:            randomUUID(),
        pattern:       topPattern,
        plan,
        sandboxScore:  score,
        sandboxReason: reason,
        createdAt:     Date.now(),
        status:        "pending",
      };

      this.suggestions.unshift(suggestion);
      if (this.suggestions.length > 20) this.suggestions.pop();

      // ── 5. DEPLOY ───────────────────────────────────────────────────────────
      if (!safe || score < MIN_DEPLOY_SCORE) {
        logger.info({ score }, "[Autonomous] Score below threshold — not deploying");
        record.deployed = false;
        this.consecutiveFails++;
        return this.closeCycle(record, "idle");
      }

      if (!this.autoApply) {
        logger.info("[Autonomous] autoApply=false — queued for manual review");
        record.deployed = false;
        this.consecutiveFails = 0;
        return this.closeCycle(record, "idle");
      }

      this.setPhase("deploying");
      const snapshotId = await this.applyPlan(plan);
      suggestion.status     = "applied";
      suggestion.snapshotId = snapshotId;
      record.deployed        = true;
      record.deployedFeature = plan.feature;
      record.snapshotId      = snapshotId;
      this.consecutiveFails  = 0;

      logger.info({ feature: plan.feature, snapshotId }, "[Autonomous] Changes DEPLOYED");
      this.broadcast("apex:aut:deployed", { feature: plan.feature, snapshotId });

      return this.closeCycle(record, "idle");

    } catch (err) {
      this.consecutiveFails++;
      record.error = String(err);
      logger.error({ err, cycleId }, "[Autonomous] Cycle ERROR");

      // Auto-pause after 3 consecutive errors
      if (this.consecutiveFails >= 3) {
        this.pause();
        logger.warn("[Autonomous] Auto-paused after 3 consecutive failures");
      }

      return this.closeCycle(record, "idle");
    }
  }

  // ── Game metric pattern analysis ──────────────────────────────────────────

  private analyzeGameMetrics(): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const now = new Date().toISOString();

    for (const m of this.gameModes.values()) {
      if (m.sessions < 3) continue;

      // Low FPS pattern
      if (m.avgFps > 0 && m.avgFps < 30) {
        patterns.push({
          id:          randomUUID(),
          class:       "SLOW_GENERATION",
          title:       `${m.mode} games averaging ${m.avgFps} FPS (below 30)`,
          description: `Players experience lag in ${m.mode} mode. Average FPS is ${m.avgFps} across ${m.sessions} sessions.`,
          frequency:   m.sessions,
          severity:    m.avgFps < 15 ? "critical" : "high",
          evidence:    { avgDurationMs: m.avgFps },
          suggestedAction: `Optimize ${m.mode} renderer — reduce particle count, LOD system, or render batch size`,
          detectedAt:  now,
        });
      }

      // High loss rate
      const total = m.wins + m.losses;
      if (total >= 5 && m.losses / total > 0.8) {
        patterns.push({
          id:          randomUUID(),
          class:       "UI_UX_FRICTION",
          title:       `${m.mode} games have ${Math.round((m.losses / total) * 100)}% loss rate`,
          description: `Players are losing too often in ${m.mode} mode — possible difficulty spike or control issue.`,
          frequency:   m.losses,
          severity:    "medium",
          evidence:    { failureRate: m.losses / total },
          suggestedAction: `Tune enemy difficulty or control responsiveness in ${m.mode} game mode`,
          detectedAt:  now,
        });
      }

      // High failure rate
      const totalFails = Object.values(m.failureReasons).reduce((a, b) => a + b, 0);
      if (totalFails > 5) {
        const topReason = Object.entries(m.failureReasons)
          .sort(([, a], [, b]) => b - a)[0]?.[0] ?? "unknown";
        patterns.push({
          id:          randomUUID(),
          class:       "HIGH_ERROR_RATE",
          title:       `${m.mode} game failures: "${topReason}" occurs most`,
          description: `${totalFails} game failures detected in ${m.mode} mode. Top cause: "${topReason}".`,
          frequency:   totalFails,
          severity:    totalFails > 20 ? "high" : "medium",
          evidence:    { failureRate: totalFails / m.sessions },
          suggestedAction: `Fix "${topReason}" failure path in ${m.mode} game engine`,
          detectedAt:  now,
        });
      }
    }

    return patterns;
  }

  // ── Build phase ───────────────────────────────────────────────────────────

  private async buildCodeSuggestion(
    pattern: DetectedPattern,
  ): Promise<FeaturePlan | null> {
    try {
      const completion = await openai.chat.completions.create({
        model:       "gpt-4o-mini",
        temperature: 0.4,
        max_tokens:  1800,
        messages: [
          {
            role: "system",
            content: `You are the Apex Autonomous Build System. Your job is to generate safe, minimal TypeScript code changes that fix detected patterns in the Apex app.

The Apex app is a React+TypeScript+Vite frontend with an Express API server.
Return ONLY a valid JSON feature plan.
NEVER suggest changes to: ${[...PROTECTED_PATHS].join(", ")}`,
          },
          {
            role: "user",
            content: `Detected pattern: ${JSON.stringify(pattern, null, 2)}

Generate a feature plan to fix this pattern. Return JSON only:
{
  "feature": "Short name",
  "description": "What this fixes",
  "files": [
    {
      "path": "artifacts/apex/src/...",
      "action": "create|modify",
      "code": "// TypeScript code"
    }
  ],
  "risks": ["..."]
}`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      let plan: FeaturePlan;
      try {
        plan = JSON.parse(raw) as FeaturePlan;
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        plan = m ? (JSON.parse(m[0]) as FeaturePlan) : { feature: "", description: "", files: [], risks: [] };
      }

      // Filter protected paths
      plan.files = (plan.files ?? []).filter(
        (f) => !PROTECTED_PATHS.has(f.path),
      );

      if (!plan.feature || plan.files.length === 0) return null;
      return plan;
    } catch (err) {
      logger.error({ err }, "[Autonomous] Build failed");
      return null;
    }
  }

  // ── Sandbox validation ────────────────────────────────────────────────────

  private async sandboxValidate(
    plan: FeaturePlan,
  ): Promise<{ score: number; reason: string; safe: boolean }> {
    try {
      const completion = await openai.chat.completions.create({
        model:       "gpt-4o-mini",
        temperature: 0.2,
        max_tokens:  400,
        messages: [
          {
            role: "system",
            content: `You are a code safety validator for the Apex Autonomous System. 
Evaluate the proposed code change and return a JSON safety report.
Be conservative — only approve changes with clear, minimal impact.`,
          },
          {
            role: "user",
            content: `Evaluate this code plan:
${JSON.stringify(plan, null, 2)}

Return JSON only:
{
  "score": 0.0-1.0,
  "safe": true|false,
  "reason": "brief explanation",
  "risks": ["..."]
}

Score guide: 0.9+=safe+beneficial, 0.7-0.9=safe, 0.5-0.7=risky, <0.5=reject`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      let result: { score: number; safe: boolean; reason: string };
      try {
        result = JSON.parse(raw) as { score: number; safe: boolean; reason: string };
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        result = m ? (JSON.parse(m[0]) as { score: number; safe: boolean; reason: string }) : { score: 0, safe: false, reason: "Parse failed" };
      }

      return {
        score:  Math.max(0, Math.min(1, result.score ?? 0)),
        reason: result.reason ?? "No reason provided",
        safe:   result.safe ?? false,
      };
    } catch {
      return { score: 0, reason: "Validation error", safe: false };
    }
  }

  // ── Deploy phase ──────────────────────────────────────────────────────────

  private async applyPlan(plan: FeaturePlan): Promise<string> {
    // Create snapshot first
    const snapshotId = await createSnapshot(
      `Auto: ${plan.feature}`,
      plan.files,
    );

    // Apply each file
    for (const file of plan.files) {
      const fullPath = path.join(WORKSPACE, file.path);
      mkdirSync(path.dirname(fullPath), { recursive: true });

      if (file.action === "create") {
        writeFileSync(fullPath, file.code, "utf-8");
      } else {
        const existing = existsSync(fullPath)
          ? readFileSync(fullPath, "utf-8")
          : "";
        writeFileSync(fullPath, `${existing}\n\n${file.code}`, "utf-8");
      }
    }

    return snapshotId;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private setPhase(phase: CyclePhase) {
    this.phase = phase;
    this.broadcast("apex:aut:phase", { phase });
    logger.info({ phase }, "[Autonomous] Phase →");
  }

  private closeCycle(
    record: Partial<CycleRecord>,
    finalPhase: CyclePhase,
  ): CycleRecord {
    this.phase = finalPhase;
    const complete: CycleRecord = {
      id:                  record.id ?? randomUUID(),
      startedAt:           record.startedAt ?? Date.now(),
      completedAt:         Date.now(),
      phase:               finalPhase,
      eventsProcessed:     record.eventsProcessed ?? 0,
      patternsFound:       record.patternsFound ?? 0,
      suggestionGenerated: record.suggestionGenerated ?? false,
      deployed:            record.deployed ?? false,
      deployedFeature:     record.deployedFeature,
      snapshotId:          record.snapshotId,
      error:               record.error,
    };

    this.cycleHistory.unshift(complete);
    if (this.cycleHistory.length > 50) this.cycleHistory.pop();

    this.broadcast("apex:aut:cycle_end", {
      deployed: complete.deployed,
      patterns: complete.patternsFound,
      error:    complete.error,
    });

    logger.info(
      { cycleId: complete.id, deployed: complete.deployed, durationMs: complete.completedAt - complete.startedAt },
      "[Autonomous] Cycle COMPLETE",
    );

    return complete;
  }

  private broadcast(event: string, data: Record<string, unknown>) {
    try {
      this.io?.emit(event, { ...data, ts: Date.now() });
    } catch { /* non-fatal */ }
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }

  // ── REST API setup ────────────────────────────────────────────────────────

  buildRouter(): Router {
    const r = Router();

    // Status
    r.get("/autonomous/status", (_req, res) => {
      res.json({ ...this.status, metrics: this.metrics });
    });

    // Metrics (observer data)
    r.get("/autonomous/metrics", (_req, res) => {
      res.json(this.metrics);
    });

    // Suggestions queue
    r.get("/autonomous/suggestions", (_req, res) => {
      res.json({ suggestions: this.suggestions });
    });

    // Cycle history
    r.get("/autonomous/history", (_req, res) => {
      res.json({ history: this.cycleHistory });
    });

    // Ingest an event from the frontend observer
    r.post("/autonomous/event", (req, res) => {
      const { events } = req.body as { events?: Omit<ApexEvent, "id">[] };
      if (Array.isArray(events)) {
        events.forEach((e) => this.recordEvent(e));
      } else {
        const e = req.body as Omit<ApexEvent, "id">;
        if (e.type) this.recordEvent(e);
      }
      res.json({ ok: true });
    });

    // Control — start
    r.post("/autonomous/start", (req, res) => {
      const { key, intervalMs, autoApply } = req.body as {
        key?: string; intervalMs?: number; autoApply?: boolean;
      };
      const requiresKey = autoApply;
      if (requiresKey && key !== DEV_KEY) {
        res.status(403).json({ error: "Developer key required to enable autoApply" });
        return;
      }
      this.start({ intervalMs, autoApply });
      res.json({ ok: true, status: this.status });
    });

    // Control — pause
    r.post("/autonomous/pause", (_req, res) => {
      this.pause();
      res.json({ ok: true });
    });

    // Control — trigger a manual cycle
    r.post("/autonomous/cycle", async (req, res) => {
      const { key } = req.body as { key?: string };
      if (key && key !== DEV_KEY) {
        res.status(403).json({ error: "Invalid developer key" });
        return;
      }
      // autoApply only if dev key supplied
      const prevAutoApply = this.autoApply;
      if (!key) this.autoApply = false;
      try {
        const record = await this.triggerCycle();
        res.json({ record });
      } finally {
        this.autoApply = prevAutoApply;
      }
    });

    // Apply a queued suggestion (manual dev action)
    r.post("/autonomous/apply/:id", async (req, res) => {
      const { key } = req.body as { key?: string };
      if (key !== DEV_KEY) {
        res.status(403).json({ error: "Invalid developer key" });
        return;
      }
      const sugg = this.suggestions.find((s) => s.id === req.params["id"]);
      if (!sugg) {
        res.status(404).json({ error: "Suggestion not found" });
        return;
      }
      if (sugg.status !== "pending") {
        res.status(409).json({ error: "Already applied or discarded" });
        return;
      }
      try {
        const snapshotId = await this.applyPlan(sugg.plan);
        sugg.status     = "applied";
        sugg.snapshotId = snapshotId;
        res.json({ ok: true, snapshotId });
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    // Discard a queued suggestion
    r.post("/autonomous/discard/:id", (req, res) => {
      const sugg = this.suggestions.find((s) => s.id === req.params["id"]);
      if (sugg) sugg.status = "discarded";
      res.json({ ok: true });
    });

    return r;
  }

  // ── WebSocket init ────────────────────────────────────────────────────────
  attachIO(io: IO) { this.io = io; }
}

// ── Snapshot helpers (mirrors builder.ts) ─────────────────────────────────────

function ensureSnapshotsDir() {
  if (!existsSync(SNAPSHOTS_DIR)) mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

async function createSnapshot(
  label: string,
  files: Array<{ path: string }>,
): Promise<string> {
  ensureSnapshotsDir();
  const id  = `${Date.now()}_${randomUUID().slice(0, 6)}`;
  const dir = path.join(SNAPSHOTS_DIR, id);
  mkdirSync(dir, { recursive: true });

  const snapshotFiles: Array<{ path: string; snapshotFile: string }> = [];
  for (const file of files) {
    const full = path.join(WORKSPACE, file.path);
    if (existsSync(full)) {
      const sf = `file_${snapshotFiles.length}.bak`;
      writeFileSync(path.join(dir, sf), readFileSync(full, "utf-8"));
      snapshotFiles.push({ path: file.path, snapshotFile: sf });
    }
  }

  writeFileSync(
    path.join(dir, "meta.json"),
    JSON.stringify({ id, label, timestamp: Date.now(), files: snapshotFiles }, null, 2),
  );

  // Prune — keep max 10
  try {
    const all = readdirSync(SNAPSHOTS_DIR).sort();
    if (all.length > 10) {
      for (const old of all.slice(0, all.length - 10)) {
        rmSync(path.join(SNAPSHOTS_DIR, old), { recursive: true, force: true });
      }
    }
  } catch { /* non-fatal */ }

  return id;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

const autonomousSystem = new AutonomousSystem();
export default autonomousSystem;

// ── Module setup (called from server index.ts) ────────────────────────────────

export function setupAutonomousSystem(io: IO) {
  autonomousSystem.attachIO(io);
  // Start in observe-only mode (autoApply=false) — safe default
  autonomousSystem.start({ intervalMs: CYCLE_INTERVAL, autoApply: false });
  logger.info("[Autonomous] System ready — observe-only mode (autoApply=false)");
}

export function getAutonomousRouter(): Router {
  return autonomousSystem.buildRouter();
}
