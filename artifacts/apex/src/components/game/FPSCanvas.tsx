/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — FPS Canvas v3 (Console-Quality Combat)   ║
 * ║                                                             ║
 * ║  Combat Feel Upgrades:                                      ║
 * ║    🎮  Acceleration + friction movement model               ║
 * ║    🔫  Per-weapon recoil spring system                      ║
 * ║    🎯  Mobile/controller aim assist                         ║
 * ║    📷  Camera shake — hit micro + landing impact            ║
 * ║    💥  Floating damage numbers + hit feedback               ║
 * ║    🔊  Synthesized audio — gunshot / hit / reload / ammo    ║
 * ║    🚀  Sprint FOV shift                                     ║
 * ║    📦  4-frame input buffer — no missed shots               ║
 * ║    💀  Death distortion overlay                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useEffect, useRef, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import type { GameConfig } from "@/engine/types";
import { type Loadout, getLoadoutEffects }          from "@/engine3d/LoadoutSystem";
import { generateMap, loadMapConfig, saveMapConfig } from "@/engine3d/MapGenSystem";
import type { MapConfig }                            from "@/engine3d/MapGenSystem";
import { MapAnalyticsSystem, loadAnalytics, saveAnalytics } from "@/engine3d/MapAnalyticsSystem";
import { optimizeMap }                               from "@/engine3d/MapOptimizerSystem";
import type { OptimizationResult }                   from "@/engine3d/MapOptimizerSystem";
import { MapGenHUD }                                 from "./MapGenHUD";
import { detectDevice }           from "@/systems/deviceSystem";
import { PerformanceSystem }      from "@/systems/performanceSystem";
import { createScene }            from "@/engine3d/scene";
import { buildWorld }             from "@/engine3d/world";
import { InputManager }           from "@/engine3d/InputManager";
import { InputOverlay }           from "./InputOverlay";
import { createPlayerController, type PlayerController } from "@/engine3d/player";
import { createShootingSystem }   from "@/engine3d/shooting";
import { createEnemySystem }      from "@/engine3d/ai";
import {
  type WeaponId, type WeaponState,
  WEAPON_ORDER, WEAPON_DEFS,
  createWeaponState, updateWeapon, startReload, canFire,
  createGunScene, type GunScene,
} from "@/engine3d/weapons";
import {
  createWaveState, updateWaveState, enemiesForWave,
  type WavePhase,
} from "@/engine3d/waves";
import { useGameDirector }   from "@/engine3d/useGameDirector";
import { DirectorOverlay }   from "./DirectorOverlay";

// ── Combat Feel systems v2 ─────────────────────────────────────────────────────
import {
  AudioSystem,
  InputBuffer,
  type DamageNumber,
  type AimAssistStrength,
  WEAPON_RECOIL, WEAPON_PATTERNS,
  createRecoilState, createShakeState,
  applyPatternRecoilKick, tickPatternReset, tickRecoil,
  addShake, tickShake,
  applyAimAssistV2, createRotationalTrackState,
  type AimAssistConfig,
  createDamageNumber, tickDamageNumbers,
} from "@/engine3d/CombatFeel";
import * as THREE from "three";

// ── Props ──────────────────────────────────────────────────────────────────────

interface FPSCanvasProps {
  config:      GameConfig;
  loadout?:    Loadout;
  onGameEnd?:  (phase: "won" | "lost", score: number) => void;
  onBack:      () => void;
  onRespawn?:  () => void;
}

type Phase       = "idle" | "playing" | "won" | "lost";
type HitMarkerKind = "body" | "head" | null;

const GRAD     = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const MAX_WAVES = 5;
const BASE_FOV  = 75;
const SPRINT_FOV_BONUS = 8;   // degrees added during sprint

// ── HUD State ─────────────────────────────────────────────────────────────────

