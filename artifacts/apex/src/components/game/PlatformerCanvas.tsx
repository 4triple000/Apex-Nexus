/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE v2 — PlatformerCanvas                 ║
 * ║  Juice-upgraded: particles · camera shake · synth audio ║
 * ║  Coyote time · jump buffering · smooth acceleration     ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { GameHUD }       from "./GameHUD";
import { TouchControls, type TouchInput } from "./TouchControls";
import {
  resolvePlatformCollisions,
  applyGravity,
  updateEnemyPatrol,
  clampToWorld,
  coinOverlaps,
  overlaps,
} from "@/engine/physics";
import {
  drawBackground,
  drawPlatforms,
  drawPlayer,
  drawEnemies,
  drawCoins,
  drawRemotePlayers,
  drawEndFlag,
} from "@/engine/renderer";
import { EffectsManager } from "@/engine/effects";
import type {
  GameConfig, PlayerState, PlatformState, EnemyState, CoinState,
  GamePhase, RemotePlayer,
} from "@/engine/types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlatformerCanvasProps {
  config:         GameConfig;
  remotePlayers?: RemotePlayer[];
  onGameEnd?:     (phase: "won" | "lost", score: number) => void;
  onPlayerMove?:  (x: number, y: number, vx: number, vy: number) => void;
  onBack:         () => void;
}

