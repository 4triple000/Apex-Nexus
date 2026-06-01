/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Open World / Chunk System v2          ║
 * ║  Procedural city · streaming · roads · buildings        ║
 * ║                                                         ║
 * ║  Performance improvements over v1:                      ║
 * ║    ✓ Chunk caching — hide/show instead of destroy/build ║
 * ║    ✓ AABB dirty-flag memoization (zero allocs/frame)    ║
 * ║    ✓ Quality-aware chunk gen (lights, windows, material)║
 * ║    ✓ MeshLambert fallback on low-end devices            ║
 * ║    ✓ Window instancing via merged geometry              ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";
import type { PerfSettings } from "./PerfManager";

export const CHUNK_SIZE   = 48;
export const WORLD_CHUNKS = 8;           // 8×8 = 64 chunks → 384×384 m world
export const WORLD_ORIGIN = -(WORLD_CHUNKS / 2) * CHUNK_SIZE; // -192
export const ROAD_W       = 7;
export const BLOCK        = CHUNK_SIZE - ROAD_W;

export interface BuildingAABB {
  minX: number; maxX: number; minZ: number; maxZ: number; h: number;
}

export interface ChunkData {
  group:        THREE.Group;
  cx:           number;
  cz:           number;
  aabbs:        BuildingAABB[];
  collectibles: CollectibleRef[];
  /** Whether this chunk's group is currently in the scene */
  loaded:       boolean;
}

export interface CollectibleRef {
  mesh:      THREE.Mesh;
  worldPos:  THREE.Vector3;
  collected: boolean;
  missionId: string;
}

// ── Seeded deterministic random ───────────────────────────────────────────────

function sr(cx: number, cz: number, s: number): number {
  let h = (((cx * 374761393 + cz * 1274126177) ^ (s * 2246822519)) >>> 0);
  h = ((h >> 16) ^ h) >>> 0;
  return (h & 0x7FFFFFFF) / 0x7FFFFFFF;
}

// ── Shared material cache ─────────────────────────────────────────────────────

const MAT: Record<string, THREE.Material> = {};
function gm(k: string, f: () => THREE.Material): THREE.Material {
  return (MAT[k] ??= f());
}

// Builds a shared material keyed by color + quality
function getBldMat(color: number, lambert: boolean): THREE.Material {
  const k = `bld_${color}_${lambert}`;
  return gm(k, () => lambert
    ? new THREE.MeshLambertMaterial({ color })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.12 })
  );
}

const BUILDING_COLORS = [0x1a2744, 0x2c3e50, 0x1a252f, 0x2d3436, 0x2c2c54, 0x192a56, 0x1e3799, 0x0d1b2a];
const WIN_COLORS      = [0xffffcc, 0x99ccff, 0xffcc99, 0xccffcc];

// ── Shared geometry pool ──────────────────────────────────────────────────────

const GEO_PLANE_CHUNK = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);
const GEO_ROAD_H      = new THREE.PlaneGeometry(CHUNK_SIZE, ROAD_W);
const GEO_ROAD_V      = new THREE.PlaneGeometry(ROAD_W, CHUNK_SIZE);
const GEO_SW_H        = new THREE.PlaneGeometry(BLOCK, 1.8);
const GEO_SW_V        = new THREE.PlaneGeometry(1.8, BLOCK);
const GEO_STAR        = new THREE.OctahedronGeometry(0.55, 0);
const GEO_WIN         = new THREE.PlaneGeometry(0.9, 1.2);

// ── Chunk generation options ──────────────────────────────────────────────────

export interface ChunkGenOpts {
  lampLights:    boolean;
  maxWindowRows: number;
  lambertMode:   boolean;
}

const DEFAULT_OPTS: ChunkGenOpts = {
  lampLights:    true,
  maxWindowRows: 999,
  lambertMode:   false,
};

// ── Generate one chunk ────────────────────────────────────────────────────────

