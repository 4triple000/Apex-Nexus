/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Performance Manager                   ║
 * ║                                                         ║
 * ║  Auto-detects device capability and returns a bundle    ║
 * ║  of quality settings that every engine sub-system       ║
 * ║  can consume.                                           ║
 * ║                                                         ║
 * ║  Quality tiers:                                         ║
 * ║    high   — desktop / high-end (shadows on, full res)   ║
 * ║    medium — mid desktop / tablet                        ║
 * ║    low    — mobile / low-end (aggressive cuts)          ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type QualityLevel = "high" | "medium" | "low";

export interface PerfSettings {
  quality:        QualityLevel;
  /** devicePixelRatio cap */
  pixelRatio:     number;
  /** WebGL antialiasing */
  antialias:      boolean;
  /** Cast + receive shadows */
  shadowEnabled:  boolean;
  /** Shadow map resolution (must be power-of-2) */
  shadowMapSize:  number;
  /** Three.js FogExp2 density — higher = shorter draw distance */
  fogDensity:     number;
  /** Chunk streaming radius in chunk units */
  chunkRadius:    number;
  /** Max NPCs to spawn */
  maxNPCs:        number;
  /** Max simultaneous AI evaluations per update batch */
  maxActiveNPCs:  number;
  /** NPC AI update rate in Hz (evaluations per second) */
  npcAIHz:        number;
  /** Distance at which NPC AI is skipped (metres) */
  npcAISleep:     number;
  /** Distance at which NPC models are hidden (metres) */
  npcVisDistance: number;
  /** Whether to add per-chunk PointLights (lampposts) */
  lampLights:     boolean;
  /** Max windows per building face (0 = none) */
  maxWindowRows:  number;
  /** Whether to use MeshLambertMaterial instead of MeshStandard */
  lambertMode:    boolean;
  /** Whether this is a coarse-pointer (touch) device */
  isMobile:       boolean;
}

// ── Preset tiers ──────────────────────────────────────────────────────────────

const HIGH: PerfSettings = {
  quality:       "high",
  pixelRatio:    2,
  antialias:     true,
  shadowEnabled: true,
  shadowMapSize: 1024,
  fogDensity:    0.006,
  chunkRadius:   3,
  maxNPCs:       20,
  maxActiveNPCs: 20,
  npcAIHz:       10,
  npcAISleep:    80,
  npcVisDistance:100,
  lampLights:    true,
  maxWindowRows: 999,
  lambertMode:   false,
  isMobile:      false,
};

const MEDIUM: PerfSettings = {
  quality:       "medium",
  pixelRatio:    1.5,
  antialias:     false,
  shadowEnabled: true,
  shadowMapSize: 512,
  fogDensity:    0.009,
  chunkRadius:   2,
  maxNPCs:       12,
  maxActiveNPCs: 12,
  npcAIHz:       6,
  npcAISleep:    50,
  npcVisDistance:60,
  lampLights:    true,
  maxWindowRows: 4,
  lambertMode:   false,
  isMobile:      false,
};

const LOW: PerfSettings = {
  quality:       "low",
  pixelRatio:    1,
  antialias:     false,
  shadowEnabled: false,
  shadowMapSize: 256,
  fogDensity:    0.014,
  chunkRadius:   2,
  maxNPCs:       8,
  maxActiveNPCs: 8,
  npcAIHz:       4,
  npcAISleep:    35,
  npcVisDistance:40,
  lampLights:    false,
  maxWindowRows: 2,
  lambertMode:   true,
  isMobile:      true,
};

export const PERF_PRESETS: Record<QualityLevel, PerfSettings> = { high: HIGH, medium: MEDIUM, low: LOW };

// ── Auto-detect ───────────────────────────────────────────────────────────────

export function detectPerfSettings(): PerfSettings {
  const isMobile   = typeof window !== "undefined"
    && (window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
  const cores      = navigator.hardwareConcurrency ?? 4;
  const mem        = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4; // GB
  const hiRes      = window.devicePixelRatio >= 2;

  // Mobile → always low
  if (isMobile) return { ...LOW, isMobile: true };

  // Very weak CPU/RAM
  if (cores <= 2 || mem <= 2) return { ...LOW, isMobile: false };

  // Mid-range
  if (cores <= 4 || (!hiRes && cores <= 6)) return { ...MEDIUM, isMobile: false };

  // High-end
  return { ...HIGH, isMobile: false };
}

// ── Per-frame budget helper ───────────────────────────────────────────────────
// Returns the ideal max dt cap for the game loop.
export function maxDt(): number { return 1 / 20; }  // never simulate more than 50ms
