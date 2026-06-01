/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE v2 — Canvas Renderer                  ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Pure canvas drawing utilities — no React, no DOM.
 * v2: enhanced squash/stretch, air rotation, enemy flash,
 *     coin collection scale-pop, particle-aware rendering.
 */
import type { PlayerState, PlatformState, EnemyState, CoinState, RemotePlayer } from './types';
import type { EnemyFX, CoinFX } from './effects';

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Background ────────────────────────────────────────────────────────────────

export function drawBackground(
  ctx: CanvasRenderingContext2D, w: number, h: number, color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.028)";
  ctx.lineWidth   = 1;
  const step = 40;
  for (let x = 0; x < w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

// ── Platforms ─────────────────────────────────────────────────────────────────

export function drawPlatforms(ctx: CanvasRenderingContext2D, platforms: PlatformState[]) {
  for (const p of platforms) {
    const gradient = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
    gradient.addColorStop(0, p.color);
    gradient.addColorStop(1, darken(p.color, 0.30));
    ctx.fillStyle = gradient;
    roundRect(ctx, p.x, p.y, p.width, p.height, 4);
    ctx.fill();

    // Top highlight stripe
    ctx.strokeStyle = lighten(p.color, 0.40);
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x + 5, p.y + 1);
    ctx.lineTo(p.x + p.width - 5, p.y + 1);
    ctx.stroke();
  }
}

// ── Player ────────────────────────────────────────────────────────────────────

