/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — World Loader                          ║
 * ║  Load a full 3D world from a structured JSON config     ║
 * ║                                                         ║
 * ║  Input:  WorldConfig JSON (from AI or hand-crafted)     ║
 * ║  Output: Three.js scene populated with all objects,     ║
 * ║          AABB array for collision, entity references    ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";
import { PropEntity, PickupEntity, TriggerEntity, EntityManager } from "./Entity";

// ── World Config Types (AI output format) ─────────────────────────────────────

export type ObjectType = "ground" | "box" | "building" | "wall" | "ramp" | "prop" | "enemy_spawn";
export type MaterialType = "standard" | "basic" | "emissive";
export type EnemyBehavior = "patrol" | "chase" | "guard" | "sniper";
export type GameObjective = "eliminate_all" | "collect_all" | "reach_point" | "survive" | "escort";

export interface WorldObject {
  id:         string;
  type:       ObjectType;
  position:   { x: number; y: number; z: number };
  scale:      { x: number; y: number; z: number };
  rotation?:  { x: number; y: number; z: number };
  color?:     string;               // CSS hex string e.g. "#2c3e50"
  material?:  MaterialType;
  emissive?:  string;               // optional emissive overlay color
  castShadow?: boolean;
  receiveShadow?: boolean;
  meta?: Record<string, unknown>;   // arbitrary extra data
}

export interface EnemySpawnConfig {
  id?:      string;
  spawn:    { x: number; y: number; z: number };
  hp:       number;
  speed:    number;
  behavior: EnemyBehavior;
  patrol?:  Array<{ x: number; y: number; z: number }>;
}

export interface PickupConfig {
  id:       string;
  position: { x: number; y: number; z: number };
  kind:     "star" | "health" | "ammo" | "key";
  value?:   number;
}

export interface MissionPoint {
  id:       string;
  position: { x: number; y: number; z: number };
  radius:   number;
  label?:   string;
}

export interface WorldConfig {
  mode:         "fps" | "openworld" | "mission";
  name?:        string;
  world: {
    skyColor?:  string;
    fogColor?:  string;
    fogDensity?: number;
    ambientColor?: string;
    ambientIntensity?: number;
    sunColor?:  string;
    sunDirection?: { x: number; y: number; z: number };
    objects:    WorldObject[];
  };
  enemies:      EnemySpawnConfig[];
  pickups?:     PickupConfig[];
  missionPoints?: MissionPoint[];
  playerSpawn:  { x: number; y: number; z: number };
  objective:    GameObjective;
}

// ── AABB for collision ─────────────────────────────────────────────────────────

export interface WorldAABB {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  minY: number; maxY: number;
  id:   string;
}

// ── Loaded world result ───────────────────────────────────────────────────────

export interface LoadedWorld {
  config:       WorldConfig;
  entities:     EntityManager;
  aabbs:        WorldAABB[];
  enemySpawns:  Array<{ pos: THREE.Vector3; config: EnemySpawnConfig }>;
  pickupRefs:   PickupEntity[];
  triggers:     TriggerEntity[];
  playerStart:  THREE.Vector3;
  dispose():    void;
}

// ── Material cache ────────────────────────────────────────────────────────────

const matCache = new Map<string, THREE.Material>();
function getMat(key: string, factory: () => THREE.Material): THREE.Material {
  return matCache.get(key) ?? (() => { const m = factory(); matCache.set(key, m); return m; })();
}

// ── Build a Three.js material from config ─────────────────────────────────────

function buildMaterial(obj: WorldObject): THREE.Material {
  const color    = obj.color    ? parseInt(obj.color.replace("#", ""), 16) : 0x2c3e50;
  const emissive = obj.emissive ? parseInt(obj.emissive.replace("#", ""), 16) : 0x000000;
  const matType  = obj.material ?? "standard";
  const key      = `${matType}_${obj.color}_${obj.emissive}`;

  if (matType === "basic") {
    return getMat(key, () => new THREE.MeshBasicMaterial({ color }));
  }
  if (matType === "emissive") {
    return getMat(key, () => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.3 }));
  }
  // Default: standard
  return getMat(key, () => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.08 }));
}

