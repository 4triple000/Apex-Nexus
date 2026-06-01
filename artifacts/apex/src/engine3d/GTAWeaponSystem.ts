/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — GTA Weapon System                         ║
 * ║                                                             ║
 * ║  Slot-based inventory (melee / pistol / smg / shotgun /    ║
 * ║  rifle) with ammo tracking, reload mechanics, weapon        ║
 * ║  pickups, and 3rd-person raycasting.                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";

// ── Weapon Slots ──────────────────────────────────────────────────────────────

export type GTAWeaponSlot = "melee" | "pistol" | "smg" | "shotgun" | "rifle";
export const GTA_WEAPON_SLOTS: GTAWeaponSlot[] = ["melee", "pistol", "smg", "shotgun", "rifle"];

// ── Weapon Definitions ────────────────────────────────────────────────────────

export interface GTAWeaponDef {
  slot:        GTAWeaponSlot;
  name:        string;
  emoji:       string;
  key:         string;        // hotkey label shown in HUD (1–5)
  magSize:     number;        // bullets per magazine (0 = infinite melee)
  reserveAmmo: number;        // total reserve ammo
  reloadTime:  number;        // seconds to reload
  fireRate:    number;        // shots per second
  damage:      number;        // body damage
  range:       number;        // raycast max distance (metres)
  spread:      number;        // camera-space NDC jitter per pellet
  pellets:     number;        // 1 for most; 6 for shotgun
  auto:        boolean;       // hold-to-fire (SMG, rifle) vs click
}

export const GTA_WEAPON_DEFS: Record<GTAWeaponSlot, GTAWeaponDef> = {
  melee: {
    slot: "melee", name: "Fists", emoji: "👊", key: "1",
    magSize: 0, reserveAmmo: 0, reloadTime: 0,
    fireRate: 2.0, damage: 25, range: 2.5,
    spread: 0, pellets: 1, auto: false,
  },
  pistol: {
    slot: "pistol", name: "Pistol", emoji: "🔫", key: "2",
    magSize: 12, reserveAmmo: 60, reloadTime: 1.2,
    fireRate: 3.0, damage: 35, range: 60,
    spread: 0.002, pellets: 1, auto: false,
  },
  smg: {
    slot: "smg", name: "SMG", emoji: "⚡", key: "3",
    magSize: 30, reserveAmmo: 120, reloadTime: 1.8,
    fireRate: 10, damage: 18, range: 50,
    spread: 0.005, pellets: 1, auto: true,
  },
  shotgun: {
    slot: "shotgun", name: "Shotgun", emoji: "💥", key: "4",
    magSize: 6, reserveAmmo: 30, reloadTime: 2.4,
    fireRate: 1.2, damage: 12, range: 25,
    spread: 0.055, pellets: 6, auto: false,
  },
  rifle: {
    slot: "rifle", name: "Rifle", emoji: "🎯", key: "5",
    magSize: 25, reserveAmmo: 100, reloadTime: 2.0,
    fireRate: 8, damage: 28, range: 100,
    spread: 0.003, pellets: 1, auto: true,
  },
};

// ── Weapon State ──────────────────────────────────────────────────────────────

export interface GTAWeaponState {
  def:         GTAWeaponDef;
  mag:         number;
  reserve:     number;
  reloading:   boolean;
  reloadTimer: number;
  cooldown:    number;
}