export function drawPlayer(ctx: CanvasRenderingContext2D, p: PlayerState) {
  const { x, y, width: w, height: h, color, onGround, facing, vy } = p;

  // ── Squash & stretch (v2: velocity-proportional) ──────────────────────────
  let squashX = 1, squashY = 1;
  if (onGround) {
    // Squash on landing (vy was positive, now 0)
    squashX = 1.14;
    squashY = 0.86;
  } else if (vy < 0) {
    // Rising — stretch vertically
    const t = Math.min(1, Math.abs(vy) / 12);
    squashX = 1 - t * 0.14;
    squashY = 1 + t * 0.18;
  } else if (vy > 0) {
    // Falling — slight stretch
    const t = Math.min(1, vy / 12);
    squashX = 1 + t * 0.06;
    squashY = 1 - t * 0.04;
  }

  // ── Air rotation (slight tilt based on vy) ────────────────────────────────
  const airRotation = onGround ? 0 : clamp(vy * 0.007, -0.22, 0.22) * facing;

  ctx.save();

  const pivotX = x + w / 2;
  const pivotY = y + h;
  ctx.translate(pivotX, pivotY);
  if (airRotation !== 0) ctx.rotate(airRotation);
  ctx.scale(facing * squashX, squashY);
  ctx.translate(-w / 2, -h);

  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur  = 14;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, lighten(color, 0.32));
  grad.addColorStop(1, darken(color,  0.22));
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, w, h, 6);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Eyes
  const eyeY  = h * 0.27;
  const eyeR  = w * 0.105;
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.beginPath(); ctx.arc(w * 0.30, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.70, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(w * 0.30 + 1, eyeY + 1, eyeR * 0.52, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.70 + 1, eyeY + 1, eyeR * 0.52, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// ── Enemies ───────────────────────────────────────────────────────────────────

export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: EnemyState[],
  fxMap?: Map<number, EnemyFX>
) {
  enemies.forEach((e, idx) => {
    if (!e.alive && !fxMap?.has(idx)) return;

    const fx      = fxMap?.get(idx);
    const isFlash = fx && fx.flashTimer > 0;
    const alpha   = fx?.dying ? fx.dyingAlpha : 1;

    // Squash on stomp
    let squashX = 1, squashY = 1;
    if (fx && fx.squashTimer > 0) {
      const t = fx.squashTimer / 8;
      squashX = 1 + t * 0.30;
      squashY = 1 - t * 0.30;
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    if (isFlash) {
      // White flash on stomp hit
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#fff";
    } else {
      ctx.shadowColor = e.color;
      const grad = ctx.createLinearGradient(e.x, e.y, e.x, e.y + e.height);
      grad.addColorStop(0, lighten(e.color, 0.22));
      grad.addColorStop(1, darken(e.color,  0.30));
      ctx.fillStyle = grad;
    }

    ctx.shadowBlur = 8;

    const cx = e.x + e.width / 2;
    const cy = e.y + e.height;
    ctx.translate(cx, cy);
    ctx.scale(squashX, squashY);
    ctx.translate(-e.width / 2, -e.height);

    roundRect(ctx, 0, 0, e.width, e.height, 4);
    ctx.fill();

    if (!isFlash) {
      // Angry eyes
      ctx.shadowBlur = 0;
      const ey = e.height * 0.27;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(e.width * 0.30, ey, e.width * 0.10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.width * 0.70, ey, e.width * 0.10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f00";
      ctx.beginPath(); ctx.arc(e.width * 0.30 + 1, ey + 1, e.width * 0.05, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.width * 0.70 + 1, ey + 1, e.width * 0.05, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  });
}

// ── Coins ─────────────────────────────────────────────────────────────────────

export function drawCoins(
  ctx: CanvasRenderingContext2D,
  coins: CoinState[],
  t: number,
  fxMap?: Map<number, CoinFX>
) {
  coins.forEach((c, idx) => {
    const fx = fxMap?.get(idx);

    if (c.collected && !fx) return;

    const bob   = Math.sin(t * 0.003 + c.x * 0.05) * 3;
    const pulse = 1 + Math.sin(t * 0.006 + c.x * 0.02) * 0.06; // gentle pulse

    let scale = pulse;
    let alpha = 1;
    let dy    = bob;

    if (c.collected && fx) {
      // Collection pop animation
      scale = fx.collectScale;
      alpha = fx.collectAlpha;
      dy    = bob - fx.collectFrames * 1.2; // float upward
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    const r = c.radius * scale;
    ctx.translate(c.x, c.y + dy);

    ctx.shadowColor = c.color;
    ctx.shadowBlur  = 12;

    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    grad.addColorStop(0, lighten(c.color, 0.52));
    grad.addColorStop(1, darken(c.color,  0.20));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur   = 0;
    ctx.fillStyle    = "rgba(0,0,0,0.55)";
    ctx.font         = `bold ${r * 1.1}px sans-serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("◆", 0, 0);

    ctx.restore();
  });
}

// ── Remote players (multiplayer ghosts) ───────────────────────────────────────

export function drawRemotePlayers(ctx: CanvasRenderingContext2D, players: RemotePlayer[]) {
  for (const rp of players) {
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.shadowColor = rp.color;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = rp.color;
    roundRect(ctx, rp.x, rp.y, rp.width, rp.height, 6);
    ctx.fill();

    ctx.globalAlpha    = 1;
    ctx.shadowBlur     = 0;
    ctx.fillStyle      = "rgba(255,255,255,0.9)";
    ctx.font           = "10px sans-serif";
    ctx.textAlign      = "center";
    ctx.textBaseline   = "bottom";
    ctx.fillText(rp.name, rp.x + rp.width / 2, rp.y - 3);
    ctx.restore();
  }
}

// ── End-goal flag ─────────────────────────────────────────────────────────────

export function drawEndFlag(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 60); ctx.stroke();

  ctx.fillStyle = "#6C5CE7";
  ctx.shadowColor = "#6C5CE7";
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + 26, y + 11); ctx.lineTo(x, y + 22);
  ctx.fill();

  ctx.shadowBlur     = 0;
  ctx.fillStyle      = "rgba(162,155,254,0.7)";
  ctx.font           = "11px sans-serif";
  ctx.textAlign      = "center";
  ctx.textBaseline   = "bottom";
  ctx.fillText("GOAL", x + 4, y - 6);
  ctx.restore();
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h   = hex.replace('#', '');
  const big = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(big >> 16) & 255, (big >> 8) & 255, big & 255];
}

function namedToHex(color: string): string {
  const map: Record<string, string> = {
    blue: '#4a9eff', red: '#ff4444', green: '#44ff88',
    yellow: '#ffdd44', purple: '#a855f7', orange: '#ff8c00',
    cyan: '#00cfff', pink: '#ff79a8', white: '#ffffff',
    gray: '#888888', gold: '#ffcc33',
  };
  return map[color.toLowerCase()] ?? color;
}

export function lighten(color: string, amount: number): string {
  const hex = namedToHex(color);
  if (!hex.startsWith('#')) return color;
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r + 255 * amount)},${Math.min(255, g + 255 * amount)},${Math.min(255, b + 255 * amount)})`;
}

export function darken(color: string, amount: number): string {
  const hex = namedToHex(color);
  if (!hex.startsWith('#')) return color;
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, r - 255 * amount)},${Math.max(0, g - 255 * amount)},${Math.max(0, b - 255 * amount)})`;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