interface HUDState {
  health:        number;
  maxHealth:     number;
  mag:           number;
  reserve:       number;
  reloading:     boolean;
  reloadPct:     number;
  weaponId:      WeaponId;
  kills:         number;
  score:         number;
  wave:          number;
  wavePhase:     WavePhase;
  waveCountdown: number;
  enemiesLeft:   number;
  killFeed:      string[];
  hitMarker:     HitMarkerKind;
  damageFlash:   boolean;
  waveBannerTtl: number;
  // ── v3 additions ──────────────────────────────────────────────────────────
  recoilSpread:  number;       // 0..1 crosshair spread from recoil
  sprintFOV:     number;       // current FOV (for external display if needed)
  damageNums:    DamageNumber[];
  isDead:        boolean;
  deathFadeAmt:  number;       // 0..1 how far the death overlay has faded in
  // ── Performance monitor ───────────────────────────────────────────────────
  fpsDisplay:    number;       // live FPS shown in HUD
  qualityLabel:  string;       // "Low" | "Medium" | "High"
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FPSCanvas({ config, loadout, onGameEnd, onBack, onRespawn }: FPSCanvasProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const playerRef   = useRef<PlayerController | null>(null);
  const gunSceneRef = useRef<GunScene | null>(null);
  const inputMgrRef = useRef<InputManager | null>(null);

  const [phase,  setPhase]  = useState<Phase>("idle");
  const [locked, setLocked] = useState(false);
  const effects   = getLoadoutEffects(loadout);
  const maxHealth = (config.health ?? 100) + effects.extraHealth + effects.startBonusHp;

  // ── AI Map System ──────────────────────────────────────────────────────────
  const [mapConfig,  setMapConfig]  = useState<MapConfig>(() => loadMapConfig() ?? generateMap());
  const [optResult,  setOptResult]  = useState<OptimizationResult | null>(null);
  const [liveStats,  setLiveStats]  = useState({ deaths: 0, coverage: 0, chokeCount: 0, unusedCount: 0 });
  const mapConfigRef  = useRef<MapConfig>(mapConfig);
  const analyticsRef  = useRef<MapAnalyticsSystem | null>(null);
  const optimizedRef  = useRef(false); // guard: only optimize once per session

  // ── Aim Assist Strength (persisted, reactive) ──────────────────────────────
  const [assistStrength, setAssistStrength] = useState<AimAssistStrength>(() => {
    const stored = localStorage.getItem("apex:aimAssist") as AimAssistStrength | null;
    if (stored && ["off","low","medium","high"].includes(stored)) return stored;
    // Default: mobile gets medium, desktop gets low
    const mob = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return mob ? "medium" : "low";
  });
  const assistStrengthRef = useRef<AimAssistStrength>(assistStrength);
  useEffect(() => {
    assistStrengthRef.current = assistStrength;
    localStorage.setItem("apex:aimAssist", assistStrength);
  }, [assistStrength]);

  // Sync mapConfigRef when mapConfig state changes
  useEffect(() => { mapConfigRef.current = mapConfig; }, [mapConfig]);

  // Live analytics → React state bridge (throttled, 3-second poll)
  useEffect(() => {
    const tid = setInterval(() => {
      const sys = analyticsRef.current;
      if (!sys) return;
      setLiveStats({
        deaths:     sys.totalDeaths,
        coverage:   sys.explorationCoverage,
        chokeCount: sys.getChokePoints(2).length,
        unusedCount: sys.getUnusedAreas().length,
      });
    }, 3000);
    return () => clearInterval(tid);
  }, []);

  // Rotational tracking state for Layer-3 aim assist
  const rotTrackState = useRef(createRotationalTrackState());

  const [hud, setHUD] = useState<HUDState>({
    health: maxHealth, maxHealth,
    mag: 30, reserve: 150, reloading: false, reloadPct: 0,
    weaponId: "rifle", kills: 0, score: 0,
    wave: 1, wavePhase: "countdown", waveCountdown: 3,
    enemiesLeft: 0, killFeed: [], hitMarker: null,
    damageFlash: false, waveBannerTtl: 0,
    recoilSpread: 0, sprintFOV: BASE_FOV, damageNums: [], isDead: false, deathFadeAmt: 0,
    fpsDisplay: 60, qualityLabel: "Medium",
  });

  const isMobile = typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // ── Kill feed helper ────────────────────────────────────────────────────────
  const killFeedRef = useRef<string[]>([]);
  const killFeedTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const addKillFeed = (msg: string) => {
    killFeedRef.current = [msg, ...killFeedRef.current.slice(0, 4)];
    const tid = setTimeout(() => {
      killFeedRef.current = killFeedRef.current.filter((m) => m !== msg);
    }, 3500);
    killFeedTimers.current.push(tid);
  };

  // ── Director ────────────────────────────────────────────────────────────────
  const { phase: dirPhase, band: dirBand, settings: dirSettings,
          style: dirStyle, reportMetrics, directorRef } =
    useGameDirector({ gameMode: "fps", tickIntervalMs: 6000 });
  const dirSettingsRef = useRef(dirSettings);
  useEffect(() => { dirSettingsRef.current = dirSettings; }, [dirSettings]);

  // ── Engine bootstrap ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const aspect = canvas.clientWidth / canvas.clientHeight;

    // ── Device profile + performance system ────────────────────────────────
    const device    = detectDevice();
    const perfSystem = new PerformanceSystem(device.graphicsLevel);

    // 3D Scene
    const { scene, renderer, camera, dispose: disposeScene } = createScene(canvas);

    // Apply device-detected pixel ratio immediately (overrides createScene default)
    renderer.setPixelRatio(Math.min(device.perfSettings.pixelRatio, window.devicePixelRatio));
    renderer.shadowMap.enabled = device.perfSettings.shadowEnabled;

    renderer.autoClear = false;
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();

    // ── AI Map analytics ──────────────────────────────────────────────────
    const analytics = new MapAnalyticsSystem();
    const persisted = loadAnalytics();
    if (persisted) analytics.merge(persisted);
    analyticsRef.current = analytics;
    optimizedRef.current = false;

    const wallAABBs = buildWorld(scene, mapConfigRef.current);

    // Player
    const player       = createPlayerController(camera, canvas);
    playerRef.current  = player;

    // Input
    const inputMgr = new InputManager(canvas, { pointerLock: true });
    inputMgrRef.current = inputMgr;

    // Gun scene
    const gunScene     = createGunScene(aspect, "rifle");
    gunSceneRef.current = gunScene;

    // Weapon — start with loadout primary (default: rifle)
    const startWeaponId = (loadout?.primary ?? "rifle") as WeaponId;
    const ws: WeaponState = createWeaponState(startWeaponId);
    let currentWeaponIdx  = Math.max(0, WEAPON_ORDER.indexOf(startWeaponId));
    let prevMag           = ws.mag;

    // Shooting
    const shooting = createShootingSystem();

    // Waves / enemies
    let waveState  = createWaveState(MAX_WAVES);
    const enemySys = createEnemySystem(scene, 0, 24, 3);

    // ── Combat Feel Systems ────────────────────────────────────────────────
    const audio      = new AudioSystem();
    const recoil     = createRecoilState();
    const shake      = createShakeState();
    const inputBuf   = new InputBuffer();
    const damageNums: DamageNumber[] = [];

    // ── Mutable game state ────────────────────────────────────────────────
    let currentHealth = maxHealth;
    let killCount     = 0;
    let score         = 0;
    let gameOver      = false;
    let hitMarkerKind: HitMarkerKind = null;
    let hitMarkerTtl  = 0;
    let damageFlashTtl = 0;
    let currentFOV    = BASE_FOV;
    let deathFade     = 0;    // 0..1
    let wasReloading  = false;

    // ── Keyboard ──────────────────────────────────────────────────────────
    const switchWeapon = (idx: number) => {
      const wid = WEAPON_ORDER[idx];
      if (!wid || idx === currentWeaponIdx) return;
      const def    = WEAPON_DEFS[wid];
      ws.def       = def;
      ws.mag       = def.magSize;
      ws.reserve   = def.reserveAmmo;
      ws.reloading = false;
      ws.reloadPct = 0;
      ws.cooldown  = 0;
      currentWeaponIdx = idx;
      gunScene.setWeapon(wid);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyR") startReload(ws);
      if (e.code === "Digit1") switchWeapon(0);
      if (e.code === "Digit2") switchWeapon(1);
      if (e.code === "Digit3") switchWeapon(2);
      if (e.code === "Digit4") switchWeapon(3);
    };
    document.addEventListener("keydown", onKeyDown);

    // ── Shoot logic ───────────────────────────────────────────────────────
    const tryShoot = () => {
      if (!canFire(ws) || gameOver || waveState.phase !== "fighting") return;
      const result = shooting.shoot(scene, camera, ws);
      gunScene.animateRecoil();

      // Pattern-based recoil kick
      const prof    = WEAPON_RECOIL[ws.def.id];
      const pattern = WEAPON_PATTERNS[ws.def.id];
      if (prof && pattern) applyPatternRecoilKick(recoil, prof, pattern);
      else if (prof) { recoil.pitchVel -= prof.kickV; recoil.yawVel += (Math.random()-0.5)*2*prof.kickH; }

      // Audio
      audio.gunshot(ws.def.id);

      if (result.hit && result.hitObject) {
        const hit = enemySys.hitEnemy(result.hitObject, result.damage * effects.damageMult, result.isHead, scene);
        if (hit.damage > 0) {
          hitMarkerKind = result.isHead ? "head" : "body";
          hitMarkerTtl  = 0.30;
          const pts = result.isHead ? hit.damage * 2 : hit.damage;
          score += pts;

          // Hit confirm audio
          audio.hitConfirm(result.isHead);

          // Hit micro-shake
          addShake(shake, result.isHead ? 0.009 : 0.004);

          // Floating damage number
          if (result.hitPoint) {
            const dn = createDamageNumber(result.hitPoint, camera, hit.damage, result.isHead);
            if (dn) damageNums.push(dn);
          }
        }
        if (hit.killed) {
          killCount++;
          score += result.isHead ? 250 : 100;
          const tag = result.isHead ? "💥 HEADSHOT" : "☠ Kill";
          addKillFeed(`${tag} — ${killCount}`);
        }
      }
    };

    // ── Pointer lock ─────────────────────────────────────────────────────
    const onLockChange = () => setLocked(document.pointerLockElement === canvas);
    document.addEventListener("pointerlockchange", onLockChange);

    // ── Wave events ───────────────────────────────────────────────────────
    const waveEvents = {
      onWaveStart: (wave: number, count: number) => {
        const ds  = dirSettingsRef.current;
        const adj = Math.max(1, Math.round(count * ds.enemyCountMult));
        enemySys.spawnWave(scene, adj, wave, ds.enemySpeedMult);
      },
      onWaveCleared: (_wave: number) => { addKillFeed(`✅ Wave ${_wave} cleared!`); },
      onAllCleared: () => {
        if (!gameOver) {
          gameOver = true;
          setPhase("won");
          onGameEnd?.("won", score);
          // Analytics: optimize map on victory
          if (!optimizedRef.current) {
            optimizedRef.current = true;
            const result = optimizeMap(mapConfigRef.current, analytics);
            saveMapConfig(result.config);
            saveAnalytics(analytics.serialize());
            setMapConfig(result.config);
            setOptResult(result);
          }
        }
      },
    };
    setPhase("playing");

    // ── Director ──────────────────────────────────────────────────────────
    let deaths = 0;
    const unsubDirector = directorRef.current?.on((ev) => {
      if (gameOver) return;
      switch (ev.type) {
        case "ambush":
          enemySys.spawnWave(scene, Math.max(1, Math.round(3 * ev.settings.enemyCountMult)), waveState.wave);
          addKillFeed("⚠️ AMBUSH!");
          break;
        case "bonus_drop":
          currentHealth = Math.min(maxHealth, currentHealth + 25);
          addKillFeed("💊 Health +25 (Director)");
          break;
        case "boss_spawn":
          enemySys.spawnWave(scene, 1, waveState.wave + 2, 1.5);
          addKillFeed("👾 BOSS INCOMING!");
          break;
        case "calm_moment":
          currentHealth = Math.min(maxHealth, currentHealth + 15);
          addKillFeed("✨ Relief moment — hang in there");
          break;
        case "checkpoint_reward":
          currentHealth = Math.min(maxHealth, currentHealth + 10);
          addKillFeed("⭐ Checkpoint bonus");
          break;
      }
    }) ?? (() => undefined);

    // ── Game Loop ─────────────────────────────────────────────────────────
    let lastTime     = performance.now();
    let raf: number;
    let frameCount   = 0;
    let shotCount    = 0;
    let idleTimer    = 0;
    let sessionStart = performance.now();
    let lowAmmoWarnCd = 0;

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (gameOver) {
        // Death fade
        deathFade = Math.min(1, deathFade + dt * 1.2);
        renderer.clear();
        renderer.render(scene, camera);
        return;
      }

      // ── Unified input ────────────────────────────────────────────────────
      inputMgr.update();
      const rawInput = inputMgr.snapshot;

      frameCount++;

      // ── Input Buffer — feed shoot/jump so nothing is missed ──────────────
      inputBuf.feed(rawInput.shoot, rawInput.jump);

      // ── Aim Assist — adjust look deltas before applying to player ────────
      const aliveEnemyPositions: THREE.Vector3[] = [];
      for (const e of enemySys.enemies) {
        if (e.alive) aliveEnemyPositions.push(e.group.position);
      }

      // Build per-frame aim assist config from ref (reactive to UI toggle)
      const aaConfig: AimAssistConfig = {
        strength:   assistStrengthRef.current,
        isMobile,
        slowZone:   0.08,
        magnetZone: 0.035,
      };
      const { dx: assistDX, dy: assistDY } = applyAimAssistV2(
        rawInput.lookX, rawInput.lookY, camera, aliveEnemyPositions,
        aaConfig, rotTrackState.current, dt,
      );

      // Build adjusted input snapshot (lookX/Y modified by aim assist)
      const input = assistDX !== rawInput.lookX || assistDY !== rawInput.lookY
        ? { ...rawInput, lookX: assistDX, lookY: assistDY,
            jump: inputBuf.wantsJump }
        : { ...rawInput, jump: inputBuf.wantsJump };

      // ── Player update ─────────────────────────────────────────────────────
      player.update(dt, wallAABBs, input);

      // ── Landing shake ────────────────────────────────────────────────────
      const landingMag = player.popLandingShake();
      if (landingMag > 0) {
        addShake(shake, landingMag);
        audio.landingThud();
      }

      // ── Recoil tick + pattern reset ───────────────────────────────────────
      const prof    = WEAPON_RECOIL[ws.def.id];
      const pattern = WEAPON_PATTERNS[ws.def.id];
      if (prof) tickRecoil(recoil, prof, dt);
      if (pattern) tickPatternReset(recoil, pattern);
      tickShake(shake, dt);

      camera.rotation.x += recoil.pitchOffset + shake.x;
      camera.rotation.y += recoil.yawOffset   + shake.y;

      // ── Sprint FOV shift ──────────────────────────────────────────────────
      const targetFOV = BASE_FOV + player.getSprintFraction() * SPRINT_FOV_BONUS;
      currentFOV += (targetFOV - currentFOV) * Math.min(1, 8 * dt);
      if (Math.abs(camera.fov - currentFOV) > 0.1) {
        camera.fov = currentFOV;
        camera.updateProjectionMatrix();
      }

      // ── Idle tracking ─────────────────────────────────────────────────────
      const isMoving = Math.abs(rawInput.moveX) > 0.1 || Math.abs(rawInput.moveY) > 0.1;
      idleTimer = isMoving ? 0 : idleTimer + dt;

      // ── Shoot — use buffered input ────────────────────────────────────────
      if (inputBuf.wantsShoot) { tryShoot(); shotCount++; }

      // ── Reload ───────────────────────────────────────────────────────────
      if (rawInput.reload && !ws.reloading) {
        startReload(ws);
        audio.reloadClick();
      }

      // ── Weapon update ─────────────────────────────────────────────────────
      const reloadDone = updateWeapon(ws, dt);
      if (reloadDone) audio.reloadClick();

      // ── Low-ammo audio warning ────────────────────────────────────────────
      lowAmmoWarnCd = Math.max(0, lowAmmoWarnCd - dt);
      if (ws.mag <= 3 && ws.mag > 0 && !ws.reloading && lowAmmoWarnCd <= 0) {
        audio.lowAmmoWarning();
        lowAmmoWarnCd = 2.0;   // debounce 2 s
      }

      // ── Enemies ───────────────────────────────────────────────────────────
      const ds = dirSettingsRef.current;
      enemySys.update(dt, player.getPosition(), (rawDmg) => {
        const dmg = rawDmg * ds.enemyDamageMult;
        currentHealth = Math.max(0, currentHealth - dmg);
        damageFlashTtl = 0.22;
        addShake(shake, 0.018);   // hit camera shake

        // Analytics: record damage position
        const pp = player.getPosition();
        analytics.recordDamage(pp.x, pp.z, dmg);

        if (currentHealth <= 0 && !gameOver) {
          deaths++;
          gameOver = true;
          setPhase("lost");
          onGameEnd?.("lost", score);

          // Analytics: record death + optimize map
          analytics.recordDeath(pp.x, pp.z);
          if (!optimizedRef.current) {
            optimizedRef.current = true;
            const result = optimizeMap(mapConfigRef.current, analytics);
            saveMapConfig(result.config);
            saveAnalytics(analytics.serialize());
            setMapConfig(result.config);
            setOptResult(result);
          }
        }
      }, ds.enemySpeedMult);

      // ── Analytics visit tracking (every 30 frames) ───────────────────────
      if (frameCount % 30 === 0 && !gameOver) {
        const pp = player.getPosition();
        analytics.recordVisit(pp.x, pp.z);
      }

      // ── Director metrics ──────────────────────────────────────────────────
      if (frameCount % 30 === 0) {
        reportMetrics({
          health:             currentHealth,
          maxHealth:          maxHealth,
          successRate:        killCount / Math.max(shotCount, 1),
          movementSpeed:      isMoving ? 1 : 0,
          combatFrequency:    shotCount / Math.max((performance.now() - sessionStart) / 60000, 0.001),
          idleSeconds:        idleTimer,
          completionProgress: (waveState.wave - 1) / MAX_WAVES,
          failureCount:       deaths,
          killCount,
          score,
          sessionSeconds:     (performance.now() - sessionStart) / 1000,
        });
      }

      // ── Waves ─────────────────────────────────────────────────────────────
      waveState = updateWaveState(waveState, dt, enemySys.aliveCount(), waveEvents);

      // ── Tracers ───────────────────────────────────────────────────────────
      shooting.update(scene, dt);
      gunScene.update(dt);

      // ── TTL counters ──────────────────────────────────────────────────────
      if (hitMarkerTtl > 0) { hitMarkerTtl -= dt; if (hitMarkerTtl <= 0) hitMarkerKind = null; }
      if (damageFlashTtl > 0) damageFlashTtl = Math.max(0, damageFlashTtl - dt);

      // ── Damage numbers ────────────────────────────────────────────────────
      tickDamageNumbers(damageNums, dt);

      // ── Sync HUD ──────────────────────────────────────────────────────────
      const recoilMag = Math.abs(recoil.pitchOffset) / (prof?.maxV ?? 0.3);
      setHUD({
        health: currentHealth, maxHealth,
        mag:         ws.mag,
        reserve:     ws.reserve,
        reloading:   ws.reloading,
        reloadPct:   ws.reloadPct,
        weaponId:    ws.def.id,
        kills:       killCount,
        score,
        wave:        waveState.wave,
        wavePhase:   waveState.phase,
        waveCountdown: waveState.countdown,
        enemiesLeft:   waveState.enemiesLeft,
        killFeed:    [...killFeedRef.current],
        hitMarker:   hitMarkerKind,
        damageFlash: damageFlashTtl > 0,
        waveBannerTtl: waveState.bannerTtl,
        recoilSpread: recoilMag,
        sprintFOV:   currentFOV,
        damageNums:  [...damageNums],
        isDead:      gameOver && !player.isAlive(),
        deathFadeAmt: deathFade,
        fpsDisplay:  perfSystem.fps,
        qualityLabel: perfSystem.snapshot.label,
      });

      // ── Performance monitor — adaptive quality scaling ────────────────────
      const qualityChanged = perfSystem.tick(dt);
      if (qualityChanged) {
        const ps = perfSystem.snapshot;
        renderer.setPixelRatio(Math.min(ps.pixelRatio, window.devicePixelRatio));
        renderer.shadowMap.enabled = ps.shadowEnabled;
      }

      // ── Render ────────────────────────────────────────────────────────────
      renderer.clear();
      renderer.render(scene, camera);
      renderer.clearDepth();
      renderer.render(gunScene.scene, gunScene.camera);
    }
    raf = requestAnimationFrame(loop);

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      gunScene.resize(w / h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      gameOver = true;
      unsubDirector();
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown",           onKeyDown);
      document.removeEventListener("pointerlockchange", onLockChange);
      window.removeEventListener("resize", onResize);
      killFeedTimers.current.forEach(clearTimeout);
      inputMgr.dispose();
      inputMgrRef.current = null;
      player.dispose();
      playerRef.current   = null;
      gunSceneRef.current = null;
      shooting.dispose();
      enemySys.dispose(scene);
      gunScene.dispose();
      audio.dispose();
      disposeScene();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hpRatio  = hud.health / hud.maxHealth;
  const hpColor  = hpRatio > 0.6 ? "#00ff88" : hpRatio > 0.3 ? "#ffcc33" : "#ff4444";
  const ammoLow  = hud.mag <= Math.floor(hud.mag / 3) || hud.mag <= 3;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#070a14", overflow: "hidden" }}>

      {/* ── Three.js canvas ────────────────────────────────────────────────── */}
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

      {/* ── AI Map Gen HUD ─────────────────────────────────────────────────── */}
      {phase === "playing" && (
        <MapGenHUD
          mapConfig={mapConfig}
          liveDeaths={liveStats.deaths}
          liveCoverage={liveStats.coverage}
          chokeCount={liveStats.chokeCount}
          unusedCount={liveStats.unusedCount}
          optResult={optResult}
        />
      )}

      {/* ── Damage vignette flash ──────────────────────────────────────────── */}
      {hud.damageFlash && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5,
          background: "radial-gradient(ellipse at center, transparent 35%, rgba(220,20,20,0.55) 100%)",
        }} />
      )}

      {/* ── Death distortion overlay ───────────────────────────────────────── */}
      {hud.isDead && hud.deathFadeAmt > 0 && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6,
          background: `rgba(40,0,0,${hud.deathFadeAmt * 0.75})`,
          backdropFilter: `saturate(${Math.max(0, 1 - hud.deathFadeAmt * 0.9)}) blur(${hud.deathFadeAmt * 3}px)`,
          transition: "none",
        }} />
      )}

      {/* ── Click-to-lock overlay ──────────────────────────────────────────── */}
      {!locked && phase === "playing" && !isMobile && (
        <div
          onClick={() => canvasRef.current?.requestPointerLock()}
          style={{
            position: "absolute", inset: 0, zIndex: 20,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 14 }}>🎯</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 10 }}>Click to Enter FPS Mode</div>
          <div style={{
            fontSize: 12, color: "#666", marginBottom: 28, textAlign: "center", maxWidth: 340, lineHeight: 1.8,
          }}>
            WASD / move &nbsp;·&nbsp; Mouse / aim &nbsp;·&nbsp; LClick / shoot &nbsp;·&nbsp; R / reload
            <br />
            Space / jump &nbsp;·&nbsp; 1 2 3 4 / weapons &nbsp;·&nbsp; Shift / sprint &nbsp;·&nbsp; ESC / exit
          </div>
          <div style={{ padding: "12px 34px", borderRadius: 28, background: GRAD, color: "#fff", fontWeight: 800, fontSize: 15 }}>
            Click to Play
          </div>
        </div>
      )}

      {/* ── Wave countdown banner ──────────────────────────────────────────── */}
      {phase === "playing" && (hud.wavePhase === "countdown" || hud.wavePhase === "wave_clear") && hud.waveBannerTtl > 0 && (
        <div style={{
          position: "absolute", top: "38%", left: "50%",
          transform: "translate(-50%,-50%)",
          pointerEvents: "none", zIndex: 15, textAlign: "center",
        }}>
          {hud.wavePhase === "wave_clear" ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: "0.25em", marginBottom: 4 }}>
                WAVE {hud.wave - 1} CLEARED
              </div>
              <div style={{ fontSize: 11, color: "#555" }}>
                Next wave in {Math.ceil(hud.waveCountdown)}s…
              </div>
            </>
          ) : (
            <>
              <div style={{
                fontSize: 56, fontWeight: 900,
                background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                WAVE {hud.wave}
              </div>
              <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>
                {hud.wavePhase === "countdown" && hud.waveCountdown > 0.5
                  ? `Starting in ${Math.ceil(hud.waveCountdown)}…`
                  : `${enemiesForWave(hud.wave)} enemies incoming`}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Crosshair ──────────────────────────────────────────────────────── */}
      {(locked || isMobile) && phase === "playing" && (
        <Crosshair weaponId={hud.weaponId} hitMarker={hud.hitMarker} recoilSpread={hud.recoilSpread} />
      )}

      {/* ── Floating damage numbers ─────────────────────────────────────────── */}
      {hud.damageNums.map((dn) => (
        <DamageNumberPop key={dn.id} dn={dn} />
      ))}

      {/* ── Main HUD ───────────────────────────────────────────────────────── */}
      {phase === "playing" && (
        <>
          {/* Wave / Kill counter — top centre */}
          <div style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            pointerEvents: "none", zIndex: 10,
            display: "flex", alignItems: "center", gap: 14,
            background: "rgba(0,0,0,0.52)", backdropFilter: "blur(8px)",
            borderRadius: 28, padding: "6px 22px",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#a29bfe" }}>
              WAVE {hud.wave}/{MAX_WAVES}
            </span>
            <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.12)" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
              ☠ {hud.kills}
            </span>
            <span style={{ fontSize: 10, color: "#444" }}>
              {hud.enemiesLeft} left
            </span>
            <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.12)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#ffcc33" }}>
              ⭐ {hud.score.toLocaleString()}
            </span>
          </div>

          {/* Health bar — bottom left */}
          <div style={{
            position: "absolute", bottom: isMobile ? 152 : 22, left: 16,
            pointerEvents: "none", zIndex: 10,
          }}>
            <div style={{ fontSize: 8, color: "#555", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 4 }}>HEALTH</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 120, height: 7, borderRadius: 4, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
                <div style={{
                  width: `${hpRatio * 100}%`, height: "100%",
                  background: hpColor, borderRadius: 4,
                  transition: "width 0.14s ease, background 0.2s",
                  boxShadow: `0 0 8px ${hpColor}88`,
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: hpColor, minWidth: 28 }}>{Math.ceil(hud.health)}</span>
            </div>
          </div>

          {/* Ammo & Weapon — bottom right */}
          <div style={{
            position: "absolute", bottom: isMobile ? 152 : 22, right: 16,
            pointerEvents: "none", zIndex: 10, textAlign: "right",
          }}>
            <div style={{ fontSize: 9, color: "#555", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 3 }}>
              {WEAPON_DEFS[hud.weaponId].emoji} {WEAPON_DEFS[hud.weaponId].name.toUpperCase()}
            </div>

            {hud.reloading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ffcc33" }}>RELOADING…</div>
                <div style={{ width: 90, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{
                    width: `${hud.reloadPct * 100}%`, height: "100%",
                    background: "linear-gradient(90deg,#6c5ce7,#a29bfe)",
                    transition: "width 0.05s linear",
                  }} />
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, justifyContent: "flex-end" }}>
                <span style={{
                  fontSize: 28, fontWeight: 900, lineHeight: 1,
                  color: ammoLow ? "#ff4444" : "#fff",
                  textShadow: ammoLow ? "0 0 12px #ff444488" : "none",
                }}>
                  {hud.mag}
                </span>
                <span style={{ fontSize: 12, color: "#444", fontWeight: 600 }}>/ {hud.reserve}</span>
              </div>
            )}

            {/* Weapon switcher */}
            <div style={{ display: "flex", gap: 5, marginTop: 6, justifyContent: "flex-end" }}>
              {WEAPON_ORDER.map((wid) => (
                <div key={wid} style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: wid === hud.weaponId ? "rgba(108,92,231,0.45)" : "rgba(255,255,255,0.04)",
                  border: wid === hud.weaponId ? "1px solid #a29bfe" : "1px solid rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                }}>
                  {WEAPON_DEFS[wid].emoji}
                </div>
              ))}
            </div>
          </div>

          {/* Kill feed — top right */}
          <div style={{
            position: "absolute", top: 54, right: 12,
            pointerEvents: "none", zIndex: 10,
            display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4,
          }}>
            {hud.killFeed.map((msg, i) => (
              <div key={i} style={{
                fontSize: 11, fontWeight: 600,
                color: msg.includes("HEADSHOT") ? "#ffcc33" : msg.includes("✅") ? "#00ff88" : "#ff7070",
                background: "rgba(0,0,0,0.55)", padding: "3px 10px", borderRadius: 8,
                border: msg.includes("HEADSHOT") ? "1px solid rgba(255,200,50,0.3)" : "none",
              }}>{msg}</div>
            ))}
          </div>

          {/* Back button */}
          <button
            onClick={() => { if (document.pointerLockElement) document.exitPointerLock(); onBack(); }}
            style={{
              position: "absolute", top: 10, left: 10, zIndex: 30,
              background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20, color: "#aaa", fontSize: 12, fontWeight: 600,
              padding: "6px 14px", cursor: "pointer",
            }}
          >← Back</button>

          {/* FPS + Quality badge */}
          <div style={{
            position: "absolute", top: 44, left: 10, zIndex: 30,
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: "3px 9px", pointerEvents: "none",
          }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: "0.04em",
              color: hud.fpsDisplay >= 55 ? "#00ff88"
                   : hud.fpsDisplay >= 30 ? "#ffcc33"
                   : "#ff4444",
            }}>
              {hud.fpsDisplay} FPS
            </span>
            <div style={{ width: 1, height: 8, background: "rgba(255,255,255,0.12)" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: "#555", letterSpacing: "0.05em" }}>
              {hud.qualityLabel.toUpperCase()}
            </span>
          </div>

          {/* Aim Assist strength toggle */}
          <button
            onClick={() => {
              const order: AimAssistStrength[] = ["off", "low", "medium", "high"];
              setAssistStrength(s => order[(order.indexOf(s) + 1) % order.length]!);
            }}
            style={{
              position: "absolute", top: isMobile ? undefined : 44, bottom: isMobile ? (152 + 40) : undefined,
              left: 16, zIndex: 30,
              background: assistStrength === "off"
                ? "rgba(255,255,255,0.06)"
                : assistStrength === "low"
                ? "rgba(108,92,231,0.22)"
                : assistStrength === "medium"
                ? "rgba(108,92,231,0.38)"
                : "rgba(162,155,254,0.42)",
              border: `1px solid ${assistStrength === "off"
                ? "rgba(255,255,255,0.10)"
                : "rgba(162,155,254,0.50)"}`,
              borderRadius: 16, padding: "4px 10px",
              fontSize: 9, fontWeight: 800, color: assistStrength === "off" ? "#555" : "#A29BFE",
              cursor: "pointer", letterSpacing: "0.07em",
              display: "flex", alignItems: "center", gap: 5,
            }}
            title="Cycle aim assist strength"
          >
            <span>🎯</span>
            <span>
              {assistStrength === "off"    ? "AIM OFF"
               : assistStrength === "low"    ? "AIM LOW"
               : assistStrength === "medium" ? "AIM MED"
               : "AIM HIGH"}
            </span>
            {isMobile && assistStrength !== "off" && (
              <span style={{ fontSize: 8, color: "#fd79a8" }}>+MB</span>
            )}
          </button>
        </>
      )}

      {/* ── Mobile touch controls ──────────────────────────────────────────── */}
      {phase === "playing" && inputMgrRef.current && (
        <InputOverlay
          manager={inputMgrRef.current}
          mode="fps"
          pointerLocked={locked}
        />
      )}

      {/* ── AI Director overlay ────────────────────────────────────────────── */}
      {phase === "playing" && (
        <DirectorOverlay phase={dirPhase} band={dirBand} style={dirStyle} />
      )}

      {/* ── End screen ────────────────────────────────────────────────────── */}
      {(phase === "won" || phase === "lost") && (
        <EndOverlay
          phase={phase}
          kills={hud.kills}
          score={hud.score}
          wave={hud.wave}
          health={hud.health}
          onBack={onBack}
          onRespawn={onRespawn}
        />
      )}
    </div>
  );
}

