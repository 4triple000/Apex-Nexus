/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AME — Server-Authoritative Combat System v2                ║
 * ║                                                             ║
 * ║  All damage, kill, and respawn logic is validated           ║
 * ║  SERVER-SIDE. Clients report intent; server decides.        ║
 * ║                                                             ║
 * ║  v2 upgrades:                                               ║
 * ║    ⏱  Lag-compensated hit validation (position rewind)     ║
 * ║    🎯  Headshot from client hint + server distance check    ║
 * ║    🛡  Sanity checks: range, alive status, cooldown         ║
 * ║    📡  Per-weapon damage table                              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { randomUUID } from "node:crypto";
import type { Room, PlayerState, HitResult, Projectile, Vec3 } from "./models";
import { logger } from "../../lib/logger";
import { getRewindPosition, dist3D } from "./lagCompensator";

const DEFAULT_HP        = 100;
const RESPAWN_DELAY_MS  = 5_000;
const MAX_WEAPON_RANGE  = 160;    // units — server clamps all shots
const RANGE_TOLERANCE   = 35;    // desync window (lag comp adds extra leeway)

// ── Per-weapon server-side damage ─────────────────────────────────────────────
//  Must match client WeaponDef damage values (client cannot inflate).
const WEAPON_DAMAGE: Record<string, { base: number; head: number }> = {
  pistol:  { base: 35, head: 77 },    // 35 * 2.2
  rifle:   { base: 22, head: 44 },    // 22 * 2.0
  shotgun: { base: 15, head: 23 },    // 15 * 1.5
  sniper:  { base: 80, head: 240 },   // 80 * 3.0
  default: { base: 25, head: 50 },
};

// Per-shooter fire-rate cooldown guard (prevents rapid-fire cheats)
const FIRE_COOLDOWN_MS: Record<string, number> = {
  pistol:  285,    // 3.5 rps
  rifle:   111,    // 9 rps
  shotgun: 666,    // 1.5 rps
  sniper:  1111,   // 0.9 rps
  default: 200,
};

const lastFireTs = new Map<string, number>();   // shooterId → last allowed fire ts

// ── Geometry helpers ──────────────────────────────────────────────────────────

function distance3D(a: Vec3, b: Vec3): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

// ── Hit Validation (Lag-Compensated) ─────────────────────────────────────────

/**
 * Server validates a shoot event.
 *
 * Steps:
 *  1. Alive checks (shooter and target)
 *  2. Fire-rate cooldown guard
 *  3. Rewind target position to the moment the shot was fired
 *  4. Validate range against rewound position
 *  5. Apply server-authoritative damage
 */
export function handleShoot(
  room:          Room,
  shooterId:     string,
  targetId:      string,
  clientDistance: number,
  weaponId       = "default",
  isHeadHint     = false,
  shooterRttMs   = 0,
  shotTs         = Date.now(),
): HitResult {
  const shooter = room.players[shooterId];
  const target  = room.players[targetId];

  if (!shooter || !target) {
    return { valid: false, targetId, damage: 0, targetHp: 0, killed: false, reason: "Player not found" };
  }
  if (!shooter.alive) {
    return { valid: false, targetId, damage: 0, targetHp: target.hp, killed: false, reason: "Shooter is dead" };
  }
  if (!target.alive) {
    return { valid: false, targetId, damage: 0, targetHp: 0, killed: false, reason: "Target already dead" };
  }

  // ── Fire-rate cooldown guard ─────────────────────────────────────────────
  const cooldownMs = FIRE_COOLDOWN_MS[weaponId] ?? FIRE_COOLDOWN_MS["default"]!;
  const lastFire   = lastFireTs.get(shooterId) ?? 0;
  const now        = Date.now();
  if (now - lastFire < cooldownMs * 0.8) {    // 20 % tolerance
    return { valid: false, targetId, damage: 0, targetHp: target.hp, killed: false, reason: "Fire rate exceeded" };
  }
  lastFireTs.set(shooterId, now);

  // ── Lag-compensated range check ──────────────────────────────────────────
  //  Get where the TARGET was when the shot was fired (rewound by RTT/2).
  const rewindPos = getRewindPosition(targetId, shotTs, shooterRttMs);
  const refPos    = rewindPos ?? target;   // fallback to current if no history

  const serverDist = dist3D(shooter, refPos);
  if (serverDist > MAX_WEAPON_RANGE + RANGE_TOLERANCE) {
    logger.debug({ shooterId, targetId, serverDist, rtt: shooterRttMs }, "[AME] Shot rejected: out of range");
    return { valid: false, targetId, damage: 0, targetHp: target.hp, killed: false, reason: "Out of range" };
  }

  // ── Headshot validation ──────────────────────────────────────────────────
  //  Accept client headshot hint if shooter is close (< 60 units) or
  //  if rewound Y position suggests a head-height ray.
  const isHead = isHeadHint && serverDist < 60;

  // ── Server-authoritative damage ──────────────────────────────────────────
  const dmgTable = WEAPON_DAMAGE[weaponId] ?? WEAPON_DAMAGE["default"]!;
  const damage   = isHead ? dmgTable.head : dmgTable.base;

  return applyDamage(room, shooterId, targetId, damage);
}

