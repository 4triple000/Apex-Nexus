/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — AI Gameplay Director System v1           ║
 * ║                                                          ║
 * ║  A continuous AI loop that reads player state and        ║
 * ║  adjusts pacing, difficulty, and events in real time.   ║
 * ║                                                          ║
 * ║  Every tick (default 6 s):                              ║
 * ║    1. Analyze player metrics → difficulty score          ║
 * ║    2. Smooth score with EMA                              ║
 * ║    3. Classify → DifficultyBand + PlayerStyle            ║
 * ║    4. Advance EngagementPhase state machine              ║
 * ║    5. Compute DirectorSettings                           ║
 * ║    6. Decide which event to fire                         ║
 * ║    7. Notify all listeners                               ║
 * ║                                                          ║
 * ║  "flow state" = not bored, not overwhelmed              ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ── Public types ──────────────────────────────────────────────────────────────

/** Narrative arc phase the director is currently in. */
export type EngagementPhase = "calm" | "buildup" | "peak" | "reward" | "recovery";

/** How easy or hard the game currently is for this player. */
export type DifficultyBand  = "too_easy" | "easy" | "balanced" | "hard" | "too_hard";

/** Inferred playstyle from recent behaviour. */
export type PlayerStyle = "aggressive" | "defensive" | "explorer" | "skill-based" | "unknown";

// ── Player Metrics (caller updates this each frame / every few frames) ─────────

export interface PlayerMetrics {
  /** Current HP, 0–maxHealth */
  health:             number;
  /** Maximum HP (usually 100) */
  maxHealth:          number;
  /** 0–1: ratio of recent attacks that succeeded (hits / shots, goals / attempts…) */
  successRate:        number;
  /** 0–1: normalised current movement intensity */
  movementSpeed:      number;
  /** Recent combat events per minute */
  combatFrequency:    number;
  /** Continuous seconds without meaningful player action */
  idleSeconds:        number;
  /** 0–1: mission/level progress */
  completionProgress: number;
  /** Cumulative session failure count (deaths / resets) */
  failureCount:       number;
  /** Cumulative enemies defeated this session */
  killCount:          number;
  score:              number;
  sessionSeconds:     number;
}

const DEFAULT_METRICS: PlayerMetrics = {
  health: 100, maxHealth: 100,
  successRate: 0.5, movementSpeed: 0.5, combatFrequency: 1,
  idleSeconds: 0, completionProgress: 0,
  failureCount: 0, killCount: 0, score: 0, sessionSeconds: 0,
};

// ── Director Settings (output — callers apply these) ──────────────────────────

export interface DirectorSettings {
  /** Enemy count multiplier (0.3 – 2.5) */
  enemyCountMult:  number;
  /** Enemy movement speed multiplier (0.5 – 1.6) */
  enemySpeedMult:  number;
  /** Enemy damage multiplier (0.5 – 1.6) */
  enemyDamageMult: number;
  /** Enemy aggression 0–1 (chase range, attack rate) */
  enemyAggression: number;
  /** Spawn rate multiplier */
  spawnRateMult:   number;
  /** Reward / loot frequency multiplier */
  rewardMult:      number;
  /** Recommended enemy AI update rate Hz */
  aiHz:            number;
}

export const NEUTRAL_SETTINGS: DirectorSettings = {
  enemyCountMult:  1.0,
  enemySpeedMult:  1.0,
  enemyDamageMult: 1.0,
  enemyAggression: 0.5,
  spawnRateMult:   1.0,
  rewardMult:      1.0,
  aiHz:            6,
};

// ── Director Events ───────────────────────────────────────────────────────────

export type DirectorEventType =
  | "ambush"               // Surprise enemy wave
  | "bonus_drop"           // Reward item / health pack spawned
  | "boss_spawn"           // Elite / boss enemy spawned
  | "environmental_hazard" // Hazard event triggered
  | "mission_update"       // New objective / waypoint
  | "difficulty_shift"     // Settings changed significantly
  | "phase_change"         // Engagement phase transitioned
  | "calm_moment"          // Difficulty relief / rest moment
  | "checkpoint_reward";   // Progress milestone reward

export interface DirectorEvent {
  type:      DirectorEventType;
  phase:     EngagementPhase;
  band:      DifficultyBand;
  style:     PlayerStyle;
  settings:  DirectorSettings;
  message?:  string;
  payload?:  Record<string, unknown>;
  timestamp: number;
}

export type DirectorListener = (event: DirectorEvent) => void;

// ── Options ───────────────────────────────────────────────────────────────────