// ── Crosshair (v3 — recoil spread indicator) ─────────────────────────────────

function Crosshair({ weaponId, hitMarker, recoilSpread }: {
  weaponId:    WeaponId;
  hitMarker:   HitMarkerKind;
  recoilSpread: number;
}) {
  const baseGap = weaponId === "sniper" ? 3 : weaponId === "shotgun" ? 10 : 6;
  const size    = weaponId === "sniper" ? 7 : 9;
  // Spread opens the gap proportional to recoil
  const gap     = baseGap + recoilSpread * 10;
  const col     = hitMarker === "head" ? "#ffcc33" : hitMarker === "body" ? "#ff4444" : "rgba(255,255,255,0.88)";

  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%,-50%)",
      pointerEvents: "none", zIndex: 10,
    }}>
      <div style={{ position: "relative", width: 60, height: 60 }}>
        {/* Hit marker X */}
        {hitMarker && (
          <>
            <div style={{ ...xLine, transform: "rotate(45deg)",  background: col }} />
            <div style={{ ...xLine, transform: "rotate(-45deg)", background: col }} />
          </>
        )}

        {/* Centre dot */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: weaponId === "sniper" ? 2 : 3,
          height: weaponId === "sniper" ? 2 : 3,
          borderRadius: "50%", background: col,
          transition: "background 0.08s",
        }} />

        {/* Arms — gap widens with recoil */}
        {[
          { top: 30 - gap - size, left: 29, width: 2, height: size },
          { top: 30 + gap,        left: 29, width: 2, height: size },
          { top: 29, left: 30 - gap - size, width: size, height: 2 },
          { top: 29, left: 30 + gap,        width: size, height: 2 },
        ].map((s, i) => (
          <div key={i} style={{
            position: "absolute", background: col,
            transition: "top 0.04s, left 0.04s, background 0.08s",
            ...s,
          }} />
        ))}

        {/* Sniper ring */}
        {weaponId === "sniper" && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            width: 36, height: 36, borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.3)",
          }} />
        )}
      </div>
    </div>
  );
}

