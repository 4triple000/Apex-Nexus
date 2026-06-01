/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE v3 — Physics                          ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Pure functions only — no React, no Canvas.
 * AABB (axis-aligned bounding box) collision resolution.
 * v3: added chase AI, bullet physics.
 */
import type { Rect, PlayerState, EnemyState, PlatformState, BulletState } from './types';

// ── Gravity ───────────────────────────────────────────────────────────────────

export function applyGravity(vy: number, gravity: number, dt: number): number {
  return vy + gravity * dt;
}

// ── AABB overlap test ─────────────────────────────────────────────────────────

export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width  &&
    a.x + a.width  > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// ── Circle vs AABB overlap ────────────────────────────────────────────────────

export function circleOverlapsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const nearX = Math.max(rect.x, Math.min(rect.x + rect.width, cx));
  const nearY = Math.max(rect.y, Math.min(rect.y + rect.height, cy));
  const dx = cx - nearX, dy = cy - nearY;
  return dx * dx + dy * dy < r * r;
}

// ── Platform collision resolution ─────────────────────────────────────────────
// Returns updated {x, y, vx, vy, onGround}.

export function resolvePlatformCollisions(
  player: PlayerState,
  platforms: PlatformState[]
): Pick<PlayerState, 'x' | 'y' | 'vx' | 'vy' | 'onGround'> {
  let { x, y, vx, vy } = player;
  let onGround = false;

  for (const p of platforms) {
    if (!overlaps({ x, y, width: player.width, height: player.height }, p)) continue;

    const overlapLeft  = x + player.width  - p.x;
    const overlapRight = p.x + p.width     - x;
    const overlapTop   = y + player.height - p.y;
    const overlapBot   = p.y + p.height    - y;

    const minH = Math.min(overlapLeft, overlapRight);
    const minV = Math.min(overlapTop,  overlapBot);

    if (minV < minH) {
      if (overlapTop < overlapBot) { y = p.y - player.height; vy = 0; onGround = true; }
      else                         { y = p.y + p.height;      vy = 0; }
    } else {
      if (overlapLeft < overlapRight) x = p.x - player.width;
      else                            x = p.x + p.width;
      vx = 0;
    }
  }

  return { x, y, vx, vy, onGround };
}

// ── Enemy patrol AI ───────────────────────────────────────────────────────────

export function updateEnemyPatrol(enemy: EnemyState, dt: number): EnemyState {
  let { x, vx } = enemy;
  x += vx * dt;

  if (enemy.patrol) {
    if (x <= enemy.patrol.minX) { x = enemy.patrol.minX; vx = Math.abs(vx); }
    if (x + enemy.width >= enemy.patrol.maxX) { x = enemy.patrol.maxX - enemy.width; vx = -Math.abs(vx); }
  }

  return { ...enemy, x, vx };
}

// ── Enemy chase AI (top-down shooter) ────────────────────────────────────────
// Enemy moves toward (targetX, targetY) at given speed.

export function updateEnemyChase(
  enemy: EnemyState,
  targetX: number,
  targetY: number,
  dt: number
): EnemyState {
  if (!enemy.alive) return enemy;

  const dx  = (targetX + 16) - (enemy.x + enemy.width  / 2);
  const dy  = (targetY + 16) - (enemy.y + enemy.height / 2);
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return enemy;

  const spd = enemy.vx; // reusing vx field as speed scalar
  const nx = enemy.x + (dx / len) * spd * dt;
  const ny = enemy.y + (dy / len) * spd * dt;

  return { ...enemy, x: nx, y: ny };
}

// ── Bullet update ─────────────────────────────────────────────────────────────

export function updateBullets(
  bullets: BulletState[],
  worldW: number,
  worldH: number,
  dt: number
): BulletState[] {
  return bullets
    .map((b) => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt, ttl: b.ttl - 1 }))
    .filter((b) => b.ttl > 0 && b.x >= 0 && b.x <= worldW && b.y >= 0 && b.y <= worldH);
}

// ── Bullet vs enemy hit ───────────────────────────────────────────────────────

export function checkBulletEnemyHits(
  bullets: BulletState[],
  enemies: EnemyState[]
): { bullets: BulletState[]; enemies: EnemyState[]; killCount: number } {
  const hitBullets = new Set<number>();
  let killCount = 0;

  const newEnemies = enemies.map((e) => {
    if (!e.alive) return e;
    for (let bi = 0; bi < bullets.length; bi++) {
      if (hitBullets.has(bi)) continue;
      const b = bullets[bi]!;
      if (circleOverlapsRect(b.x, b.y, 5, e)) {
        hitBullets.add(bi);
        const newHp = (e.hp ?? 1) - 1;
        if (newHp <= 0) { killCount++; return { ...e, hp: 0, alive: false }; }
        return { ...e, hp: newHp };
      }
    }
    return e;
  });

  const newBullets = bullets.filter((_, i) => !hitBullets.has(i));
  return { bullets: newBullets, enemies: newEnemies, killCount };
}

// ── World boundary clamp ──────────────────────────────────────────────────────

export function clampToWorld(
  x: number, y: number, width: number, height: number,
  worldW: number, worldH: number
): { x: number; y: number; fell: boolean } {
  const clampedX = Math.max(0, Math.min(worldW - width, x));
  const fell     = y > worldH + 100;
  return { x: clampedX, y, fell };
}

// ── World clamp (top-down — no falling) ───────────────────────────────────────

export function clampToWorldTopDown(
  x: number, y: number, width: number, height: number,
  worldW: number, worldH: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(worldW - width, x)),
    y: Math.max(0, Math.min(worldH - height, y)),
  };
}

// ── Coin circle-rect overlap ──────────────────────────────────────────────────

export function coinOverlaps(
  px: number, py: number, pw: number, ph: number,
  cx: number, cy: number, cr: number
): boolean {
  const nearX = Math.max(px, Math.min(px + pw, cx));
  const nearY = Math.max(py, Math.min(py + ph, cy));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}
