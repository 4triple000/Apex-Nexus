/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — HUD AI Optimizer                             ║
 * ║                                                             ║
 * ║  Tracks per-user per-game button behavior and automatically ║
 * ║  mutates HUD layout for maximum comfort and speed.          ║
 * ║                                                             ║
 * ║  Systems:                                                   ║
 * ║    📊  ButtonMetrics  — usage, misclicks, reaction time    ║
 * ║    🗺  ThumbZone     — safe vs. stretch reach mapping      ║
 * ║    🤖  OptEngine     — 5 rules that reshape the layout     ║
 * ║    🛡  SafetyLock    — essential buttons stay accessible   ║
 * ║    💾  Storage       — per-user per-game, layout history   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { HUDElement, HUDLayout, JoystickConfig } from "./HUDLayout";
import { cloneLayout } from "./HUDLayout";

// ── Adaptation mode ───────────────────────────────────────────────────────────

export type AdaptMode = "static" | "balanced" | "aggressive";

// ── Metrics ───────────────────────────────────────────────────────────────────

export interface ButtonMetrics {
  buttonId:         string;
  /** Total presses ever (persisted) */
  usageCount:       number;
  /** Rapid re-tap fumbles (< 80ms after previous press) */
  misClicks:        number;
  /** Rolling average reaction time (ms since last ANY button press) */
  avgReactionTimeMs: number;
  reactionSamples:  number;
  /** Presses this session only (resets on analyze()) */
  sessionCount:     number;
  /** Ts of last press */
  lastPressTs:      number;
}

function emptyMetrics(buttonId: string): ButtonMetrics {
  return {
    buttonId,
    usageCount: 0,
    misClicks:  0,
    avgReactionTimeMs: 350,
    reactionSamples:   0,
    sessionCount: 0,
    lastPressTs:  0,
  };
}

// ── Thumb zones ───────────────────────────────────────────────────────────────
//
//  Defined as % of screen.  Buttons inside these zones are "in reach".
//  Buttons outside are "stretch" — candidates for repositioning.

interface ThumbZone {
  name: "left" | "right" | "top";
  cx:   number;    // % center X
  cy:   number;    // % center Y
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const THUMB_ZONES: ThumbZone[] = [
  { name: "left",  cx: 18,  cy: 78, xMin: 4,  xMax: 38, yMin: 55, yMax: 95 },
  { name: "right", cx: 82,  cy: 78, xMin: 62, xMax: 96, yMin: 55, yMax: 95 },
  { name: "top",   cx: 50,  cy: 20, xMin: 5,  xMax: 95, yMin: 2,  yMax: 40 },
];

function nearestThumbZone(x: number, y: number): ThumbZone {
  // Never return "top" as a movement target — it's stretch territory
  const zones = THUMB_ZONES.filter(z => z.name !== "top");
  let best = zones[0]!;
  let bestDist = Infinity;
  for (const z of zones) {
    const d = Math.hypot(z.cx - x, z.cy - y);
    if (d < bestDist) { bestDist = d; best = z; }
  }
  return best;
}

function inThumbZone(x: number, y: number): boolean {
  return THUMB_ZONES.some(z =>
    z.name !== "top" &&
    x >= z.xMin && x <= z.xMax &&
    y >= z.yMin && y <= z.yMax
  );
}

// ── Safety lock rules ─────────────────────────────────────────────────────────

const ESSENTIAL_BUTTONS = new Set(["fire", "jump"]);
const MIN_ESSENTIAL_SIZE    = 64;
const MIN_ESSENTIAL_OPACITY = 0.75;
const MIN_SECONDARY_SIZE    = 38;
const MIN_SECONDARY_OPACITY = 0.30;
const MAX_Y_ESSENTIAL       = 88;   // essential buttons must be ≤ this Y

function clampEssential(el: HUDElement): HUDElement {
  if (!ESSENTIAL_BUTTONS.has(el.id)) {
    return {
      ...el,
      size:    Math.max(MIN_SECONDARY_SIZE, el.size),
      opacity: Math.max(MIN_SECONDARY_OPACITY, el.opacity),
    };
  }
  return {
    ...el,
    size:    Math.max(MIN_ESSENTIAL_SIZE, el.size),
    opacity: Math.max(MIN_ESSENTIAL_OPACITY, el.opacity),
    x:       Math.max(55, el.x),   // essential stays right side
    y:       Math.min(MAX_Y_ESSENTIAL, Math.max(55, el.y)),
  };
}

// ── Optimization parameters by mode ──────────────────────────────────────────

const PARAMS = {
  static: {
    minSessionPresses: Infinity,  // never fires
    sizeBoostPct:      0,
    sizeShrinkPct:     0,
    opacityBoostPct:   0,
    opacityShrinkPct:  0,
    posNudgePct:       0,
    highUsageThreshold: Infinity,
    lowUsageThreshold:  -1,
    slowReactionMs:    Infinity,
    highMisclickRate:  Infinity,
  },
  balanced: {
    minSessionPresses: 30,
    sizeBoostPct:      0.08,
    sizeShrinkPct:     0.06,
    opacityBoostPct:   0.10,
    opacityShrinkPct:  0.12,
    posNudgePct:       2.5,   // % of screen moved per cycle
    highUsageThreshold: 20,   // session presses
    lowUsageThreshold:  3,
    slowReactionMs:    450,
    highMisclickRate:  0.18,  // 18%
  },
  aggressive: {
    minSessionPresses: 15,
    sizeBoostPct:      0.18,
    sizeShrinkPct:     0.14,
    opacityBoostPct:   0.22,
    opacityShrinkPct:  0.25,
    posNudgePct:       5.0,
    highUsageThreshold: 10,
    lowUsageThreshold:  2,
    slowReactionMs:    380,
    highMisclickRate:  0.12,
  },
};

// ── Optimizer engine ──────────────────────────────────────────────────────────

export interface OptimizationResult {
  layout:    HUDLayout;
  changed:   boolean;
  reasons:   string[];     // human-readable change log
  generation: number;
}

export class HUDOptimizerEngine {
  private metrics   = new Map<string, ButtonMetrics>();
  private lastGlobalPressTs = 0;
  private generation = 0;
  private history:   HUDLayout[] = [];   // last 10 layouts
  private storageKey: string;