const xLine: CSSProperties = {
  position: "absolute", top: "50%", left: "50%",
  width: 14, height: 2, marginLeft: -7, marginTop: -1, borderRadius: 1,
};

// ── Floating Damage Number ────────────────────────────────────────────────────

function DamageNumberPop({ dn }: { dn: DamageNumber }) {
  const progress = 1 - dn.ttl / dn.maxTtl;   // 0..1 as time passes
  const opacity  = Math.min(1, (1 - progress) * 2);   // fades out in second half
  const yOff     = progress * -48;   // floats upward

  return (
    <div style={{
      position: "absolute",
      left:  `${dn.screenX * 100}%`,
      top:   `${dn.screenY * 100}%`,
      transform: `translate(-50%, calc(-50% + ${yOff}px))`,
      pointerEvents: "none", zIndex: 12,
      fontSize:  dn.isHead ? 18 : 13,
      fontWeight: 900,
      color:      dn.isHead ? "#ffcc33" : "#ffffff",
      textShadow: dn.isHead
        ? "0 0 8px #ffcc33, 0 1px 3px rgba(0,0,0,0.8)"
        : "0 1px 4px rgba(0,0,0,0.9)",
      opacity,
      letterSpacing: dn.isHead ? 1 : 0,
      transition: "none",
    }}>
      {dn.isHead ? `🎯 ${dn.value}` : dn.value}
    </div>
  );
}

