/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — World Builder                             ║
 * ║  Ground · boundary walls · cover objects · neon accents    ║
 * ║                                                             ║
 * ║  Accepts an optional MapConfig from MapGenSystem.           ║
 * ║  Falls back to the hardcoded classic layout.               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";
import type { MapConfig } from "./MapGenSystem";

export interface WallAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// ── Materials ─────────────────────────────────────────────────────────────────

const matFloor    = new THREE.MeshStandardMaterial({ color: 0x12141e, roughness: 0.9, metalness: 0.05 });
const matCeiling  = new THREE.MeshStandardMaterial({ color: 0x0a0b14, roughness: 1 });
const matWall     = new THREE.MeshStandardMaterial({ color: 0x1a1d2e, roughness: 0.7, metalness: 0.1 });
const matBox      = new THREE.MeshStandardMaterial({ color: 0x0f2044, roughness: 0.5, metalness: 0.4 });
const matNeon     = new THREE.MeshStandardMaterial({ color: 0x6c5ce7, emissive: 0x6c5ce7, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.6 });
const matOpt      = new THREE.MeshStandardMaterial({ color: 0x00cec9, emissive: 0x00cec9, emissiveIntensity: 0.15, roughness: 0.5, metalness: 0.4 });

// ── Helpers ───────────────────────────────────────────────────────────────────

function addBox(
  scene:     THREE.Scene,
  aabbs:     WallAABB[],
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  mat:       THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  aabbs.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}

function addPillar(
  scene: THREE.Scene,
  x: number, z: number,
  radius: number, height: number,
  mat: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 8), mat);
  mesh.position.set(x, height / 2, z);
  mesh.castShadow = true;
  scene.add(mesh);
}

// ── Base arena (always built) ──────────────────────────────────────────────────

function buildBase(scene: THREE.Scene, aabbs: WallAABB[]) {
  const HALF   = 32;
  const WALL_H = 6;

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Grid overlay
  const grid = new THREE.GridHelper(HALF * 2, 48, 0x6c5ce7, 0x1a1a3e);
  (grid.material as THREE.LineBasicMaterial).opacity = 0.22;
  (grid.material as THREE.LineBasicMaterial).transparent = true;
  scene.add(grid);

  // Ceiling
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), matCeiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_H;
  scene.add(ceiling);

  // Boundary walls
  for (const [wx, wz, ww, wd] of [
    [0, -HALF, HALF * 2, 0.8],
    [0,  HALF, HALF * 2, 0.8],
    [-HALF, 0, 0.8, HALF * 2],
    [ HALF, 0, 0.8, HALF * 2],
  ] as [number, number, number, number][]) {
    addBox(scene, aabbs, wx, WALL_H / 2, wz, ww, WALL_H, wd, matWall);
  }

  // Corner + mid neon pillars
  for (const [cx, cz] of [
    [-28, -28], [28, -28], [-28, 28], [28, 28],
    [0, -28], [0, 28], [-28, 0], [28, 0],
  ] as [number, number][]) {
    addPillar(scene, cx, cz, 0.3, WALL_H, matNeon.clone());
  }
}

// ── Classic (fallback) cover layout ───────────────────────────────────────────

const CLASSIC_COVERS: [number, number, number, number, number, number][] = [
  [-8,  1,  -6,  2,   2,   2  ],
  [ 7,  1,  -9,  2,   2,   2  ],
  [-5,  1,  10,  4,   2,   1  ],
  [11,  1,   4,  1,   2,   4  ],
  [ 0,  1.5, -16, 6,   3,   2  ],
  [-13, 1.5,  0,  2,   3,   6  ],
  [ 5,  1,   15, 3,   2,   3  ],
  [-7,  1.5, -20, 2.5, 3,   2.5],
  [16,  1.5, -11, 2.5, 3,   2.5],
  [ 0,  1,    0,  3,   2,   3  ],
  [-20, 1,   14,  2,   2,   4  ],
  [ 20, 1,  -14,  4,   2,   2  ],
  [-4,  1,  -10,  1,   3,   5  ],
  [ 9,  1,   -1,  5,   1.5, 1.5],
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build the full FPS arena.
 *
 * If `mapConfig` is provided, cover objects are placed from the AI-generated
 * layout.  Otherwise the classic hand-crafted layout is used.
 */
export function buildWorld(scene: THREE.Scene, mapConfig?: MapConfig): WallAABB[] {
  const aabbs: WallAABB[] = [];

  buildBase(scene, aabbs);

  if (mapConfig) {
    for (const cover of mapConfig.covers) {
      const mat = cover.optimizerAdded ? matOpt.clone() : matBox.clone();
      addBox(scene, aabbs, cover.x, cover.h / 2, cover.z, cover.w, cover.h, cover.d, mat);
    }

    for (const cover of mapConfig.covers) {
      if (cover.type === "pillar") {
        addPillar(scene, cover.x, cover.z, cover.w / 2, cover.h, matNeon.clone());
      }
    }
  } else {
    for (const [cx, cy, cz, cw, ch, cd] of CLASSIC_COVERS) {
      addBox(scene, aabbs, cx, cy, cz, cw, ch, cd, matBox.clone());
    }
  }

  return aabbs;
}
