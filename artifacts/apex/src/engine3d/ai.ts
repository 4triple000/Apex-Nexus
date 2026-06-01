/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Enemy AI System v2                    ║
 * ║  Variable damage · headshot support · wave spawning     ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";

export interface Enemy3D {
  group:    THREE.Group;
  body:     THREE.Mesh;
  head:     THREE.Mesh;
  hpFill:   THREE.Mesh;
  hp:       number;
  maxHp:    number;
  speed:    number;
  alive:    boolean;
  damageCd: number;
}

export interface HitResult {
  killed:    boolean;
  isHead:    boolean;
  damage:    number;
}

export interface EnemySystem {
  enemies:   Enemy3D[];
  hitEnemy:  (object: THREE.Object3D, damage: number, isHead: boolean, scene: THREE.Scene) => HitResult;
  spawnWave: (scene: THREE.Scene, count: number, wave: number, speedMult?: number) => void;
  update:    (dt: number, playerPos: THREE.Vector3, onPlayerHit: (dmg: number) => void, speedMult?: number) => void;
  allDead:   () => boolean;
  aliveCount: () => number;
  dispose:   (scene: THREE.Scene) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ATTACK_RANGE  = 1.7;
const ATTACK_DAMAGE = 8;
const ATTACK_CD     = 1.3;
const SPAWN_RADIUS  = 24;

const ENEMY_PALETTE = [0xe74c3c, 0xe67e22, 0x9b59b6, 0xc0392b, 0x8e44ad, 0x1abc9c, 0xe91e63];

// ── Spawn single enemy ────────────────────────────────────────────────────────

function spawnEnemy(
  scene:  THREE.Scene,
  index:  number,
  total:  number,
  radius: number,
  hp:     number,
  speedBonus = 0,
): Enemy3D {
  const angle = (index / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
  const r     = radius * 0.5 + Math.random() * radius * 0.5;
  const col   = ENEMY_PALETTE[index % ENEMY_PALETTE.length]!;

  const group = new THREE.Group();
  group.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);

  // ── Body ──────────────────────────────────────────────────────────────────
  const bodyMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.3 });
  const body    = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.5, 0.52), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  body.userData.shootable    = true;
  body.userData.enemyGroupId = group.uuid;
  body.userData.isHead       = false;
  group.add(body);

  // ── Head ──────────────────────────────────────────────────────────────────
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc88, roughness: 0.6 });
  const head    = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), headMat);
  head.position.y = 1.73;
  head.castShadow = true;
  head.userData.shootable    = true;
  head.userData.enemyGroupId = group.uuid;
  head.userData.isHead       = true;
  group.add(head);

  // ── Glowing eyes ──────────────────────────────────────────────────────────
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1100 });
  [-0.13, 0.13].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), eyeMat);
    eye.position.set(ex, 1.79, 0.24);
    group.add(eye);
  });

  // ── HP bar bg ─────────────────────────────────────────────────────────────
  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x1a1a1a }),
  );
  hpBg.position.set(0, 2.35, 0);
  hpBg.renderOrder = 1;
  group.add(hpBg);

  // ── HP bar fill ───────────────────────────────────────────────────────────
  const hpFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 }),
  );
  hpFill.position.set(0, 2.36, 0);
  hpFill.renderOrder = 2;
  group.add(hpFill);

  scene.add(group);

  return {
    group, body, head, hpFill,
    hp, maxHp: hp,
    speed: 2.0 + Math.random() * 1.5 + speedBonus,
    alive: true,
    damageCd: 0,
  };
}

// ── Enemy System ──────────────────────────────────────────────────────────────

