/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE v2 — Effects Manager                  ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * High-level "juice" event dispatcher.
 * Coordinates particle bursts, camera shake, and audio cues
 * from a single call site in the game loop.
 *
 * Usage:
 *   const fx = new EffectsManager();
 *   fx.onJump(player.x + player.width/2, player.y + player.height);
 */

import { ParticleSystem } from './particles';
import { CameraSystem }   from './camera';
import { AudioManager }   from './audio';

// ── Enemy animation state (tracked per-index) ────────────────────────────────

export interface EnemyFX {
  flashTimer:  number;   // frames remaining for white-flash on stomp
  squashTimer: number;   // frames remaining for squash animation
  dying:       boolean;  // true = fading out before removal
  dyingAlpha:  number;   // 1 → 0
}

// ── Coin animation state (tracked per-index) ─────────────────────────────────

export interface CoinFX {
  collectScale:  number;  // 1 → 1.8 peak → disappear
  collectAlpha:  number;  // 1 → 0
  collectFrames: number;  // frames since collection
}

// ── Main class ────────────────────────────────────────────────────────────────

export class EffectsManager {
  particles: ParticleSystem;
  camera:    CameraSystem;
  audio:     AudioManager;

  /** Per-enemy FX state (keyed by enemy array index) */
  enemyFX = new Map<number, EnemyFX>();

  /** Per-coin FX state (keyed by coin array index) */
  coinFX  = new Map<number, CoinFX>();

  constructor() {
    this.particles = new ParticleSystem();
    this.camera    = new CameraSystem();
    this.audio     = new AudioManager();
  }

  // ── Game events ───────────────────────────────────────────────────────────

  onJump(cx: number, footY: number) {
    this.audio.jump();
    this.particles.emitJumpDust(cx, footY);
    this.camera.shake(1.2, 60);
  }

  onLand(cx: number, footY: number, fallVelocity: number) {
    const mag = Math.abs(fallVelocity);
    if (mag < 2) return; // ignore trivial taps

    this.audio.land();
    const intensity = Math.min(6, mag * 0.35);
    this.camera.shake(intensity, 100 + intensity * 15);
    this.particles.emitLandImpact(cx, footY, intensity);
  }

  onCoinCollect(coinIdx: number, cx: number, cy: number, color: string) {
    this.audio.coin();
    this.particles.emitCoinSparkle(cx, cy, color);
    this.coinFX.set(coinIdx, {
      collectScale:  1,
      collectAlpha:  1,
      collectFrames: 0,
    });
  }

  onEnemyStomp(enemyIdx: number, cx: number, cy: number, color: string) {
    this.audio.stomp();
    this.camera.shake(4, 140);
    this.particles.emitEnemyExplosion(cx, cy, color);
    this.enemyFX.set(enemyIdx, {
      flashTimer:  8,
      squashTimer: 8,
      dying:       true,
      dyingAlpha:  1,
    });
  }

  onPlayerHit(cx: number, cy: number) {
    this.audio.hit();
    this.camera.shake(7, 260);
    this.particles.emitPlayerHit(cx, cy);
  }

  onWin() {
    this.audio.win();
    this.camera.shake(3, 200);
  }

  // ── New preset events ──────────────────────────────────────────────────────

  /** Neon energy burst — power-up, teleport, portal activation */
  onNeonBurst(cx: number, cy: number, count = 20) {
    this.camera.shake(2, 80);
    this.particles.emitNeonEnergy(cx, cy, count);
  }

  /** Fire burst — ground pound, respawn, explosion */
  onFireBurst(cx: number, cy: number, count = 18) {
    this.camera.shake(3.5, 120);
    this.particles.emitFireBurst(cx, cy, count);
  }

  /** Electric sparks — electric hit, EMP, lightning strike */
  onElectricSparks(cx: number, cy: number, count = 16) {
    this.camera.shake(2.5, 90);
    this.particles.emitSciFiSparks(cx, cy, count);
  }

  /** Gold magic — bonus collect, perfect combo, level complete */
  onGoldMagic(cx: number, cy: number, count = 16) {
    this.audio.coin();
    this.particles.emitCoinMagic(cx, cy, count);
  }

  /** Spectacular win burst — fires all four presets at once */
  onWinBurst(cx: number, cy: number) {
    this.audio.win();
    this.camera.shake(5, 300);
    this.particles.emitNeonEnergy(cx, cy, 14);
    this.particles.emitFireBurst(cx, cy - 20, 12);
    this.particles.emitCoinMagic(cx, cy, 20);
    this.particles.emitSciFiSparks(cx, cy, 10);
  }

  // ── Frame update ──────────────────────────────────────────────────────────

  /** Call once per frame to tick animation states and particles */
  update(dt: number) {
    this.particles.update(dt);

    // Tick enemy FX
    for (const [idx, fx] of this.enemyFX) {
      fx.flashTimer  = Math.max(0, fx.flashTimer  - dt);
      fx.squashTimer = Math.max(0, fx.squashTimer - dt);
      if (fx.dying) {
        fx.dyingAlpha = Math.max(0, fx.dyingAlpha - 0.08 * dt);
        if (fx.dyingAlpha <= 0) this.enemyFX.delete(idx);
      }
    }

    // Tick coin FX
    for (const [idx, fx] of this.coinFX) {
      fx.collectFrames += dt;
      fx.collectScale   = 1 + Math.sin(fx.collectFrames * 0.4) * 0.4;
      fx.collectAlpha   = Math.max(0, 1 - fx.collectFrames * 0.06);
      if (fx.collectAlpha <= 0) this.coinFX.delete(idx);
    }
  }

  reset() {
    this.particles.clear();
    this.camera.reset();
    this.enemyFX.clear();
    this.coinFX.clear();
  }
}