// ── Build geometry from object type ───────────────────────────────────────────

function buildGeometry(obj: WorldObject): THREE.BufferGeometry {
  const { x: sx, y: sy, z: sz } = obj.scale;

  switch (obj.type) {
    case "ramp": {
      // Wedge shape
      const geo = new THREE.CylinderGeometry(0, 1, 1, 4, 1);
      geo.scale(sx, sy, sz);
      geo.rotateY(Math.PI / 4);
      return geo;
    }
    case "ground":
      return new THREE.PlaneGeometry(sx, sz);
    default:
      return new THREE.BoxGeometry(sx, sy, sz);
  }
}

// ── Window decoration for building faces ──────────────────────────────────────

function addWindows(mesh: THREE.Mesh, obj: WorldObject): void {
  const { y: h, x: w, z: d } = obj.scale;
  if (h < 4 || w < 2) return;

  const winMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
  const rows = Math.max(1, Math.floor(h / 3.5));
  const cols = Math.max(1, Math.floor(w / 2.5));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.4) continue; // ~60% lit
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), winMat);
      win.position.set(c * 2.5 - w / 2 + 1.25, r * 3.5 + 2 - h / 2, d / 2 + 0.01);
      mesh.add(win);
    }
  }
}

// ── Core loader ───────────────────────────────────────────────────────────────

export function loadWorld(config: WorldConfig, scene: THREE.Scene): LoadedWorld {
  const entities    = new EntityManager();
  const aabbs:      WorldAABB[]    = [];
  const enemySpawns = config.enemies.map((e) => ({
    pos:    new THREE.Vector3(e.spawn.x, e.spawn.y, e.spawn.z),
    config: e,
  }));
  const pickupRefs: PickupEntity[]  = [];
  const triggers:   TriggerEntity[] = [];

  // ── Scene environment ──────────────────────────────────────────────────────
  const w = config.world;
  const skyCol = w.skyColor ? parseInt(w.skyColor.replace("#", ""), 16) : 0x070a14;
  scene.background = new THREE.Color(skyCol);

  if (w.fogColor !== undefined) {
    const fogCol = parseInt((w.fogColor ?? "#070a14").replace("#", ""), 16);
    scene.fog = new THREE.FogExp2(fogCol, w.fogDensity ?? 0.012);
  }

  // Ambient light
  const ambCol = w.ambientColor ? parseInt(w.ambientColor.replace("#", ""), 16) : 0x334466;
  const ambInt = w.ambientIntensity ?? 0.55;
  const ambient = new THREE.AmbientLight(ambCol, ambInt);
  scene.add(ambient);

  // Directional (sun/moon)
  const sunCol = w.sunColor ? parseInt(w.sunColor.replace("#", ""), 16) : 0x8899cc;
  const sun    = new THREE.DirectionalLight(sunCol, 0.65);
  const sd     = w.sunDirection ?? { x: 40, y: 80, z: 40 };
  sun.position.set(sd.x, sd.y, sd.z);
  sun.castShadow               = true;
  sun.shadow.camera.near       = 0.1;
  sun.shadow.camera.far        = 300;
  sun.shadow.camera.left       = sun.shadow.camera.bottom = -80;
  sun.shadow.camera.right      = sun.shadow.camera.top   =  80;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  // ── World objects ──────────────────────────────────────────────────────────
  for (const obj of w.objects) {
    const geo = buildGeometry(obj);
    const mat = buildMaterial(obj);
    const p   = obj.position;
    const pos = new THREE.Vector3(p.x, p.y, p.z);

    if (obj.type === "ground") {
      // Ground is a plane — lay flat
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(pos);
      mesh.receiveShadow = true;
      scene.add(mesh);
      continue;
    }

    const prop = new PropEntity(
      obj.id,
      scene,
      geo,
      mat,
      pos,
      new THREE.Vector3(1, 1, 1), // scale already baked into geometry
    );

    // Apply rotation override
    if (obj.rotation) {
      const { x, y, z } = obj.rotation;
      prop.rootObject?.rotation.set(x, y, z);
    }

    if (obj.castShadow !== false) {
      prop.rootObject?.traverse((c: THREE.Object3D) => {
        if (c instanceof THREE.Mesh) c.castShadow = true;
      });
    }

    // Window decoration for buildings
    if (obj.type === "building" && prop.rootObject instanceof THREE.Mesh) {
      addWindows(prop.rootObject as THREE.Mesh, obj);
    }

    // AABB for solid objects
    if (obj.type !== "prop") {
      const { x: sx, y: sy, z: sz } = obj.scale;
      aabbs.push({
        id:   obj.id,
        minX: p.x - sx / 2, maxX: p.x + sx / 2,
        minZ: p.z - sz / 2, maxZ: p.z + sz / 2,
        minY: p.y - sy / 2, maxY: p.y + sy / 2,
      });
    }

    entities.add(prop);
  }

  // ── Pickups ────────────────────────────────────────────────────────────────
  const pickupColorMap: Record<string, number> = {
    star: 0xffdd00, health: 0x00ff88, ammo: 0xff6666, key: 0x00aaff,
  };

  for (const pk of config.pickups ?? []) {
    const color = pickupColorMap[pk.kind] ?? 0xffffff;
    const ent   = new PickupEntity(
      pk.id, scene,
      new THREE.Vector3(pk.position.x, pk.position.y, pk.position.z),
      color,
    );
    entities.add(ent);
    pickupRefs.push(ent);
  }

  // ── Mission point triggers ─────────────────────────────────────────────────
  for (const mp of config.missionPoints ?? []) {
    const trig = new TriggerEntity(
      mp.id, scene,
      new THREE.Vector3(mp.position.x, mp.position.y, mp.position.z),
      { radius: mp.radius, once: false },
    );
    entities.add(trig);
    triggers.push(trig);
  }

  // ── Enemy spawn markers (debug visualizers) ────────────────────────────────
  for (const es of enemySpawns) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.55 }),
    );
    marker.position.copy(es.pos);
    scene.add(marker);
    setTimeout(() => scene.remove(marker), 5000); // disappears after 5s
  }

  return {
    config,
    entities,
    aabbs,
    enemySpawns,
    pickupRefs,
    triggers,
    playerStart: new THREE.Vector3(
      config.playerSpawn.x,
      config.playerSpawn.y,
      config.playerSpawn.z,
    ),
    dispose() {
      entities.destroyAll();
      matCache.clear();
      scene.remove(ambient, sun);
    },
  };
}