  constructor(private gameMode: string) {
    this.storageKey = `apex:hud-opt:${gameMode}`;
    this._load();
  }

  // ── Input recording ─────────────────────────────────────────────────────────

  /** Call on every button touchstart. */
  recordPress(buttonId: string, x: number, y: number): void {
    const m = this._metrics(buttonId);
    const now = Date.now();

    // Misclick: rapid re-tap within 80 ms
    if (now - m.lastPressTs < 80) {
      m.misClicks += 1;
    }

    // Reaction time: time since last ANY button press
    if (this.lastGlobalPressTs > 0 && now - this.lastGlobalPressTs < 3000) {
      const rt = now - this.lastGlobalPressTs;
      m.avgReactionTimeMs = m.reactionSamples === 0
        ? rt
        : (m.avgReactionTimeMs * m.reactionSamples + rt) / (m.reactionSamples + 1);
      m.reactionSamples += 1;
    }

    m.usageCount    += 1;
    m.sessionCount  += 1;
    m.lastPressTs    = now;
    this.lastGlobalPressTs = now;

    // Auto-save every 20 presses to not lose data
    if (m.usageCount % 20 === 0) this._save();
  }

  /** Explicit misclick (no game effect on press). */
  recordMissClick(buttonId: string): void {
    this._metrics(buttonId).misClicks += 1;
  }

  /** Metrics for a button. */
  getMetrics(buttonId: string): ButtonMetrics {
    return { ...this._metrics(buttonId) };
  }

  /** All metrics snapshot. */
  getAllMetrics(): ButtonMetrics[] {
    return Array.from(this.metrics.values());
  }

  // ── Analysis & mutation ─────────────────────────────────────────────────────

