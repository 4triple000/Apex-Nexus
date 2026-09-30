/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE v4 — GameCanvas Router                    ║
 * ║                                                             ║
 * ║  Flow (fps / openworld):                                    ║
 * ║    1. GameHUDCustomizer  (controls overview)                ║
 * ║    2. LoadoutSelector    (COD-style pre-deploy screen)      ║
 * ║    3. Game engine canvas                                    ║
 * ║                                                             ║
 * ║  Flow (all other modes):                                    ║
 * ║    1. GameHUDCustomizer                                     ║
 * ║    2. Game engine canvas                                    ║
 * ║                                                             ║
 * ║  Modes:                                                     ║
 * ║    platformer  → PlatformerCanvas                          ║
 * ║    shooter     → ShooterCanvas                             ║
 * ║    basketball  → BasketballCanvas                          ║
 * ║    topdown     → ShooterCanvas                             ║
 * ║    fps         → FPSCanvas         + Loadout               ║
 * ║    openworld   → OpenWorldCanvas   + Loadout               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useState } from "react";
import type { GameConfig, RemotePlayer } from "@/engine/types";
import { getSchemaForMode }  from "@/engine3d/GameInputSchema";
import { GameHUDCustomizer } from "./GameHUDCustomizer";
import { LoadoutSelector }   from "./LoadoutSelector";
import { PlatformerCanvas  } from "./PlatformerCanvas";
import { ShooterCanvas     } from "./ShooterCanvas";
import { BasketballCanvas  } from "./BasketballCanvas";
import { FPSCanvas         } from "./FPSCanvas";
import { OpenWorldCanvas   } from "./OpenWorldCanvas";
import {
  type Loadout,
  getLoadoutById, loadActiveLoadoutId,
} from "@/engine3d/LoadoutSystem";

interface GameCanvasProps {
  config:         GameConfig;
  remotePlayers?: RemotePlayer[];
  onGameEnd?:     (phase: "won" | "lost", score: number) => void;
  onPlayerMove?:  (x: number, y: number, vx: number, vy: number) => void;
  onBack:         () => void;
}

/** Modes that show the loadout selector before launch */
const LOADOUT_MODES = new Set(["fps", "openworld", "gta"]);

type Phase = "customizing" | "loadout" | "playing";

// The controls screen shows the first time someone plays each kind of game, then Play goes straight in
const controlsKey = (mode: string) => `apex_controls_seen_${mode}`;
function controlsSeen(mode: string) {
  try { return localStorage.getItem(controlsKey(mode)) === "1"; } catch { return false; }
}
function markControlsSeen(mode: string) {
  try { localStorage.setItem(controlsKey(mode), "1"); } catch { /* private mode */ }
}

export function GameCanvas({ config, remotePlayers = [], onGameEnd, onPlayerMove, onBack }: GameCanvasProps) {
  const mode    = config.gameMode ?? "platformer";
  const schema  = getSchemaForMode(mode);
  const hasLoadout = LOADOUT_MODES.has(mode);

  const [phase,   setPhase]   = useState<Phase>(() => (controlsSeen(mode) ? (hasLoadout ? "loadout" : "playing") : "customizing"));
  const [loadout, setLoadout] = useState<Loadout>(() => getLoadoutById(loadActiveLoadoutId()));

  // ── 1. Pre-game HUD customiser ────────────────────────────────────────────
  if (phase === "customizing") {
    return (
      <GameHUDCustomizer
        schema={schema}
        gameMode={mode}
        onPlay={() => { markControlsSeen(mode); setPhase(hasLoadout ? "loadout" : "playing"); }}
        onBack={onBack}
      />
    );
  }

  // ── 2. COD-style Loadout Selector (fps / openworld only) ─────────────────
  if (phase === "loadout") {
    return (
      <LoadoutSelector
        gameMode={mode}
        onDeploy={(chosen) => { setLoadout(chosen); setPhase("playing"); }}
        onBack={() => setPhase("customizing")}
      />
    );
  }

  // ── 3. Route to engine ────────────────────────────────────────────────────
  if (mode === "fps") {
    return (
      <FPSCanvas
        config={config}
        loadout={loadout}
        onGameEnd={onGameEnd}
        onBack={onBack}
        onRespawn={() => setPhase("loadout")}
      />
    );
  }

  if (mode === "openworld" || mode === "gta") {
    return (
      <OpenWorldCanvas
        config={config}
        loadout={loadout}
        onGameEnd={onGameEnd}
        onBack={onBack}
        onRespawn={() => setPhase("loadout")}
      />
    );
  }

  if (mode === "shooter" || mode === "topdown") {
    return <ShooterCanvas config={config} onGameEnd={onGameEnd} onBack={onBack} />;
  }

  if (mode === "basketball") {
    return <BasketballCanvas config={config} onGameEnd={onGameEnd} onBack={onBack} />;
  }

  return (
    <PlatformerCanvas
      config={config}
      remotePlayers={remotePlayers}
      onGameEnd={onGameEnd}
      onPlayerMove={onPlayerMove}
      onBack={onBack}
    />
  );
}