// ── End Overlay ───────────────────────────────────────────────────────────────

function EndOverlay({ phase, kills, score, wave, health, onBack, onRespawn }: {
  phase: Phase; kills: number; score: number; wave: number; health: number;
  onBack: () => void; onRespawn?: () => void;
}) {
  const won = phase === "won";
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 40,
      background: won ? "rgba(0,20,10,0.92)" : "rgba(20,0,0,0.92)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(16px)",
    }}>
      <div style={{ fontSize: 64, marginBottom: 12 }}>{won ? "🏆" : "💀"}</div>
      <div style={{
        fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 8,
        background: won ? "linear-gradient(135deg,#00ff88,#00cec9)" : "linear-gradient(135deg,#ff4444,#fd79a8)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      }}>
        {won ? "ALL WAVES CLEARED" : "YOU DIED"}
      </div>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 32 }}>
        {won
          ? `${kills} total kills · Survived all ${MAX_WAVES} waves`
          : `Reached Wave ${wave} · ${kills} kills before falling`}
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 36 }}>
        {[
          { label: "KILLS",  value: kills,              icon: "☠" },
          { label: "SCORE",  value: score.toLocaleString(), icon: "⭐" },
          { label: "WAVE",   value: `${wave}/${MAX_WAVES}`, icon: "🌊" },
          { label: "HEALTH", value: Math.ceil(health),  icon: "❤️" },
        ].map((s) => (
          <div key={s.label} style={{
            textAlign: "center", minWidth: 64,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, padding: "14px 18px",
          }}>
            <div style={{ fontSize: 22, marginBottom: 5 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{s.value}</div>
            <div style={{ fontSize: 8, color: "#444", fontWeight: 700, letterSpacing: "0.1em", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {onRespawn && (
          <button
            onClick={onRespawn}
            style={{
              padding: "13px 28px", borderRadius: 28, border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer",
            }}
          >⚙ Change Loadout</button>
        )}
        <button
          onClick={onBack}
          style={{
            padding: "13px 40px", borderRadius: 28, border: "none",
            background: GRAD, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}
        >Back to Engine</button>
      </div>
    </div>
  );
}
