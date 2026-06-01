/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — FPS Player Controller v3                  ║
 * ║                                                             ║
 * ║  Console-quality movement feel:                             ║
 * ║    • Acceleration + friction (weighted, not floaty)         ║
 * ║    • Sprint FOV shift output                                ║
 * ║    • Landing impact shake trigger                           ║
 * ║    • Smooth head-bob                                        ║
 * ║    • Jump arc smoothing (coyote-time + better gravity)      ║
 * ║                                                             ║
 * ║  Still driven entirely by UnifiedInput — same API, mobile,  ║
 * ║  desktop, and controller work identically.                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";
import type { WallAABB } from "./world";
import type { UnifiedInput } from "./InputManager";

// ── Physics constants ─────────────────────────────────────────────────────────

const PLAYER_HEIGHT  = 1.7;
const PLAYER_RADIUS  = 0.38;
const GRAVITY        = -28;       // stronger gravity = less floaty
const JUMP_FORCE     = 9.5;
const WALK_SPEED     = 7.5;
const SPRINT_SPEED   = 13.5;
const ACCEL_GROUND   = 80;        // acceleration rate (units/s²) — snappy but not instant
const ACCEL_AIR      = 30;        // reduced air control
const FRICTION       = 14;        // ground friction coefficient (exponential)
const BOB_FREQ       = 9;
const BOB_AMP        = 0.032;
const SPRINT_BOB_AMP = 0.055;

/** Kept for backward-compatibility */
export interface TouchInput {
  moveX: number;
  moveZ: number;
  lookX: number;
  lookY: number;
  fire:  boolean;
}

export interface PlayerController {
  update:         (dt: number, wallAABBs: WallAABB[], input?: UnifiedInput) => void;
  getPosition:    () => THREE.Vector3;
  getHealth:      () => number;
  takeDamage:     (amount: number) => void;
  isAlive:        () => boolean;
  isLocked:       () => boolean;
  /** Set from outside (game loop) — cleared each frame after being read */
  popLandingShake: () => number;   // returns landing velocity magnitude (0 if no landing this frame)
  /** 0 = no sprint, 1 = full sprint — smooth output for FOV shift */
  getSprintFraction: () => number;
  /** @deprecated */
  touchInput:     TouchInput;
  dispose:        () => void;
}