export function generateChunk(cx: number, cz: number, opts: ChunkGenOpts = DEFAULT_OPTS): ChunkData {
  const { lampLights, maxWindowRows, lambertMode } = opts;
  const group = new THREE.Group();
  const wx = WORLD_ORIGIN + cx * CHUNK_SIZE;
  const wz = WORLD_ORIGIN + cz * CHUNK_SIZE;
  group.position.set(wx, 0, wz);

  const aabbs: BuildingAABB[] = [];
  const collectibles: CollectibleRef[] = [];

  // ── Ground ────────────────────────────────────────────────────────────────
  const ground = new THREE.Mesh(
    GEO_PLANE_CHUNK,
    gm("gnd", () => new THREE.MeshLambertMaterial({ color: 0x111316 })),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(CHUNK_SIZE / 2, -0.01, CHUNK_SIZE / 2);
  ground.receiveShadow = !lambertMode;
  group.add(ground);

  // ── Roads ─────────────────────────────────────────────────────────────────
  const roadMat = gm("road", () => new THREE.MeshLambertMaterial({ color: 0x1d2124 }));

  const rx = new THREE.Mesh(GEO_ROAD_H, roadMat);
  rx.rotation.x = -Math.PI / 2;
  rx.position.set(CHUNK_SIZE / 2, 0, ROAD_W / 2);
  group.add(rx);

  const rz = new THREE.Mesh(GEO_ROAD_V, roadMat);
  rz.rotation.x = -Math.PI / 2;
  rz.position.set(ROAD_W / 2, 0, CHUNK_SIZE / 2);
  group.add(rz);

  // Road dashes — only in high/medium
  if (maxWindowRows > 2) {
    const dashMat = gm("dash", () => new THREE.MeshBasicMaterial({ color: 0xffee00 }));
    const GEO_DH  = new THREE.PlaneGeometry(5, 0.25);
    const GEO_DV  = new THREE.PlaneGeometry(0.25, 5);
    for (let d = 0; d < 3; d++) {
      const o = ROAD_W + (BLOCK * (d + 0.5)) / 3;
      const dh = new THREE.Mesh(GEO_DH, dashMat);
      dh.rotation.x = -Math.PI / 2;
      dh.position.set(o, 0.01, ROAD_W / 2);
      group.add(dh);
      const dv = new THREE.Mesh(GEO_DV, dashMat);
      dv.rotation.x = -Math.PI / 2;
      dv.position.set(ROAD_W / 2, 0.01, o);
      group.add(dv);
    }
  }

  // ── Sidewalks ─────────────────────────────────────────────────────────────
  const swMat = gm("sw", () => new THREE.MeshLambertMaterial({ color: 0x26292d }));
  const sw1 = new THREE.Mesh(GEO_SW_H, swMat);
  sw1.rotation.x = -Math.PI / 2;
  sw1.position.set(ROAD_W + BLOCK / 2, 0.01, ROAD_W + 0.9);
  group.add(sw1);
  const sw2 = new THREE.Mesh(GEO_SW_V, swMat);
  sw2.rotation.x = -Math.PI / 2;
  sw2.position.set(ROAD_W + 0.9, 0.01, ROAD_W + BLOCK / 2);
  group.add(sw2);

  // ── Buildings ─────────────────────────────────────────────────────────────
  const iStart = ROAD_W + 2.5;
  const iEnd   = CHUNK_SIZE - 2.5;
  const iSize  = iEnd - iStart;
  const nBuildings = 1 + Math.floor(sr(cx, cz, 0) * 3);

  for (let b = 0; b < nBuildings; b++) {
    const bw = 5  + sr(cx, cz, b * 11 + 1) * 12;
    const bd = 5  + sr(cx, cz, b * 11 + 2) * 12;
    const bh = 6  + sr(cx, cz, b * 11 + 3) * 28;
    const bx = iStart + sr(cx, cz, b * 11 + 4) * Math.max(0, iSize - bw);
    const bz = iStart + sr(cx, cz, b * 11 + 5) * Math.max(0, iSize - bd);
    const bc = BUILDING_COLORS[Math.floor(sr(cx, cz, b * 11 + 6) * BUILDING_COLORS.length)]!;

    const bMat = getBldMat(bc, lambertMode);
    const bld  = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bMat);
    bld.position.set(bx + bw / 2, bh / 2, bz + bd / 2);
    bld.castShadow    = !lambertMode;
    bld.receiveShadow = !lambertMode;
    group.add(bld);

    aabbs.push({ minX: wx + bx, maxX: wx + bx + bw, minZ: wz + bz, maxZ: wz + bz + bd, h: bh });

    // ── Windows — batch into a single InstancedMesh per building ──────────
    if (maxWindowRows > 0) {
      const winRows = Math.min(maxWindowRows, Math.max(1, Math.floor(bh / 3.8)));
      const winCols = Math.max(1, Math.floor(bw / 2.8));
      const maxInst = winRows * winCols;

      if (maxInst > 0) {
        // Collect lit instances on front face, cull dark ones
        const dummy      = new THREE.Object3D();
        const litIndices: Array<{ r: number; c: number }> = [];
        for (let wr = 0; wr < winRows; wr++) {
          for (let wc = 0; wc < winCols; wc++) {
            if (sr(cx, cz, b * 500 + wr * 20 + wc) < 0.45) continue;
            litIndices.push({ r: wr, c: wc });
          }
        }
        if (litIndices.length > 0) {
          const wColVal = WIN_COLORS[Math.floor(sr(cx, cz, b * 500 + 300) * WIN_COLORS.length)]!;
          const wMat    = gm(`win_${wColVal}`, () => new THREE.MeshBasicMaterial({ color: wColVal }));
          const iMesh   = new THREE.InstancedMesh(GEO_WIN, wMat, litIndices.length);
          iMesh.count   = litIndices.length;
          let idx = 0;
          for (const { r, c } of litIndices) {
            const px2 = c * 2.8 - bw / 2 + 1.4;
            const py2 = r * 3.8 + 2.5 - bh / 2;
            dummy.position.set(bx + bw / 2 + px2, bh / 2 + py2, bz + bd / 2 + bd / 2 + 0.01);
            dummy.updateMatrix();
            iMesh.setMatrixAt(idx++, dummy.matrix);
          }
          iMesh.instanceMatrix.needsUpdate = true;
          group.add(iMesh);
        }
      }
    }
  }

  // ── Trees ─────────────────────────────────────────────────────────────────
  const nTrees = lambertMode ? 0 : 1 + Math.floor(sr(cx, cz, 90) * 3);
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.18, 2.2, 5);
  for (let t = 0; t < nTrees; t++) {
    const tx = ROAD_W + 1.2 + sr(cx, cz, t * 13 + 200) * (CHUNK_SIZE - ROAD_W - 3);
    const tz = ROAD_W + 1.2 + sr(cx, cz, t * 13 + 201) * (CHUNK_SIZE - ROAD_W - 3);

    const trunk = new THREE.Mesh(
      trunkGeo,
      gm("trunk", () => new THREE.MeshLambertMaterial({ color: 0x3e2723 })),
    );
    trunk.position.set(tx, 1.1, tz);
    group.add(trunk);

    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 + sr(cx, cz, t * 13 + 202) * 0.9, 5, 4),
      gm("foliage", () => new THREE.MeshLambertMaterial({ color: 0x1b5e20 })),
    );
    foliage.position.set(tx, 3.2 + sr(cx, cz, t * 13 + 203) * 0.6, tz);
    group.add(foliage);
  }

  // ── Lampposts (optional point lights) ─────────────────────────────────────
  const poleMat = gm("pole", () => new THREE.MeshLambertMaterial({ color: 0x445566 }));
  const bulbMat = gm("bulb", () => new THREE.MeshBasicMaterial({ color: 0xfff0a0 }));
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.07, 5.5, 5);
  const bulbGeo = new THREE.SphereGeometry(0.2, 5, 4);

  for (let l = 0; l < 2; l++) {
    const lx = ROAD_W + 2 + l * (CHUNK_SIZE - ROAD_W - 5);
    const lz = ROAD_W + 1.5;
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(lx, 2.75, lz);
    group.add(pole);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(lx, 5.65, lz);
    group.add(bulb);
    // Point light only when quality allows
    if (lampLights) {
      const pl = new THREE.PointLight(0xffeebb, 0.3, 12);
      pl.position.set(lx, 5.5, lz);
      group.add(pl);
    }
  }

  // ── Collectible stars ─────────────────────────────────────────────────────
  if ((cx + cz) % 4 === 0) {
    const sx = ROAD_W + 5 + sr(cx, cz, 500) * (BLOCK - 10);
    const sz = ROAD_W + 5 + sr(cx, cz, 501) * (BLOCK - 10);
    const star = new THREE.Mesh(
      GEO_STAR,
      new THREE.MeshBasicMaterial({ color: 0xffdd00 }),
    );
    star.position.set(sx, 1.4, sz);
    star.userData.collectible = true;
    star.userData.missionId   = "collect";
    group.add(star);
    collectibles.push({
      mesh: star,
      worldPos: new THREE.Vector3(wx + sx, 1.4, wz + sz),
      collected: false,
      missionId: "collect",
    });
  }

  return { group, cx, cz, aabbs, collectibles, loaded: false };
}