// ── Sample world configs ──────────────────────────────────────────────────────
//  These are ready-to-use WorldConfig objects for demos + testing.

export const SAMPLE_WORLDS: Record<string, WorldConfig> = {

  // ── Neon Warehouse (FPS) ──────────────────────────────────────────────────
  neon_warehouse: {
    mode: "fps",
    name: "Neon Warehouse",
    world: {
      skyColor: "#060810",
      fogColor: "#060810",
      fogDensity: 0.018,
      ambientColor: "#223344",
      ambientIntensity: 0.5,
      sunColor: "#6677cc",
      objects: [
        { id: "floor",  type: "ground",    position: { x:0,  y:0,    z:0   }, scale: { x:80, y:0.1, z:80 }, color: "#151820" },
        { id: "wall_n", type: "wall",      position: { x:0,  y:4,    z:-30 }, scale: { x:60, y:8,   z:0.5 }, color: "#1a2035" },
        { id: "wall_s", type: "wall",      position: { x:0,  y:4,    z:30  }, scale: { x:60, y:8,   z:0.5 }, color: "#1a2035" },
        { id: "wall_e", type: "wall",      position: { x:30, y:4,    z:0   }, scale: { x:0.5,y:8,   z:60  }, color: "#1a2035" },
        { id: "wall_w", type: "wall",      position: { x:-30,y:4,    z:0   }, scale: { x:0.5,y:8,   z:60  }, color: "#1a2035" },
        { id: "box1",   type: "prop",      position: { x:8,  y:0.75, z:5   }, scale: { x:1.5,y:1.5, z:1.5 }, color: "#2c3e50" },
        { id: "box2",   type: "prop",      position: { x:-6, y:0.75, z:-8  }, scale: { x:1.5,y:1.5, z:1.5 }, color: "#2c3e50" },
        { id: "box3",   type: "prop",      position: { x:12, y:0.75, z:-5  }, scale: { x:1.5,y:1.5, z:1.5 }, color: "#2c3e50" },
        { id: "crate1", type: "prop",      position: { x:-10,y:0.75, z:12  }, scale: { x:2,  y:1.5, z:2   }, color: "#3d2b1f" },
        { id: "col1",   type: "building",  position: { x:-20,y:4,    z:-20 }, scale: { x:2,  y:8,   z:2   }, color: "#1a1c2a", emissive: "#6c5ce7", material: "emissive" },
        { id: "col2",   type: "building",  position: { x:20, y:4,    z:-20 }, scale: { x:2,  y:8,   z:2   }, color: "#1a1c2a", emissive: "#fd79a8", material: "emissive" },
        { id: "col3",   type: "building",  position: { x:-20,y:4,    z:20  }, scale: { x:2,  y:8,   z:2   }, color: "#1a1c2a", emissive: "#00cec9", material: "emissive" },
        { id: "col4",   type: "building",  position: { x:20, y:4,    z:20  }, scale: { x:2,  y:8,   z:2   }, color: "#1a1c2a", emissive: "#6c5ce7", material: "emissive" },
      ],
    },
    enemies: [
      { id: "e1", spawn: { x:15, y:0, z:-15 }, hp: 3, speed: 4.5, behavior: "chase" },
      { id: "e2", spawn: { x:-15,y:0, z:15  }, hp: 3, speed: 4.5, behavior: "patrol" },
      { id: "e3", spawn: { x:0,  y:0, z:-20 }, hp: 5, speed: 3.5, behavior: "guard" },
      { id: "e4", spawn: { x:20, y:0, z:8   }, hp: 3, speed: 5.0, behavior: "chase" },
      { id: "e5", spawn: { x:-8, y:0, z:-15 }, hp: 4, speed: 4.0, behavior: "patrol" },
    ],
    pickups: [
      { id: "hp1",    position: { x:5,  y:1, z:10  }, kind: "health", value: 30 },
      { id: "ammo1",  position: { x:-8, y:1, z:8   }, kind: "ammo",   value: 20 },
      { id: "ammo2",  position: { x:12, y:1, z:-10 }, kind: "ammo",   value: 20 },
    ],
    playerSpawn: { x: 0, y: 1.7, z: 0 },
    objective: "eliminate_all",
  },

  // ── City Rooftop (Mission) ────────────────────────────────────────────────
  city_rooftop: {
    mode: "mission",
    name: "City Rooftop",
    world: {
      skyColor: "#04060e",
      fogColor: "#04060e",
      fogDensity: 0.01,
      ambientColor: "#111133",
      ambientIntensity: 0.4,
      sunColor: "#445599",
      objects: [
        { id: "roof_main", type: "ground",    position: { x:0,  y:0,    z:0   }, scale: { x:50,y:0.5,z:50  }, color: "#1a1e25" },
        { id: "ac1",       type: "box",       position: { x:-15,y:1.5,  z:-15 }, scale: { x:4, y:3,  z:4   }, color: "#2a2e35" },
        { id: "ac2",       type: "box",       position: { x:14, y:1.5,  z:12  }, scale: { x:3, y:3,  z:5   }, color: "#2a2e35" },
        { id: "tank1",     type: "building",  position: { x:8,  y:2,    z:-12 }, scale: { x:4, y:4,  z:4   }, color: "#252830", emissive: "#00aaff", material: "emissive" },
        { id: "pipe1",     type: "box",       position: { x:-5, y:0.5,  z:18  }, scale: { x:1, y:1,  z:12  }, color: "#333344" },
        { id: "edge_n",    type: "wall",      position: { x:0,  y:0.5,  z:-25 }, scale: { x:50,y:1,  z:0.4 }, color: "#222530" },
        { id: "edge_s",    type: "wall",      position: { x:0,  y:0.5,  z:25  }, scale: { x:50,y:1,  z:0.4 }, color: "#222530" },
        { id: "edge_e",    type: "wall",      position: { x:25, y:0.5,  z:0   }, scale: { x:0.4,y:1,z:50   }, color: "#222530" },
        { id: "edge_w",    type: "wall",      position: { x:-25,y:0.5,  z:0   }, scale: { x:0.4,y:1,z:50   }, color: "#222530" },
      ],
    },
    enemies: [
      { id: "sniper1", spawn: { x:20,  y:0, z:-20 }, hp: 4, speed: 2.5, behavior: "sniper" },
      { id: "guard1",  spawn: { x:-15, y:0, z:10  }, hp: 3, speed: 4.0, behavior: "guard"  },
      { id: "guard2",  spawn: { x:12,  y:0, z:18  }, hp: 3, speed: 4.0, behavior: "patrol" },
    ],
    pickups: [
      { id: "star1", position: { x:-10, y:1, z:-15 }, kind: "star",   value: 100 },
      { id: "star2", position: { x:10,  y:1, z:10  }, kind: "star",   value: 100 },
      { id: "star3", position: { x:0,   y:1, z:-20 }, kind: "star",   value: 100 },
    ],
    missionPoints: [
      { id: "extract", position: { x:20, y:0, z:20 }, radius: 5, label: "Extraction Point" },
    ],
    playerSpawn: { x: 0, y: 1.0, z: 0 },
    objective: "collect_all",
  },
};

