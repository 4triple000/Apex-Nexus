/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — useGameDirector React Hook               ║
 * ║                                                          ║
 * ║  Wraps GameDirector in a React-friendly interface.      ║
 * ║                                                          ║
 * ║  Usage:                                                  ║
 * ║    const { settings, phase, band, style,                ║
 * ║            reportMetrics, addListener } =               ║
 * ║      useGameDirector({ gameMode: "fps" });              ║
 * ║                                                          ║
 * ║    // In game loop:                                      ║
 * ║    reportMetrics({ health, successRate, killCount… });  ║
 * ║                                                          ║
 * ║    // React to director events:                          ║
 * ║    addListener((ev) => {                                ║
 * ║      if (ev.type === "ambush") spawnExtraEnemies();     ║
 * ║      if (ev.type === "bonus_drop") giveHealthPack();    ║
 * ║    });                                                   ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  GameDirector,
  NEUTRAL_SETTINGS,
  type GameDirectorOptions,
  type PlayerMetrics,
  type DirectorSettings,
  type DirectorListener,
  type DirectorEvent,
  type EngagementPhase,
  type DifficultyBand,
  type PlayerStyle,
} from "./GameDirector";

export type {
  DirectorSettings, DirectorEvent, DirectorListener,
  EngagementPhase, DifficultyBand, PlayerStyle,
  PlayerMetrics,
};

// ── Return type ────────────────────────────────────────────────────────────────

export interface UseGameDirectorResult {
  /** Current recommended difficulty settings. Apply to enemies / spawns. */
  settings:      DirectorSettings;
  /** Current narrative phase (calm / buildup / peak / reward / recovery) */
  phase:         EngagementPhase;
  /** How easy/hard the game is right now for this player */
  band:          DifficultyBand;
  /** Inferred player behaviour style */
  style:         PlayerStyle;
  /**
   * Report updated metrics from the game loop.
   * Call every ~0.5 s (every 30 frames at 60 fps).
   */
  reportMetrics: (patch: Partial<PlayerMetrics>) => void;
  /**
   * Subscribe to director events (ambush / bonus_drop / boss_spawn…).
   * Returns an unsubscribe fn — safe to call in useEffect cleanup.
   */
  addListener:   (fn: DirectorListener) => () => void;
  /** Raw director instance (advanced use). */
  directorRef:   React.MutableRefObject<GameDirector | null>;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useGameDirector(opts: GameDirectorOptions = {}): UseGameDirectorResult {
  const directorRef = useRef<GameDirector | null>(null);

  const [settings, setSettings] = useState<DirectorSettings>(NEUTRAL_SETTINGS);
  const [phase,    setPhase]    = useState<EngagementPhase>("calm");
  const [band,     setBand]     = useState<DifficultyBand>("balanced");
  const [style,    setStyle]    = useState<PlayerStyle>("unknown");

  useEffect(() => {
    const director = new GameDirector(opts);
    directorRef.current = director;

    const unsub = director.on((ev) => {
      setSettings(ev.settings);
      setPhase(ev.phase);
      setBand(ev.band);
      setStyle(ev.style);
    });

    director.start();

    return () => {
      unsub();
      director.stop();
      directorRef.current = null;
    };
    // Intentionally not in dep array — opts is a literal object, would re-create every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reportMetrics = useCallback((patch: Partial<PlayerMetrics>) => {
    directorRef.current?.updateMetrics(patch);
  }, []);

  const addListener = useCallback((fn: DirectorListener): (() => void) => {
    return directorRef.current?.on(fn) ?? (() => undefined);
  }, []);

  return { settings, phase, band, style, reportMetrics, addListener, directorRef };
}