  /**
   * Analyze current metrics against the given layout and return a (possibly)
   * mutated layout.  Call this when the session has enough interactions.
   *
   * Resets sessionCount for all buttons after running.
   */
  optimize(layout: HUDLayout, mode: AdaptMode): OptimizationResult {
    if (mode === "static") {
      return { layout: cloneLayout(layout), changed: false, reasons: [], generation: this.generation };
    }

    const p = PARAMS[mode];
    const totalPresses = Array.from(this.metrics.values()).reduce((s, m) => s + m.sessionCount, 0);
    if (totalPresses < p.minSessionPresses) {
      return { layout: cloneLayout(layout), changed: false, reasons: [], generation: this.generation };
    }

    const newLayout = cloneLayout(layout);
    const reasons: string[] = [];
    let changed = false;

    for (const btn of newLayout.buttons) {
      const m = this._metrics(btn.id);
      const misclickRate = m.usageCount > 0 ? m.misClicks / m.usageCount : 0;
      const essential    = ESSENTIAL_BUTTONS.has(btn.id);

      // ── Rule 1: HIGH USAGE → grow + move to thumb zone ──────────────────
      if (m.sessionCount >= p.highUsageThreshold) {
        const newSize = Math.min(96, btn.size * (1 + p.sizeBoostPct));
        if (Math.abs(newSize - btn.size) > 0.5) {
          reasons.push(`${btn.id}: used often → enlarged`);
          btn.size    = newSize;
          btn.opacity = Math.min(1, btn.opacity + p.opacityBoostPct);
          changed = true;
        }
        // Move toward thumb zone if not already there
        if (!inThumbZone(btn.x, btn.y)) {
          const zone = nearestThumbZone(btn.x, btn.y);
          const dx   = zone.cx - btn.x;
          const dy   = zone.cy - btn.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 3) {
            const step = p.posNudgePct;
            btn.x += (dx / dist) * step;
            btn.y += (dy / dist) * step;
            reasons.push(`${btn.id}: moved toward thumb zone`);
            changed = true;
          }
        }
      }

      // ── Rule 2: LOW USAGE → fade + shrink (non-essential only) ──────────
      if (!essential && m.sessionCount <= p.lowUsageThreshold && m.usageCount > 5) {
        const newOp   = Math.max(MIN_SECONDARY_OPACITY, btn.opacity - p.opacityShrinkPct);
        const newSize = Math.max(MIN_SECONDARY_SIZE,    btn.size    * (1 - p.sizeShrinkPct));
        if (Math.abs(newOp - btn.opacity) > 0.01 || Math.abs(newSize - btn.size) > 0.5) {
          btn.opacity = newOp;
          btn.size    = newSize;
          reasons.push(`${btn.id}: rarely used → faded`);
          changed = true;
        }
      }

      // ── Rule 3: HIGH MISCLICK RATE → enlarge + space away ───────────────
      if (misclickRate >= p.highMisclickRate && m.usageCount >= 10) {
        const newSize = Math.min(100, btn.size * (1 + p.sizeBoostPct * 1.25));
        if (Math.abs(newSize - btn.size) > 0.5) {
          btn.size = newSize;
          reasons.push(`${btn.id}: misclick rate ${Math.round(misclickRate * 100)}% → enlarged`);
          changed = true;
        }
      }

      // ── Rule 4: SLOW REACTION TIME → move closer to thumb zone ──────────
      if (m.avgReactionTimeMs > p.slowReactionMs && m.reactionSamples >= 5) {
        if (!inThumbZone(btn.x, btn.y)) {
          const zone = nearestThumbZone(btn.x, btn.y);
          const dx   = zone.cx - btn.x;
          const dy   = zone.cy - btn.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 5) {
            const step = p.posNudgePct * 0.8;
            btn.x += (dx / dist) * step;
            btn.y += (dy / dist) * step;
            reasons.push(`${btn.id}: slow reaction → moved closer`);
            changed = true;
          }
        }
      }

      // ── Rule 5: POSITION BOUNDARY CLAMP (safety) ────────────────────────
      btn.x = Math.max(5, Math.min(95, btn.x));
      btn.y = Math.max(5, Math.min(93, btn.y));

      // ── Safety lock ──────────────────────────────────────────────────────
      const clamped = clampEssential(btn);
      if (clamped.size !== btn.size || clamped.opacity !== btn.opacity ||
          clamped.x !== btn.x || clamped.y !== btn.y) {
        Object.assign(btn, clamped);
      }
    }

    if (changed) {
      // Push to history before finalizing
      this._pushHistory(layout);
      this.generation += 1;
      this._save();
    }

    // Reset session counters
    for (const m of this.metrics.values()) m.sessionCount = 0;

    return { layout: newLayout, changed, reasons, generation: this.generation };
  }

  /** Undo the last AI layout change. Returns the previous layout, or null. */
  undo(): HUDLayout | null {
    return this.history.length > 0 ? this.history.pop()! : null;
  }

  get historyDepth(): number { return this.history.length; }
  get gen(): number          { return this.generation; }

  /** Total session presses across all tracked buttons. */
  get totalSessionPresses(): number {
    return Array.from(this.metrics.values()).reduce((s, m) => s + m.sessionCount, 0);
  }

  // ── Storage ────────────────────────────────────────────────────────────────

  private _save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        metrics:    Array.from(this.metrics.entries()),
        generation: this.generation,
      }));
    } catch { /* quota, private mode */ }
  }

  private _load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        metrics:    [string, ButtonMetrics][];
        generation: number;
      };
      this.metrics    = new Map(data.metrics);
      this.generation = data.generation ?? 0;
    } catch { /* ignore */ }
  }

  private _pushHistory(layout: HUDLayout): void {
    this.history.push(cloneLayout(layout));
    if (this.history.length > 10) this.history.shift();
  }

  private _metrics(buttonId: string): ButtonMetrics {
    if (!this.metrics.has(buttonId)) this.metrics.set(buttonId, emptyMetrics(buttonId));
    return this.metrics.get(buttonId)!;
  }
}

// ── Per-game storage keys ─────────────────────────────────────────────────────

export function hudOptimizerStorageKey(gameMode: string): string {
  return `apex:hud-opt:${gameMode}`;
}

// ── Thumb zone helper (exported for overlay drawing) ─────────────────────────

export { THUMB_ZONES, inThumbZone };
export type { ThumbZone };
