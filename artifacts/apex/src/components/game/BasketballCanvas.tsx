/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX BASKETBALL ENGINE — Arc shots · physics · hoops   ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { BasketballControls, type BasketballInput } from "./BasketballControls";
import {
  resolvePlatformCollisions,
  applyGravity,
  clampToWorld,
  overlaps,
  coinOverlaps,
} from "@/engine/physics";
import { drawBackground, drawPlatforms, darken, lighten } from "@/engine/renderer";
import { EffectsManager } from "@/engine/effects";
import type {
  GameConfig, PlayerState, PlatformState, BallState, GamePhase,
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

const ACCEL_FACTOR = 0.28;
const FRICTION     = 0.78;
const COYOTE_FRAMES = 6;
const JUMP_BUF_FRAMES = 6;
const BALL_BOUNCE   = 0.62;  // energy retained on bounce
const BALL_GRAVITY  = 0.48;

// ── HUD ───────────────────────────────────────────────────────────────────────

function BasketballHUD({
  score, scoreLimit, timer, phase, gameTitle, onRestart, onBack,
}: {
  score:      number;
  scoreLimit: number;
  timer:      number | null;
  phase:      GamePhase;
  gameTitle:  string;
  onRestart:  () => void;
  onBack:     () => void;
}) {
  if (phase === "won" || phase === "lost") {
    return (
      <div style={{
        position: "absolute", inset: 0, zIndex: 40,
        background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
      }}>
        <div style={{ fontSize: 52 }}>{phase === "won" ? "🏆" : "⏰"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "white" }}>
          {phase === "won" ? "Buckets!" : "Time's Up!"}
        </div>
        <div style={{ fontSize: 15, color: "#ff8c00", fontWeight: 700 }}>Score: {score} pts</div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onRestart} style={{ padding: "12px 24px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#ff8c00,#ffcc33)", color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>▶ Play Again</button>
          <button onClick={onBack}    style={{ padding: "12px 24px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>← Back</button>
        </div>
      </div>
    );
  }

  const timerColor = timer != null && timer <= 10 ? "#ff4444" : "#ffcc33";

  return (
    <div style={{ position: "absolute", top: 12, left: 0, right: 0, zIndex: 20, padding: "0 14px", pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#ff8c00" }}>🏀 {score}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>pts / {scoreLimit} to win</div>
        </div>
        {timer != null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: timerColor }}>{Math.ceil(timer)}s</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>time left</div>
          </div>
        )}
      </div>
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{gameTitle}</span>
      </div>
    </div>
  );
}

// ── Canvas drawing helpers ────────────────────────────────────────────────────

function drawBall(ctx: CanvasRenderingContext2D, ball: BallState, t: number) {
  const { x, y, radius } = ball;
  ctx.save();
  ctx.shadowColor = "#ff8c00";
  ctx.shadowBlur  = 14;

  const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 1, x, y, radius);
  grad.addColorStop(0, "#ffaa44");
  grad.addColorStop(0.6, "#ff8c00");
  grad.addColorStop(1, "#cc4400");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Lines
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth   = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.7, y);
  ctx.bezierCurveTo(x - radius * 0.3, y - radius * 0.3, x + radius * 0.3, y - radius * 0.3, x + radius * 0.7, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - radius * 0.7);
  ctx.bezierCurveTo(x - radius * 0.3, y - radius * 0.3, x - radius * 0.3, y + radius * 0.3, x, y + radius * 0.7);
  ctx.stroke();

  ctx.restore();
  void t;
}

