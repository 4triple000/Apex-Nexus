/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX — useHUDOptimizer React Hook                          ║
 * ║                                                             ║
 * ║  Bridges the HUDOptimizerEngine to React state:            ║
 * ║    • Schedules periodic analysis                            ║
 * ║    • Fires toast notification when layout mutates           ║
 * ║    • Exposes undo (one-step rollback)                       ║
 * ║    • Provides recordPress() for ActionButton wiring         ║
 * ║    • Exposes per-button metrics for debug overlay           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { useRef, useState, useEffect, useCallback } from "react";
import {
  HUDOptimizerEngine,
  type AdaptMode,
  type ButtonMetrics,
} from "@/engine3d/HUDOptimizer";
import type { HUDLayout } from "@/engine3d/HUDLayout";

// ── Analysis schedule ─────────────────────────────────────────────────────────
//
//  In Balanced mode we analyze every 60 s or every 40 total presses.
//  In Aggressive mode: 30 s or 20 presses.

const SCHEDULE: Record<AdaptMode, { intervalMs: number; pressThreshold: number }> = {
  static:     { intervalMs: Infinity,  pressThreshold: Infinity },
  balanced:   { intervalMs: 60_000,    pressThreshold: 40 },
  aggressive: { intervalMs: 30_000,    pressThreshold: 20 },
};

// ── Toast ─────────────────────────────────────────────────────────────────────

export interface OptToast {
  visible:   boolean;
  reasons:   string[];
  canUndo:   boolean;
  generation: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseHUDOptimizerOptions {
  gameMode:  string;
  mode:      AdaptMode;
  layout:    HUDLayout;
  setLayout: (next: HUDLayout) => void;
  /** If true, show a debug metrics panel */
  debug?:    boolean;
}

export interface UseHUDOptimizerReturn {
  /** Call this on every button press */
  recordPress: (buttonId: string, x: number, y: number) => void;
  /** Undo last AI layout change */
  undo: () => void;
  /** Toast notification state */
  toast: OptToast;
  /** Dismiss toast */
  dismissToast: () => void;
  /** Current metrics for all buttons (for debug panel) */
  metrics: ButtonMetrics[];
  /** How many presses in the current session */
  sessionPresses: number;
  /** Engine generation (how many times layout was evolved) */
  generation: number;
  /** Force an immediate optimization analysis */
  forceOptimize: () => void;
}

export function useHUDOptimizer({
  gameMode,
  mode,
  layout,
  setLayout,
  debug = false,
}: UseHUDOptimizerOptions): UseHUDOptimizerReturn {

  // Stable engine instance per gameMode
  const engineRef = useRef<HUDOptimizerEngine | null>(null);
  if (!engineRef.current || (engineRef.current as unknown as { gameMode: string }).gameMode !== gameMode) {
    engineRef.current = new HUDOptimizerEngine(gameMode);
  }
  const engine = engineRef.current;

  // Snapshot the latest layout for the interval callback
  const layoutRef = useRef(layout);
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  // Mode ref for interval callback
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Toast state
  const [toast, setToast] = useState<OptToast>({
    visible: false, reasons: [], canUndo: false, generation: 0,
  });

  // Session press counter for debug
  const [sessionPresses, setSessionPresses] = useState(0);
  const [generation, setGeneration] = useState(engine.gen);

  // Metrics (updated on each recordPress — cheap since Map lookup)
  const [metrics, setMetrics] = useState<ButtonMetrics[]>(() => engine.getAllMetrics());

  // ── Analysis runner ────────────────────────────────────────────────────────

  const runAnalysis = useCallback(() => {
    const m = modeRef.current;
    if (m === "static") return;

    const result = engine.optimize(layoutRef.current, m);
    setMetrics(engine.getAllMetrics());
    setSessionPresses(0);

    if (result.changed) {
      setLayout(result.layout);
      setGeneration(result.generation);
      setToast({
        visible:   true,
        reasons:   result.reasons,
        canUndo:   engine.historyDepth > 0,
        generation: result.generation,
      });

      // Auto-dismiss toast after 4 s
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4_000);
    }
  }, [engine, setLayout]);

  // ── Interval-based analysis ────────────────────────────────────────────────

  useEffect(() => {
    if (mode === "static") return;
    const { intervalMs } = SCHEDULE[mode];
    if (!isFinite(intervalMs)) return;

    const id = setInterval(runAnalysis, intervalMs);
    return () => clearInterval(id);
  }, [mode, runAnalysis]);

  // ── Threshold-based analysis (on press count) ──────────────────────────────

  const pressCountRef = useRef(0);

  // ── recordPress ────────────────────────────────────────────────────────────

  const recordPress = useCallback((buttonId: string, x: number, y: number) => {
    engine.recordPress(buttonId, x, y);
    pressCountRef.current += 1;
    setSessionPresses(p => p + 1);

    // Update metrics in debug mode
    if (debug) setMetrics(engine.getAllMetrics());

    // Check press-threshold
    const threshold = SCHEDULE[modeRef.current]?.pressThreshold ?? Infinity;
    if (pressCountRef.current >= threshold) {
      pressCountRef.current = 0;
      runAnalysis();
    }
  }, [engine, debug, runAnalysis]);

  // ── Undo ───────────────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    const prev = engine.undo();
    if (prev) {
      setLayout(prev);
      setToast(t => ({ ...t, visible: false, canUndo: engine.historyDepth > 0 }));
    }
  }, [engine, setLayout]);

  const dismissToast = useCallback(() => {
    setToast(t => ({ ...t, visible: false }));
  }, []);

  const forceOptimize = useCallback(() => {
    runAnalysis();
  }, [runAnalysis]);

  return {
    recordPress,
    undo,
    toast,
    dismissToast,
    metrics,
    sessionPresses,
    generation,
    forceOptimize,
  };
}