// ── Colour normaliser ─────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue: "#4a9eff", red: "#ff4444", green: "#44ff88",
  yellow: "#ffdd44", purple: "#a855f7", orange: "#ff8c00",
  cyan: "#00cfff", pink: "#ff79a8", gold: "#ffcc33", gray: "#888",
};
function resolveColor(c: string) { return COLOR_MAP[c.toLowerCase()] ?? c; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ── Feel constants ────────────────────────────────────────────────────────────

const ACCEL_FACTOR  = 0.28;
const FRICTION      = 0.78;
const MAX_VX_MULT   = 1.0;
const COYOTE_FRAMES = 7;
const JUMP_BUF_FRAMES = 7;

// ── Main component ────────────────────────────────────────────────────────────

export function PlatformerCanvas({
  config,
  remotePlayers = [],
  onGameEnd,
  onPlayerMove,
  onBack,
}: PlatformerCanvasProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const WORLD_W = config.width  ?? 400;
  const WORLD_H = config.height ?? 600;

  // ── Factory helpers ────────────────────────────────────────────────────────

  const mkPlayer = useCallback((): PlayerState => ({
    x: config.player.x, y: config.player.y,
    width: config.player.width, height: config.player.height,
    color: resolveColor(config.player.color),
    vx: 0, vy: 0, onGround: false,
    jumpForce: config.player.jumpForce,
    speed: config.player.speed,
    score: 0, lives: 3, facing: 1,
  }), [config]);

  const mkPlatforms = useCallback((): PlatformState[] =>
    config.platforms.map((p) => ({ ...p, color: resolveColor(p.color ?? "#3d2561") })),
  [config]);

  const mkEnemies = useCallback((): EnemyState[] =>
    config.enemies.map((e) => ({
      x: e.x, y: e.y, width: e.width, height: e.height,
      color: resolveColor(e.color ?? "red"),
      vx: e.speed ?? 1.5,
      alive: true,
      patrol: e.patrol,
    })),
  [config]);

  const mkCoins = useCallback((): CoinState[] =>
    (config.coins ?? []).map((c) => ({
      x: c.x, y: c.y, radius: c.radius,
      color: resolveColor(c.color ?? "gold"),
      value: c.value ?? 10,
      collected: false,
    })),
  [config]);

  // ── Game state refs ────────────────────────────────────────────────────────

  const playerRef    = useRef<PlayerState>(mkPlayer());
  const platformsRef = useRef<PlatformState[]>(mkPlatforms());
  const enemiesRef   = useRef<EnemyState[]>(mkEnemies());
  const coinsRef     = useRef<CoinState[]>(mkCoins());
  const inputRef     = useRef<TouchInput>({ left: false, right: false, jump: false });
  const phaseRef     = useRef<GamePhase>("playing");
  const timerRef     = useRef<number | null>(config.surviveSecs ?? null);
  const rafRef       = useRef(0);

  // ── Feel state refs ────────────────────────────────────────────────────────

  const coyoteRef    = useRef(0);
  const jumpBufRef   = useRef(0);
  const jumpHeldRef  = useRef(false);
  const wasOnGround  = useRef(false);
  const prevVy       = useRef(0);

  // ── Effects manager ────────────────────────────────────────────────────────

  const fxRef = useRef(new EffectsManager());

  // ── HUD state ─────────────────────────────────────────────────────────────

  const [hudState, setHudState] = useState({
    score: 0, lives: 3, timer: timerRef.current, phase: "playing" as GamePhase,
  });

  // ── Input ──────────────────────────────────────────────────────────────────

  const handleInput = useCallback((input: TouchInput) => {
    fxRef.current.audio.unlock();

    if (input.jump && !inputRef.current.jump) {
      const p = playerRef.current;
      if (!p.onGround && coyoteRef.current <= 0) {
        jumpBufRef.current = JUMP_BUF_FRAMES;
      }
    }
    inputRef.current = input;
  }, []);

  // ── Scale ──────────────────────────────────────────────────────────────────

  const getScale = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 1;
    return Math.min(el.clientWidth / WORLD_W, el.clientHeight / WORLD_H);
  }, [WORLD_W, WORLD_H]);

  // ── Update ─────────────────────────────────────────────────────────────────

  const update = useCallback((dt: number, elapsed: number) => {
    if (phaseRef.current !== "playing") return;

    const p     = playerRef.current;
    const input = inputRef.current;
    const fx    = fxRef.current;

    if (coyoteRef.current > 0) coyoteRef.current -= dt;
    if (jumpBufRef.current > 0) jumpBufRef.current -= dt;

    const maxVx = p.speed * MAX_VX_MULT;
    let { vx } = p;

    if (input.left) {
      vx += (-p.speed - vx) * ACCEL_FACTOR * dt;
    } else if (input.right) {
      vx += (p.speed - vx) * ACCEL_FACTOR * dt;
    } else {
      vx *= Math.pow(FRICTION, dt);
    }
    vx = clamp(vx, -maxVx, maxVx);
    if (Math.abs(vx) < 0.05) vx = 0;

    const facing: 1 | -1 = input.left ? -1 : input.right ? 1 : p.facing;

    let { vy } = p;
    const canJump = p.onGround || coyoteRef.current > 0;
    const wantsJump = (input.jump && !jumpHeldRef.current) || jumpBufRef.current > 0;

    if (canJump && wantsJump) {
      vy = -p.jumpForce;
      jumpHeldRef.current = true;
      jumpBufRef.current  = 0;
      coyoteRef.current   = 0;
      const footY = p.y + p.height;
      fx.onJump(p.x + p.width / 2, footY);
    }
    if (!input.jump) jumpHeldRef.current = false;

    const newVy = config.gravity > 0 ? applyGravity(vy, config.gravity, dt) : vy;

    const nx0 = p.x + vx * dt;
    const ny0 = p.y + newVy * dt;
    const partial  = { ...p, x: nx0, y: ny0, vx, vy: newVy };
    const resolved = resolvePlatformCollisions(partial, platformsRef.current);
    let nx = resolved.x, ny = resolved.y;

    const { x: cx, y: cy, fell } = clampToWorld(nx, ny, p.width, p.height, WORLD_W * 2, WORLD_H);
    nx = cx; ny = cy;

    if (wasOnGround.current && !resolved.onGround) {
      coyoteRef.current = COYOTE_FRAMES;
    }
    wasOnGround.current = resolved.onGround;

    if (!p.onGround && resolved.onGround && prevVy.current > 1.5) {
      fx.onLand(nx + p.width / 2, ny + p.height, prevVy.current);
    }
    prevVy.current = resolved.vy;

    let { lives } = p;
    let lostLife   = false;

    enemiesRef.current = enemiesRef.current.map((e) => updateEnemyPatrol(e, dt));

    if (config.gravity === 0 && config.winCondition === "survive") {
      enemiesRef.current = enemiesRef.current.map((e) => {
        const ny2 = e.y + 3 * dt;
        return { ...e, y: ny2 > WORLD_H + 50 ? -40 : ny2 };
      });
    }

    enemiesRef.current.forEach((e, idx) => {
      if (!e.alive) return;
      const pr = { x: nx, y: ny, width: p.width, height: p.height };
      if (!overlaps(pr, e)) return;

      if (resolved.vy === 0 && prevVy.current > 0 && ny + p.height < e.y + e.height * 0.55 + 8) {
        e.alive = false;
        resolved.vy = -7;
        playerRef.current.score += 25;
        fx.onEnemyStomp(idx, e.x + e.width / 2, e.y + e.height / 2, e.color);
      } else if (!lostLife) {
        lives    = Math.max(0, lives - 1);
        lostLife = true;
        fx.onPlayerHit(nx + p.width / 2, ny + p.height / 2);
        nx = p.x; ny = p.y;
      }
    });

    let { score } = p;
    coinsRef.current.forEach((c, idx) => {
      if (c.collected) return;
      if (!coinOverlaps(nx, ny, p.width, p.height, c.x, c.y, c.radius)) return;
      c.collected = true;
      score += c.value;
      fx.onCoinCollect(idx, c.x, c.y, c.color);
    });

    let newPhase: GamePhase = "playing";
    if (lives <= 0 || fell) {
      newPhase = "lost";
    } else if (config.winCondition === "collect_all") {
      if (
        coinsRef.current.every((c) => c.collected) &&
        (config.enemies.length === 0 || enemiesRef.current.every((e) => !e.alive))
      ) newPhase = "won";
    } else if (config.winCondition === "reach_end") {
      if (nx + p.width >= (config.endX ?? WORLD_W * 2 - 60)) newPhase = "won";
    } else if (config.winCondition === "survive") {
      if (timerRef.current !== null) {
        timerRef.current = Math.max(0, timerRef.current - dt * (1 / 60));
        if (timerRef.current <= 0) newPhase = "won";
      }
    } else if (config.winCondition === "defeat_all") {
      if (enemiesRef.current.every((e) => !e.alive)) newPhase = "won";
    }

    if (newPhase === "won")  fx.onWinBurst(nx + p.width / 2, ny + p.height / 2);
    if (newPhase === "lost") { fx.camera.shake(8, 300); fx.particles.emitSciFiSparks(nx + p.width / 2, ny + p.height / 2, 20); }

    playerRef.current = {
      ...p,
      x: nx, y: ny,
      vx: resolved.vx ?? vx,
      vy: resolved.vy,
      onGround: resolved.onGround,
      facing, score, lives,
    };

    if (newPhase !== "playing") {
      phaseRef.current = newPhase;
      onGameEnd?.(newPhase, score);
    }

    fx.update(dt);
    fx.camera.update(nx, p.width, vx, WORLD_W * 2, WORLD_W, dt);

    if (Math.round(elapsed) % 6 === 0) {
      setHudState({ score, lives, timer: timerRef.current, phase: phaseRef.current });
    }

    if (onPlayerMove && Math.round(elapsed) % 3 === 0) {
      onPlayerMove(nx, ny, vx, resolved.vy);
    }
  }, [config, WORLD_W, WORLD_H, onGameEnd, onPlayerMove]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const render = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx)  return;

    const scale = getScale();
    const fx    = fxRef.current;

    ctx.save();
    ctx.scale(scale, scale);
    fx.camera.apply(ctx);

    drawBackground(ctx, WORLD_W * 2, WORLD_H, config.background ?? "#07080E");

    if (config.winCondition === "reach_end") {
      drawEndFlag(ctx, (config.endX ?? WORLD_W * 2 - 60) + 4, WORLD_H - 150);
    }

    drawPlatforms(ctx, platformsRef.current);
    drawCoins(ctx, coinsRef.current, t, fx.coinFX);
    drawEnemies(ctx, enemiesRef.current, fx.enemyFX);
    drawRemotePlayers(ctx, remotePlayers);
    drawPlayer(ctx, playerRef.current);

    fx.particles.render(ctx);

    ctx.restore();
  }, [config, WORLD_W, WORLD_H, remotePlayers, getScale]);

  // ── Game loop ─────────────────────────────────────────────────────────────

  const startLoop = useCallback(() => {
    let lastTime = 0;
    let elapsed  = 0;

    const loop = (time: number) => {
      const dt = lastTime > 0 ? Math.min((time - lastTime) / 16.67, 3) : 1;
      lastTime  = time;
      elapsed  += 1;

      update(dt, elapsed);
      render(time);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [update, render]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    playerRef.current    = mkPlayer();
    platformsRef.current = mkPlatforms();
    enemiesRef.current   = mkEnemies();
    coinsRef.current     = mkCoins();
    phaseRef.current     = "playing";
    timerRef.current     = config.surviveSecs ?? null;
    coyoteRef.current    = 0;
    jumpBufRef.current   = 0;
    jumpHeldRef.current  = false;
    wasOnGround.current  = false;
    prevVy.current       = 0;
    fxRef.current.reset();
    setHudState({ score: 0, lives: 3, timer: timerRef.current, phase: "playing" });
  }, [mkPlayer, mkPlatforms, mkEnemies, mkCoins, config.surviveSecs]);

  // ── Canvas resize ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const cont   = containerRef.current;
    if (!canvas || !cont) return;
    const resize = () => { canvas.width = cont.clientWidth; canvas.height = cont.clientHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cont);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    reset();
    const stop = startLoop();
    return stop;
  }, [config, reset, startLoop]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative", width: "100%", height: "100%",
        background: config.background ?? "#07080E", overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />

      <TouchControls onInput={handleInput} />

      <GameHUD
        score={hudState.score}
        lives={hudState.lives}
        timer={hudState.timer ?? undefined}
        phase={hudState.phase}
        gameTitle={config.name}
        onRestart={reset}
        onBack={onBack}
      />
    </div>
  );
}
