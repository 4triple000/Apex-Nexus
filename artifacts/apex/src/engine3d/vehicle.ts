/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Vehicle System                        ║
 * ║  Drivable car · entry/exit · physics                    ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";

export interface Vehicle {
  model:    THREE.Group;
  pos:      THREE.Vector3;
  yaw:      number;
  speed:    number;          // m/s  (signed: + = forward)
  occupied: boolean;
  id:       string;
}

const ENTER_DIST  = 3.5;
const MAX_SPEED_F = 22;
const MAX_SPEED_R = 8;
const ACCEL       = 14;
const BRAKE       = 18;
const FRICTION    = 5.5;
const STEER_RATE  = 1.8;    // rad/s at full speed
const CAM_DIST_DRV = 13;
const CAM_H_DRV    = 4.5;

// ── Car Model ─────────────────────────────────────────────────────────────────

const CAR_COLORS = [0xe74c3c, 0x3498db, 0xf39c12, 0x2ecc71, 0x9b59b6, 0x1abc9c];
let carIdx = 0;

function buildCarModel(color: number): THREE.Group {
  const g   = new THREE.Group();
  const bMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 });
  const gMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
  const glaM = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.55 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.4), bMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.4), bMat.clone());
  cabin.position.set(0, 1.18, -0.2);
  cabin.castShadow = true;
  g.add(cabin);

  // Windshield (front)
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.55), glaM);
  ws.position.set(0, 1.15, 1.0);
  ws.rotation.x = 0.35;
  g.add(ws);

  // Rear glass
  const rg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.55), glaM.clone());
  rg.position.set(0, 1.15, -1.4);
  rg.rotation.x = -0.35;
  g.add(rg);

  // Side glasses
  [-0.9, 0.9].forEach((sx) => {
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), glaM.clone());
    sg.position.set(sx, 1.2, -0.2);
    sg.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(sg);
  });

  // Headlights
  const hMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-0.6, 0.6].forEach((hx) => {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.1), hMat);
    h.position.set(hx, 0.62, 2.26);
    g.add(h);
  });

  // Taillights
  const tMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  [-0.6, 0.6].forEach((tx) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.1), tMat);
    t.position.set(tx, 0.62, -2.26);
    g.add(t);
  });

  // Bumpers
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
  const fb = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.28, 0.18), bumperMat);
  fb.position.set(0, 0.3, 2.31);
  g.add(fb);
  const rb = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.28, 0.18), bumperMat.clone());
  rb.position.set(0, 0.3, -2.31);
  g.add(rb);

  // Wheels (4 cylinders) — stored in userData for rotation
  const wheels: THREE.Mesh[] = [];
  [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]].forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.28, 12), wMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx!, 0.35, wz!);
    wheel.castShadow = true;
    g.add(wheel);
    wheels.push(wheel);

    // Wheel rim
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8), gMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx!, 0.35, wz!);
    g.add(rim);
  });

  g.userData.wheels = wheels;
  return g;
}

// ── Create vehicle ────────────────────────────────────────────────────────────

export function createVehicle(scene: THREE.Scene, pos: THREE.Vector3, yaw = 0): Vehicle {
  const color = CAR_COLORS[carIdx++ % CAR_COLORS.length]!;
  const model = buildCarModel(color);
  model.position.copy(pos);
  model.position.y = 0.35;
  model.rotation.y = yaw;
  scene.add(model);

  return { model, pos: pos.clone(), yaw, speed: 0, occupied: false, id: `car_${carIdx}` };
}

// ── Drive vehicle ─────────────────────────────────────────────────────────────

export function driveVehicle(
  veh:  Vehicle,
  keys: Set<string>,
  touch: { accel: number; steer: number },
  dt:   number,
): void {
  const fwd  = keys.has("KeyW") || keys.has("ArrowUp")    || touch.accel > 0;
  const back = keys.has("KeyS") || keys.has("ArrowDown")  || touch.accel < 0;
  const left = keys.has("KeyA") || keys.has("ArrowLeft");
  const right= keys.has("KeyD") || keys.has("ArrowRight");
  const brake= keys.has("Space");

  if (fwd)   veh.speed = Math.min(veh.speed + ACCEL * dt, MAX_SPEED_F);
  if (back)  veh.speed = Math.max(veh.speed - ACCEL * dt, -MAX_SPEED_R);
  if (brake) veh.speed *= (1 - BRAKE * dt / MAX_SPEED_F);

  // Friction
  const drag = FRICTION * dt;
  if (!fwd && !back) {
    if (Math.abs(veh.speed) < drag) veh.speed = 0;
    else veh.speed -= Math.sign(veh.speed) * drag;
  }

  // Steering (only effective when moving)
  const steerAmt = (left ? -1 : 0) + (right ? 1 : 0) + touch.steer;
  const steerFactor = Math.min(1, Math.abs(veh.speed) / 5);
  veh.yaw -= steerAmt * STEER_RATE * dt * Math.sign(veh.speed) * steerFactor;

  // Move
  const sina = Math.sin(veh.yaw);
  const cosa = Math.cos(veh.yaw);
  veh.pos.x += sina * veh.speed * dt;
  veh.pos.z += cosa * veh.speed * dt;

  // Clamp
  const bound = 182;
  veh.pos.x = Math.max(-bound, Math.min(bound, veh.pos.x));
  veh.pos.z = Math.max(-bound, Math.min(bound, veh.pos.z));

  // Apply to model
  veh.model.position.set(veh.pos.x, 0.35, veh.pos.z);
  veh.model.rotation.y = veh.yaw;

  // Wheel rotation
  const wheels = veh.model.userData.wheels as THREE.Mesh[];
  const rotDelta = (veh.speed * dt) / 0.35;
  wheels?.forEach((w) => { w.rotation.x += rotDelta; });
}

// ── Position camera behind vehicle ───────────────────────────────────────────

export function applyVehicleCamera(veh: Vehicle, camera: THREE.PerspectiveCamera): void {
  const camX = veh.pos.x + Math.sin(veh.yaw) * CAM_DIST_DRV;
  const camZ = veh.pos.z + Math.cos(veh.yaw) * CAM_DIST_DRV;
  camera.position.set(camX, CAM_H_DRV, camZ);
  camera.lookAt(veh.pos.x, 1, veh.pos.z);
}

// ── Proximity check ───────────────────────────────────────────────────────────

export function nearestVehicle(
  vehicles: Vehicle[],
  playerPos: THREE.Vector3,
): Vehicle | null {
  let best: Vehicle | null = null;
  let bestDist = ENTER_DIST;
  for (const v of vehicles) {
    if (v.occupied) continue;
    const d = v.pos.distanceTo(playerPos);
    if (d < bestDist) { bestDist = d; best = v; }
  }
  return best;
}

export function exitPosition(veh: Vehicle): THREE.Vector3 {
  return new THREE.Vector3(
    veh.pos.x + Math.cos(veh.yaw) * 3,
    0,
    veh.pos.z - Math.sin(veh.yaw) * 3,
  );
}
