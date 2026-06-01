/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Third-Person Player Controller        ║
 * ║  Character model · orbit camera · WASD · jump           ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";
import type { BuildingAABB } from "./openworld";
import type { UnifiedInput } from "./InputManager";

const WALK_SPEED   = 7;
const SPRINT_SPEED = 13;
const GRAVITY      = -22;
const JUMP_FORCE   = 9;
const CAM_DIST     = 9;
const CAM_HEIGHT   = 4;
const CAM_PITCH    = -0.22;         // fixed down-tilt in radians
const PLAYER_R     = 0.4;           // collision radius
const PLAYER_H_F   = 1.0;           // camera target height above ground

export interface OWTouchInput {
  moveX: number; moveZ: number;
  lookDX: number; lookDY: number;
  fire: boolean; jump: boolean;
}

export interface ThirdPersonPlayer {
  update:      (dt: number, keys: Set<string>, aabbs: BuildingAABB[], input?: UnifiedInput) => void;
  getPosition: () => THREE.Vector3;
  getCameraYaw:() => number;
  getHealth:   () => number;
  takeDamage:  (n: number) => void;
  isAlive:     () => boolean;
  model:       THREE.Group;
  touchInput:  OWTouchInput;
  dispose:     () => void;
}

export function createThirdPersonPlayer(
  camera:  THREE.PerspectiveCamera,
  _canvas: HTMLCanvasElement, // kept for API compat — InputManager owns the canvas now
  startPos = new THREE.Vector3(4, 0, 4),
): ThirdPersonPlayer {
  const pos  = startPos.clone();
  const vel  = new THREE.Vector3();
  let camYaw = 0;
  let onGrd  = true;
  let health = 100;
  let vy     = 0;

  const touchInput: OWTouchInput = { moveX: 0, moveZ: 0, lookDX: 0, lookDY: 0, fire: false, jump: false };

  // ── Character model ───────────────────────────────────────────────────────
  const model = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d5afe, roughness: 0.6 });
  const body    = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.2, 0.38), bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  model.add(body);

  const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc88, roughness: 0.7 });
  const head    = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), headMat);
  head.position.y = 1.42;
  head.castShadow = true;
  model.add(head);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x1a237e, roughness: 0.7 });
  [-0.15, 0.15].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.28), legMat);
    leg.position.set(lx, -0.35, 0);
    leg.castShadow = true;
    model.add(leg);
  });

  const armMat = new THREE.MeshStandardMaterial({ color: 0x3d5afe, roughness: 0.6 });
  [-0.42, 0.42].forEach((ax) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), armMat);
    arm.position.set(ax, 0.4, 0);
    arm.castShadow = true;
    model.add(arm);
  });

  // Mouse drag is now handled by InputManager (rightDragLook option).

  // ── Building AABB push-out ────────────────────────────────────────────────
  function pushOutAABBs(p: THREE.Vector3, aabbs: BuildingAABB[]) {
    for (const w of aabbs) {
      if (p.x + PLAYER_R > w.minX && p.x - PLAYER_R < w.maxX &&
          p.z + PLAYER_R > w.minZ && p.z - PLAYER_R < w.maxZ) {
        const ox1 = w.maxX - (p.x - PLAYER_R);
        const ox2 = (p.x + PLAYER_R) - w.minX;
        const oz1 = w.maxZ - (p.z - PLAYER_R);
        const oz2 = (p.z + PLAYER_R) - w.minZ;
        const m = Math.min(ox1, ox2, oz1, oz2);
        if (m === ox1) p.x += ox1;
        else if (m === ox2) p.x -= ox2;
        else if (m === oz1) p.z += oz1;
        else p.z -= oz2;
      }
    }
  }

  function update(dt: number, keys: Set<string>, aabbs: BuildingAABB[], input?: UnifiedInput) {
    // ── Camera look ───────────────────────────────────────────────────────────
    if (input) {
      // UnifiedInput path: lookX is already in radians (mouse drag + touch + gamepad)
      camYaw -= input.lookX;
    } else if (touchInput.lookDX !== 0) {
      // Legacy touch path
      camYaw -= touchInput.lookDX * 0.006;
      touchInput.lookDX = 0;
    }

    // ── Gravity ───────────────────────────────────────────────────────────────
    vy += GRAVITY * dt;
    pos.y += vy * dt;
    if (pos.y <= 0) { pos.y = 0; vy = 0; onGrd = true; }

    // ── Jump ──────────────────────────────────────────────────────────────────
    const wantJump = input ? input.jump : (keys.has("Space") || touchInput.jump);
    if (wantJump && onGrd) {
      vy = JUMP_FORCE;
      onGrd = false;
      touchInput.jump = false;
    }

    // ── Horizontal movement ───────────────────────────────────────────────────
    const sprint = input ? input.sprint : (keys.has("ShiftLeft") || keys.has("ShiftRight"));
    const speed  = sprint ? SPRINT_SPEED : WALK_SPEED;
    const dir    = new THREE.Vector3();

    if (input) {
      // UnifiedInput: moveX/Y already combines keyboard + joystick + gamepad
      dir.x = input.moveX;
      dir.z = input.moveY;
    } else {
      if (keys.has("KeyW") || keys.has("ArrowUp"))    dir.z -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown"))  dir.z += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft"))  dir.x -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) dir.x += 1;
      dir.x += touchInput.moveX;
      dir.z += touchInput.moveZ;
    }

    const moving = dir.lengthSq() > 0.01;
    if (moving) {
      dir.normalize().applyEuler(new THREE.Euler(0, camYaw, 0));
      pos.x += dir.x * speed * dt;
      pos.z += dir.z * speed * dt;

      // Face movement direction
      const targetYaw = Math.atan2(dir.x, dir.z) + Math.PI;
      let diff = targetYaw - model.rotation.y;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      model.rotation.y += diff * 0.2;

      // Leg swing animation
      const swingT = Date.now() * 0.01;
      (model.children[2] as THREE.Mesh).rotation.x =  Math.sin(swingT) * 0.5;
      (model.children[3] as THREE.Mesh).rotation.x = -Math.sin(swingT) * 0.5;
    }

    // Clamp to world bounds
    const bound = 185;
    pos.x = Math.max(-bound, Math.min(bound, pos.x));
    pos.z = Math.max(-bound, Math.min(bound, pos.z));

    pushOutAABBs(pos, aabbs);

    // ── Apply model position ──────────────────────────────────────────────────
    model.position.set(pos.x, pos.y, pos.z);

    // ── Third-person camera ───────────────────────────────────────────────────
    const camX = pos.x + Math.sin(camYaw) * CAM_DIST;
    const camZ = pos.z + Math.cos(camYaw) * CAM_DIST;
    const camY = pos.y + CAM_HEIGHT;

    camera.position.set(camX, camY, camZ);
    camera.lookAt(pos.x, pos.y + PLAYER_H_F, pos.z);
  }

  function dispose() {
    // Mouse / keyboard events are now owned by InputManager — nothing to clean up here.
    void _canvas; // suppress unused warning
  }

  return {
    update,
    getPosition:  () => pos.clone(),
    getCameraYaw: () => camYaw,
    getHealth:    () => health,
    takeDamage:   (n) => { health = Math.max(0, health - n); },
    isAlive:      () => health > 0,
    model,
    touchInput,
    dispose,
  };
}
