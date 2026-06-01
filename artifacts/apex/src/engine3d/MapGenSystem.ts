/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — AI Map Generation System                  ║
 * ║                                                             ║
 * ║  Generates procedural arena maps with:                     ║
 * ║    🎲  Seeded PRNG for reproducible seeds                  ║
 * ║    🏗  Density-grid cover placement                         ║
 * ║    🛤  Natural path corridors                               ║
 * ║    📍  Balanced spawn points                               ║
 * ║    💾  localStorage persistence                            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type CoverType = "crate" | "wall" | "pillar" | "building";

export interface CoverObject {
  id:   string;
  x:    number;
  z:    number;
  w:    number;
  h:    number;
  d:    number;
  type: CoverType;
  /** Added by optimizer post-generation (not in original seed) */
  optimizerAdded?: boolean;
}

export interface SpawnPoint {
  x:      number;
  z:      number;
  weight: number;
}

export interface PathCorridor {
  fromX: number; fromZ: number;
  toX:   number; toZ:   number;
  width: number;
}

export interface MapConfig {
  id:              string;
  seed:            number;
  version:         number;
  covers:          CoverObject[];
  spawnPoints:     SpawnPoint[];
  paths:           PathCorridor[];
  generationCount: number;
  optimizationLog: string[];
  createdAt:       number;
}

// ── Seeded PRNG ───────────────────────────────────────────────────────────────

function makePRNG(seed: number) {
  let s = (seed ^ 0xDEADBEEF) >>> 0;
  const next = () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    s = s >>> 0;
    return s / 0xFFFFFFFF;
  };
  return {
    next,
    range: (min: number, max: number) => min + next() * (max - min),
    int:   (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    pick:  <T>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const ARENA_HALF = 30;   // World bounds ±30
export const CELL_SIZE  = 4;    // Density-grid cell size
const GRID  = Math.floor((ARENA_HALF * 2) / CELL_SIZE);  // 15 per axis

// ── Cover size library ────────────────────────────────────────────────────────

const COVER_SIZES: Record<CoverType, [number, number, number][]> = {
  crate:    [[2, 2, 2], [3, 2, 3], [1.5, 2.5, 1.5], [2.5, 2, 2.5]],
  wall:     [[1, 3, 5], [5, 3, 1], [1, 2.5, 4],     [4, 2.5, 1]],
  pillar:   [[1, 5, 1], [0.8, 4.5, 0.8],             [1.2, 4, 1.2]],
  building: [[4, 4, 4], [5, 3.5, 3], [3, 3, 5],      [6, 3, 4]],
};

// ── Map generation ────────────────────────────────────────────────────────────

export function generateMap(seed?: number): MapConfig {
  const s = seed !== undefined ? (seed >>> 0) : (Math.floor(Math.random() * 0xFFFFFFF));
  const rng = makePRNG(s);
  const covers: CoverObject[] = [];
  let idN = 0;

  // ── 1. Build density weight grid with pseudo-noise ─────────────────────────
  const weights: number[][] = Array.from({ length: GRID }, (_, i) =>
    Array.from({ length: GRID }, (__, j) => {
      const ni = i / GRID;
      const nj = j / GRID;
      // Stacked waves for organic variation
      const base =
        Math.abs(Math.sin(ni * 7.1 + s * 0.00001) * Math.cos(nj * 6.3 + s * 0.000007)) +
        Math.abs(Math.sin(ni * 3.2 + 1.5) * Math.cos(nj * 4.5)) * 0.5 +
        rng.next() * 0.25;
      // Reduce weight near center (keep spawn area clear) and edges
      const distCenter = Math.hypot(ni - 0.5, nj - 0.5);
      const edgeFade = Math.min(ni, 1 - ni, nj, 1 - nj) * 4;
      return base * edgeFade * (0.4 + distCenter * 1.2);
    })
  );

  // ── 2. Sort cells by weight, place cover objects ───────────────────────────
  const cells = weights
    .flatMap((row, i) => row.map((w, j) => ({ i, j, w })))
    .sort((a, b) => b.w - a.w);

  const target = rng.int(12, 18);

  for (const cell of cells) {
    if (covers.length >= target) break;

    const wx = -ARENA_HALF + cell.i * CELL_SIZE + CELL_SIZE / 2 + rng.range(-1, 1);
    const wz = -ARENA_HALF + cell.j * CELL_SIZE + CELL_SIZE / 2 + rng.range(-1, 1);

    // Keep spawn center clear
    if (Math.abs(wx) < 7 && Math.abs(wz) < 7) continue;
    // Keep edges clear for movement
    if (Math.abs(wx) > ARENA_HALF - 4 || Math.abs(wz) > ARENA_HALF - 4) continue;

    // Enforce minimum spacing between covers
    if (covers.some(c => Math.hypot(c.x - wx, c.z - wz) < 4.5)) continue;

    const type = rng.pick<CoverType>(["crate", "crate", "wall", "pillar", "building"]);
    const [w, h, d] = rng.pick(COVER_SIZES[type]);

    covers.push({ id: `c${idN++}`, x: wx, z: wz, w, h, d, type });
  }

  // ── 3. Carve natural path corridors ───────────────────────────────────────
  const paths: PathCorridor[] = [
    { fromX: -ARENA_HALF, fromZ: 0,           toX: ARENA_HALF, toZ: 0,           width: 5 },
    { fromX: 0,           fromZ: -ARENA_HALF, toX: 0,          toZ: ARENA_HALF,  width: 5 },
    { fromX: -ARENA_HALF, fromZ: -ARENA_HALF, toX: ARENA_HALF, toZ: ARENA_HALF,  width: 4 },
  ];

  // ── 4. Balanced spawn points (center + 4 quadrants + 2 edge mids) ─────────
  const sp = ARENA_HALF * 0.6;
  const spawnPoints: SpawnPoint[] = [
    { x: 0,   z: 0,   weight: 1.0 },
    { x: -sp, z: -sp, weight: 0.8 },
    { x:  sp, z: -sp, weight: 0.8 },
    { x: -sp, z:  sp, weight: 0.8 },
    { x:  sp, z:  sp, weight: 0.8 },
    { x: 0,   z: -ARENA_HALF * 0.72, weight: 0.6 },
    { x: 0,   z:  ARENA_HALF * 0.72, weight: 0.6 },
  ];

  return {
    id:              `map_${s.toString(16).padStart(7, "0")}`,
    seed:            s,
    version:         1,
    covers,
    spawnPoints,
    paths,
    generationCount: 0,
    optimizationLog: [`✨ Generated (seed 0x${s.toString(16).toUpperCase()}, ${covers.length} objects)`],
    createdAt:       Date.now(),
  };
}

// ── Persistence ───────────────────────────────────────────────────────────────

const KEY = "apex:mapConfig_v2";

export function saveMapConfig(cfg: MapConfig): void {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}

export function loadMapConfig(): MapConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MapConfig) : null;
  } catch { return null; }
}

export function clearMapConfig(): void {
  localStorage.removeItem(KEY);
}

/** Return a fresh random seed string for display */
export function seedLabel(s: number): string {
  return `0x${s.toString(16).toUpperCase().padStart(6, "0")}`;
}