// ── Chunk Manager v2 ──────────────────────────────────────────────────────────
//
//  Key optimizations vs v1:
//
//  1. CHUNK CACHE — chunks are NEVER destroyed once generated.
//     Out-of-range chunks get `group.visible = false` (cost ≈ 0).
//     Returning chunks get `group.visible = true` (cost ≈ 0).
//     Only the very first visit to a chunk pays the generation cost.
//
//  2. AABB MEMOIZATION — `getAllAABBs()` only rebuilds its array
//     when the visible set changes (dirty flag).  Every other frame
//     it returns the same cached array → zero allocation per frame.
//
//  3. COLLECTIBLES MEMOIZATION — same dirty-flag pattern.

export class ChunkManager {
  private scene:   THREE.Scene;
  private rad:     number;
  private opts:    ChunkGenOpts;

  /** Full chunk cache — all ever-generated chunks live here */
  private _cache:   Map<string, ChunkData> = new Map();
  /** Keys of chunks currently visible */
  private _visible: Set<string> = new Set();

  /** Dirty flag — set when visible set changes */
  private _aabbDirty = true;
  private _colDirty  = true;

  /** Memoized flat arrays */
  private _aabbCache: BuildingAABB[]  = [];
  private _colCache:  CollectibleRef[] = [];

