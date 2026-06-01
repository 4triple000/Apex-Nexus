/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Open World Canvas v3                      ║
 * ║  GTA-style sandbox with:                                    ║
 * ║    🔫  Slot-based weapon system (5 weapons)                 ║
 * ║    🎯  4 mission types: goto / eliminate / deliver / survive ║
 * ║    🗺  Live minimap with mission markers                    ║
 * ║    🚗  Driveable vehicles                                   ║
 * ║    🤖  NPCs with AI                                         ║
 * ║    💰  Cash rewards + score                                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import type { GameConfig } from "@/engine/types";
import { type Loadout, getLoadoutEffects } from "@/engine3d/LoadoutSystem";
import { InputManager }         from "@/engine3d/InputManager";
import { InputOverlay }         from "./InputOverlay";
import {
  ChunkManager, WORLD_ORIGIN, CHUNK_SIZE, type CollectibleRef,
} from "@/engine3d/openworld";
import {
  createThirdPersonPlayer, type ThirdPersonPlayer,
} from "@/engine3d/thirdPersonPlayer";
import {
  createVehicle, driveVehicle, applyVehicleCamera,
  nearestVehicle, exitPosition, type Vehicle,
} from "@/engine3d/vehicle";
import { createNPCSystem, type NPCSystem } from "@/engine3d/npc";
import { detectPerfSettings } from "@/engine3d/PerfManager";
import { useGameDirector }    from "@/engine3d/useGameDirector";
import { DirectorOverlay }    from "./DirectorOverlay";
import {
  createGTAInventory, addWeaponToInventory, getActiveWeapon,
  switchSlot, cycleWeapon, tickGTAWeapon, canFireGTA,
  startReloadGTA, shootGTA,
  spawnWeaponPickups, updateWeaponPickups,
  type GTAInventory, type GTAWeaponSlot, GTA_WEAPON_SLOTS,
  type WeaponPickup,
} from "@/engine3d/GTAWeaponSystem";
import {
  MissionSystem, type Mission, type MissionPhase,
} from "@/engine3d/MissionSystem";

// ── Constants ─────────────────────────────────────────────────────────────────

const GRAD = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";

// ── HUD Types ─────────────────────────────────────────────────────────────────

interface HUDMission {
  id:       string;
  type:     string;
  title:    string;
  desc:     string;
  phase:    MissionPhase;
  progress: number;
  target:   number;
  reward:   number;
}

interface HUD {
  health:          number;
  inVehicle:       boolean;
  speed:           number;
  score:           number;
  cash:            number;
  prompt:          string | null;
  dialogue:        string | null;
  damageFlash:     boolean;
  // Weapon
  weaponSlot:      GTAWeaponSlot;
  weaponEmoji:     string;
  weaponName:      string;
  weaponMag:       number;
  weaponReserve:   number;
  weaponReloading: boolean;
  weaponReloadPct: number;
  ownedSlots:      GTAWeaponSlot[];
  // Missions
  missions:        HUDMission[];
  kills:           number;
}

// ─────────────────────────────────────────────────────────────────────────────

interface OWProps {
  config:      GameConfig;
  loadout?:    Loadout;
  onGameEnd?:  (phase: "won" | "lost", score: number) => void;
  onBack:      () => void;
  onRespawn?:  () => void;
}