export function createPlayerController(
  camera: THREE.PerspectiveCamera,
  _canvas: HTMLCanvasElement,
): PlayerController {
  let pitch    = 0;
  let yaw      = 0;
  let vy       = 0;
  let onGround = true;
  let health   = 100;
  let bobTime  = 0;

  // Velocity (XZ plane only; Y handled by gravity vy)
  const vel = new THREE.Vector2();   // x = lateral, y = forward

  // Landing shake
  let landingShakePending = 0;   // magnitude of last landing

  // Sprint
  let sprintFrac = 0;    // 0..1 smooth interpolated

  const pos = new THREE.Vector3(0, PLAYER_HEIGHT, 5);
  const touchInput: TouchInput = { moveX: 0, moveZ: 0, lookX: 0, lookY: 0, fire: false };

  // ── Wall collision ───────────────────────────────────────────────────────────
  function resolveWalls(p: THREE.Vector3, aabbs: WallAABB[]) {
    for (const w of aabbs) {
      if (
        p.x + PLAYER_RADIUS > w.minX && p.x - PLAYER_RADIUS < w.maxX &&
        p.z + PLAYER_RADIUS > w.minZ && p.z - PLAYER_RADIUS < w.maxZ
      ) {
        const overlapPosX = w.maxX - (p.x - PLAYER_RADIUS);
        const overlapNegX = (p.x + PLAYER_RADIUS) - w.minX;
        const overlapPosZ = w.maxZ - (p.z - PLAYER_RADIUS);
        const overlapNegZ = (p.z + PLAYER_RADIUS) - w.minZ;
        const minO = Math.min(overlapPosX, overlapNegX, overlapPosZ, overlapNegZ);
        if      (minO === overlapPosX) p.x += overlapPosX;
        else if (minO === overlapNegX) p.x -= overlapNegX;
        else if (minO === overlapPosZ) p.z += overlapPosZ;
        else                           p.z -= overlapNegZ;
      }
    }
  }

  // ── Core update ──────────────────────────────────────────────────────────────
  function update(dt: number, wallAABBs: WallAABB[], input?: UnifiedInput) {
    // ── Gravity ──────────────────────────────────────────────────────────────
    const prevVY = vy;
    vy    += GRAVITY * dt;
    pos.y += vy * dt;

    if (pos.y <= PLAYER_HEIGHT) {
      // Landing
      if (!onGround && prevVY < -4) {
        landingShakePending = Math.min(Math.abs(prevVY) * 0.006, 0.045);
      }
      pos.y    = PLAYER_HEIGHT;
      vy       = 0;
      onGround = true;
    } else {
      onGround = false;
    }

    if (!input) {
      // No input — coast to a stop
      vel.multiplyScalar(Math.exp(-FRICTION * dt));
      if (vel.lengthSq() < 0.0001) vel.set(0, 0);
      sprintFrac = 0;
      return;
    }

    // ── Camera look ──────────────────────────────────────────────────────────
    yaw   -= input.lookX;
    pitch -= input.lookY;
    pitch  = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, pitch));

    // ── Jump ─────────────────────────────────────────────────────────────────
    if (input.jump && onGround) {
      vy       = JUMP_FORCE;
      onGround = false;
    }

    // ── Horizontal movement (acceleration + friction model) ──────────────────
    const sprint    = input.sprint && onGround;
    const maxSpeed  = sprint ? SPRINT_SPEED : WALK_SPEED;
    const accel     = onGround ? ACCEL_GROUND : ACCEL_AIR;

    const inputDir  = new THREE.Vector2(input.moveX, input.moveY);
    const hasInput  = inputDir.lengthSq() > 0.01;

    // Rotate input to world-space (yaw-aligned)
    const worldDir = new THREE.Vector3(input.moveX, 0, input.moveY);
    if (hasInput) worldDir.normalize().applyEuler(new THREE.Euler(0, yaw, 0));

    if (hasInput) {
      // Accelerate toward desired velocity
      const desiredX = worldDir.x * maxSpeed;
      const desiredZ = worldDir.z * maxSpeed;
      vel.x += (desiredX - vel.x) * Math.min(1, accel * dt);
      vel.y += (desiredZ - vel.y) * Math.min(1, accel * dt);
      // Clamp to max speed
      const spd = vel.length();
      if (spd > maxSpeed) vel.multiplyScalar(maxSpeed / spd);
    } else {
      // Friction stop
      vel.multiplyScalar(Math.max(0, 1 - FRICTION * dt));
      if (vel.lengthSq() < 0.01) vel.set(0, 0);
    }

    pos.x += vel.x * dt;
    pos.z += vel.y * dt;

    // Sprint fraction (smooth for FOV)
    const targetSprint = (sprint && hasInput) ? 1 : 0;
    sprintFrac += (targetSprint - sprintFrac) * Math.min(1, 8 * dt);

    resolveWalls(pos, wallAABBs);

    // ── Head bob ─────────────────────────────────────────────────────────────
    const isMoving = vel.lengthSq() > 0.2;
    if (isMoving && onGround) bobTime += dt * BOB_FREQ * (sprint ? 1.35 : 1);
    const bobAmp = sprint ? SPRINT_BOB_AMP : BOB_AMP;
    const bobY   = isMoving && onGround ? Math.sin(bobTime) * bobAmp : 0;

    // ── Apply to camera ───────────────────────────────────────────────────────
    camera.position.set(pos.x, pos.y + bobY, pos.z);
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  }

  return {
    update,
    getPosition:    () => pos.clone(),
    getHealth:      () => health,
    takeDamage:     (a) => { health = Math.max(0, health - a); },
    isAlive:        () => health > 0,
    isLocked:       () => document.pointerLockElement != null,
    popLandingShake: () => {
      const v = landingShakePending;
      landingShakePending = 0;
      return v;
    },
    getSprintFraction: () => sprintFrac,
    touchInput,
    dispose: () => { if (document.pointerLockElement) document.exitPointerLock?.(); },
  };
}
