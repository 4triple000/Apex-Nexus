/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX SYSTEMS — Performance Monitor                     ║
 * ║                                                         ║
 * ║  Tracks live FPS using a rolling frame-time window.     ║
 * ║  Automatically steps graphics quality up or down:       ║
 * ║                                                         ║
 * ║    FPS < 30 for 2s  → reduce quality (pixelRatio, shadows)║
 * ║    FPS > 55 for 8s  → increase quality (conservative)   ║
 * ║                                                         ║
 * ║  Usage in game loop:                                    ║
 * ║    const changed = perfSystem.tick(dt);                 ║
 * ║    if (changed) applyPerfSettings(perfSystem.snapshot); ║
 * ║                                                         ║
 * ║  ─── Tuning ────────────────────────────────────────── ║
 * ║  Adjust DOWN_FPS_THRESHOLD / UP_FPS_THRESHOLD below.   ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import type { QualityLevel } from "@/engine3d/PerfManager";

// ── Config ────────────────────────────────────────────────────────────────────

/** FPS below this for longer than DOWN_DELAY seconds → step quality down */
const DOWN_FPS_THRESHOLD = 30;

/** FPS above this for longer than UP_DELAY seconds → step quality up */
const UP_FPS_THRESHOLD   = 55;

/** Seconds of low FPS before we drop quality (fast response to bad perf) */
const DOWN_DELAY = 2;

/** Seconds of stable high FPS before we raise quality (conservative, avoids ping-pong) */
const UP_DELAY   = 8;

/** Number of frames in the rolling window used to compute average FPS */
const WINDOW_FRAMES = 90;

// ── Quality ladder ────────────────────────────────────────────────────────────
//  Each step defines exactly what settings the renderer should use.
//  Steps are ordered: [0] = lowest quality → [2] = highest quality.

export interface QualityStep {
  quality:       QualityLevel;
  /** devicePixelRatio cap to apply to the renderer */
  pixelRatio:    number;
  /** Whether shadow maps should be enabled on the renderer */
  shadowEnabled: boolean;
  /** Descriptive label for UI display */
  label:         string;
}

export const QUALITY_LADDER: QualityStep[] = [
  { quality: "low",    pixelRatio: 1.0, shadowEnabled: false, label: "Low"    },
  { quality: "medium", pixelRatio: 1.5, shadowEnabled: true,  label: "Medium" },
  { quality: "high",   pixelRatio: 2.0, shadowEnabled: true,  label: "High"   },
];

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface PerfSnapshot {
  fps:           number;
  avgFrameMs:    number;
  quality:       QualityLevel;
  pixelRatio:    number;
  shadowEnabled: boolean;
  label:         string;
}

// ── PerformanceSystem ─────────────────────────────────────────────────────────

export class PerformanceSystem {
  private _frameTimes:  number[] = [];
  private _fps         = 60;
  private _stepIdx:    number;
  private _stableTimer = 0;   // seconds spent at current quality tier

  constructor(initialQuality: QualityLevel = "medium") {
    const idx = QUALITY_LADDER.findIndex((s) => s.quality === initialQuality);
    this._stepIdx = Math.max(0, idx);
  }

  // ── Per-frame tick ────────────────────────────────────────────────────────

  /**
   * Call once per game frame with the current delta-time (in seconds).
   * Returns `true` if quality changed this frame — apply new settings to renderer.
   */
  tick(dt: number): boolean {
    // Rolling window — push frame time, evict oldest
    this._frameTimes.push(dt);
    if (this._frameTimes.length > WINDOW_FRAMES) this._frameTimes.shift();

    // Compute rolling average FPS (only after we have enough samples)
    if (this._frameTimes.length >= 10) {
      const sum = this._frameTimes.reduce((a, b) => a + b, 0);
      const avg = sum / this._frameTimes.length;
      this._fps = Math.round(1 / Math.max(avg, 0.001));
    }

    this._stableTimer += dt;

    // ── Step down: FPS too low ──────────────────────────────────────────────
    if (
      this._fps < DOWN_FPS_THRESHOLD &&
      this._stableTimer > DOWN_DELAY &&
      this._stepIdx > 0
    ) {
      this._stepIdx--;
      this._stableTimer = 0;
      return true;
    }

    // ── Step up: FPS consistently high ────────────────────────────────────
    if (
      this._fps > UP_FPS_THRESHOLD &&
      this._stableTimer > UP_DELAY &&
      this._stepIdx < QUALITY_LADDER.length - 1
    ) {
      this._stepIdx++;
      this._stableTimer = 0;
      return true;
    }

    return false;
  }

  // ── Read API ──────────────────────────────────────────────────────────────

  /** Full status snapshot — read after tick() to get current quality state. */
  get snapshot(): PerfSnapshot {
    const step   = QUALITY_LADDER[this._stepIdx]!;
    const frames = this._frameTimes;
    const avgMs  = frames.length
      ? (frames.reduce((a, b) => a + b, 0) / frames.length) * 1000
      : 16.7;
    return {
      fps:           this._fps,
      avgFrameMs:    Math.round(avgMs * 10) / 10,
      quality:       step.quality,
      pixelRatio:    step.pixelRatio,
      shadowEnabled: step.shadowEnabled,
      label:         step.label,
    };
  }

  /** Current FPS estimate */
  get fps(): number { return this._fps; }

  /** Current quality tier */
  get quality(): QualityLevel { return QUALITY_LADDER[this._stepIdx]!.quality; }

  /** Seconds the timer has been stable at current quality — useful for debug UI */
  get stableSeconds(): number { return this._stableTimer; }

  // ── Manual override ───────────────────────────────────────────────────────

  /** Force a specific quality tier (bypasses adaptive logic for that step).
   *  Resets the stability timer so the system waits a full UP_DELAY
   *  before trying to step up again. */
  forceQuality(q: QualityLevel): void {
    const idx = QUALITY_LADDER.findIndex((s) => s.quality === q);
    if (idx !== -1) {
      this._stepIdx    = idx;
      this._stableTimer = 0;
    }
  }
}
