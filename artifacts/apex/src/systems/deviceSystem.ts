/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX SYSTEMS — Device Detection System                 ║
 * ║                                                         ║
 * ║  Call detectDevice() once at game startup.              ║
 * ║  Returns controlMode + graphicsLevel + full perf data.  ║
 * ║                                                         ║
 * ║  controlMode: "mobile" | "desktop"                      ║
 * ║  graphicsLevel: "low" | "medium" | "high"               ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { detectPerfSettings, type PerfSettings, type QualityLevel } from "@/engine3d/PerfManager";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ControlMode = "mobile" | "desktop";

export interface DeviceProfile {
  /** Input mode — drives which controls are shown */
  controlMode:   ControlMode;
  /** Starting graphics quality tier */
  graphicsLevel: QualityLevel;
  /** Full perf bundle — pixel ratio, shadow config, NPC limits, etc. */
  perfSettings:  PerfSettings;
  /** True for touch/coarse-pointer devices */
  isMobile:      boolean;
  /** Current viewport width in pixels */
  screenWidth:   number;
  /** True when devicePixelRatio >= 2 (retina / high-DPI) */
  isHighDPI:     boolean;
}

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Detect device capabilities and return a full DeviceProfile.
 *
 * Uses:
 *  - CSS `pointer: coarse` media query to distinguish touch vs mouse
 *  - `navigator.maxTouchPoints` as a fallback
 *  - `navigator.hardwareConcurrency` + `deviceMemory` for quality tier
 *  - `window.devicePixelRatio` for DPI awareness
 *
 * ─── Tweak graphicsLevel overrides here ─────────────────────────────────────
 *  Force mobile to low:   return { ...profile, graphicsLevel: "low" }
 *  Force desktop to high: return { ...profile, graphicsLevel: "high" }
 */
export function detectDevice(): DeviceProfile {
  if (typeof window === "undefined") {
    return {
      controlMode:   "desktop",
      graphicsLevel: "medium",
      perfSettings:  detectPerfSettings(),
      isMobile:      false,
      screenWidth:   1280,
      isHighDPI:     false,
    };
  }

  const perfSettings  = detectPerfSettings();
  const isMobile      = perfSettings.isMobile;
  const controlMode: ControlMode = isMobile ? "mobile" : "desktop";
  const graphicsLevel = perfSettings.quality;
  const screenWidth   = window.innerWidth;
  const isHighDPI     = window.devicePixelRatio >= 2;

  return {
    controlMode,
    graphicsLevel,
    perfSettings,
    isMobile,
    screenWidth,
    isHighDPI,
  };
}

// ── Convenience re-exports from PerfManager ───────────────────────────────────

export type { PerfSettings, QualityLevel } from "@/engine3d/PerfManager";
export { PERF_PRESETS } from "@/engine3d/PerfManager";