function drawBasket(ctx: CanvasRenderingContext2D, bx: number, by: number, bw: number) {
  // Backboard
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(bx + bw + 6, by - 50, 10, 80);

  // Rim
  ctx.shadowColor = "#ff4444";
  ctx.shadowBlur  = 10;
  ctx.strokeStyle = "#ff4444";
  ctx.lineWidth   = 4;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + bw, by);
  ctx.stroke();

  // Net
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.40)";
  ctx.lineWidth   = 1;
  const netH = 30, netW = bw;
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(bx + t * netW, by);
    ctx.lineTo(bx + netW * 0.2 + t * netW * 0.6, by + netH);
    ctx.stroke();
  }
  for (let row = 1; row <= 3; row++) {
    const frac  = row / 4;
    const y2    = by + netH * frac;
    const leftX = bx + netW * 0.2 * frac;
    const wid   = netW * (1 - 0.4 * frac);
    ctx.beginPath();
    ctx.moveTo(leftX, y2);
    ctx.lineTo(leftX + wid, y2);
    ctx.stroke();
  }

  // "3PT" line hint
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BASKET", bx + bw / 2, by - 8);

  ctx.restore();
}

function drawBBPlayer(ctx: CanvasRenderingContext2D, p: PlayerState) {
  const { x, y, width: w, height: h, color, onGround, facing, vy } = p;

  let squashX = 1, squashY = 1;
  if (onGround)      { squashX = 1.10; squashY = 0.90; }
  else if (vy < -1)  { squashX = 0.88; squashY = 1.14; }

  ctx.save();
  ctx.translate(x + w / 2, y + h);
  ctx.scale(facing * squashX, squashY);
  ctx.translate(-w / 2, -h);

  ctx.shadowColor = color;
  ctx.shadowBlur  = 12;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, lighten(color, 0.30));
  grad.addColorStop(1, darken(color,  0.20));
  ctx.fillStyle = grad;

  // Body
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 5);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Jersey number
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font      = `bold ${w * 0.4}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("1", w / 2, h * 0.52);

  ctx.restore();
}

function drawShotArc(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  vx: number, vy: number
) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,204,51,0.40)";
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(px, py);

  let sx = px, sy = py, svx = vx, svy = vy;
  for (let i = 0; i < 24; i++) {
    svy += BALL_GRAVITY;
    sx  += svx * 1;
    sy  += svy * 1;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Score popup state ─────────────────────────────────────────────────────────

interface ScorePopup { x: number; y: number; text: string; life: number; }

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  config:     GameConfig;
  onGameEnd?: (phase: "won" | "lost", score: number) => void;
  onBack:     () => void;
}

export function BasketballCanvas({ config, onGameEnd, onBack }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const WORLD_W     = config.width  ?? 400;
  const WORLD_H     = config.height ?? 600;
  const SCORE_LIMIT = config.scoreLimit ?? 10;
  const GAME_TIME   = config.surviveSecs ?? 60;

  const BASKET_X  = config.basket?.x ?? WORLD_W - 90;
  const BASKET_Y  = config.basket?.y ?? WORLD_H - 280;
  const BASKET_W  = config.basket?.width ?? 55;
  const BALL_R    = 14;

  // ── Factories ────────────────────────────────────────────────────────────

  const mkPlayer = useCallback((): PlayerState => ({
    x: config.player.x, y: config.player.y,
    width: config.player.width, height: config.player.height,
    color: rc(config.player.color),
    vx: 0, vy: 0, onGround: false,
    jumpForce: config.player.jumpForce,
    speed: config.player.speed,
    score: 0, lives: 3, facing: 1,
  }), [config]);

  const mkPlatforms = useCallback((): PlatformState[] =>
    config.platforms.map((p) => ({ ...p, color: rc(p.color ?? "#2d3561") })),
  [config]);

  const mkBall = useCallback((): BallState => ({
    x: config.player.x + config.player.width / 2,
    y: config.player.y - BALL_R,
    vx: 0, vy: 0, radius: BALL_R, inPossession: true,
  }), [config, BALL_R]);

  // ── Refs ─────────────────────────────────────────────────────────────────

  const playerRef    = useRef<PlayerState>(mkPlayer());
  const platformsRef = useRef<PlatformState[]>(mkPlatforms());
  const ballRef      = useRef<BallState>(mkBall());
  const inputRef     = useRef<BasketballInput>({ left: false, right: false, jump: false, shoot: false });
  const phaseRef     = useRef<GamePhase>("playing");
  const timerRef     = useRef<number>(GAME_TIME);
  const scoreRef     = useRef(0);
  const popupsRef    = useRef<ScorePopup[]>([]);
  const coyoteRef    = useRef(0);
  const jumpBufRef   = useRef(0);
  const jumpHeldRef  = useRef(false);
  const wasOnGround  = useRef(false);
  const prevVy       = useRef(0);
  const shootHeldRef = useRef(false);
  const rafRef       = useRef(0);
  const fxRef        = useRef(new EffectsManager());

  const [hudState, setHudState] = useState({ score: 0, timer: GAME_TIME as number | null, phase: "playing" as GamePhase });

  const getScale = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 1;
    return Math.min(el.clientWidth / WORLD_W, el.clientHeight / WORLD_H);
  }, [WORLD_W, WORLD_H]);

  const handleInput = useCallback((input: BasketballInput) => {
    fxRef.current.audio.unlock();
    if (input.jump && !inputRef.current.jump) {
      const p = playerRef.current;
      if (!p.onGround && coyoteRef.current <= 0) jumpBufRef.current = JUMP_BUF_FRAMES;
    }
    inputRef.current = input;
  }, []);

  // ── Update ───────────────────────────────────────────────────────────────

  const update = useCallback((dt: number, elapsed: number) => {
    if (phaseRef.current !== "playing") return;

    const p     = playerRef.current;
    const ball  = ballRef.current;
    const input = inputRef.current;
    const fx    = fxRef.current;

    // Timer
    timerRef.current = Math.max(0, timerRef.current - dt * (1 / 60));

    // ── Player movement ────────────────────────────────────────────────

    if (coyoteRef.current > 0) coyoteRef.current -= dt;
    if (jumpBufRef.current > 0) jumpBufRef.current -= dt;

    const maxVx = p.speed;
    let { vx, vy } = p;

    if (input.left)  vx += (-p.speed - vx) * ACCEL_FACTOR * dt;
    else if (input.right) vx += (p.speed - vx) * ACCEL_FACTOR * dt;
    else vx *= Math.pow(FRICTION, dt);
    vx = clamp(vx, -maxVx, maxVx);
    if (Math.abs(vx) < 0.05) vx = 0;

    const facing: 1 | -1 = input.left ? -1 : input.right ? 1 : p.facing;

    const canJump  = p.onGround || coyoteRef.current > 0;
    const wantsJump = (input.jump && !jumpHeldRef.current) || jumpBufRef.current > 0;
    if (canJump && wantsJump) {
      vy = -p.jumpForce;
      jumpHeldRef.current = true; jumpBufRef.current = 0; coyoteRef.current = 0;
      fx.onJump(p.x + p.width / 2, p.y + p.height);
    }
    if (!input.jump) jumpHeldRef.current = false;

    const newVy  = applyGravity(vy, config.gravity, dt);
    const nx0    = p.x + vx * dt;
    const ny0    = p.y + newVy * dt;
    const partial = { ...p, x: nx0, y: ny0, vx, vy: newVy };
    const resolved = resolvePlatformCollisions(partial, platformsRef.current);
    let { x: nx, y: ny } = resolved;

    const { x: cx, y: cy } = clampToWorld(nx, ny, p.width, p.height, WORLD_W, WORLD_H);
    nx = cx; ny = cy;

    if (wasOnGround.current && !resolved.onGround) coyoteRef.current = COYOTE_FRAMES;
    wasOnGround.current = resolved.onGround;

    if (!p.onGround && resolved.onGround && prevVy.current > 1.5)
      fx.onLand(nx + p.width / 2, ny + p.height, prevVy.current);
    prevVy.current = resolved.vy;

    // ── Ball physics ───────────────────────────────────────────────────

    let { x: bx, y: by, vx: bvx, vy: bvy, inPossession } = ball;

    // Auto-possession: if ball near player and not in air (low velocity), pick up
    const distToBall = Math.hypot((bx - (nx + p.width / 2)), (by - (ny + p.height / 2)));
    if (!inPossession && distToBall < 40 && Math.abs(bvx) < 2 && Math.abs(bvy) < 3) {
      inPossession = true;
    }

    if (inPossession) {
      // Ball sits slightly above player's head
      bx = nx + p.width / 2;
      by = ny - BALL_R - 2;
      bvx = 0; bvy = 0;
    } else {
      // Ball physics
      bvy += BALL_GRAVITY * dt;
      bx  += bvx * dt;
      by  += bvy * dt;

      // Wall bounce
      if (bx - BALL_R < 0)          { bx = BALL_R;          bvx = Math.abs(bvx) * BALL_BOUNCE; }
      if (bx + BALL_R > WORLD_W)    { bx = WORLD_W - BALL_R; bvx = -Math.abs(bvx) * BALL_BOUNCE; }
      if (by - BALL_R < 0)          { by = BALL_R;           bvy = Math.abs(bvy) * BALL_BOUNCE; }
      if (by + BALL_R > WORLD_H - 10) { by = WORLD_H - 10 - BALL_R; bvy = -Math.abs(bvy) * BALL_BOUNCE; bvx *= 0.85; }

      // Platform bounce
      for (const plat of platformsRef.current) {
        if (bx > plat.x - BALL_R && bx < plat.x + plat.width + BALL_R &&
            by + BALL_R > plat.y && by - BALL_R < plat.y + plat.height) {
          // Hit top
          if (bvy > 0 && by < plat.y + plat.height / 2) {
            by = plat.y - BALL_R;
            bvy = -Math.abs(bvy) * BALL_BOUNCE;
            bvx *= 0.90;
          }
        }
      }

      // ── Basket collision ──────────────────────────────────────────────
      // Ball scores when it passes through the rim from above
      const rimMidX = BASKET_X + BASKET_W / 2;
      const rimY    = BASKET_Y;
      const prevBy  = by - bvy * dt;

      if (
        Math.abs(bx - rimMidX) < BASKET_W * 0.44 &&
        prevBy < rimY && by >= rimY &&
        bvy > 0
      ) {
        // Score!
        const distFromCenter = Math.abs(bx - rimMidX) / (BASKET_W / 2);
        const pts = distFromCenter < 0.3 ? 3 : 2;
        scoreRef.current += pts;
        popupsRef.current.push({ x: rimMidX, y: rimY - 30, text: `+${pts}`, life: 50 });
        fx.onWinBurst(bx, by);
        inPossession = true; // reset ball to player
        bx = nx + p.width / 2;
        by = ny - BALL_R - 2;
      }
    }

    // ── Shoot mechanic ─────────────────────────────────────────────────

    if (input.shoot && !shootHeldRef.current && inPossession) {
      shootHeldRef.current = true;
      // Arc toward basket
      const targetX = BASKET_X + BASKET_W / 2;
      const targetY = BASKET_Y;
      const dx = targetX - bx;
      const dy = targetY - by;
      const dist = Math.hypot(dx, dy);

      // Compute velocity for arc shot
      const t_flight = Math.sqrt(Math.max(10, dist) * 0.35); // approx flight time
      const aimVx = dx / t_flight;
      const aimVy = dy / t_flight - BALL_GRAVITY * t_flight * 0.5;

      bvx = aimVx;
      bvy = Math.min(aimVy, -6); // ensure upward arc
      inPossession = false;
      bx = nx + p.width / 2 + (facing > 0 ? 12 : -12);
      by = ny;
    }
    if (!input.shoot) shootHeldRef.current = false;

    // ── Win / lose conditions ──────────────────────────────────────────

    let newPhase: GamePhase = "playing";
    if (scoreRef.current >= SCORE_LIMIT) newPhase = "won";
    else if (timerRef.current <= 0)      newPhase = "lost";

    if (newPhase !== "playing") {
      phaseRef.current = newPhase;
      onGameEnd?.(newPhase, scoreRef.current);
    }

    // ── Commit ─────────────────────────────────────────────────────────

    playerRef.current = {
      ...p,
      x: nx, y: ny,
      vx: resolved.vx ?? vx,
      vy: resolved.vy,
      onGround: resolved.onGround,
      facing, score: scoreRef.current,
    };

    ballRef.current = { x: bx, y: by, vx: bvx, vy: bvy, radius: BALL_R, inPossession };

    // Tick popups
    popupsRef.current = popupsRef.current.map((pp) => ({ ...pp, life: pp.life - 1, y: pp.y - 0.5 })).filter((pp) => pp.life > 0);

    fx.update(dt);
    fx.camera.update(nx, p.width, vx, WORLD_W, WORLD_W, dt);

    if (elapsed % 6 === 0) {
      setHudState({ score: scoreRef.current, timer: timerRef.current, phase: phaseRef.current });
    }
    void overlaps; void coinOverlaps;
  }, [config, WORLD_W, WORLD_H, SCORE_LIMIT, BASKET_X, BASKET_Y, BASKET_W, onGameEnd]);

  // ── Render ───────────────────────────────────────────────────────────────

  const render = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx)  return;

    const scale = getScale();
    ctx.save();
    ctx.scale(scale, scale);
    fxRef.current.camera.apply(ctx);

    drawBackground(ctx, WORLD_W, WORLD_H, config.background ?? "#0a1628");
    drawBasket(ctx, BASKET_X, BASKET_Y, BASKET_W);
    drawPlatforms(ctx, platformsRef.current);

    // Shot arc preview when in possession
    if (ballRef.current.inPossession && playerRef.current) {
      const p = playerRef.current;
      const targetX = BASKET_X + BASKET_W / 2;
      const targetY = BASKET_Y;
      const dx = targetX - (p.x + p.width / 2);
      const dy = targetY - (p.y);
      const dist = Math.hypot(dx, dy);
      const tf = Math.sqrt(Math.max(10, dist) * 0.35);
      const pvx = dx / tf;
      const pvy = Math.min(dy / tf - BALL_GRAVITY * tf * 0.5, -6);
      drawShotArc(ctx, p.x + p.width / 2, p.y, pvx, pvy);
    }

    drawBall(ctx, ballRef.current, t);
    drawBBPlayer(ctx, playerRef.current);

    // Score popups
    for (const pp of popupsRef.current) {
      const alpha = Math.min(1, pp.life / 20);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = "#ffcc33";
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = "#ffcc33";
      ctx.font        = "bold 20px sans-serif";
      ctx.textAlign   = "center";
      ctx.fillText(pp.text, pp.x, pp.y);
      ctx.restore();
    }

    fxRef.current.particles.render(ctx);
    ctx.restore();
  }, [config, WORLD_W, WORLD_H, BASKET_X, BASKET_Y, BASKET_W, getScale]);

  // ── Game loop ────────────────────────────────────────────────────────────

  const startLoop = useCallback(() => {
    let lastTime = 0, elapsed = 0;
    const loop = (time: number) => {
      const dt = lastTime > 0 ? Math.min((time - lastTime) / 16.67, 3) : 1;
      lastTime = time; elapsed++;
      update(dt, elapsed);
      render(time);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [update, render]);

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    playerRef.current    = mkPlayer();
    platformsRef.current = mkPlatforms();
    ballRef.current      = mkBall();
    phaseRef.current     = "playing";
    timerRef.current     = GAME_TIME;
    scoreRef.current     = 0;
    popupsRef.current    = [];
    coyoteRef.current    = 0;
    jumpBufRef.current   = 0;
    jumpHeldRef.current  = false;
    wasOnGround.current  = false;
    prevVy.current       = 0;
    shootHeldRef.current = false;
    fxRef.current.reset();
    setHudState({ score: 0, timer: GAME_TIME, phase: "playing" });
  }, [mkPlayer, mkPlatforms, mkBall, GAME_TIME]);

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
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", background: config.background ?? "#0a1628", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      <BasketballControls onInput={handleInput} />
      <BasketballHUD
        score={hudState.score}
        scoreLimit={SCORE_LIMIT}
        timer={hudState.timer}
        phase={hudState.phase}
        gameTitle={config.name}
        onRestart={reset}
        onBack={onBack}
      />
    </div>
  );
}
