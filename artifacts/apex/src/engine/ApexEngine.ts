/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX — Engine Internal Module                              ║
 * ║                                                             ║
 * ║  Single-instance service that owns the game session.       ║
 * ║  The Apex UI calls this; React components observe it.      ║
 * ║                                                             ║
 * ║  Public API:                                               ║
 * ║    loadGame(config)   → stage a game config                ║
 * ║    startGame()        → transition to "playing"            ║
 * ║    stopGame()         → pause / halt                       ║
 * ║    updateGame(delta)  → hot-patch config mid-session       ║
 * ║    generateGame(p)    → AI-generate then load              ║
 * ║    sendToEngine(cfg)  → loadGame + startGame in one shot   ║
 * ║                                                             ║
 * ║  Engine responds with:                                      ║
 * ║    gameState          → observable snapshot                ║
 * ║    events             → subscribe with .on(handler)        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import type { GameConfig }          from "./types";
import { generateGameFromPrompt }   from "./demoGames";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EngineStatus =
  | "idle"       // no game loaded
  | "loading"    // config staged, not yet started
  | "playing"    // game loop running
  | "paused"     // game loop suspended
  | "won"        // game ended — victory
  | "lost";      // game ended — defeat

export interface EngineGameState {
  status:    EngineStatus;
  config:    GameConfig | null;
  sessionId: string | null;
  startedAt: number | null;
  score:     number;
  kills:     number;
  wave:      number;
}

export type EngineEventType =
  | { type: "stateChange";  state:   EngineGameState }
  | { type: "gameEvent";    name:    string; data?: unknown }
  | { type: "gameEnd";      result:  "won" | "lost"; score: number }
  | { type: "error";        message: string };

export type EngineEventHandler = (event: EngineEventType) => void;

// ── Defaults ──────────────────────────────────────────────────────────────────

const IDLE_STATE: EngineGameState = {
  status:    "idle",
  config:    null,
  sessionId: null,
  startedAt: null,
  score:     0,
  kills:     0,
  wave:      0,
};

function newSessionId(): string {
  return `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Service ───────────────────────────────────────────────────────────────────

class ApexEngineService {
  private _state:    EngineGameState   = { ...IDLE_STATE };
  private _handlers: Set<EngineEventHandler> = new Set();

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Stage a game config. Transitions to "loading".
   * Call startGame() to begin, or sendToEngine() to do both at once.
   */
  loadGame(config: GameConfig): void {
    this._setState({
      status:    "loading",
      config:    { ...config },
      sessionId: newSessionId(),
      startedAt: null,
      score:     0,
      kills:     0,
      wave:      0,
    });
    this._emit({ type: "gameEvent", name: "loaded", data: { mode: config.gameMode } });
  }

  /**
   * Transition "loading" → "playing". Noop if no config is staged.
   */
  startGame(): void {
    if (!this._state.config) {
      this._emit({ type: "error", message: "No game loaded — call loadGame() first" });
      return;
    }
    if (this._state.status === "playing") return;
    this._setState({ status: "playing", startedAt: Date.now() });
    this._emit({ type: "gameEvent", name: "started" });
  }

  /**
   * Pause/stop. If the game is playing, transitions to "paused".
   * If called from an end-state, resets to "idle".
   */
  stopGame(): void {
    if (this._state.status === "playing") {
      this._setState({ status: "paused" });
      this._emit({ type: "gameEvent", name: "paused" });
    } else if (this._state.status === "won" || this._state.status === "lost") {
      this._setState({ ...IDLE_STATE });
      this._emit({ type: "gameEvent", name: "reset" });
    }
  }

  /**
   * Hot-patch the current game config without resetting score / kills.
   * Useful for AI-driven map tweaks mid-session.
   */
  updateGame(updates: Partial<GameConfig>): void {
    if (!this._state.config) return;
    this._setState({ config: { ...this._state.config, ...updates } });
    this._emit({ type: "gameEvent", name: "updated", data: updates });
  }

  /**
   * AI-generate a game from a text prompt, then load it.
   * Returns the generated config so callers can inspect it.
   */
  async generateGame(prompt: string): Promise<GameConfig> {
    this._setState({ status: "loading" });
    this._emit({ type: "gameEvent", name: "generating", data: { prompt } });
    try {
      const config = await generateGameFromPrompt(prompt);
      this.loadGame(config);
      return config;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._emit({ type: "error", message });
      this._setState({ status: "idle" });
      throw err;
    }
  }

  /**
   * Load + start in a single call (most common entry point from the UI).
   */
  sendToEngine(config: GameConfig): void {
    this.loadGame(config);
    this.startGame();
  }

  // ── Callbacks from game canvases ───────────────────────────────────────────

  /** Call when the game canvas reports a win or loss. */
  notifyGameEnd(result: "won" | "lost", score: number): void {
    this._setState({ status: result, score });
    this._emit({ type: "gameEnd", result, score });
    this._emit({ type: "stateChange", state: this.snapshot });
  }

  /** Call each frame / on major events to keep the engine state in sync. */
  notifyUpdate(data: { wave?: number; kills?: number; score?: number }): void {
    const patch: Partial<EngineGameState> = {};
    if (data.wave  !== undefined) patch.wave  = data.wave;
    if (data.kills !== undefined) patch.kills = data.kills;
    if (data.score !== undefined) patch.score = data.score;
    if (Object.keys(patch).length > 0) this._setState(patch);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  /**
   * Subscribe to engine events.
   * Returns an unsubscribe function.
   */
  on(handler: EngineEventHandler): () => void {
    this._handlers.add(handler);
    // Immediately deliver current state so new subscribers are in sync
    handler({ type: "stateChange", state: this.snapshot });
    return () => this._handlers.delete(handler);
  }

  // ── State snapshot ─────────────────────────────────────────────────────────

  get snapshot(): EngineGameState { return { ...this._state }; }
  get status():   EngineStatus    { return this._state.status; }
  get config():   GameConfig | null { return this._state.config; }

  // ── Private ────────────────────────────────────────────────────────────────

  private _setState(patch: Partial<EngineGameState>): void {
    this._state = { ...this._state, ...patch };
    this._emit({ type: "stateChange", state: this.snapshot });
  }

  private _emit(event: EngineEventType): void {
    for (const h of this._handlers) {
      try { h(event); } catch { /* isolate handler errors */ }
    }
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
//
// The entire app shares one ApexEngine instance. Components read its state via
// EngineContext / useEngine(). This keeps the engine lifecycle decoupled from
// the React tree.

export const ApexEngine = new ApexEngineService();
