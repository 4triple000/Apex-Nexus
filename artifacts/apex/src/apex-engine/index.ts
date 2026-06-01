/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — Public Module API                            ║
 * ║                                                             ║
 * ║  Single import for the full internal game runtime system.  ║
 * ║                                                             ║
 * ║  Quickstart:                                               ║
 * ║                                                             ║
 * ║    import {                                                 ║
 * ║      loadGame, startGame, pauseGame, stopGame,             ║
 * ║      attachRenderer, initInput,                            ║
 * ║    } from "@/apex-engine";                                 ║
 * ║                                                             ║
 * ║    // 1. Attach the renderer to any DOM container          ║
 * ║    const renderer = attachRenderer(document.getElementById("game")); ║
 * ║                                                             ║
 * ║    // 2. Bind input to the canvas                          ║
 * ║    const input = initInput(renderer.canvas);               ║
 * ║                                                             ║
 * ║    // 3. Load a game from JSON config                      ║
 * ║    loadGame({ name: "Neon Ops", gameMode: "fps", ... });   ║
 * ║                                                             ║
 * ║    // 4. Start the game loop                               ║
 * ║    startGame();                                            ║
 * ║    renderer.start();                                       ║
 * ║                                                             ║
 * ║  Module breakdown:                                          ║
 * ║    gameLoader.ts — loadGame(), loadGameOnCanvas(),         ║
 * ║                    parseConfig(), validateConfig()         ║
 * ║    runtime.ts    — startGame(), pauseGame(), stopGame(),   ║
 * ║                    resumeGame(), onStateChange(),          ║
 * ║                    onGameEnd(), onGameEvent()              ║
 * ║    renderer.ts   — attachRenderer(), detachRenderer(),     ║
 * ║                    getRenderer(), getStats()               ║
 * ║    input.ts      — initInput(), getInput(),                ║
 * ║                    getController(), simulateButton()       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Game Loader ───────────────────────────────────────────────────────────────

export {
  loadGame,
  loadGameOnCanvas,
  createWorldConfig,
  validateConfig,
  parseConfig,
  type GameConfig,
  type GameMode,
  type WorldConfig,
} from "./gameLoader";

// ── Runtime Controller ────────────────────────────────────────────────────────

export {
  startGame,
  pauseGame,
  stopGame,
  resumeGame,
  getStatus,
  getSnapshot,
  onStateChange,
  onGameEnd,
  onGameEvent,
  notifyEnd,
  notifyUpdate,
  type EngineGameState,
  type RuntimeStatus,
} from "./runtime";

// ── Renderer ──────────────────────────────────────────────────────────────────

export {
  attachRenderer,
  detachRenderer,
  getRenderer,
  getStats,
  type RendererAPI,
  type RendererOptions,
  type EngineStats,
} from "./renderer";

// ── Input ─────────────────────────────────────────────────────────────────────

export {
  initInput,
  getInput,
  getController,
  destroyInput,
  simulateButton,
  type InputController,
  type InputManagerOptions,
  type UnifiedInput,
  type DeviceType,
  type JoystickState,
  type ButtonName,
} from "./input";
