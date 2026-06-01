/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Shooting System v2                    ║
 * ║  Weapon-aware · headshot detection · hit markers        ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";
import type { WeaponState } from "./weapons";
import { canFire, fireWeapon } from "./weapons";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShotResult {
  hit:       boolean;
  isHead:    boolean;
  damage:    number;
  hitObject: THREE.Object3D | null;
  hitPoint:  THREE.Vector3 | null;
}

interface Tracer {
  line: THREE.Line;
  ttl:  number;
}

// HEAD_Y: world-space Y threshold for head-zone detection
// Enemy head is at ~1.7m (body y=0.75, head y=1.7)
const HEAD_Y = 1.45;

// ── Single materials (reused) ─────────────────────────────────────────────────
const sparkMat  = new THREE.MeshBasicMaterial({ color: 0xff4422 });
const headMat   = new THREE.MeshBasicMaterial({ color: 0xffdd00 });

// ─────────────────────────────────────────────────────────────────────────────

export function createShootingSystem() {
  const raycaster = new THREE.Raycaster();
  const center    = new THREE.Vector2(0, 0);
  const tracers:  Tracer[] = [];

  function shoot(
    scene:    THREE.Scene,
    camera:   THREE.PerspectiveCamera,
    weapon:   WeaponState,
  ): ShotResult {
    const MISS: ShotResult = { hit: false, isHead: false, damage: 0, hitObject: null, hitPoint: null };
    if (!canFire(weapon)) return MISS;

    fireWeapon(weapon);

    const def    = weapon.def;
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    const tracerMat = new THREE.LineBasicMaterial({ color: def.tracerColor, transparent: true, opacity: 0.8 });

    const results: ShotResult[] = [];

    for (let p = 0; p < def.pellets; p++) {
      // Apply spread
      const sx = (Math.random() - 0.5) * 2 * def.spread;
      const sy = (Math.random() - 0.5) * 2 * def.spread;
      raycaster.setFromCamera(new THREE.Vector2(sx, sy), camera);

      const hits = raycaster.intersectObjects(scene.children, true);
      const hit  = hits.find((h) => h.object.userData.shootable);

      const end = hit
        ? hit.point.clone()
        : camera.position.clone().add(camDir.clone().multiplyScalar(80));

      // Bullet tracer
      const start = camera.position.clone().add(camDir.clone().multiplyScalar(0.25));
      const geo   = new THREE.BufferGeometry().setFromPoints([start, end]);
      const line  = new THREE.Line(geo, tracerMat.clone());
      scene.add(line);
      tracers.push({ line, ttl: 0.05 });

      // Muzzle flash (small, near camera)
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 5, 5),
        new THREE.MeshBasicMaterial({ color: def.tracerColor }),
      );
      flash.position.copy(start);
      scene.add(flash);
      setTimeout(() => scene.remove(flash), 30);

      if (hit) {
        const isHead = hit.point.y >= HEAD_Y;
        const dmg    = isHead ? Math.round(def.damage * def.headMult) : def.damage;

        // Hit spark (bigger + yellow for headshot)
        const sm  = isHead ? headMat : sparkMat;
        const sz  = isHead ? 0.18 : 0.12;
        const sp  = new THREE.Mesh(new THREE.SphereGeometry(sz, 6, 6), sm);
        sp.position.copy(hit.point);
        scene.add(sp);
        setTimeout(() => scene.remove(sp), 80);

        // Decal ring
        const ringColor = isHead ? 0xffdd00 : 0xff3300;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.07, 0.16, 10),
          new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
        );
        ring.position.copy(hit.point);
        ring.lookAt(hit.point.clone().add(hit.face?.normal ?? new THREE.Vector3(0, 1, 0)));
        scene.add(ring);
        setTimeout(() => scene.remove(ring), 400);

        results.push({ hit: true, isHead, damage: dmg, hitObject: hit.object, hitPoint: hit.point.clone() });
      } else {
        results.push(MISS);
      }
    }

    // For shotgun return first hit, for others the single result
    return results.find((r) => r.hit) ?? MISS;
  }

  function update(scene: THREE.Scene, dt: number) {
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i]!;
      t.ttl -= dt;
      if (t.ttl <= 0) { scene.remove(t.line); tracers.splice(i, 1); }
    }
  }

  function dispose() {
    sparkMat.dispose();
    headMat.dispose();
  }

  return { shoot, update, dispose };
}