function makeState(def: GTAWeaponDef): GTAWeaponState {
  return { def, mag: def.magSize, reserve: def.reserveAmmo,
           reloading: false, reloadTimer: 0, cooldown: 0 };
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export interface GTAInventory {
  slots:  Map<GTAWeaponSlot, GTAWeaponState>;
  active: GTAWeaponSlot;
}

/** Player starts with fists only. */
export function createGTAInventory(): GTAInventory {
  const slots = new Map<GTAWeaponSlot, GTAWeaponState>();
  slots.set("melee", makeState(GTA_WEAPON_DEFS.melee));
  return { slots, active: "melee" };
}

/** Pick up / refill a weapon. Returns true if a new slot was unlocked. */
export function addWeaponToInventory(inv: GTAInventory, slot: GTAWeaponSlot): boolean {
  if (inv.slots.has(slot)) {
    const ws = inv.slots.get(slot)!;
    ws.reserve = Math.min(ws.reserve + ws.def.reserveAmmo, ws.def.reserveAmmo * 2);
    return false;
  }
  inv.slots.set(slot, makeState(GTA_WEAPON_DEFS[slot]));
  inv.active = slot;
  return true;
}

export function getActiveWeapon(inv: GTAInventory): GTAWeaponState | null {
  return inv.slots.get(inv.active) ?? null;
}

/** Switch active slot. Returns false if slot is not in inventory. */
export function switchSlot(inv: GTAInventory, slot: GTAWeaponSlot): boolean {
  if (!inv.slots.has(slot)) return false;
  inv.active = slot;
  return true;
}

/** Cycle to next owned weapon. */
export function cycleWeapon(inv: GTAInventory, dir: 1 | -1 = 1): void {
  const owned = GTA_WEAPON_SLOTS.filter((s) => inv.slots.has(s));
  if (owned.length <= 1) return;
  const cur = owned.indexOf(inv.active);
  inv.active = owned[(cur + dir + owned.length) % owned.length]!;
}

// ── Per-frame Tick ─────────────────────────────────────────────────────────────

/** Call every frame on the active weapon. Returns true when reload just finished. */
export function tickGTAWeapon(ws: GTAWeaponState, dt: number): boolean {
  ws.cooldown = Math.max(0, ws.cooldown - dt);
  if (ws.reloading) {
    ws.reloadTimer -= dt;
    if (ws.reloadTimer <= 0) {
      const needed = ws.def.magSize - ws.mag;
      const take   = Math.min(needed, ws.reserve);
      ws.mag      += take;
      ws.reserve  -= take;
      ws.reloading  = false;
      ws.reloadTimer = 0;
      return true;
    }
  }
  return false;
}

export function canFireGTA(ws: GTAWeaponState): boolean {
  if (ws.reloading || ws.cooldown > 0) return false;
  if (ws.def.slot === "melee") return true;
  return ws.mag > 0;
}

export function startReloadGTA(ws: GTAWeaponState): boolean {
  if (ws.reloading) return false;
  if (ws.def.slot === "melee") return false;
  if (ws.mag === ws.def.magSize) return false;
  if (ws.reserve <= 0) return false;
  ws.reloading   = true;
  ws.reloadTimer = ws.def.reloadTime;
  return true;
}

// ── Shooting ──────────────────────────────────────────────────────────────────

export interface GTAShootResult {
  hit:      boolean;
  hitObj?:  THREE.Object3D;
  npcId?:   string;
  damage:   number;
  isMelee:  boolean;
}

/**
 * Raycast from the camera center (works for both FPS and orbit cameras).
 * `targets` should be the scene or an array of shootable meshes.
 */
export function shootGTA(
  ws:      GTAWeaponState,
  camera:  THREE.PerspectiveCamera,
  targets: THREE.Object3D[],
): GTAShootResult[] {
  if (!canFireGTA(ws)) return [];

  // Consume ammo
  if (ws.def.slot !== "melee") ws.mag = Math.max(0, ws.mag - 1);
  ws.cooldown = 1 / ws.def.fireRate;

  const results: GTAShootResult[] = [];
  const ray = new THREE.Raycaster();
  ray.far   = ws.def.range;

  for (let p = 0; p < ws.def.pellets; p++) {
    const sx = (Math.random() - 0.5) * 2 * ws.def.spread;
    const sy = (Math.random() - 0.5) * 2 * ws.def.spread;
    ray.setFromCamera(new THREE.Vector2(sx, sy), camera);

    const hits = ray.intersectObjects(targets, true);
    const hit  = hits.find((h) => h.object.userData.npcId || h.object.userData.shootable);

    if (hit) {
      results.push({
        hit:     true,
        hitObj:  hit.object,
        npcId:   hit.object.userData.npcId as string | undefined,
        damage:  ws.def.damage,
        isMelee: ws.def.slot === "melee",
      });
    } else {
      results.push({ hit: false, damage: 0, isMelee: ws.def.slot === "melee" });
    }
  }

  return results;
}

// ── World Pickup Spawner ──────────────────────────────────────────────────────

export interface WeaponPickup {
  mesh:   THREE.Mesh;
  slot:   GTAWeaponSlot;
  pos:    THREE.Vector3;
  picked: boolean;
}

const GEO_PICKUP = new THREE.BoxGeometry(0.45, 0.18, 0.85);

/** Spawn weapon pickup crates at given positions. */
export function spawnWeaponPickups(
  scene:     THREE.Scene,
  positions: Array<{ pos: THREE.Vector3; slot: GTAWeaponSlot }>,
): WeaponPickup[] {
  const COLORS: Record<GTAWeaponSlot, number> = {
    melee:   0x8B4513,
    pistol:  0xffee44,
    smg:     0x00ccff,
    shotgun: 0xff6600,
    rifle:   0x00ff88,
  };

  return positions.map(({ pos, slot }) => {
    const mesh = new THREE.Mesh(
      GEO_PICKUP,
      new THREE.MeshStandardMaterial({ color: COLORS[slot], roughness: 0.5, emissive: COLORS[slot], emissiveIntensity: 0.25 }),
    );
    mesh.position.copy(pos);
    mesh.position.y = 0.6;
    mesh.userData.weaponPickup = slot;
    scene.add(mesh);
    return { mesh, slot, pos: pos.clone(), picked: false };
  });
}

/** Animate and check pickup proximity. Returns slots picked up this frame. */
export function updateWeaponPickups(
  pickups:   WeaponPickup[],
  playerPos: THREE.Vector3,
  now:       number,
  dt:        number,
): WeaponPickup[] {
  const picked: WeaponPickup[] = [];
  for (const p of pickups) {
    if (p.picked) continue;
    p.mesh.rotation.y += dt * 2;
    p.mesh.position.y  = 0.6 + Math.sin(now * 0.002) * 0.12;

    if (playerPos.distanceTo(p.pos) < 2.2) {
      p.picked = true;
      p.mesh.visible = false;
      picked.push(p);
    }
  }
  return picked;
}