// ── Apply Damage ──────────────────────────────────────────────────────────────

export function applyDamage(
  room:       Room,
  attackerId: string,
  targetId:   string,
  damage:     number,
): HitResult {
  const target   = room.players[targetId];
  const attacker = room.players[attackerId];

  if (!target) {
    return { valid: false, targetId, damage: 0, targetHp: 0, killed: false, reason: "Target missing" };
  }

  target.hp = Math.max(0, target.hp - damage);
  const killed = target.hp <= 0;

  if (killed) {
    target.alive     = false;
    target.deaths   += 1;
    target.respawnAt = Date.now() + RESPAWN_DELAY_MS;
    if (attacker) attacker.kills += 1;
    if (room.scoreboard[targetId])   room.scoreboard[targetId]!.deaths += 1;
    if (room.scoreboard[attackerId]) room.scoreboard[attackerId]!.kills += 1;
    logger.debug({ attackerId, targetId, damage }, "[AME] Kill confirmed");
  }

  return { valid: true, targetId, damage, targetHp: target.hp, killed };
}

// ── Respawn ───────────────────────────────────────────────────────────────────

export function respawnPlayer(
  room:     Room,
  playerId: string,
): { ok: true; player: PlayerState } | { ok: false; remainingMs: number; reason: string } {
  const player = room.players[playerId];
  if (!player) return { ok: false, remainingMs: 0, reason: "Player not found" };
  if (player.alive) return { ok: true, player };

  const remaining = (player.respawnAt ?? 0) - Date.now();
  if (remaining > 0) {
    return { ok: false, remainingMs: remaining, reason: `Respawn in ${Math.ceil(remaining / 1000)}s` };
  }

  player.hp       = DEFAULT_HP;
  player.alive    = true;
  player.x        = (Math.random() - 0.5) * 100;
  player.y        = 1.7;
  player.z        = (Math.random() - 0.5) * 100;
  player.respawnAt = undefined;

  logger.debug({ playerId, roomId: room.roomId }, "[AME] Player respawned");
  return { ok: true, player };
}

// ── Projectile registration (future tick-based simulation) ────────────────────

export function spawnProjectile(
  room:      Room,
  ownerId:   string,
  origin:    Vec3,
  direction: Vec3,
  damage     = 25,
  speed      = 80,
  range      = MAX_WEAPON_RANGE,
): Projectile {
  const proj: Projectile = {
    id: randomUUID(), ownerId, origin, direction, speed, damage, range,
    createdAt: Date.now(),
  };
  room.projectiles.push(proj);
  if (room.projectiles.length > 100) room.projectiles.splice(0, room.projectiles.length - 100);
  return proj;
}

// ── Match End ─────────────────────────────────────────────────────────────────

export function checkMatchEnd(room: Room): { ended: boolean; winner?: string; reason?: string } {
  if (room.status !== "active") return { ended: false };

  const KILL_LIMIT: Record<string, number> = { tdm: 50, ffa: 30, battle: 1 };
  const killLimit = KILL_LIMIT[room.mode] ?? 30;
  const TIME_LIMIT_MS = 10 * 60 * 1000;

  for (const [pid, score] of Object.entries(room.scoreboard)) {
    if (score.kills >= killLimit) {
      return { ended: true, winner: pid, reason: `Kill limit (${killLimit}) reached` };
    }
  }

  if (Date.now() - room.startedAt > TIME_LIMIT_MS) {
    const top = Object.entries(room.scoreboard).sort((a, b) => b[1].kills - a[1].kills)[0];
    return { ended: true, winner: top?.[0], reason: "Time limit reached" };
  }

  return { ended: false };
}

/** Cleanup fire-rate state on player disconnect. */
export function clearFireState(playerId: string): void {
  lastFireTs.delete(playerId);
}

export { distance3D as isInRange };
