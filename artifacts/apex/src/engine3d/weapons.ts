/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Weapon System                         ║
 * ║  4 weapons · gun models · fire rate · reload · ammo     ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";

// ── Weapon definitions ────────────────────────────────────────────────────────

export type WeaponId = "pistol" | "rifle" | "shotgun" | "sniper";

export interface WeaponDef {
  id:          WeaponId;
  name:        string;
  emoji:       string;
  key:         string;       // hotkey label
  magSize:     number;
  reserveAmmo: number;
  reloadTime:  number;       // seconds
  fireRate:    number;       // rounds per second
  damage:      number;       // body shot damage
  headMult:    number;       // headshot multiplier
  spread:      number;       // raycaster offset (screen units)
  pellets:     number;       // 1 for most, 6 for shotgun
  tracerColor: number;
  auto:        boolean;
}

export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: "pistol", name: "Pistol", emoji: "🔫", key: "1",
    magSize: 15, reserveAmmo: 75,
    reloadTime: 1.3, fireRate: 3.5,
    damage: 35, headMult: 2.2,
    spread: 0.001, pellets: 1,
    tracerColor: 0xffee44,
    auto: false,
  },
  rifle: {
    id: "rifle", name: "Assault Rifle", emoji: "⚡", key: "2",
    magSize: 30, reserveAmmo: 150,
    reloadTime: 2.0, fireRate: 9,
    damage: 22, headMult: 2.0,
    spread: 0.003, pellets: 1,
    tracerColor: 0xff9922,
    auto: true,
  },
  shotgun: {
    id: "shotgun", name: "Shotgun", emoji: "💥", key: "3",
    magSize: 8, reserveAmmo: 40,
    reloadTime: 2.6, fireRate: 1.5,
    damage: 15, headMult: 1.5,
    spread: 0.06, pellets: 6,
    tracerColor: 0xff5500,
    auto: false,
  },
  sniper: {
    id: "sniper", name: "Sniper", emoji: "🎯", key: "4",
    magSize: 5, reserveAmmo: 20,
    reloadTime: 3.2, fireRate: 0.9,
    damage: 80, headMult: 3.0,
    spread: 0.0002, pellets: 1,
    tracerColor: 0x00ddff,
    auto: false,
  },
};

export const WEAPON_ORDER: WeaponId[] = ["pistol", "rifle", "shotgun", "sniper"];

// ── Weapon state ──────────────────────────────────────────────────────────────

export interface WeaponState {
  def:        WeaponDef;
  mag:        number;
  reserve:    number;
  reloading:  boolean;
  reloadPct:  number;    // 0..1 progress
  cooldown:   number;    // seconds until next shot
}

export function createWeaponState(id: WeaponId = "rifle"): WeaponState {
  const def = WEAPON_DEFS[id];
  return { def, mag: def.magSize, reserve: def.reserveAmmo, reloading: false, reloadPct: 0, cooldown: 0 };
}

export function updateWeapon(ws: WeaponState, dt: number): boolean {
  ws.cooldown = Math.max(0, ws.cooldown - dt);
  let reloadDone = false;
  if (ws.reloading) {
    ws.reloadPct += dt / ws.def.reloadTime;
    if (ws.reloadPct >= 1) {
      const needed  = ws.def.magSize - ws.mag;
      const take    = Math.min(needed, ws.reserve);
      ws.mag       += take;
      ws.reserve   -= take;
      ws.reloading  = false;
      ws.reloadPct  = 0;
      reloadDone    = true;
    }
  }
  return reloadDone;
}

export function startReload(ws: WeaponState) {
  if (ws.reloading || ws.reserve <= 0 || ws.mag >= ws.def.magSize) return;
  ws.reloading = true;
  ws.reloadPct = 0;
}

export function canFire(ws: WeaponState): boolean {
  return !ws.reloading && ws.cooldown <= 0 && ws.mag > 0;
}

export function fireWeapon(ws: WeaponState) {
  ws.mag--;
  ws.cooldown = 1 / ws.def.fireRate;
  if (ws.mag <= 0 && ws.reserve > 0) {
    // Auto-reload when mag empties
    ws.reloading = true;
    ws.reloadPct = 0;
  }
}

// ── 3D Gun Models ─────────────────────────────────────────────────────────────

const BASE_METALS: Record<WeaponId, number> = {
  pistol:  0x8899aa,
  rifle:   0x445566,
  shotgun: 0x664433,
  sniper:  0x336655,
};

function mat(color: number, metalness = 0.7): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness });
}

function box(w: number, h: number, d: number, m: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
}