export function createEnemySystem(
  scene:  THREE.Scene,
  count:  number,
  radius  = SPAWN_RADIUS,
  hp      = 3,
): EnemySystem {
  const enemies: Enemy3D[] = [];

  for (let i = 0; i < count; i++) {
    enemies.push(spawnEnemy(scene, i, count, radius, hp));
  }

  // GroupId → Enemy lookup
  const groupMap = new Map<string, Enemy3D>();
  for (const e of enemies) groupMap.set(e.group.uuid, e);

  // ── Spawn wave ─────────────────────────────────────────────────────────────
  function spawnWave(scene: THREE.Scene, count: number, wave: number, speedMult = 1.0) {
    const hpScale  = 1 + (wave - 1) * 0.8;
    const speedBon = (wave - 1) * 0.35 * speedMult;  // director-scaled speed bonus
    const waveHp   = Math.max(3, Math.round(3 * hpScale));

    for (let i = 0; i < count; i++) {
      const e = spawnEnemy(scene, i, count, SPAWN_RADIUS, waveHp, speedBon);
      enemies.push(e);
      groupMap.set(e.group.uuid, e);
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(
    dt:           number,
    playerPos:    THREE.Vector3,
    onPlayerHit:  (dmg: number) => void,
    speedMult = 1.0,
  ) {
    for (const e of enemies) {
      if (!e.alive) continue;
      e.damageCd = Math.max(0, e.damageCd - dt);

      const toPlayer = new THREE.Vector3().subVectors(playerPos, e.group.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();

      e.group.lookAt(playerPos.x, e.group.position.y, playerPos.z);

      if (dist > ATTACK_RANGE + 0.15) {
        toPlayer.normalize().multiplyScalar(e.speed * speedMult * dt);
        e.group.position.add(toPlayer);
      } else if (e.damageCd <= 0) {
        onPlayerHit(ATTACK_DAMAGE);
        e.damageCd = ATTACK_CD;
      }

      e.group.position.y = 0;

      // Update HP bar
      const ratio = e.hp / e.maxHp;
      e.hpFill.scale.x      = Math.max(0.001, ratio);
      e.hpFill.position.x   = -(0.78 * (1 - ratio)) / 2;
      (e.hpFill.material as THREE.MeshBasicMaterial).color.setHex(
        ratio > 0.6 ? 0x00ff88 : ratio > 0.3 ? 0xffcc33 : 0xff4444,
      );

      // Billboard HP bar toward (0,0,0) — hack: reset quaternion then rotate
      const hpBar = e.group.children[3] as THREE.Mesh;
      const fill  = e.group.children[4] as THREE.Mesh;
      if (hpBar) hpBar.quaternion.copy(new THREE.Quaternion());
      if (fill)  fill.quaternion.copy(new THREE.Quaternion());
    }
  }

  // ── Hit enemy ─────────────────────────────────────────────────────────────
  function hitEnemy(
    object:  THREE.Object3D,
    damage:  number,
    isHead:  boolean,
    scene:   THREE.Scene,
  ): HitResult {
    // Walk up hierarchy to find group uuid
    let obj: THREE.Object3D | null = object;
    let groupId: string | undefined;
    while (obj) {
      groupId = obj.userData.enemyGroupId as string | undefined;
      if (groupId) break;
      obj = obj.parent;
    }
    if (!groupId) return { killed: false, isHead: false, damage: 0 };
    const e = groupMap.get(groupId);
    if (!e || !e.alive) return { killed: false, isHead: false, damage: 0 };

    e.hp = Math.max(0, e.hp - damage);

    if (e.hp <= 0) {
      e.alive = false;
      // Death FX
      const col = (e.body.material as THREE.MeshStandardMaterial).color.getHex();
      for (let p = 0; p < 12; p++) {
        const chunk = new THREE.Mesh(
          new THREE.BoxGeometry(0.17, 0.17, 0.17),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        chunk.position.copy(e.group.position);
        chunk.position.x += (Math.random() - 0.5) * 1.4;
        chunk.position.y += Math.random() * 2.0;
        chunk.position.z += (Math.random() - 0.5) * 1.4;
        scene.add(chunk);
        // Drift upward and fade
        const startY = chunk.position.y;
        let t = 0;
        const drift = () => {
          t += 0.016;
          chunk.position.y = startY + t * 2;
          (chunk.material as THREE.MeshBasicMaterial).opacity = 1 - t * 1.5;
          (chunk.material as THREE.MeshBasicMaterial).transparent = true;
          if (t < 0.65) requestAnimationFrame(drift);
          else scene.remove(chunk);
        };
        requestAnimationFrame(drift);
      }
      scene.remove(e.group);
      return { killed: true, isHead, damage };
    }

    // Hit flash
    const mat = e.body.material as THREE.MeshStandardMaterial;
    const hc  = isHead ? 0xffff00 : 0xffffff;
    mat.emissive.setHex(hc);
    mat.emissiveIntensity = 1.0;
    setTimeout(() => { mat.emissive.setHex(0x000000); mat.emissiveIntensity = 0; }, 55);

    return { killed: false, isHead, damage };
  }

  return {
    enemies,
    hitEnemy,
    spawnWave,
    update,
    allDead:    () => enemies.every((e) => !e.alive),
    aliveCount: () => enemies.filter((e) => e.alive).length,
    dispose:    (scene) => enemies.forEach((e) => { if (e.alive) scene.remove(e.group); }),
  };
}