export function OpenWorldCanvas({ config, loadout, onGameEnd, onBack, onRespawn }: OWProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const mapRef      = useRef<HTMLCanvasElement>(null);
  const playerRef   = useRef<ThirdPersonPlayer | null>(null);
  const inputMgrRef = useRef<InputManager | null>(null);

  const effects = getLoadoutEffects(loadout);
  const [phase, setPhase] = useState<"playing" | "won" | "lost">("playing");
  const [hud,   setHUD]   = useState<HUD>({
    health: Math.min(200, 100 + effects.startBonusHp + effects.extraHealth), inVehicle: false, speed: 0, score: 0, cash: 0,
    prompt: null, dialogue: null, damageFlash: false,
    weaponSlot: "melee", weaponEmoji: "👊", weaponName: "Fists",
    weaponMag: 0, weaponReserve: 0, weaponReloading: false,
    weaponReloadPct: 0, ownedSlots: ["melee"],
    missions: [], kills: 0,
  });

  const isMobile = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  // ── AI Gameplay Director ───────────────────────────────────────────────────
  const { settings: dirSettings, phase: dirPhase, band: dirBand,
          style: dirStyle, reportMetrics, directorRef } =
    useGameDirector({ gameMode: "openworld", tickIntervalMs: 6000 });
  const dirSettingsRef = useRef(dirSettings);
  useEffect(() => { dirSettingsRef.current = dirSettings; }, [dirSettings]);

  // ── Engine bootstrap ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const mapCvs = mapRef.current;
    if (!canvas || !mapCvs) return;

    const perf = detectPerfSettings();

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: perf.antialias,
      powerPreference: perf.isMobile ? "low-power" : "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, perf.pixelRatio));
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled   = perf.shadowEnabled;
    renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
    renderer.toneMapping         = perf.isMobile ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.setClearColor(0x070a14);

    const scene  = new THREE.Scene();
    scene.fog    = new THREE.FogExp2(0x07080e, perf.fogDensity);

    const camera = new THREE.PerspectiveCamera(72, W / H, 0.1, perf.isMobile ? 200 : 400);

    // Lighting
    scene.add(new THREE.AmbientLight(0x334466, perf.isMobile ? 0.85 : 0.6));
    const moon = new THREE.DirectionalLight(0x8899cc, 0.5);
    moon.position.set(40, 80, 40);
    moon.castShadow = perf.shadowEnabled;
    if (perf.shadowEnabled) {
      moon.shadow.camera.near   = 0.1;
      moon.shadow.camera.far    = 250;
      moon.shadow.camera.left   = moon.shadow.camera.bottom = -80;
      moon.shadow.camera.right  = moon.shadow.camera.top    =  80;
      moon.shadow.mapSize.set(perf.shadowMapSize, perf.shadowMapSize);
    }
    scene.add(moon);
    if (!perf.isMobile) {
      const glow = new THREE.PointLight(0x6c5ce7, 0.4, 80);
      glow.position.set(0, 20, 0);
      scene.add(glow);
    }

    // ── Subsystems ────────────────────────────────────────────────────────────
    const inputMgr = new InputManager(canvas, { rightDragLook: true });
    inputMgrRef.current = inputMgr;

    const startPos = new THREE.Vector3(8, 0, 8);
    const player   = createThirdPersonPlayer(camera, canvas, startPos);
    playerRef.current = player;
    scene.add(player.model);

    const chunkMgr = new ChunkManager(scene, perf.chunkRadius, undefined, {
      lampLights:    perf.lampLights,
      maxWindowRows: perf.maxWindowRows,
      lambertMode:   perf.lambertMode,
    });
    let collectibles: CollectibleRef[] = [];

    const vehicles: Vehicle[] = [];
    const carPositions = [
      new THREE.Vector3(20, 0, 10),
      new THREE.Vector3(-30, 0, 25),
      new THREE.Vector3(55, 0, -15),
    ];
    for (const cp of carPositions) vehicles.push(createVehicle(scene, cp));

    const npcSys = createNPCSystem(scene, perf.maxNPCs, 60, {
      aiHz: perf.npcAIHz, aiSleepDist: perf.npcAISleep,
      visDistance: perf.npcVisDistance, maxActive: perf.maxActiveNPCs,
    });

    // ── Weapon system ─────────────────────────────────────────────────────────
    const inv: GTAInventory = createGTAInventory();
    // Grant loadout weapons at start (map sniper → rifle since GTA has no sniper)
    const mapLdSlot = (id: string): GTAWeaponSlot =>
      id === "sniper" ? "rifle" : (id as GTAWeaponSlot);
    if (loadout?.primary) addWeaponToInventory(inv, mapLdSlot(loadout.primary));
    if (loadout?.secondary) addWeaponToInventory(inv, mapLdSlot(loadout.secondary));
    // Switch to primary slot if granted
    if (loadout?.primary) switchSlot(inv, mapLdSlot(loadout.primary));

    const pickupDefs: Array<{ pos: THREE.Vector3; slot: GTAWeaponSlot }> = [
      { slot: "pistol",  pos: new THREE.Vector3(18,  0, 14) },
      { slot: "smg",     pos: new THREE.Vector3(40,  0, -20) },
      { slot: "shotgun", pos: new THREE.Vector3(-28, 0,  40) },
      { slot: "rifle",   pos: new THREE.Vector3(60,  0,  60) },
    ];
    let pickups: WeaponPickup[] = spawnWeaponPickups(scene, pickupDefs);

    // ── Mission system ─────────────────────────────────────────────────────────
    let dialogueMsg: string | null = null;
    let dialogueTtl = 0;

    const missionSys = new MissionSystem(scene, {
      onComplete: (m, reward) => {
        score += reward;
        cash  += reward;
        dialogueMsg = `✅ ${m.def.title} complete! +$${reward.toLocaleString()}`;
        dialogueTtl = 4;
      },
      onFail: (m) => {
        dialogueMsg = `❌ ${m.def.title} failed.`;
        dialogueTtl = 3;
      },
      onMessage: (text, ttl) => {
        dialogueMsg = text;
        dialogueTtl = ttl ?? 2.5;
      },
    });

    // ── Mutable game state ────────────────────────────────────────────────────
    let currentHealth = Math.min(200, 100 + effects.startBonusHp + effects.extraHealth);
    let score         = 0;
    let cash          = 0;
    let kills         = 0;
    let inVehicle     = false;
    let activeVehicle: Vehicle | null = null;
    let gameOver      = false;
    let damageFlashTtl = 0;
    let interactCd    = 0;
    let prevInteract  = false;
    let prevShoot     = false;
    const vTouch      = { accel: 0, steer: 0 };
    let deaths        = 0;
    const sessionStart = performance.now();

    // ── Director ──────────────────────────────────────────────────────────────
    const unsubDirector = directorRef.current?.on((ev) => {
      if (gameOver) return;
      const pp = player.getPosition();
      switch (ev.type) {
        case "ambush":
          npcSys.getNearby(pp, 30).slice(0, 5).forEach((npc) => {
            if (npc.state !== "chasing") npc.state = "chasing";
          });
          dialogueMsg = "⚠️ You've got company!"; dialogueTtl = 3;
          break;
        case "bonus_drop":
          currentHealth = Math.min(100, currentHealth + 30);
          dialogueMsg = "💊 Found a health pack!"; dialogueTtl = 2.5;
          break;
        case "boss_spawn":
          npcSys.getNearby(pp, 60).slice(0, 3).forEach((npc) => {
            npc.state = "chasing"; npc.speed = Math.min(npc.speed * 1.5, 5);
          });
          dialogueMsg = "👾 Watch out — reinforcements!"; dialogueTtl = 3.5;
          break;
        case "calm_moment":
          currentHealth = Math.min(100, currentHealth + 20);
          npcSys.npcs.forEach((npc) => {
            if (npc.state === "chasing") npc.state = "walking";
          });
          dialogueMsg = "✨ Things have calmed down..."; dialogueTtl = 2.5;
          break;
        case "checkpoint_reward":
          currentHealth = Math.min(100, currentHealth + 10);
          dialogueMsg = "⭐ Checkpoint bonus!"; dialogueTtl = 2;
          break;
      }
    }) ?? (() => undefined);

    // ── Keyboard bindings ─────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      // Weapon slot keys 1–5
      const slotKeys: Record<string, GTAWeaponSlot> = {
        Digit1: "melee", Digit2: "pistol", Digit3: "smg",
        Digit4: "shotgun", Digit5: "rifle",
      };
      if (slotKeys[e.code]) {
        switchSlot(inv, slotKeys[e.code]!);
        return;
      }
      // Reload
      if (e.code === "KeyR") {
        const ws = getActiveWeapon(inv);
        if (ws) {
          if (startReloadGTA(ws)) {
            dialogueMsg = "🔄 Reloading…"; dialogueTtl = ws.def.reloadTime + 0.3;
          }
        }
        return;
      }
      // E = interact
      if (e.code === "KeyE" && interactCd <= 0) doInteract();
      // Q = cycle weapon
      if (e.code === "KeyQ") cycleWeapon(inv, 1);
    };
    document.addEventListener("keydown", onKeyDown);

    // ── Interact ──────────────────────────────────────────────────────────────
    function doInteract(): void {
      interactCd = 0.6;

      if (inVehicle && activeVehicle) {
        const exitPos = exitPosition(activeVehicle);
        player.model.position.copy(exitPos);
        (player as any).pos?.copy?.(exitPos);
        activeVehicle.occupied = false;
        activeVehicle = null;
        inVehicle = false;
        scene.add(player.model);
        return;
      }

      const pp = player.getPosition();

      // Vehicle check
      const veh = nearestVehicle(vehicles, pp);
      if (veh) {
        scene.remove(player.model);
        veh.occupied = true;
        activeVehicle = veh;
        inVehicle = true;
        return;
      }

      // Collectible star
      for (const c of collectibles) {
        if (!c.collected && c.worldPos.distanceTo(pp) < 3.5) {
          c.collected = true;
          c.mesh.visible = false;
          score += 100;
          cash  += 50;
          dialogueMsg = "⭐ Collected a star!"; dialogueTtl = 2;
          return;
        }
      }

      // NPC dialogue
      const nearby = npcSys.getNearby(pp, 4.5);
      if (nearby.length > 0) {
        const line = npcSys.interact(nearby[0]!);
        dialogueMsg = `💬 "${line}"`; dialogueTtl = 3.5;
      }
    }

    // ── Resize ─────────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ── Minimap ────────────────────────────────────────────────────────────────
    const mapCtx  = mapCvs.getContext("2d");
    const MAP_W   = 160;
    const MAP_H   = 160;
    const MAP_SCL = 1.2;

    function drawMinimap(pp: THREE.Vector3) {
      if (!mapCtx) return;
      mapCtx.clearRect(0, 0, MAP_W, MAP_H);

      mapCtx.fillStyle = "rgba(0,0,0,0.78)";
      mapCtx.fillRect(0, 0, MAP_W, MAP_H);

      const cx = MAP_W / 2, cz = MAP_H / 2;
      const wToM = (wx: number, wz: number) => ({
        mx: cx + (wx - pp.x) * MAP_SCL,
        my: cz + (wz - pp.z) * MAP_SCL,
      });

      // Road grid
      mapCtx.strokeStyle = "rgba(60,70,80,0.8)";
      mapCtx.lineWidth = 3;
      for (let c = 0; c <= 8; c++) {
        const wPos = WORLD_ORIGIN + c * CHUNK_SIZE;
        const { mx: mx1, my: my1 } = wToM(wPos, -200);
        const { my: my2 } = wToM(wPos, 200);
        const { mx: mx2 } = wToM(-200, wPos);
        const { mx: mx3 } = wToM(200, wPos);
        mapCtx.beginPath(); mapCtx.moveTo(mx1, my1); mapCtx.lineTo(mx1, my2); mapCtx.stroke();
        mapCtx.beginPath(); mapCtx.moveTo(mx2, my1); mapCtx.lineTo(mx3, my1); mapCtx.stroke();
      }

      // Weapon pickups (white diamonds)
      for (const p of pickups) {
        if (p.picked) continue;
        const { mx, my } = wToM(p.pos.x, p.pos.z);
        mapCtx.fillStyle = "#ffffff";
        mapCtx.beginPath();
        mapCtx.moveTo(mx, my - 4); mapCtx.lineTo(mx + 4, my);
        mapCtx.lineTo(mx, my + 4); mapCtx.lineTo(mx - 4, my);
        mapCtx.closePath(); mapCtx.fill();
      }

      // Collectibles (yellow)
      for (const c of collectibles) {
        if (c.collected) continue;
        const { mx, my } = wToM(c.worldPos.x, c.worldPos.z);
        mapCtx.fillStyle = "#ffdd00";
        mapCtx.beginPath(); mapCtx.arc(mx, my, 2, 0, Math.PI * 2); mapCtx.fill();
      }

      // Mission markers
      for (const m of missionSys.getMinimapMarkers()) {
        const { mx, my } = wToM(m.pos.x, m.pos.z);
        mapCtx.fillStyle   = m.color;
        mapCtx.strokeStyle = "rgba(0,0,0,0.6)";
        mapCtx.lineWidth   = 1;
        mapCtx.beginPath(); mapCtx.arc(mx, my, 5, 0, Math.PI * 2);
        mapCtx.fill(); mapCtx.stroke();
        mapCtx.fillStyle = "#fff";
        mapCtx.font = "bold 6px sans-serif";
        mapCtx.textAlign = "center";
        mapCtx.textBaseline = "middle";
        mapCtx.fillText(m.label, mx, my);
      }

      // Vehicles (green rect)
      for (const v of vehicles) {
        const { mx, my } = wToM(v.pos.x, v.pos.z);
        mapCtx.fillStyle = v.occupied ? "#2ecc71" : "#27ae60";
        mapCtx.fillRect(mx - 3, my - 5, 6, 10);
      }

      // NPCs
      for (const n of npcSys.npcs) {
        if (!n.alive) continue;
        const { mx, my } = wToM(n.pos.x, n.pos.z);
        mapCtx.fillStyle = n.kind === "hostile" ? "#ff4444" : "rgba(255,255,255,0.5)";
        mapCtx.beginPath(); mapCtx.arc(mx, my, 2, 0, Math.PI * 2); mapCtx.fill();
      }

      // Player (blue dot + heading arrow)
      mapCtx.fillStyle = "#4da6ff";
      mapCtx.beginPath(); mapCtx.arc(cx, cz, 5, 0, Math.PI * 2); mapCtx.fill();
      const yaw = player.getCameraYaw();
      mapCtx.strokeStyle = "#fff"; mapCtx.lineWidth = 1.5;
      mapCtx.beginPath();
      mapCtx.moveTo(cx, cz);
      mapCtx.lineTo(cx - Math.sin(yaw) * 10, cz - Math.cos(yaw) * 10);
      mapCtx.stroke();

      // Border
      mapCtx.strokeStyle = "rgba(255,255,255,0.15)"; mapCtx.lineWidth = 1;
      mapCtx.strokeRect(0, 0, MAP_W, MAP_H);
    }

    // ── Fire helper ───────────────────────────────────────────────────────────
    let frameKills = 0;

    function tryFire(): void {
      if (inVehicle) return;
      const ws = getActiveWeapon(inv);
      if (!ws || !canFireGTA(ws)) {
        if (ws && ws.mag === 0 && ws.def.slot !== "melee") {
          startReloadGTA(ws);
          dialogueMsg = "🔄 Reloading…"; dialogueTtl = ws.def.reloadTime + 0.3;
        }
        return;
      }

      const targets = npcSys.npcs
        .filter((n) => n.alive && n.visible)
        .flatMap((n) => [...n.model.children]);

      const results = shootGTA(ws, camera, targets);
      for (const r of results) {
        if (r.hit && r.npcId) {
          const killed = npcSys.hitNPC(r.npcId, r.damage, scene);
          if (killed) {
            const idx = parseInt(r.npcId.split("_")[1] ?? "0", 10);
            if (npcSys.npcs[idx]?.kind === "hostile") {
              kills++;
              frameKills++;
              score += 200;
              cash  += 100;
              dialogueMsg = `☠ Enemy down! (${kills} total)`; dialogueTtl = 1.5;
            }
          }
        }
      }
    }

    // ── Game loop ──────────────────────────────────────────────────────────────
    let lastTime  = performance.now();
    let raf: number;
    let frameCount = 0;
    const DT_MAX  = 0.05;

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - lastTime) / 1000, DT_MAX);
      lastTime = now;
      frameCount++;
      interactCd = Math.max(0, interactCd - dt);
      frameKills = 0;

      if (gameOver) { renderer.render(scene, camera); return; }

      // ── Input ────────────────────────────────────────────────────────────
      inputMgr.update();
      const input = inputMgr.snapshot;
      const keys  = inputMgr.keys;

      // Interact
      if (input.interact && !prevInteract) doInteract();
      prevInteract = input.interact;

      // Fire (hold for auto, edge for semi)
      const ws = getActiveWeapon(inv);
      if (ws) {
        const wantFire = input.shoot;
        if (ws.def.auto ? wantFire : (wantFire && !prevShoot)) tryFire();
        prevShoot = wantFire;

        // Mobile weapon switch via dedicated input
        if (input.reload) {
          const done = startReloadGTA(ws);
          if (done) { dialogueMsg = "🔄 Reloading…"; dialogueTtl = ws.def.reloadTime; }
        }

        tickGTAWeapon(ws, dt);
        // Auto-reload when empty
        if (ws.mag === 0 && !ws.reloading && ws.reserve > 0 && ws.def.slot !== "melee") {
          startReloadGTA(ws);
        }
      }

      // ── Chunk streaming (every 30 frames) ────────────────────────────────
      const pp = inVehicle ? activeVehicle!.pos : player.getPosition();
      if (frameCount % 30 === 0) {
        chunkMgr.update(pp.x, pp.z);
        collectibles = chunkMgr.getAllCollectibles();
      }
      const aabbs = chunkMgr.getAllAABBs();

      // ── Vehicle / player ──────────────────────────────────────────────────
      if (inVehicle && activeVehicle) {
        driveVehicle(activeVehicle, keys, vTouch, dt);
        applyVehicleCamera(activeVehicle, camera);
      } else {
        player.update(dt, keys, aabbs, input);
      }

      // ── Weapon pickups ────────────────────────────────────────────────────
      const newPickups = updateWeaponPickups(pickups, pp, now, dt);
      for (const p of newPickups) {
        const isNew = addWeaponToInventory(inv, p.slot);
        dialogueMsg = isNew
          ? `🔫 New weapon: ${p.slot.toUpperCase()}! (key ${["1","2","3","4","5"][GTA_WEAPON_SLOTS.indexOf(p.slot)]})`
          : `🔄 Ammo refilled for ${p.slot}!`;
        dialogueTtl = 3;
      }

      // ── NPCs ──────────────────────────────────────────────────────────────
      const ds = dirSettingsRef.current;
      npcSys.update(dt, pp, (rawDmg) => {
        const dmg = rawDmg * ds.enemyDamageMult;
        currentHealth = Math.max(0, currentHealth - dmg);
        damageFlashTtl = 0.22;
        if (currentHealth <= 0 && !gameOver) {
          deaths++;
          gameOver = true;
          setPhase("lost");
          onGameEnd?.("lost", score);
        }
      });

      // ── Mission system ────────────────────────────────────────────────────
      missionSys.update(dt, now, pp, frameKills, npcSys.npcs);

      // ── Win check (complete 4+ missions) ──────────────────────────────────
      if (missionSys.totalCompleted >= 4 && !gameOver) {
        gameOver = true;
        setPhase("won");
        onGameEnd?.("won", score + 2000);
      }

      // ── Star collectibles animation ───────────────────────────────────────
      const ANIM_R2 = 60 * 60;
      for (const c of collectibles) {
        if (c.collected) continue;
        const dx = c.worldPos.x - pp.x, dz = c.worldPos.z - pp.z;
        if (dx * dx + dz * dz > ANIM_R2) continue;
        c.mesh.rotation.y += dt * 2;
        c.mesh.position.y  = 1.4 + Math.sin(now * 0.002) * 0.25;
      }

      // ── Director metrics ──────────────────────────────────────────────────
      if (frameCount % 30 === 0) {
        reportMetrics({
          health:             currentHealth,
          maxHealth:          100,
          successRate:        missionSys.totalCompleted / Math.max(4, 1),
          movementSpeed:      inVehicle ? 1 : (Math.abs(input.moveX) > 0.1 || Math.abs(input.moveY) > 0.1 ? 0.8 : 0),
          combatFrequency:    kills / Math.max((performance.now() - sessionStart) / 60000, 0.001),
          idleSeconds:        0,
          completionProgress: Math.min(1, missionSys.totalCompleted / 4),
          failureCount:       deaths,
          killCount:          kills,
          score,
          sessionSeconds:     (performance.now() - sessionStart) / 1000,
        });
      }

      // ── Timers ────────────────────────────────────────────────────────────
      if (dialogueTtl > 0) dialogueTtl = Math.max(0, dialogueTtl - dt);
      if (damageFlashTtl > 0) damageFlashTtl = Math.max(0, damageFlashTtl - dt);

      // ── Interaction prompt ────────────────────────────────────────────────
      let prompt: string | null = null;
      if (!inVehicle) {
        const nearV = nearestVehicle(vehicles, pp);
        if (nearV) prompt = "E — Enter Car";
        else {
          const nearNPC = npcSys.getNearby(pp, 4.5);
          if (nearNPC.length > 0)
            prompt = nearNPC[0]!.kind === "hostile" ? "E — Talk / Fight" : "E — Talk";
          for (const c of collectibles)
            if (!c.collected && c.worldPos.distanceTo(pp) < 3.5) { prompt = "E — Collect ⭐"; break; }
        }
      } else {
        prompt = "E — Exit Vehicle";
      }

      // ── HUD sync (every 3 frames) ─────────────────────────────────────────
      if (frameCount % 3 === 0) {
        const activeWS = getActiveWeapon(inv);
        setHUD({
          health: currentHealth,
          inVehicle,
          speed: inVehicle && activeVehicle ? Math.abs(activeVehicle.speed * 3.6) : 0,
          score,
          cash,
          prompt,
          dialogue:  dialogueTtl > 0 ? dialogueMsg : null,
          damageFlash: damageFlashTtl > 0,
          weaponSlot:      inv.active,
          weaponEmoji:     activeWS?.def.emoji ?? "👊",
          weaponName:      activeWS?.def.name  ?? "Fists",
          weaponMag:       activeWS?.mag        ?? 0,
          weaponReserve:   activeWS?.reserve    ?? 0,
          weaponReloading: activeWS?.reloading  ?? false,
          weaponReloadPct: activeWS
            ? (1 - (activeWS.reloadTimer / (activeWS.def.reloadTime || 1)))
            : 1,
          ownedSlots: GTA_WEAPON_SLOTS.filter((s) => inv.slots.has(s)),
          missions: missionSys.missions.map((m) => ({
            id:       m.def.id,
            type:     m.def.type,
            title:    m.def.title,
            desc:     m.def.desc,
            phase:    m.phase,
            progress: m.progress,
            target:   m.def.target,
            reward:   m.def.reward,
          })),
          kills,
        });

        drawMinimap(pp);
      }

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(loop);

    // ── Canvas click to fire ──────────────────────────────────────────────────
    const onCanvasClick = () => tryFire();
    canvas.addEventListener("click", onCanvasClick);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      gameOver = true;
      unsubDirector();
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("click", onCanvasClick);
      inputMgr.dispose();
      inputMgrRef.current = null;
      player.dispose();
      playerRef.current   = null;
      npcSys.dispose(scene);
      missionSys.dispose();
      chunkMgr.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const hpRatio = hud.health / 100;
  const hpColor = hpRatio > 0.6 ? "#00ff88" : hpRatio > 0.3 ? "#ffcc33" : "#ff4444";
  const ammoLow  = hud.weaponMag <= 2 && hud.weaponSlot !== "melee";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#07080e", overflow: "hidden" }}>

      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

      {/* Damage vignette */}
      {hud.damageFlash && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5,
          background: "radial-gradient(ellipse at center, transparent 35%, rgba(220,30,30,0.42) 100%)",
        }} />
      )}

      {/* Crosshair (on foot only) */}
      {phase === "playing" && !hud.inVehicle && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          pointerEvents: "none", zIndex: 10,
        }}>
          <div style={{ position: "relative", width: 18, height: 18 }}>
            {[
              { top: 0, left: 8, width: 2, height: 5 },
              { top: 13, left: 8, width: 2, height: 5 },
              { top: 8, left: 0, width: 5, height: 2 },
              { top: 8, left: 13, width: 5, height: 2 },
            ].map((s, i) => (
              <div key={i} style={{
                position: "absolute", background: "rgba(255,255,255,0.85)",
                boxShadow: "0 0 3px rgba(0,0,0,0.6)", ...s,
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Minimap */}
      {phase === "playing" && (
        <div style={{
          position: "absolute", bottom: isMobile ? 155 : 20, left: 14, zIndex: 10,
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden",
        }}>
          <canvas ref={mapRef} width={160} height={160}
            style={{ display: "block", borderRadius: 8 }} />
          <div style={{
            position: "absolute", bottom: 4, left: 0, right: 0,
            textAlign: "center", fontSize: 8,
            color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.12em",
          }}>MINIMAP</div>
        </div>
      )}

      {/* ── HUD ──────────────────────────────────────────────────────────────── */}
      {phase === "playing" && (
        <>
          {/* Back */}
          <button
            onClick={onBack}
            style={{
              position: "absolute", top: 10, left: 10, zIndex: 30,
              background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20, color: "#aaa", fontSize: 12, fontWeight: 600,
              padding: "6px 14px", cursor: "pointer",
            }}
          >← Back</button>

          {/* Top bar — score + cash + kills */}
          <div style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            pointerEvents: "none", zIndex: 10,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
            borderRadius: 28, padding: "6px 22px",
            border: "1px solid rgba(255,255,255,0.07)",
            display: "flex", gap: 16, alignItems: "center",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#ffcc33" }}>
              ⭐ {hud.score.toLocaleString()}
            </span>
            <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.12)" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#00ff88" }}>
              💰 ${hud.cash.toLocaleString()}
            </span>
            <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.12)" }} />
            <span style={{ fontSize: 10, color: "#aaa" }}>☠ {hud.kills}</span>
            <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.12)" }} />
            <span style={{ fontSize: 10, color: "#666" }}>Neon City</span>
          </div>

          {/* Health — above minimap */}
          <div style={{
            position: "absolute",
            bottom: isMobile ? 155 + 168 : 188, left: 14,
            pointerEvents: "none", zIndex: 10,
          }}>
            <div style={{ fontSize: 8, color: "#555", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 4 }}>HEALTH</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 115, height: 7, borderRadius: 4, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
                <div style={{ width: `${hpRatio * 100}%`, height: "100%", background: hpColor, borderRadius: 4, transition: "width 0.14s ease, background 0.2s", boxShadow: `0 0 8px ${hpColor}88` }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: hpColor }}>{Math.ceil(hud.health)}</span>
            </div>
          </div>

          {/* Speed — when driving */}
          {hud.inVehicle && (
            <div style={{
              position: "absolute", bottom: isMobile ? 155 : 20, right: 14,
              pointerEvents: "none", zIndex: 10, textAlign: "right",
            }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                {Math.round(hud.speed)}
              </div>
              <div style={{ fontSize: 9, color: "#555", fontWeight: 700, letterSpacing: "0.1em" }}>KM/H</div>
            </div>
          )}

          {/* ── Weapon HUD — bottom right ─────────────────────────────────────── */}
          {!hud.inVehicle && (
            <div style={{
              position: "absolute",
              bottom: isMobile ? 155 : 20, right: 14,
              pointerEvents: "none", zIndex: 10,
            }}>
              {/* Ammo */}
              <div style={{ textAlign: "right", marginBottom: 6 }}>
                {hud.weaponReloading ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ffcc33", marginBottom: 4 }}>RELOADING…</div>
                    <div style={{ width: 90, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginLeft: "auto" }}>
                      <div style={{ width: `${hud.weaponReloadPct * 100}%`, height: "100%", background: "linear-gradient(90deg,#6c5ce7,#a29bfe)", transition: "width 0.05s linear" }} />
                    </div>
                  </div>
                ) : hud.weaponSlot !== "melee" ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5, justifyContent: "flex-end" }}>
                    <span style={{
                      fontSize: 28, fontWeight: 900, lineHeight: 1,
                      color: ammoLow ? "#ff4444" : "#fff",
                      textShadow: ammoLow ? "0 0 12px #ff444488" : "none",
                    }}>{hud.weaponMag}</span>
                    <span style={{ fontSize: 11, color: "#444" }}>/ {hud.weaponReserve}</span>
                  </div>
                ) : null}

                {/* Weapon name */}
                <div style={{ fontSize: 10, color: "#666", fontWeight: 700, letterSpacing: "0.10em", marginTop: 3 }}>
                  {hud.weaponEmoji} {hud.weaponName.toUpperCase()}
                </div>
              </div>

              {/* Weapon slots row */}
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                {GTA_WEAPON_SLOTS.map((slot, i) => {
                  const owned  = hud.ownedSlots.includes(slot);
                  const active = hud.weaponSlot === slot;
                  const EMOJIS: Record<GTAWeaponSlot, string> = {
                    melee: "👊", pistol: "🔫", smg: "⚡", shotgun: "💥", rifle: "🎯",
                  };
                  return (
                    <div key={slot} style={{
                      width: 30, height: 30, borderRadius: 7,
                      background: active ? "rgba(108,92,231,0.55)"
                        : owned ? "rgba(255,255,255,0.07)"
                        : "rgba(255,255,255,0.02)",
                      border: active ? "1.5px solid #a29bfe"
                        : owned ? "1px solid rgba(255,255,255,0.15)"
                        : "1px solid rgba(255,255,255,0.05)",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      opacity: owned ? 1 : 0.3,
                    }}>
                      <span style={{ fontSize: 11 }}>{EMOJIS[slot]}</span>
                      <span style={{ fontSize: 7, color: active ? "#a29bfe" : "#444", fontWeight: 700 }}>
                        {i + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Mission board — top right ─────────────────────────────────────── */}
          <div style={{
            position: "absolute", top: 50, right: 14,
            pointerEvents: "none", zIndex: 10,
            display: "flex", flexDirection: "column", gap: 6,
            maxWidth: 210,
          }}>
            {hud.missions.map((m) => {
              const typeColor: Record<string, string> = {
                goto: "#ffcc00", eliminate: "#ff4444", deliver: "#00ff88", survive: "#ff8800",
              };
              const typeIcon: Record<string, string> = {
                goto: "📍", eliminate: "💀", deliver: "📦", survive: "⏱",
              };
              const pct  = Math.min(1, m.progress / Math.max(m.target, 1));
              const done = m.phase === "complete";
              const fail = m.phase === "fail";

              return (
                <div key={m.id} style={{
                  background: "rgba(0,0,0,0.62)", backdropFilter: "blur(12px)",
                  border: `1px solid ${done ? "rgba(0,255,136,0.35)" : fail ? "rgba(255,68,68,0.35)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 12, padding: "8px 12px",
                  opacity: done || fail ? 0.55 : 1,
                  transition: "opacity 0.5s",
                }}>
                  {/* Title row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>{typeIcon[m.type]}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: done ? "#00ff88" : fail ? "#ff4444" : "#fff",
                      letterSpacing: "0.04em", flex: 1,
                    }}>{m.title}</span>
                    <span style={{ fontSize: 9, color: "#ffcc33", fontWeight: 700 }}>
                      ${m.reward.toLocaleString()}
                    </span>
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", marginBottom: 6, lineHeight: 1.4 }}>
                    {done ? "✅ Complete!" : fail ? "❌ Failed" : m.desc}
                  </div>

                  {/* Progress bar */}
                  {!done && !fail && (
                    <div>
                      <div style={{ width: "100%", height: 3, borderRadius: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                        <div style={{
                          width: `${pct * 100}%`, height: "100%", borderRadius: 2,
                          background: typeColor[m.type] ?? "#aaa",
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <span style={{ fontSize: 8, color: typeColor[m.type], fontWeight: 700 }}>
                          {m.type === "survive" ? `${m.progress}s / ${m.target}s` : `${m.progress} / ${m.target}`}
                        </span>
                        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          {m.type}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Legend */}
            <div style={{
              fontSize: 8, color: "rgba(255,255,255,0.18)", textAlign: "right",
              letterSpacing: "0.08em", lineHeight: 1.8,
            }}>
              1–5 WEAPONS · R RELOAD · E INTERACT
            </div>
          </div>

          {/* Dialogue / notification */}
          {hud.dialogue && (
            <div style={{
              position: "absolute", bottom: isMobile ? 170 : 90, left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
              borderRadius: 22, padding: "9px 22px",
              border: "1px solid rgba(255,255,255,0.10)",
              fontSize: 13, color: "#fff", fontWeight: 600,
              pointerEvents: "none", zIndex: 20,
              textAlign: "center", maxWidth: 320,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {hud.dialogue}
            </div>
          )}

          {/* Interaction prompt */}
          {hud.prompt && (
            <div style={{
              position: "absolute", bottom: isMobile ? 170 : 90, left: "50%",
              transform: "translateX(-50%)",
              pointerEvents: "none", zIndex: 20,
              marginBottom: hud.dialogue ? 40 : 0,
            }}>
              {!hud.dialogue && (
                <div style={{
                  background: "rgba(0,0,0,0.65)", borderRadius: 20,
                  padding: "6px 18px", fontSize: 11, color: "#aaa", fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  {hud.prompt}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Mobile touch controls */}
      {phase === "playing" && inputMgrRef.current && (
        <InputOverlay
          manager={inputMgrRef.current}
          mode="openworld"
          pointerLocked={false}
        />
      )}

      {/* AI Director overlay */}
      {phase === "playing" && (
        <DirectorOverlay phase={dirPhase} band={dirBand} style={dirStyle} />
      )}

      {/* End screen */}
      {(phase === "won" || phase === "lost") && (
        <OWEndOverlay
          phase={phase}
          onRespawn={onRespawn}
          score={hud.score}
          cash={hud.cash}
          kills={hud.kills}
          missions={hud.missions.filter((m) => m.phase === "complete").length}
          onBack={onBack}
        />
      )}
    </div>
  );
}

// ── End Overlay ───────────────────────────────────────────────────────────────

function OWEndOverlay({
  phase, score, cash, kills, missions, onBack, onRespawn,
}: {
  phase: string; score: number; cash: number;
  kills: number; missions: number; onBack: () => void; onRespawn?: () => void;
}) {
  const won = phase === "won";
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 40,
      background: won ? "rgba(0,20,10,0.92)" : "rgba(20,0,0,0.92)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(16px)",
    }}>
      <div style={{ fontSize: 64, marginBottom: 12 }}>{won ? "🏆" : "💀"}</div>
      <div style={{
        fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 8,
        background: won
          ? "linear-gradient(135deg,#00ff88,#00cec9)"
          : "linear-gradient(135deg,#ff4444,#fd79a8)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      }}>
        {won ? "CITY CONQUERED" : "BUSTED"}
      </div>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 32 }}>
        {won ? `${missions} missions complete · ${kills} enemies eliminated`
              : `${kills} enemies down before they got you`}
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 36 }}>
        {[
          { label: "SCORE",    value: score.toLocaleString(),  icon: "⭐" },
          { label: "CASH",     value: `$${cash.toLocaleString()}`, icon: "💰" },
          { label: "KILLS",    value: kills,                   icon: "☠" },
          { label: "MISSIONS", value: missions,                icon: "🎯" },
        ].map((s) => (
          <div key={s.label} style={{
            textAlign: "center", minWidth: 72,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, padding: "14px 18px",
          }}>
            <div style={{ fontSize: 22, marginBottom: 5 }}>{s.icon}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>{s.value}</div>
            <div style={{ fontSize: 8, color: "#444", fontWeight: 700, letterSpacing: "0.1em", marginTop: 3 }}>
              {s.label}
            </div>
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
