/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — Game Loader                                  ║
 * ║                                                             ║
 * ║  Takes a JSON config, initializes the game world,          ║
 * ║  and prepares all entities for runtime.                    ║
 * ║                                                             ║
 * ║  Usage:                                                     ║
 * ║    import { loadGame } from "@/apex-engine/gameLoader";    ║
 * ║    loadGame({ name: "Neon Ops", gameMode: "fps", ... });   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { ApexEngine }                from "@/engine/ApexEngine";
import { Engine3D }                  from "@/engine3d/Engine";
import {
  buildDefaultWorldConfig,
  type WorldConfig,
} from "@/engine3d/WorldLoader";
import type { GameConfig, GameMode } from "@/engine/types";

// ── Re-export core types for consumers ───────────────────────────────────────

export type { GameConfig, GameMode, WorldConfig };

// ── loadGame ─────────────────────────────────────────────────────────────────
//
//  Primary entry point.
//  Takes a JSON GameConfig, stages it in the engine session manager.
//  Call startGame() (from runtime.ts) afterwards to begin the loop.
//
//  The engine status transitions:
//    "idle"  →  loadGame()  →  "loading"
//    "loading"  →  startGame()  →  "playing"

export function loadGame(config: GameConfig): void {
  ApexEngine.loadGame(config);
}

// ── loadGameOnCanvas ──────────────────────────────────────────────────────────
//
//  Low-level alternative: bypass the session manager and attach a full 3D
//  Engine3D instance directly onto an <canvas> element you control.
//  Returns the Engine3D so you can call .start() / .stop() / .addSystem() etc.
//
//  Use this when you want to embed the 3D engine inside a custom container
//  without the React GameCanvas component tree.

export function loadGameOnCanvas(
  canvas: HTMLCanvasElement,
  config?: GameConfig,
): Engine3D {
  const worldCfg: WorldConfig | undefined = config?.worldConfig
    ?? (config?.gameMode === "fps" || config?.gameMode === "openworld" || config?.gameMode === "gta"
      ? buildDefaultWorldConfig(config.name, config.gameMode as WorldConfig["mode"])
      : undefined);

  const engine = Engine3D.create(canvas, worldCfg);
  return engine;
}

// ── createWorldConfig ──────────────────────────────────────────────────────────
//
//  Helper: build a default WorldConfig for a given game mode.
//  Useful for procedurally bootstrapping a world without a full GameConfig.

export function createWorldConfig(
  name: string,
  mode: WorldConfig["mode"] = "fps",
): WorldConfig {
  return buildDefaultWorldConfig(name, mode);
}

// ── validateConfig ────────────────────────────────────────────────────────────
//
//  Check that a GameConfig has all required fields before loading.
//  Returns { valid: true } or { valid: false, errors: string[] }.

export function validateConfig(
  config: unknown,
): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (typeof config !== "object" || config === null) {
    return { valid: false, errors: ["config must be a non-null object"] };
  }

  const c = config as Record<string, unknown>;

  if (typeof c["name"] !== "string" || !c["name"]) {
    errors.push("config.name must be a non-empty string");
  }
  if (typeof c["gravity"] !== "number") {
    errors.push("config.gravity must be a number");
  }
  if (!Array.isArray(c["platforms"])) {
    errors.push("config.platforms must be an array");
  }
  if (!Array.isArray(c["enemies"])) {
    errors.push("config.enemies must be an array");
  }
  if (typeof c["player"] !== "object" || c["player"] === null) {
    errors.push("config.player must be an object");
  }
  if (typeof c["winCondition"] !== "string") {
    errors.push("config.winCondition must be a string");
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ── parseConfig ───────────────────────────────────────────────────────────────
//
//  Parse a JSON string into a GameConfig with validation.
//  Throws if the string is invalid JSON or the config fails validation.

export function parseConfig(json: string): GameConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`GameLoader: invalid JSON — ${err instanceof Error ? err.message : String(err)}`);
  }

  const result = validateConfig(parsed);
  if (!result.valid) {
    throw new Error(`GameLoader: invalid config — ${result.errors.join("; ")}`);
  }

  return parsed as GameConfig;
}