  private newChunksCb?: (c: ChunkData) => void;

  constructor(
    scene:   THREE.Scene,
    radius = 2,
    onNew?:  (c: ChunkData) => void,
    opts:    Partial<ChunkGenOpts> = {},
  ) {
    this.scene = scene;
    this.rad   = radius;
    this.opts  = { ...DEFAULT_OPTS, ...opts };
    this.newChunksCb = onNew;
  }

  applyPerfSettings(ps: PerfSettings): void {
    this.rad  = ps.chunkRadius;
    this.opts = {
      lampLights:    ps.lampLights,
      maxWindowRows: ps.maxWindowRows,
      lambertMode:   ps.lambertMode,
    };
  }

  update(worldX: number, worldZ: number): void {
    const px = Math.floor((worldX - WORLD_ORIGIN) / CHUNK_SIZE);
    const pz = Math.floor((worldZ - WORLD_ORIGIN) / CHUNK_SIZE);

    const nextVisible = new Set<string>();

    // Determine which chunks should be visible
    for (let cx = px - this.rad; cx <= px + this.rad; cx++) {
      for (let cz = pz - this.rad; cz <= pz + this.rad; cz++) {
        if (cx < 0 || cx >= WORLD_CHUNKS || cz < 0 || cz >= WORLD_CHUNKS) continue;
        nextVisible.add(`${cx},${cz}`);
      }
    }

    // Show newly-visible chunks (generate if not yet cached)
    for (const key of nextVisible) {
      if (!this._visible.has(key)) {
        // Need to become visible
        let data = this._cache.get(key);
        if (!data) {
          // First time — generate
          const [cx, cz] = key.split(",").map(Number) as [number, number];
          data = generateChunk(cx, cz, this.opts);
          this._cache.set(key, data);
          this.newChunksCb?.(data);
        }
        data.group.visible = true;
        data.loaded        = true;
        this.scene.add(data.group);   // safe to call even if already added
        this._aabbDirty = true;
        this._colDirty  = true;
      }
    }

    // Hide chunks that left the radius
    for (const key of this._visible) {
      if (!nextVisible.has(key)) {
        const data = this._cache.get(key);
        if (data) {
          data.group.visible = false;
          data.loaded        = false;
          this._aabbDirty    = true;
          this._colDirty     = true;
        }
      }
    }

    this._visible = nextVisible;
  }

  /** Zero-allocation AABB fetch — only rebuilds when visible set changed */
  getAllAABBs(): BuildingAABB[] {
    if (!this._aabbDirty) return this._aabbCache;
    this._aabbCache = [];
    for (const key of this._visible) {
      const d = this._cache.get(key);
      if (d) this._aabbCache.push(...d.aabbs);
    }
    this._aabbDirty = false;
    return this._aabbCache;
  }

  /** Zero-allocation collectible fetch */
  getAllCollectibles(): CollectibleRef[] {
    if (!this._colDirty) return this._colCache;
    this._colCache = [];
    for (const key of this._visible) {
      const d = this._cache.get(key);
      if (d) this._colCache.push(...d.collectibles);
    }
    this._colDirty = false;
    return this._colCache;
  }

  /** Mark collectibles dirty (e.g. when one is collected) */
  markCollectiblesDirty(): void { this._colDirty = true; }

  dispose(): void {
    for (const d of this._cache.values()) {
      this.scene.remove(d.group);
    }
    this._cache.clear();
    this._visible.clear();
  }
}