export function createGunModel(id: WeaponId): THREE.Group {
  const g   = new THREE.Group();
  const col = BASE_METALS[id];
  const m   = mat(col);
  const mDark = mat(0x222233, 0.5);

  if (id === "pistol") {
    const barrel = box(0.038, 0.038, 0.20, m);
    barrel.position.set(0, 0.005, -0.08);
    g.add(barrel);
    const body = box(0.09, 0.10, 0.13, m.clone());
    body.position.set(0, -0.025, 0.015);
    g.add(body);
    const handle = box(0.065, 0.14, 0.065, mat(0x334455, 0.4));
    handle.position.set(0, -0.115, 0.035);
    g.add(handle);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.018, 8), mDark);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0.005, -0.19);
    g.add(tip);
    const trigger = box(0.01, 0.03, 0.02, mDark);
    trigger.position.set(0, -0.055, 0.02);
    g.add(trigger);
  } else if (id === "rifle") {
    const body = box(0.06, 0.075, 0.50, m);
    body.position.set(0, 0, -0.14);
    g.add(body);
    const barrel = box(0.028, 0.028, 0.18, m.clone());
    barrel.position.set(0, 0.012, -0.39);
    g.add(barrel);
    const stock = box(0.055, 0.065, 0.14, mat(0x332211, 0.3));
    stock.position.set(0, 0, 0.1);
    g.add(stock);
    const handle = box(0.048, 0.12, 0.048, mat(0x332211, 0.3));
    handle.position.set(0, -0.098, -0.015);
    g.add(handle);
    const mag = box(0.04, 0.11, 0.042, mDark);
    mag.position.set(0, -0.105, -0.07);
    g.add(mag);
    const sight = box(0.014, 0.028, 0.095, mDark);
    sight.position.set(0, 0.056, -0.2);
    g.add(sight);
    const sightGlass = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.016, 0.01), new THREE.MeshBasicMaterial({ color: 0x0044ff }));
    sightGlass.position.set(0, 0.065, -0.22);
    g.add(sightGlass);
  } else if (id === "shotgun") {
    const barrelTop = box(0.06, 0.055, 0.44, m);
    barrelTop.position.set(0, 0.025, -0.13);
    g.add(barrelTop);
    const barrelBot = box(0.045, 0.04, 0.32, mat(col - 0x111111, 0.6));
    barrelBot.position.set(0, -0.025, -0.09);
    g.add(barrelBot);
    const stock = box(0.06, 0.085, 0.18, mat(0x442211, 0.2));
    stock.position.set(0, -0.005, 0.105);
    g.add(stock);
    const grip = box(0.05, 0.105, 0.055, mat(0x442211, 0.2));
    grip.position.set(0, -0.09, 0.01);
    g.add(grip);
    const guard = box(0.055, 0.01, 0.065, mDark);
    guard.position.set(0, -0.04, 0.01);
    g.add(guard);
  } else {
    // sniper
    const body = box(0.05, 0.062, 0.60, m);
    body.position.set(0, 0.002, -0.20);
    g.add(body);
    const barrel = box(0.024, 0.024, 0.26, m.clone());
    barrel.position.set(0, 0.01, -0.50);
    g.add(barrel);
    const stock = box(0.042, 0.055, 0.16, mat(0x332211, 0.3));
    stock.position.set(0, -0.003, 0.1);
    g.add(stock);
    const handle = box(0.04, 0.12, 0.045, mat(0x332211, 0.3));
    handle.position.set(0, -0.1, -0.08);
    g.add(handle);
    // Scope body
    const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.18, 8), mDark);
    scopeBody.rotation.x = Math.PI / 2;
    scopeBody.position.set(0, 0.072, -0.19);
    g.add(scopeBody);
    // Scope lens
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.017, 8), new THREE.MeshBasicMaterial({ color: 0x0022ff }));
    lens.rotation.y = Math.PI;
    lens.position.set(0, 0.072, -0.10);
    g.add(lens);
    // Bipod
    const bipL = box(0.006, 0.08, 0.006, mDark);
    bipL.position.set(-0.04, -0.06, -0.36);
    bipL.rotation.z = 0.3;
    g.add(bipL);
    const bipR = box(0.006, 0.08, 0.006, mDark);
    bipR.position.set(0.04, -0.06, -0.36);
    bipR.rotation.z = -0.3;
    g.add(bipR);
  }

  return g;
}

// ── Gun Scene (renders on top of 3D world) ────────────────────────────────────

export interface GunScene {
  scene:    THREE.Scene;
  camera:   THREE.PerspectiveCamera;
  gunGroup: THREE.Group;
  setWeapon:    (id: WeaponId) => void;
  animateRecoil: () => void;
  update:       (dt: number) => void;
  resize:       (aspect: number) => void;
  dispose:      () => void;
}

export function createGunScene(aspect: number, initialWeapon: WeaponId = "rifle"): GunScene {
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.01, 5);

  // Lighting for gun scene
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dLight.position.set(1, 2, 2);
  scene.add(dLight);
  const pLight = new THREE.PointLight(0x6c5ce7, 0.5, 3);
  pLight.position.set(-0.5, 0.5, -0.5);
  scene.add(pLight);

  let gunGroup = createGunModel(initialWeapon);
  // Position: bottom-right of view, slightly down and right
  gunGroup.position.set(0.30, -0.26, -0.55);
  gunGroup.rotation.set(0.05, -0.18, 0.0);
  scene.add(gunGroup);

  // Recoil state
  let recoilVel    = 0;
  let recoilOffset = 0;

  function animateRecoil() {
    recoilVel = 0.04; // kick back
  }

  function update(dt: number) {
    // Spring-back recoil
    recoilOffset += recoilVel;
    recoilVel    *= 0.6;
    recoilOffset *= 0.75;
    gunGroup.position.z = -0.55 + recoilOffset;
    gunGroup.rotation.x =  0.05 + recoilOffset * 0.6;
  }

  function setWeapon(id: WeaponId) {
    scene.remove(gunGroup);
    gunGroup = createGunModel(id);
    gunGroup.position.set(0.30, -0.26, -0.55);
    gunGroup.rotation.set(0.05, -0.18, 0.0);
    scene.add(gunGroup);
  }

  function resize(aspect: number) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    scene.clear();
  }

  return { scene, camera, gunGroup, setWeapon, animateRecoil, update, resize, dispose };
}
