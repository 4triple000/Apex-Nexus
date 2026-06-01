/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE v2 — Particle System  (upgraded)      ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║  Object-pool (300 slots). Four visual presets:          ║
 * ║    NEON_ENERGY  · FIRE_BURST · SCI_FI_SPARKS            ║
 * ║    COIN_MAGIC   · DEFAULT (diamond)                     ║
 * ║  Additive blending for glow (globalCompositeOperation). ║
 * ║  Trail streaks, fire flicker, zig-zag motion.           ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ── Particle type discriminator ────────────────────────────────────────────────

export type ParticleType =
  | "default"
  | "neon_energy"
  | "fire_burst"
  | "sci_fi_sparks"
  | "coin_magic";

// ── Core particle ──────────────────────────────────────────────────────────────

interface Particle {
  active:      boolean;
  type:        ParticleType;
  x:           number;
  y:           number;
  vx:          number;
  vy:          number;
  life:        number;     // remaining frames
  maxLife:     number;
  size:        number;
  color:       string;     // base color string
  r:           number;     // parsed red
  g:           number;     // parsed green
  b:           number;     // parsed blue
  gravity:     number;
  spin:        number;     // radians/frame (for default)
  angle:       number;

  // Trail ─────────────────────────────────────────
  trailX:      number[];   // ring buffer of previous X positions
  trailY:      number[];   // ring buffer of previous Y positions
  trailPtr:    number;     // write cursor in ring buffer
  trailLen:    number;     // how many slots to use (0 = no trail)

  // Fire flicker / coin twinkle ────────────────────
  flickerAmp:  number;     // scale oscillation amplitude (0 = off)
  flickerFreq: number;     // oscillations per frame
  flickerPhase: number;    // starting phase

  // Zig-zag (sci-fi sparks) ────────────────────────
  zigAmp:      number;     // horizontal amplitude per frame
  zigFreq:     number;     // oscillations per frame
  zigPhase:    number;
}

// ── Pool constants ─────────────────────────────────────────────────────────────

const POOL_MAX   = 300;
const TRAIL_SLOTS = 10;   // max trail ring-buffer size
const SQRT2INV   = 0.7071;

// ── Parse #rrggbb / rgba() → {r,g,b} ─────────────────────────────────────────

function parseRGB(color: string): [number, number, number] {
  if (color.startsWith("#") && color.length >= 7) {
    return [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
    ];
  }
  // fallback white
  return [255, 255, 255];
}

// ── Factory ────────────────────────────────────────────────────────────────────

function makeParticle(): Particle {
  return {
    active: false, type: "default",
    x: 0, y: 0, vx: 0, vy: 0,
    life: 0, maxLife: 1,
    size: 4, color: "#fff", r: 255, g: 255, b: 255,
    gravity: 0, spin: 0, angle: 0,
    trailX: new Array(TRAIL_SLOTS).fill(0),
    trailY: new Array(TRAIL_SLOTS).fill(0),
    trailPtr: 0, trailLen: 0,
    flickerAmp: 0, flickerFreq: 0, flickerPhase: 0,
    zigAmp: 0, zigFreq: 0, zigPhase: 0,
  };
}

// ── Rendering helpers ──────────────────────────────────────────────────────────

/** Draw a 4-point star (sparkle) centered at origin. radius = outer. */
function drawStar4(ctx: CanvasRenderingContext2D, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else         ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

/** Diamond shape centered at origin, size = half-height */
function drawDiamond(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * SQRT2INV, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * SQRT2INV, 0);
  ctx.closePath();
  ctx.fill();
}

// ── Render per type ────────────────────────────────────────────────────────────

function renderParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const t = Math.max(0, p.life / p.maxLife); // 1 → 0 over life
  const age = 1 - t;

  switch (p.type) {

    // ── NEON ENERGY ─────────────────────────────────────────────────────────
    case "neon_energy": {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // Draw trail first (fade streak behind the particle)
      if (p.trailLen > 0) {
        for (let j = 0; j < p.trailLen; j++) {
          const slot    = (p.trailPtr - 1 - j + TRAIL_SLOTS) % TRAIL_SLOTS;
          const tx      = p.trailX[slot]!;
          const ty      = p.trailY[slot]!;
          const tAlpha  = (1 - j / p.trailLen) * t * 0.45;
          const tSize   = p.size * (1 - j / p.trailLen) * 0.7;
          ctx.globalAlpha = tAlpha;
          ctx.fillStyle   = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur  = tSize * 4;
          ctx.beginPath();
          ctx.arc(tx, ty, Math.max(0.5, tSize * 0.4), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Core glow dot
      ctx.globalAlpha = t * 0.95;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = p.size * 8;
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, p.size * (0.4 + t * 0.6), 0, Math.PI * 2);
      ctx.fill();

      // Bright white core
      ctx.globalAlpha = t * 0.6;
      ctx.fillStyle   = "#ffffff";
      ctx.shadowBlur  = p.size * 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      break;
    }

    // ── FIRE BURST ────────────────────────────────────────────────────────────
    case "fire_burst": {
      // Color interpolation: red(255,50,0) → orange(255,160,0) → yellow(255,240,50)
      // At birth (t=1) use red; as it dies (t→0) shift to yellow
      const rc = Math.round(255);
      const gc = Math.round(50 + (1 - t) * 190);
      const bc = Math.round(t < 0.5 ? 0 : (t - 0.5) * 2 * 50);

      // Flicker: scale the size slightly
      const flick = 1 + p.flickerAmp * Math.sin(p.flickerPhase + age * p.flickerFreq * Math.PI * 2);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = t * 0.8;
      ctx.fillStyle   = `rgb(${rc},${gc},${bc})`;
      ctx.shadowColor = `rgb(${rc},${gc},${bc})`;
      ctx.shadowBlur  = p.size * 6;
      ctx.translate(p.x, p.y);

      const s = p.size * flick * (0.5 + t * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.globalAlpha = t * 0.5;
      ctx.fillStyle   = "#ffe97a";
      ctx.shadowBlur  = p.size * 2;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      break;
    }

    // ── SCI-FI SPARKS ─────────────────────────────────────────────────────────
    case "sci_fi_sparks": {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // Draw as a sharp elongated line (velocity streak)
      const sx = p.x; const sy = p.y;
      const ex = sx - p.vx * 4; const ey = sy - p.vy * 4;

      ctx.globalAlpha = t * 0.9;
      ctx.strokeStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = p.size * 5;
      ctx.lineWidth   = Math.max(0.5, p.size * 0.4);
      ctx.lineCap     = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Bright endpoint dot
      ctx.globalAlpha = t * 0.8;
      ctx.fillStyle   = "#ffffff";
      ctx.shadowBlur  = 4;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.5, p.size * 0.3), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      break;
    }

    // ── COIN MAGIC ────────────────────────────────────────────────────────────
    case "coin_magic": {
      // Twinkle: size pulses at flickerFreq
      const twinkle = 1 + p.flickerAmp * Math.abs(Math.sin(p.flickerPhase + age * p.flickerFreq * Math.PI * 2));

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = t * 0.9;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = p.size * 7;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      drawStar4(ctx, p.size * twinkle, p.size * twinkle * 0.35);

      // Inner gold core
      ctx.globalAlpha = t * 0.7;
      ctx.fillStyle   = "#fffde0";
      ctx.shadowBlur  = p.size;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.3 * twinkle, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      break;
    }

    // ── DEFAULT (diamond, original behavior) ──────────────────────────────────
    default: {
      const alpha = t * 0.9;
      const s     = p.size * (0.5 + t * 0.5);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = p.size * 1.5;
      ctx.translate(p.x, p.y);
      if (p.spin !== 0) ctx.rotate(p.angle);
      drawDiamond(ctx, s);
      ctx.restore();
      break;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ParticleSystem ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export class ParticleSystem {
  private pool:   Particle[] = Array.from({ length: POOL_MAX }, makeParticle);
  private active: Particle[] = [];

  // ── Pool acquire / release ──────────────────────────────────────────────────

  private acquire(): Particle | null {
    const p = this.pool.find((p) => !p.active);
    if (!p) return null;
    p.active   = true;
    p.trailPtr = 0;
    this.active.push(p);
    return p;
  }

  private release(p: Particle) {
    p.active = false;
    const i  = this.active.indexOf(p);
    if (i >= 0) this.active.splice(i, 1);
  }

  // ── Shared setup helper ─────────────────────────────────────────────────────

  private setup(
    p: Particle,
    type: ParticleType,
    fields: Partial<Omit<Particle, "active" | "type" | "r" | "g" | "b" | "trailX" | "trailY" | "trailPtr">>,
  ) {
    p.type = type;
    Object.assign(p, fields);
    // Reset trail
    p.trailX.fill(fields.x ?? 0);
    p.trailY.fill(fields.y ?? 0);
    p.trailPtr = 0;
    // Parse color channels
    const [r, g, b] = parseRGB(fields.color ?? "#fff");
    p.r = r; p.g = g; p.b = b;
  }

  // ── EXISTING EMITTERS (upgraded to typed particles) ─────────────────────────

  /** Small dust puff under the player feet on jump */
  emitJumpDust(cx: number, footY: number) {
    for (let i = 0; i < 6; i++) {
      const p = this.acquire(); if (!p) return;
      const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 1.5 + Math.random() * 2;
      this.setup(p, "default", {
        x: cx + (Math.random() - 0.5) * 16, y: footY,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
        life: 14 + Math.random() * 8, maxLife: 22,
        size: 3 + Math.random() * 3,
        color: "rgba(180,170,255,0.6)",
        gravity: 0.12, spin: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI * 2,
        trailLen: 0, flickerAmp: 0, zigAmp: 0, zigFreq: 0, zigPhase: 0,
        flickerFreq: 0, flickerPhase: 0,
      });
    }
  }

  /** Heavier impact burst on landing — scaled by fall velocity */
  emitLandImpact(cx: number, footY: number, intensity: number) {
    const count = Math.round(4 + intensity * 2);
    for (let i = 0; i < count; i++) {
      const p = this.acquire(); if (!p) return;
      const t   = (i / count) * Math.PI;
      const spd = (1.5 + Math.random() * 2.5) * Math.min(intensity * 0.4, 1.5);
      this.setup(p, "default", {
        x: cx + (Math.random() - 0.5) * 24, y: footY,
        vx: Math.cos(t) * spd * (Math.random() > 0.5 ? 1 : -1),
        vy: -(0.5 + Math.random() * 1.5),
        life: 10 + Math.random() * 10, maxLife: 20,
        size: 2 + Math.random() * 3,
        color: "rgba(140,130,220,0.55)",
        gravity: 0.18, spin: 0, angle: 0,
        trailLen: 0, flickerAmp: 0, flickerFreq: 0, flickerPhase: 0,
        zigAmp: 0, zigFreq: 0, zigPhase: 0,
      });
    }
  }

  /** Golden sparkle burst on coin pickup — uses COIN_MAGIC preset */
  emitCoinSparkle(cx: number, cy: number, _color: string) {
    for (let i = 0; i < 14; i++) {
      const p = this.acquire(); if (!p) return;
      const angle = (i / 14) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2.5;
      this.setup(p, "coin_magic", {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        life: 22 + Math.random() * 14, maxLife: 36,
        size: 2.5 + Math.random() * 3,
        color: i % 3 === 0 ? "#ffdd33" : i % 3 === 1 ? "#ffa833" : "#fff9a0",
        gravity: 0.06,
        spin: (Math.random() - 0.5) * 0.25,
        angle: Math.random() * Math.PI * 2,
        trailLen: 0,
        flickerAmp: 0.55, flickerFreq: 3 + Math.random() * 2,
        flickerPhase: Math.random() * Math.PI * 2,
        zigAmp: 0, zigFreq: 0, zigPhase: 0,
      });
    }
  }

  /** Explosion on enemy stomp — uses FIRE_BURST preset */
  emitEnemyExplosion(cx: number, cy: number, _color: string) {
    for (let i = 0; i < 22; i++) {
      const p = this.acquire(); if (!p) return;
      const angle = (i / 22) * Math.PI * 2;
      const speed = 2.5 + Math.random() * 4;
      this.setup(p, "fire_burst", {
        x: cx + (Math.random() - 0.5) * 10,
        y: cy + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 22 + Math.random() * 16, maxLife: 38,
        size: 3 + Math.random() * 5,
        color: "#ff4400",
        gravity: 0.12,
        spin: 0, angle: 0,
        trailLen: 0,
        flickerAmp: 0.35, flickerFreq: 4 + Math.random() * 3,
        flickerPhase: Math.random() * Math.PI * 2,
        zigAmp: 0, zigFreq: 0, zigPhase: 0,
      });
    }
  }

  /** Red flash burst when player is hit */
  emitPlayerHit(cx: number, cy: number) {
    for (let i = 0; i < 16; i++) {
      const p = this.acquire(); if (!p) return;
      const angle = (i / 16) * Math.PI * 2;
      const speed = 3 + Math.random() * 3;
      this.setup(p, "neon_energy", {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 18 + Math.random() * 10, maxLife: 28,
        size: 3 + Math.random() * 4,
        color: i % 2 === 0 ? "#ff3366" : "#ff0044",
        gravity: 0.12,
        spin: 0, angle: 0,
        trailLen: 5, flickerAmp: 0, flickerFreq: 0, flickerPhase: 0,
        zigAmp: 0, zigFreq: 0, zigPhase: 0,
      });
    }
  }

  // ── NEW PRESET EMITTERS ──────────────────────────────────────────────────────

  /**
   * NEON ENERGY burst — cyan/magenta glow with trailing streaks.
   * Great for teleport, power-up, or portal effects.
   */
  emitNeonEnergy(cx: number, cy: number, count = 20) {
    for (let i = 0; i < count; i++) {
      const p = this.acquire(); if (!p) return;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 2 + Math.random() * 4.5;
      const colors = ["#00ffff", "#ff00ff", "#00eeff", "#ff44ff", "#44ffff"];
      this.setup(p, "neon_energy", {
        x: cx + (Math.random() - 0.5) * 8,
        y: cy + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 24 + Math.random() * 18, maxLife: 42,
        size: 2.5 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        gravity: 0,
        spin: 0, angle: 0,
        trailLen: 7,
        flickerAmp: 0, flickerFreq: 0, flickerPhase: 0,
        zigAmp: 0, zigFreq: 0, zigPhase: 0,
      });
    }
  }

  /**
   * FIRE BURST — upward-biased red→orange→yellow fire particles.
   * Great for respawn, death, or ground-pound effects.
   */
  emitFireBurst(cx: number, cy: number, count = 18) {
    for (let i = 0; i < count; i++) {
      const p = this.acquire(); if (!p) return;
      const spread = (Math.random() - 0.5) * Math.PI * 1.2;
      const angle  = -Math.PI / 2 + spread; // mostly upward
      const speed  = 2 + Math.random() * 5;
      this.setup(p, "fire_burst", {
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + Math.random() * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 20 + Math.random() * 20, maxLife: 40,
        size: 4 + Math.random() * 6,
        color: "#ff3300",
        gravity: -0.04, // fire rises against gravity
        spin: 0, angle: 0, trailLen: 0,
        flickerAmp: 0.4 + Math.random() * 0.3,
        flickerFreq: 3 + Math.random() * 5,
        flickerPhase: Math.random() * Math.PI * 2,
        zigAmp: 0, zigFreq: 0, zigPhase: 0,
      });
    }
  }

  /**
   * SCI-FI SPARKS — fast electric blue/white sharp sparks with zig-zag motion.
   * Great for electric hits, laser impacts, power surges.
   */
  emitSciFiSparks(cx: number, cy: number, count = 16) {
    for (let i = 0; i < count; i++) {
      const p = this.acquire(); if (!p) return;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 4 + Math.random() * 7;
      const colors = ["#00cfff", "#aaeeff", "#ffffff", "#55ddff", "#00ffee"];
      this.setup(p, "sci_fi_sparks", {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 10 + Math.random() * 12, maxLife: 22,
        size: 1.5 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        gravity: 0.08,
        spin: 0, angle: 0, trailLen: 0,
        flickerAmp: 0, flickerFreq: 0, flickerPhase: 0,
        // Zig-zag is applied to ~50% of sparks
        zigAmp:   Math.random() > 0.5 ? (1.5 + Math.random() * 2.5) : 0,
        zigFreq:  5 + Math.random() * 8,
        zigPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * COIN MAGIC — gold sparkle circular burst with twinkle effect and slow fall.
   * Identical in spirit to emitCoinSparkle but standalone preset for direct use.
   */
  emitCoinMagic(cx: number, cy: number, count = 16) {
    for (let i = 0; i < count; i++) {
      const p = this.acquire(); if (!p) return;
      const angle = (i / count) * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      const colors = ["#ffdd00", "#ffc533", "#fff8a0", "#ffaa00", "#ffe055"];
      this.setup(p, "coin_magic", {
        x: cx + (Math.random() - 0.5) * 6,
        y: cy + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        life: 30 + Math.random() * 20, maxLife: 50,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        gravity: 0.05,
        spin: (Math.random() - 0.5) * 0.2,
        angle: Math.random() * Math.PI * 2,
        trailLen: 0,
        flickerAmp: 0.6, flickerFreq: 2 + Math.random() * 3,
        flickerPhase: Math.random() * Math.PI * 2,
        zigAmp: 0, zigFreq: 0, zigPhase: 0,
      });
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!;

      // Record trail position before moving
      if (p.trailLen > 0) {
        p.trailX[p.trailPtr] = p.x;
        p.trailY[p.trailPtr] = p.y;
        p.trailPtr = (p.trailPtr + 1) % TRAIL_SLOTS;
      }

      // Zig-zag horizontal displacement
      if (p.zigAmp > 0) {
        const progress = 1 - p.life / p.maxLife;
        p.vx += Math.sin(p.zigPhase + progress * p.zigFreq * Math.PI * 2) * p.zigAmp * 0.25 * dt;
      }

      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += p.gravity * dt;
      p.vx   *= 0.97;
      p.angle += p.spin;
      p.life  -= dt;

      if (p.life <= 0) this.release(p);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D) {
    // Two-pass: normal blend first, then additive blend particles
    const normal    = this.active.filter((p) => p.type === "default");
    const additive  = this.active.filter((p) => p.type !== "default");

    // Normal pass
    ctx.save();
    for (const p of normal) renderParticle(ctx, p);
    ctx.restore();

    // Additive (glow) pass — reset composite after
    ctx.save();
    for (const p of additive) renderParticle(ctx, p);
    // Restore default composite mode
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  clear() {
    for (const p of [...this.active]) this.release(p);
  }

  get count() { return this.active.length; }
  get poolSize() { return POOL_MAX; }
}