// ── Parse a WorldConfig from a raw JSON string or object ─────────────────────

export function parseWorldConfig(input: string | object): WorldConfig {
  const raw = typeof input === "string" ? JSON.parse(input) : input;
  // Basic validation
  if (!raw.world?.objects || !Array.isArray(raw.world.objects)) {
    throw new Error("WorldConfig: world.objects must be an array");
  }
  if (!raw.playerSpawn) {
    raw.playerSpawn = { x: 0, y: 1.7, z: 0 };
  }
  if (!raw.enemies) raw.enemies = [];
  if (!raw.objective) raw.objective = "eliminate_all";
  if (!raw.mode) raw.mode = "fps";
  return raw as WorldConfig;
}

// ── Generate a minimal WorldConfig for a prompt (lightweight fallback) ────────
//  Used when the AI doesn't return a full WorldConfig, as a safe default.

export function buildDefaultWorldConfig(name: string, mode: WorldConfig["mode"]): WorldConfig {
  return {
    mode,
    name,
    world: {
      skyColor:    "#060810",
      fogColor:    "#060810",
      fogDensity:  0.015,
      ambientColor:"#223344",
      ambientIntensity: 0.5,
      sunColor:    "#7788cc",
      objects: [
        { id: "floor", type: "ground", position: {x:0,y:0,z:0}, scale: {x:80,y:0.1,z:80}, color: "#141618" },
        ...Array.from({ length: 8 }, (_, i) => ({
          id:       `bld${i}`,
          type:     "building" as ObjectType,
          position: {
            x: Math.cos(i * Math.PI / 4) * 22,
            y: (4 + i * 2) / 2,
            z: Math.sin(i * Math.PI / 4) * 22,
          },
          scale: { x: 5, y: 4 + i * 2, z: 5 },
          color: ["#1a2744","#2c3e50","#2c2c54","#192a56"][i % 4]!,
        })),
      ],
    },
    enemies: Array.from({ length: 5 }, (_, i) => ({
      id:       `e${i}`,
      spawn:    { x: Math.cos(i * 1.2) * 14, y: 0, z: Math.sin(i * 1.2) * 14 },
      hp:       3, speed: 4.5, behavior: "chase" as EnemyBehavior,
    })),
    playerSpawn: { x: 0, y: 1.7, z: 0 },
    objective:   "eliminate_all",
  };
}
