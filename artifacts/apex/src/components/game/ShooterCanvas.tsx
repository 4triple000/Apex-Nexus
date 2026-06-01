/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX SHOOTER ENGINE — Top-down shooter (COD style)     ║
 * ║  4-way movement · bullets · chase enemies · health bar  ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { ShooterControls, type ShooterInput } from "./ShooterControls";
import {
  updateEnemyChase,
  updateBullets,
  checkBulletEnemyHits,
  clampToWorldTopDown,
  overlaps,
  coinOverlaps,
} from "@/engine/physics";
import { darken, lighten } from "@/engine/renderer";
import { EffectsManager } from "@/engine/effects";
import type {
  GameConfig, PlayerState, PlatformState, EnemyState, CoinState,
  BulletState, GamePhase,
} from "@/engine/types";

// ── Colour resolver ───────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue: "#4a9eff", red: "#ff4444", green: "#44ff88",
  yellow: "#ffdd44", purple: "#a855f7", orange: "#ff8c00",
  cyan: "#00cfff", pink: "#ff79a8", gold: "#ffcc33", gray: "#888",
  white: "#ffffff",
};
function rc(c: string) { return COLOR_MAP[c?.toLowerCase()] ?? c ?? "#888"; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ── HUD overlay ───────────────────────────────────────────────────────────────

function ShooterHUD({
  score, health, maxHealth, ammo, phase, killsLeft, gameTitle, onRestart, onBack,
}: {
  score:     number;
  health:    number;
  maxHealth: number;
  ammo:      string;
  phase:     GamePhase;
  killsLeft: number;
  gameTitle: string;
  onRestart: () => void;
  onBack:    () => void;
}) {
  const hpPct    = Math.max(0, health / maxHealth);
  const hpColor  = hpPct > 0.5 ? "#44ff88" : hpPct > 0.25 ? "#ffcc33" : "#ff4444";
  const IOS      = "cubic-bezier(0.25,0.46,0.45,0.94)";

  if (phase === "won" || phase === "lost") {
    return (
      <div style={{
        position: "absolute", inset: 0, zIndex: 40,
        background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
      }}>
        <div style={{ fontSize: 52 }}>{phase === "won" ? "🏆" : "💀"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "white" }}>
          {phase === "won" ? "Mission Complete!" : "You Were Eliminated"}
        </div>
        <div style={{ fontSize: 15, color: "#ffcc33", fontWeight: 700 }}>Score: {score}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onRestart} style={{ padding: "12px 24px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#6C5CE7,#A29BFE)", color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>▶ Retry</button>
          <button onClick={onBack}    style={{ padding: "12px 24px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", top: 12, left: 0, right: 0, zIndex: 20, padding: "0 14px", pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>

        {/* Health bar */}
        <div style={{ flex: 1, maxWidth: 160 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.50)", marginBottom: 3, textTransform: "uppercase" }}>
            ❤ HP
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${hpPct * 100}%`,
              background: hpColor,
              transition: `width 0.2s ${IOS}`,
              boxShadow: `0 0 8px ${hpColor}`,
            }} />
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>{health}/{maxHealth}</div>
        </div>

        {/* Score + kills */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "white" }}>{score}</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>score</div>
        </div>

        {/* Kills left + ammo */}
        <div style={{ textAlign: "right", minWidth: 60 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#ff4444" }}>☠ {killsLeft}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>🔫 {ammo}</div>
        </div>
      </div>

      {/* Game title */}
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.20)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {gameTitle}
        </span>
      </div>
    </div>
  );
}

// ── Canvas drawing helpers ────────────────────────────────────────────────────

function drawShooterBackground(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);

  // Top-down floor grid
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth   = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, walls: PlatformState[]) {
  for (const w of walls) {
    ctx.shadowColor = w.color;
    ctx.shadowBlur  = 6;
    const grad = ctx.createLinearGradient(w.x, w.y, w.x + w.width, w.y + w.height);
    grad.addColorStop(0, lighten(w.color, 0.20));
    grad.addColorStop(1, darken(w.color,  0.20));
    ctx.fillStyle = grad;
    ctx.fillRect(w.x, w.y, w.width, w.height);
    ctx.shadowBlur = 0;
  }
}

function drawShooterPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  angle: number
) {
  const cx = p.x + p.width  / 2;
  const cy = p.y + p.height / 2;
  const r  = p.width / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Body circle
  ctx.shadowColor = p.color;
  ctx.shadowBlur  = 16;
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
  grad.addColorStop(0, lighten(p.color, 0.40));
  grad.addColorStop(1, darken(p.color,  0.20));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Gun barrel
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(r * 0.4, -r * 0.18, r * 0.9, r * 0.36);

  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(-r * 0.22, -r * 0.22, r * 0.30, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawShooterEnemies(ctx: CanvasRenderingContext2D, enemies: EnemyState[]) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const cx = e.x + e.width  / 2;
    const cy = e.y + e.height / 2;
    const r  = e.width / 2;

    ctx.save();
    ctx.shadowColor = e.color;
    ctx.shadowBlur  = 12;

    const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
    grad.addColorStop(0, lighten(e.color, 0.28));
    grad.addColorStop(1, darken(e.color,  0.28));
    ctx.fillStyle = grad;
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Angry cross eyes
    ctx.shadowBlur = 0;
    ctx.fillStyle  = "rgba(0,0,0,0.90)";
    const er = r * 0.18;
    ctx.beginPath(); ctx.arc(-r * 0.30, -r * 0.22, er, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( r * 0.30, -r * 0.22, er, 0, Math.PI * 2); ctx.fill();

    // HP bar if multi-hp enemy
    if (e.maxHp && e.maxHp > 1 && e.hp != null) {
      const pct = e.hp / e.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(-r, r + 4, r * 2, 5);
      ctx.fillStyle = pct > 0.5 ? "#44ff88" : "#ff4444";
      ctx.fillRect(-r, r + 4, r * 2 * pct, 5);
    }

    ctx.restore();
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, bullets: BulletState[]) {
  for (const b of bullets) {
    ctx.save();
    ctx.shadowColor = "#ffcc33";
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = "#ffe066";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawPickups(ctx: CanvasRenderingContext2D, coins: CoinState[]) {
  for (const c of coins) {
    if (c.collected) continue;
    ctx.save();
    ctx.shadowColor = c.color;
    ctx.shadowBlur  = 14;
    const grad = ctx.createRadialGradient(c.x - c.radius * 0.3, c.y - c.radius * 0.3, 1, c.x, c.y, c.radius);
    grad.addColorStop(0, lighten(c.color, 0.50));
    grad.addColorStop(1, darken(c.color,  0.20));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ── Main ShooterCanvas component ─────────────────────────────────────────────

interface Props {
  config:     GameConfig;
  onGameEnd?: (phase: "won" | "lost", score: number) => void;
  onBack:     () => void;
}

const BULLET_SPEED  = 12;
const BULLET_TTL    = 80;

export function ShooterCanvas({ config, onGameEnd, onBack }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const WORLD_W = config.width  ?? 400;
  const WORLD_H = config.height ?? 600;
  const MAX_HP  = config.health ?? 100;
  const SHOOT_COOLDOWN = config.shootCooldown ?? 350; // ms

  // ── Factory helpers ──────────────────────────────────────────────────────

  const mkPlayer = useCallback((): PlayerState => ({
    x: config.player.x, y: config.player.y,
    width: config.player.width, height: config.player.height,
    color: rc(config.player.color),
    vx: 0, vy: 0, onGround: false,
    jumpForce: 0, speed: config.player.speed,
    score: 0, lives: 1, facing: 1,
    health: MAX_HP, maxHealth: MAX_HP, angle: 0,
  }), [config, MAX_HP]);

  const mkEnemies = useCallback((): EnemyState[] =>
    config.enemies.map((e) => ({
      x: e.x, y: e.y, width: e.width, height: e.height,
      color: rc(e.color ?? "red"),
      vx: e.speed ?? 1.4,
      alive: true,
      hp: e.hp ?? 1,
      maxHp: e.hp ?? 1,
    })),
  [config]);

  const mkCoins = useCallback((): CoinState[] =>
    (config.coins ?? []).map((c) => ({
      x: c.x, y: c.y, radius: c.radius,
      color: rc(c.color ?? "gold"),
      value: c.value ?? 20,
      collected: false,
    })),
  [config]);

  const mkWalls = useCallback((): PlatformState[] =>
    config.platforms.map((p) => ({ ...p, color: rc(p.color ?? "#2d3561") })),
  [config]);

  // ── State refs ───────────────────────────────────────────────────────────

  const playerRef  = useRef<PlayerState>(mkPlayer());
  const enemiesRef = useRef<EnemyState[]>(mkEnemies());
  const coinsRef   = useRef<CoinState[]>(mkCoins());
  const wallsRef   = useRef<PlatformState[]>(mkWalls());
  const bulletsRef = useRef<BulletState[]>([]);
  const inputRef   = useRef<ShooterInput>({ up: false, down: false, left: false, right: false, shoot: false });
  const phaseRef   = useRef<GamePhase>("playing");
  const rafRef     = useRef(0);
  const fxRef      = useRef(new EffectsManager());
  const lastShot   = useRef(0);
  const angleRef   = useRef(0);  // player facing angle

  // ── HUD state ────────────────────────────────────────────────────────────

  const [hudState, setHudState] = useState({
    score: 0, health: MAX_HP, maxHealth: MAX_HP,
    killsLeft: config.enemies.length, phase: "playing" as GamePhase,
    ammo: "∞",
  });

  // ── Scale ────────────────────────────────────────────────────────────────

  const getScale = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 1;
    return Math.min(el.clientWidth / WORLD_W, el.clientHeight / WORLD_H);
  }, [WORLD_W, WORLD_H]);

  // ── Input handler ────────────────────────────────────────────────────────

  const handleInput = useCallback((input: ShooterInput) => {
    fxRef.current.audio.unlock();
    inputRef.current = input;
  }, []);

  // ── Update ───────────────────────────────────────────────────────────────

  const update = useCallback((dt: number, _elapsed: number, now: number) => {
    if (phaseRef.current !== "playing") return;

    const p   = playerRef.current;
    const inp = inputRef.current;
    const fx  = fxRef.current;

    // ── Player movement (4-directional, no gravity) ────────────────────

    let { vx, vy } = p;
    const spd = p.speed;

    vx = inp.left ? -spd : inp.right ? spd : 0;
    vy = inp.up   ? -spd : inp.down  ? spd : 0;

    // Diagonal normalisation
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    let nx = p.x + vx * dt;
    let ny = p.y + vy * dt;

    // Wall collision (treat platforms as solid walls)
    const pRect = { x: nx, y: ny, width: p.width, height: p.height };
    for (const wall of wallsRef.current) {
      if (nx + p.width > wall.x && nx < wall.x + wall.width &&
          ny + p.height > wall.y && ny < wall.y + wall.height) {
        // Push out on smallest axis
        const overL = nx + p.width  - wall.x;
        const overR = wall.x + wall.width  - nx;
        const overT = ny + p.height - wall.y;
        const overB = wall.y + wall.height - ny;
        const minH  = Math.min(overL, overR);
        const minV  = Math.min(overT, overB);
        if (minH < minV) {
          nx = overL < overR ? wall.x - p.width : wall.x + wall.width;
        } else {
          ny = overT < overB ? wall.y - p.height : wall.y + wall.height;
        }
      }
    }
    void pRect;

    // Clamp to world
    const clamped = clampToWorldTopDown(nx, ny, p.width, p.height, WORLD_W, WORLD_H);
    nx = clamped.x; ny = clamped.y;

    // Update facing angle when moving
    if (vx !== 0 || vy !== 0) {
      angleRef.current = Math.atan2(vy, vx);
    }

    // ── Shooting ──────────────────────────────────────────────────────

    if (inp.shoot && now - lastShot.current >= SHOOT_COOLDOWN) {
      lastShot.current = now;
      const angle = angleRef.current;
      bulletsRef.current.push({
        x: nx + p.width  / 2 + Math.cos(angle) * (p.width / 2 + 4),
        y: ny + p.height / 2 + Math.sin(angle) * (p.height / 2 + 4),
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED,
        ttl: BULLET_TTL,
      });
    }

    // ── Update bullets ─────────────────────────────────────────────────

    bulletsRef.current = updateBullets(bulletsRef.current, WORLD_W, WORLD_H, dt);

    // Bullet vs wall
    bulletsRef.current = bulletsRef.current.filter((b) =>
      !wallsRef.current.some((w) =>
        b.x >= w.x && b.x <= w.x + w.width && b.y >= w.y && b.y <= w.y + w.height
      )
    );

    // ── Bullet vs enemy hits ────────────────────────────────────────────

    const hitResult = checkBulletEnemyHits(bulletsRef.current, enemiesRef.current);
    bulletsRef.current = hitResult.bullets;
    enemiesRef.current = hitResult.enemies;
    let { score } = p;
    score += hitResult.killCount * 100;

    if (hitResult.killCount > 0) {
      fx.particles.emitSciFiSparks(nx + p.width / 2, ny + p.height / 2, hitResult.killCount * 6);
    }

    // ── Enemy chase AI ─────────────────────────────────────────────────

    enemiesRef.current = enemiesRef.current.map((e) =>
      updateEnemyChase(e, nx, ny, dt)
    );

    // ── Enemy vs player collision (damage) ─────────────────────────────

    let { health } = p;
    let tookDamage = false;
    enemiesRef.current.forEach((e) => {
      if (!e.alive) return;
      if (overlaps({ x: nx, y: ny, width: p.width, height: p.height }, e)) {
        if (!tookDamage) {
          health = Math.max(0, health! - 20);
          tookDamage = true;
          fx.onPlayerHit(nx + p.width / 2, ny + p.height / 2);
          // Bounce player away from enemy
          const dx = nx - e.x, dy = ny - e.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          nx += (dx / len) * 20;
          ny += (dy / len) * 20;
          const c2 = clampToWorldTopDown(nx, ny, p.width, p.height, WORLD_W, WORLD_H);
          nx = c2.x; ny = c2.y;
        }
      }
    });

    // ── Coin/pickup collection ──────────────────────────────────────────

    coinsRef.current.forEach((c) => {
      if (c.collected) return;
      if (coinOverlaps(nx, ny, p.width, p.height, c.x, c.y, c.radius)) {
        c.collected = true;
        score += c.value;
        fx.onCoinCollect(0, c.x, c.y, c.color);
      }
    });

    // ── Win condition ──────────────────────────────────────────────────

    let newPhase: GamePhase = "playing";
    const aliveCount = enemiesRef.current.filter((e) => e.alive).length;

    if (health! <= 0) {
      newPhase = "lost";
    } else if (config.winCondition === "defeat_all" && aliveCount === 0) {
      newPhase = "won";
    } else if (config.winCondition === "collect_all" && coinsRef.current.every((c) => c.collected) && aliveCount === 0) {
      newPhase = "won";
    }

    if (newPhase === "won")  fx.onWinBurst(nx + p.width / 2, ny + p.height / 2);
    if (newPhase === "lost") fx.camera.shake(8, 300);

    // ── Commit ─────────────────────────────────────────────────────────

    playerRef.current = {
      ...p,
      x: nx, y: ny, vx, vy, onGround: false,
      score, health, angle: angleRef.current,
    };

    if (newPhase !== "playing") {
      phaseRef.current = newPhase;
      onGameEnd?.(newPhase, score);
    }

    fx.update(dt);

    // Topdown camera: follow player (no horizontal-only scroll)
    const camOffX = clamp(nx - WORLD_W / 2 + p.width / 2, 0, Math.max(0, WORLD_W - WORLD_W));
    const camOffY = clamp(ny - WORLD_H / 2 + p.height / 2, 0, Math.max(0, WORLD_H - WORLD_H));
    void camOffX; void camOffY;

    if (_elapsed % 6 === 0) {
      setHudState({
        score,
        health: health ?? MAX_HP,
        maxHealth: MAX_HP,
        killsLeft: aliveCount,
        phase: phaseRef.current,
        ammo: "∞",
      });
    }
  }, [config, WORLD_W, WORLD_H, MAX_HP, SHOOT_COOLDOWN, onGameEnd]);

  // ── Render ───────────────────────────────────────────────────────────────

  const render = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx)  return;

    const scale = getScale();
    ctx.save();
    ctx.scale(scale, scale);

    drawShooterBackground(ctx, WORLD_W, WORLD_H, config.background ?? "#0a0a14");
    drawWalls(ctx, wallsRef.current);
    drawPickups(ctx, coinsRef.current);
    drawBullets(ctx, bulletsRef.current);
    drawShooterEnemies(ctx, enemiesRef.current);
    drawShooterPlayer(ctx, playerRef.current, angleRef.current);

    fxRef.current.particles.render(ctx);

    ctx.restore();
    void t;
  }, [config, WORLD_W, WORLD_H, getScale]);

  // ── Game loop ────────────────────────────────────────────────────────────

  const startLoop = useCallback(() => {
    let lastTime = 0, elapsed = 0;
    const loop = (time: number) => {
      const dt = lastTime > 0 ? Math.min((time - lastTime) / 16.67, 3) : 1;
      lastTime = time; elapsed++;
      update(dt, elapsed, time);
      render(time);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [update, render]);

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    playerRef.current  = mkPlayer();
    enemiesRef.current = mkEnemies();
    coinsRef.current   = mkCoins();
    bulletsRef.current = [];
    phaseRef.current   = "playing";
    angleRef.current   = 0;
    lastShot.current   = 0;
    fxRef.current.reset();
    setHudState({ score: 0, health: MAX_HP, maxHealth: MAX_HP, killsLeft: config.enemies.length, phase: "playing", ammo: "∞" });
  }, [mkPlayer, mkEnemies, mkCoins, config.enemies.length, MAX_HP]);

  // ── Canvas resize ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current, cont = containerRef.current;
    if (!canvas || !cont) return;
    const resize = () => { canvas.width = cont.clientWidth; canvas.height = cont.clientHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cont);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    reset();
    return startLoop();
  }, [config, reset, startLoop]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", background: config.background ?? "#0a0a14", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      <ShooterControls onInput={handleInput} />
      <ShooterHUD
        score={hudState.score}
        health={hudState.health}
        maxHealth={hudState.maxHealth}
        ammo={hudState.ammo}
        phase={hudState.phase}
        killsLeft={hudState.killsLeft}
        gameTitle={config.name}
        onRestart={reset}
        onBack={onBack}
      />
    </div>
  );
}
