/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE v4 — Type Definitions                 ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * AI-readable JSON game format — every game is serialisable.
 * v4: added 3D engine modes (fps, openworld) + WorldConfig.
 */
import type { WorldConfig } from "@/engine3d/WorldLoader";

// ── Game Modes ────────────────────────────────────────────────────────────────

export type GameMode = "platformer" | "shooter" | "basketball" | "topdown" | "fps" | "openworld" | "gta";

// ── Config types (JSON-serialisable, what the AI outputs) ─────────────────────

export interface PlayerConfig {
  x:          number;
  y:          number;
  width:      number;
  height:     number;
  color:      string;
  jumpForce:  number;
  speed:      number;
}

export interface PlatformConfig {
  x:      number;
  y:      number;
  width:  number;
  height: number;
  color?: string;
}

export interface EnemyConfig {
  x:        number;
  y:        number;
  width:    number;
  height:   number;
  color?:   string;
  speed?:   number;
  patrol?:  { minX: number; maxX: number };
  hp?:      number;   // shooter mode: how many bullets to kill (default 1)
}

export interface CoinConfig {
  x:      number;
  y:      number;
  radius: number;
  color?: string;
  value?: number;
}

// ── Basketball-specific config ─────────────────────────────────────────────────

export interface BasketConfig {
  x:      number;   // basket rim left edge
  y:      number;   // basket rim y position
  width:  number;   // rim opening width
}

export type WinCondition = 'reach_end' | 'collect_all' | 'defeat_all' | 'survive' | 'score_limit';

export interface GameConfig {
  name:          string;
  player:        PlayerConfig;
  platforms:     PlatformConfig[];
  enemies:       EnemyConfig[];
  coins?:        CoinConfig[];
  gravity:       number;
  winCondition:  WinCondition;
  background?:   string;
  /** Game mode — determines which engine is used (default: "platformer") */
  gameMode?:     GameMode;
  /** Logical canvas width (default 400) */
  width?:        number;
  /** Logical canvas height (default 600) */
  height?:       number;
  /** Survive duration in seconds (only for 'survive') */
  surviveSecs?:  number;
  /** x-coord that triggers reach_end win */
  endX?:         number;
  /** Starting health for shooter mode (default 100) */
  health?:       number;
  /** Milliseconds between shots (default 350) */
  shootCooldown?: number;
  /** Basketball basket config */
  basket?:       BasketConfig;
  /** Points needed to win in basketball (default 10) */
  scoreLimit?:   number;
  /**
   * 3D world config (for fps / openworld / mission modes).
   * When present, the 3D engine loads the scene from this JSON structure
   * instead of using procedural generation.  AI generators populate this.
   */
  worldConfig?:  WorldConfig;
}

// ── Runtime state types (live, not serialised) ────────────────────────────────

export interface Rect {
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface PlayerState extends Rect {
  color:     string;
  vx:        number;
  vy:        number;
  onGround:  boolean;
  jumpForce: number;
  speed:     number;
  score:     number;
  lives:     number;
  facing:    1 | -1;   // 1=right, -1=left
  // shooter extras
  health?:   number;
  maxHealth?: number;
  // movement direction for top-down (angle in radians)
  angle?:    number;
}

export interface PlatformState extends Rect {
  color: string;
}

export interface EnemyState extends Rect {
  color:   string;
  vx:      number;
  vy?:     number;
  alive:   boolean;
  patrol?: { minX: number; maxX: number };
  hp?:     number;
  maxHp?:  number;
}

export interface CoinState {
  x:         number;
  y:         number;
  radius:    number;
  color:     string;
  value:     number;
  collected: boolean;
}

// ── Shooter bullet state ───────────────────────────────────────────────────────

export interface BulletState {
  x:    number;
  y:    number;
  vx:   number;
  vy:   number;
  ttl:  number;   // time-to-live in frames
}

// ── Basketball state ──────────────────────────────────────────────────────────

export interface BallState {
  x:          number;
  y:          number;
  vx:         number;
  vy:         number;
  radius:     number;
  inPossession: boolean;
}

export type GamePhase = 'idle' | 'playing' | 'won' | 'lost';

export interface RemotePlayer {
  id:      string;
  name:    string;
  x:       number;
  y:       number;
  width:   number;
  height:  number;
  color:   string;
  facing:  1 | -1;
}
