/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME REGISTRY  (v2 — with metadata + events)      ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║  Single source of truth for ALL games in the app.       ║
 * ║  Demo games are always injected at position 0-2.        ║
 * ║  User / AI games are persisted in localStorage and      ║
 * ║  broadcast via CustomEvent for real-time Me tab sync.   ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { DEMO_GAMES } from "@/engine/demoGames";
import type { GameConfig } from "@/engine/types";

// ── Custom event name ─────────────────────────────────────────────────────────

export const GAME_CREATED_EVENT = "apex:game-created" as const;
export const GAME_DELETED_EVENT = "apex:game-deleted" as const;

// ── Game metadata ─────────────────────────────────────────────────────────────

export interface GameMeta {
  id:          string;
  createdBy:   "ai" | "user";
  createdAt:   string;   // ISO 8601
  description: string;
}

export type CreatedBySource = GameMeta["createdBy"];

// ── localStorage keys ─────────────────────────────────────────────────────────

const USER_GAMES_KEY   = "apex_saved_games";
const META_KEY         = "apex_game_meta";
const PENDING_GAME_KEY = "apex_pending_game";
const EDITOR_GAME_KEY  = "apex_studio_edit_game";

// ── Descriptions & icons for built-in demos ───────────────────────────────────

export const GAME_DESCRIPTIONS: Record<string, string> = {
  "Neon Platformer": "Collect all coins, stomp enemies, climb to the top. Classic platformer with glowing neon visuals.",
  "Sky Jumper":      "Race across floating islands to reach the goal flag. Watch out for patrolling guards.",
  "Dodge Blitz":     "Survive 30 seconds as waves of enemies rain from above. Move fast, stay alive.",
  "Neon Ops":        "Top-down shooter. Eliminate all enemies. Move with d-pad, aim by facing direction, tap 🔫 to fire.",
  "Street Hoops":    "Arcade basketball. Score 10 points before time runs out. Jump + tap 🏀 to arc-shoot toward the basket.",
};

export const GAME_ICONS: Record<string, string> = {
  "Neon Platformer": "🟣",
  "Sky Jumper":      "🔵",
  "Dodge Blitz":     "🟢",
  "Neon Ops":        "🔫",
  "Street Hoops":    "🏀",
};

// ── Metadata persistence ──────────────────────────────────────────────────────

function loadMeta(): Record<string, GameMeta> {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMeta(map: Record<string, GameMeta>): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(map));
  } catch {}
}

export function getGameMeta(name: string): GameMeta | null {
  return loadMeta()[name] ?? null;
}

function setGameMeta(name: string, meta: GameMeta): void {
  const map = loadMeta();
  map[name]  = meta;
  saveMeta(map);
}

function removeGameMeta(name: string): void {
  const map = loadMeta();
  delete map[name];
  saveMeta(map);
}

// ── User game config persistence ──────────────────────────────────────────────

export function getUserGames(): GameConfig[] {
  try {
    const raw = localStorage.getItem(USER_GAMES_KEY);
    return raw ? (JSON.parse(raw) as GameConfig[]) : [];
  } catch {
    return [];
  }
}

function persistUserGames(games: GameConfig[]): void {
  try {
    localStorage.setItem(USER_GAMES_KEY, JSON.stringify(games));
  } catch {
    console.warn("[GameRegistry] Storage full — could not save games.");
  }
}

// ── Public save / delete API ──────────────────────────────────────────────────

/**
 * Save a game config + metadata, then fire the GAME_CREATED_EVENT so any
 * mounted component (e.g. Me tab) can refresh its game list instantly.
 */
export function saveUserGameEntry(
  cfg:         GameConfig,
  createdBy:   CreatedBySource = "ai",
  description  = "",
): void {
  const games  = getUserGames();
  const exists = games.some((g) => g.name === cfg.name);
  if (!exists) {
    persistUserGames([...games, cfg]);
    console.log(`%c[GameRegistry] GAME SAVED TO REGISTRY: "${cfg.name}"`, "color:#A29BFE;font-weight:bold");
  }

  // Always write / overwrite metadata (so description and timestamp stay fresh)
  const meta: GameMeta = {
    id:          `game_${Math.random().toString(36).slice(2, 10)}`,
    createdBy,
    createdAt:   new Date().toISOString(),
    description: description || `AI-generated ${cfg.winCondition} game`,
  };
  setGameMeta(cfg.name, meta);

  // Broadcast for real-time UI sync (same tab)
  window.dispatchEvent(new CustomEvent(GAME_CREATED_EVENT, { detail: { config: cfg, meta } }));
  console.log(`%c[GameRegistry] ME TAB UPDATED — dispatched "${GAME_CREATED_EVENT}"`, "color:#10B981;font-weight:bold");
}

export function deleteUserGame(name: string): void {
  persistUserGames(getUserGames().filter((g) => g.name !== name));
  removeGameMeta(name);
  window.dispatchEvent(new CustomEvent(GAME_DELETED_EVENT, { detail: { name } }));
}

// ── Unified read API ──────────────────────────────────────────────────────────

/**
 * All games: 3 demos (always) + any user/AI saved games.
 */
export function getAllGames(): GameConfig[] {
  const user = getUserGames();
  console.log(`[GameRegistry] getAllGames: ${DEMO_GAMES.length} demo, ${user.length} saved`);
  return [...DEMO_GAMES, ...user];
}

/**
 * Only the user/AI saved games (no demos).
 */
export function getUserGamesList(): GameConfig[] {
  return getUserGames();
}

// ── Cross-page launch mechanism ───────────────────────────────────────────────

export function queueGameForPlay(cfg: GameConfig): void {
  try {
    localStorage.setItem(PENDING_GAME_KEY, JSON.stringify(cfg));
    console.log(`[GameRegistry] GAME READY TO PLAY: "${cfg.name}"`);
  } catch {}
}

export function queueGameForEdit(cfg: GameConfig): void {
  try {
    localStorage.setItem(EDITOR_GAME_KEY, JSON.stringify(cfg));
    console.log(`[GameRegistry] Game queued for edit: "${cfg.name}"`);
  } catch {}
}

export function consumePendingGame(): GameConfig | null {
  try {
    const raw = localStorage.getItem(PENDING_GAME_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_GAME_KEY);
    return JSON.parse(raw) as GameConfig;
  } catch {
    return null;
  }
}

export function consumeEditorGame(): GameConfig | null {
  try {
    const raw = localStorage.getItem(EDITOR_GAME_KEY);
    if (!raw) return null;
    localStorage.removeItem(EDITOR_GAME_KEY);
    return JSON.parse(raw) as GameConfig;
  } catch {
    return null;
  }
}

// Re-exports
export { DEMO_GAMES };
export type { GameConfig };