export interface GameDirectorOptions {
  /** How often to run the analysis loop in ms. Default: 6000. */
  tickIntervalMs?: number;
  gameMode?:       string;
  /** Target difficulty baseline (0 = very easy, 1 = very hard). Default: 0.5. */
  targetDifficulty?: number;
  debug?: boolean;
}

// ── Band → Settings presets ───────────────────────────────────────────────────

const BAND_SETTINGS: Record<DifficultyBand, DirectorSettings> = {
  too_easy: {
    enemyCountMult:  1.80, enemySpeedMult:  1.30, enemyDamageMult: 1.25,
    enemyAggression: 0.85, spawnRateMult:   1.60, rewardMult: 0.70, aiHz: 10,
  },
  easy: {
    enemyCountMult:  1.35, enemySpeedMult:  1.15, enemyDamageMult: 1.10,
    enemyAggression: 0.65, spawnRateMult:   1.25, rewardMult: 0.85, aiHz: 8,
  },
  balanced: { ...NEUTRAL_SETTINGS },
  hard: {
    enemyCountMult:  0.70, enemySpeedMult:  0.88, enemyDamageMult: 0.80,
    enemyAggression: 0.35, spawnRateMult:   0.70, rewardMult: 1.30, aiHz: 5,
  },
  too_hard: {
    enemyCountMult:  0.40, enemySpeedMult:  0.70, enemyDamageMult: 0.60,
    enemyAggression: 0.20, spawnRateMult:   0.40, rewardMult: 2.00, aiHz: 4,
  },
};

// ── Phase durations (seconds) ─────────────────────────────────────────────────

const PHASE_DURATION: Record<EngagementPhase, [min: number, max: number]> = {
  calm:     [30, 55],
  buildup:  [20, 38],
  peak:     [18, 30],
  reward:   [8,  16],
  recovery: [15, 25],
};

const PHASE_SEQUENCE: EngagementPhase[] = ["calm", "buildup", "peak", "reward", "recovery"];

// ── Director class ────────────────────────────────────────────────────────────

export class GameDirector {
  private opts: Required<GameDirectorOptions>;
  private listeners = new Set<DirectorListener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  // Current state
  private metrics:  PlayerMetrics = { ...DEFAULT_METRICS };
  private phase:    EngagementPhase = "calm";
  private band:     DifficultyBand  = "balanced";
  private style:    PlayerStyle     = "unknown";
  private settings: DirectorSettings = { ...NEUTRAL_SETTINGS };

  // Rolling history (last 8 ticks)
  private healthHist:   number[] = [];
  private successHist:  number[] = [];
  private combatHist:   number[] = [];
  private movementHist: number[] = [];

  // Phase tracking
  private phaseTimer    = 0;                 // seconds elapsed in current phase
  private phaseDuration = 40;               // seconds target for this phase

  // Tick tracking
  private tick           = 0;
  private smoothedScore  = 0.5;             // EMA of raw player score
  private prevBand:  DifficultyBand  = "balanced";
  private prevPhase: EngagementPhase = "calm";

  // Cooldowns (tick counts)
  private lastEventTick: Partial<Record<DirectorEventType, number>> = {};
  private bossSpawned = false;

