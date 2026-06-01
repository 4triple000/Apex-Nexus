/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — Runtime Controller                           ║
 * ║                                                             ║
 * ║  Start, pause, and stop the game session.                  ║
 * ║  Also provides state observation and event subscription.   ║
 * ║                                                             ║
 * ║  Usage:                                                     ║
 * ║    import { startGame, pauseGame, stopGame }               ║
 * ║      from "@/apex-engine/runtime";                         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { ApexEngine }           from "@/engine/ApexEngine";
import type { EngineGameState } from "@/engine/ApexEngine";

// ── Re-export status type ─────────────────────────────────────────────────────

export type { EngineGameState };
export type RuntimeStatus = EngineGameState["status"];

// ── startGame ─────────────────────────────────────────────────────────────────
//
//  Begin the game loop.
//  Requires loadGame() to have been called first (status must be "loading").
//  Transitions status: "loading" → "playing"

export function startGame(): void {
  ApexEngine.startGame();
}

// ── pauseGame ─────────────────────────────────────────────────────────────────
//
//  Suspend the game loop while keeping the current config and score.
//  The game canvas stops updating but keeps its last rendered frame.
//  Call startGame() to resume.
//  Transitions status: "playing" → "paused"

export function pauseGame(): void {
  const s = ApexEngine.status;
  if (s === "playing") {
    ApexEngine.stopGame(); // "playing" → "paused"
  }
}

// ── stopGame ──────────────────────────────────────────────────────────────────
//
//  Fully stop and reset the engine session.
//  Unlike pauseGame(), this clears the config and score.
//  Transitions status: any → "idle"

export function stopGame(): void {
  // Drive through all states until we reach idle
  const s = ApexEngine.status;
  if (s === "playing") {
    ApexEngine.stopGame(); // "playing" → "paused"
  }
  // "paused" / "won" / "lost" → "idle"
  if (ApexEngine.status !== "idle") {
    // Force a win/lost → idle reset if needed by notifying a fake end
    ApexEngine.notifyGameEnd("lost", 0);
    ApexEngine.stopGame(); // "lost" → "idle"
  }
}

// ── resumeGame ────────────────────────────────────────────────────────────────
//
//  Resume from "paused" state. Alias for startGame().

export function resumeGame(): void {
  if (ApexEngine.status === "paused") {
    ApexEngine.startGame();
  }
}

// ── getStatus ─────────────────────────────────────────────────────────────────
//
//  Read the current runtime status without subscribing.

export function getStatus(): RuntimeStatus {
  return ApexEngine.status;
}

// ── getSnapshot ───────────────────────────────────────────────────────────────
//
//  Full engine state snapshot at this moment.
//  Includes: status, config, sessionId, startedAt, score, kills, wave.

export function getSnapshot(): EngineGameState {
  return ApexEngine.snapshot;
}

// ── onStateChange ─────────────────────────────────────────────────────────────
//
//  Subscribe to engine state changes.
//  The callback fires every time status, score, kills, or wave changes.
//  Returns an unsubscribe function — call it to remove the listener.
//
//  Example:
//    const unsub = onStateChange(s => console.log("Status:", s.status));
//    // later:
//    unsub();

export function onStateChange(
  callback: (state: EngineGameState) => void,
): () => void {
  return ApexEngine.on((event) => {
    if (event.type === "stateChange") callback(event.state);
  });
}

// ── onGameEnd ─────────────────────────────────────────────────────────────────
//
//  Subscribe to game-end events (win or loss).
//  Returns an unsubscribe function.

export function onGameEnd(
  callback: (result: "won" | "lost", score: number) => void,
): () => void {
  return ApexEngine.on((event) => {
    if (event.type === "gameEnd") callback(event.result, event.score);
  });
}

// ── onGameEvent ───────────────────────────────────────────────────────────────
//
//  Subscribe to named engine events (e.g. "started", "paused", "loaded",
//  "generating", "updated", "reset").
//  Returns an unsubscribe function.

export function onGameEvent(
  name: string | "*",
  callback: (data?: unknown) => void,
): () => void {
  return ApexEngine.on((event) => {
    if (event.type === "gameEvent") {
      if (name === "*" || event.name === name) callback(event.data);
    }
  });
}

// ── notifyEnd ─────────────────────────────────────────────────────────────────
//
//  Called by the game canvas implementation when the game ends.
//  Drives the engine into "won" or "lost" state.

export function notifyEnd(result: "won" | "lost", score: number): void {
  ApexEngine.notifyGameEnd(result, score);
}

// ── notifyUpdate ──────────────────────────────────────────────────────────────
//
//  Called each frame (or on significant events) to keep engine stats in sync.

export function notifyUpdate(data: {
  wave?:  number;
  kills?: number;
  score?: number;
}): void {
  ApexEngine.notifyUpdate(data);
}