  constructor(opts: GameDirectorOptions = {}) {
    this.opts = {
      tickIntervalMs:   opts.tickIntervalMs  ?? 6000,
      gameMode:         opts.gameMode        ?? "platformer",
      targetDifficulty: opts.targetDifficulty ?? 0.5,
      debug:            opts.debug           ?? false,
    };
    this.phaseDuration = this._randomDuration("calm");
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Subscribe to director events. Returns an unsubscribe function. */
  on(listener: DirectorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Call this every frame (or every N frames) with fresh player data. */
  updateMetrics(patch: Partial<PlayerMetrics>): void {
    this.metrics = { ...this.metrics, ...patch };
  }

  /** Get the current settings snapshot (callers can also listen for events). */
  getSettings(): DirectorSettings { return { ...this.settings }; }
  getPhase():    EngagementPhase  { return this.phase; }
  getBand():     DifficultyBand   { return this.band; }
  getStyle():    PlayerStyle      { return this.style; }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this._tick(), this.opts.tickIntervalMs);
    // Fire an initial tick quickly
    setTimeout(() => this._tick(), 500);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  // ── Private analysis loop ───────────────────────────────────────────────────

  private _tick(): void {
    this.tick++;
    const dt = this.opts.tickIntervalMs / 1000; // seconds per tick

    const m = this.metrics;

    // ── 1. Update rolling history (max 8 entries) ──────────────────────────
    const push = (arr: number[], val: number) => {
      arr.push(val);
      if (arr.length > 8) arr.shift();
    };
    push(this.healthHist,   m.health / Math.max(m.maxHealth, 1));
    push(this.successHist,  m.successRate);
    push(this.combatHist,   m.combatFrequency);
    push(this.movementHist, m.movementSpeed);

    // ── 2. Compute raw player performance score (higher = player doing well) ─
    const healthScore   = m.health / Math.max(m.maxHealth, 1);
    const successScore  = m.successRate;
    const survivalScore = 1 - Math.min(m.failureCount / 6, 1);
    const rawScore      = 0.40 * healthScore + 0.35 * successScore + 0.25 * survivalScore;

    // EMA smoothing (α=0.28) — prevents jitter from one bad second
    this.smoothedScore = 0.28 * rawScore + 0.72 * this.smoothedScore;

    // Apply target difficulty bias: shift the threshold curve
    // targetDifficulty=0 → more forgiving (higher smoothed before "too_easy")
    const biasedScore = this.smoothedScore - (this.opts.targetDifficulty - 0.5) * 0.15;

    // ── 3. Classify difficulty band ─────────────────────────────────────────
    this.prevBand = this.band;
    if      (biasedScore > 0.82) this.band = "too_easy";
    else if (biasedScore > 0.66) this.band = "easy";
    else if (biasedScore > 0.42) this.band = "balanced";
    else if (biasedScore > 0.24) this.band = "hard";
    else                         this.band = "too_hard";

    // ── 4. Classify player style ────────────────────────────────────────────
    this.style = this._classifyStyle();

    // ── 5. Advance engagement phase ─────────────────────────────────────────
    this.prevPhase = this.phase;
    this.phaseTimer += dt;
    if (this.phaseTimer >= this.phaseDuration) {
      this._advancePhase();
    }
    // Context overrides — accelerate or delay phase
    this._applyPhaseContext(m);

    // ── 6. Compute settings ─────────────────────────────────────────────────
    const baseSets = { ...BAND_SETTINGS[this.band] };
    this.settings  = this._applyStyleModifiers(baseSets);

    // ── 7. Decide event ─────────────────────────────────────────────────────
    const event = this._selectEvent(m);

    // ── 8. Emit ─────────────────────────────────────────────────────────────
    const ev: DirectorEvent = {
      type:      event,
      phase:     this.phase,
      band:      this.band,
      style:     this.style,
      settings:  { ...this.settings },
      timestamp: Date.now(),
    };

    if (this.opts.debug) {
      console.log(
        `[Director] tick=${this.tick} phase=${this.phase} band=${this.band} ` +
        `style=${this.style} score=${this.smoothedScore.toFixed(2)} event=${event}`,
      );
    }

    for (const fn of this.listeners) fn(ev);
  }

  // ── Phase management ────────────────────────────────────────────────────────

  private _advancePhase(): void {
    const idx  = PHASE_SEQUENCE.indexOf(this.phase);
    this.phase = PHASE_SEQUENCE[(idx + 1) % PHASE_SEQUENCE.length]!;
    this.phaseTimer    = 0;
    this.phaseDuration = this._randomDuration(this.phase);
  }

  private _applyPhaseContext(m: PlayerMetrics): void {
    const avgCombat   = this._avg(this.combatHist);
    const avgMovement = this._avg(this.movementHist);

    // Player is active in combat → rush to peak faster
    if (this.phase === "buildup" && avgCombat > 2.5) {
      this.phaseTimer += 5;
    }
    // Idle player during calm → inject something sooner
    if (this.phase === "calm" && m.idleSeconds > 12) {
      this.phaseTimer += 8;
    }
    // Player under severe pressure in peak → skip to reward
    if (this.phase === "peak" && this.band === "too_hard") {
      this.phaseTimer = this.phaseDuration + 1; // force advance next tick
    }
    // Progress nearing end → sustain peak
    if (this.phase === "peak" && m.completionProgress > 0.85) {
      this.phaseTimer = Math.min(this.phaseTimer, this.phaseDuration - 6);
    }
    void avgMovement; // used via style classifier
  }

  // ── Style classifier ────────────────────────────────────────────────────────

  private _classifyStyle(): PlayerStyle {
    if (this.healthHist.length < 3) return "unknown";

    const avgH  = this._avg(this.healthHist);
    const avgS  = this._avg(this.successHist);
    const avgC  = this._avg(this.combatHist);
    const avgM  = this._avg(this.movementHist);
    const varS  = this._variance(this.successHist);

    if (avgC > 2.0 && avgS > 0.5)                    return "aggressive";
    if (avgC < 0.6 && avgM > 0.55)                   return "explorer";
    if (avgH > 0.72 && avgC > 0.5 && avgS > 0.45)   return "defensive";
    if (avgS > 0.68 && varS < 0.06)                  return "skill-based";
    return "unknown";
  }

  // ── Style modifiers on top of band settings ─────────────────────────────────

  private _applyStyleModifiers(s: DirectorSettings): DirectorSettings {
    const out = { ...s };
    switch (this.style) {
      case "aggressive":
        // They rush → push back harder; give them density, not just speed
        out.enemyCountMult   = Math.min(out.enemyCountMult * 1.15, 2.5);
        out.enemyAggression  = Math.min(out.enemyAggression + 0.08, 1);
        break;
      case "defensive":
        // They stay back → enemies flank aggressively to flush them out
        out.enemyAggression  = Math.min(out.enemyAggression + 0.15, 1);
        out.spawnRateMult    = Math.min(out.spawnRateMult   * 1.10, 2.0);
        break;
      case "explorer":
        // They avoid fights → reward movement, inject environmental events
        out.rewardMult       = Math.min(out.rewardMult      * 1.20, 2.5);
        out.spawnRateMult    = Math.max(out.spawnRateMult   * 0.85, 0.3);
        break;
      case "skill-based":
        // High precision → increase challenge ceiling
        out.enemySpeedMult   = Math.min(out.enemySpeedMult  * 1.10, 1.6);
        out.enemyDamageMult  = Math.min(out.enemyDamageMult * 1.08, 1.6);
        break;
    }
    return out;
  }

  // ── Event selector ───────────────────────────────────────────────────────────

  private _selectEvent(m: PlayerMetrics): DirectorEventType {
    // ── Cooldown helper ───────────────────────────────────────────────────
    const cooldown = (type: DirectorEventType, ticks: number) =>
      (this.tick - (this.lastEventTick[type] ?? 0)) >= ticks;

    const record = (type: DirectorEventType) => {
      this.lastEventTick[type] = this.tick;
      return type;
    };

    // ── Phase entered reward → drop bonus ────────────────────────────────
    if (this.prevPhase !== "reward" && this.phase === "reward") {
      return record("bonus_drop");
    }

    // ── Recovery start → calm moment ─────────────────────────────────────
    if (this.prevPhase !== "recovery" && this.phase === "recovery") {
      return record("calm_moment");
    }

    // ── Phase changed → emit phase_change ────────────────────────────────
    if (this.prevPhase !== this.phase) {
      this.lastEventTick["phase_change"] = this.tick;
      return "phase_change";
    }

    // ── Too hard → immediately ease + drop reward ─────────────────────────
    if (this.band === "too_hard" && cooldown("bonus_drop", 3)) {
      return record("bonus_drop");
    }

    // ── Idle player → inject event to break monotony ──────────────────────
    if (m.idleSeconds > 14 && cooldown("ambush", 3)) {
      return record(Math.random() < 0.6 ? "ambush" : "environmental_hazard");
    }

    // ── One-time boss spawn: session > 90s + peak + not spawned ──────────
    if (!this.bossSpawned && m.sessionSeconds > 90 && this.phase === "peak"
        && this.band !== "too_hard" && cooldown("boss_spawn", 5)) {
      this.bossSpawned = true;
      return record("boss_spawn");
    }

    // ── Peak + too easy → ambush ──────────────────────────────────────────
    if (this.phase === "peak" && this.band === "too_easy" && cooldown("ambush", 4)) {
      return record("ambush");
    }

    // ── Buildup + too easy → early ambush ────────────────────────────────
    if (this.phase === "buildup" && this.band === "too_easy" && cooldown("ambush", 5)) {
      return record("ambush");
    }

    // ── Significant band change → difficulty_shift ────────────────────────
    if (this.prevBand !== this.band && cooldown("difficulty_shift", 2)) {
      return record("difficulty_shift");
    }

    // ── Progress milestone → checkpoint reward ────────────────────────────
    const prog = m.completionProgress;
    if ((prog > 0.33 || prog > 0.66) && cooldown("checkpoint_reward", 8)) {
      return record("checkpoint_reward");
    }

    // ── Default: difficulty_shift (always safe to re-emit settings) ───────
    return "difficulty_shift";
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  private _avg(arr: number[]): number {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private _variance(arr: number[]): number {
    if (arr.length < 2) return 0;
    const mean = this._avg(arr);
    return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  }

  private _randomDuration(phase: EngagementPhase): number {
    const [min, max] = PHASE_DURATION[phase];
    return min + Math.random() * (max - min);
  }
}
