/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — Renderer                                     ║
 * ║                                                             ║
 * ║  Attaches the 3D game engine to any DOM container.         ║
 * ║  Handles canvas creation, resize, fullscreen, and stats.   ║
 * ║                                                             ║
 * ║  Usage:                                                     ║
 * ║    import { attachRenderer, detachRenderer }               ║
 * ║      from "@/apex-engine/renderer";                        ║
 * ║                                                             ║
 * ║    const api = attachRenderer(document.getElementById("g")); ║
 * ║    api.start();                                            ║
 * ║    // later:                                               ║
 * ║    detachRenderer();                                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { Engine3D }                  from "@/engine3d/Engine";
import type { EngineStats }          from "@/engine3d/Engine";
import type { WorldConfig }          from "@/engine3d/WorldLoader";

// ── Types ─────────────────────────────────────────────────────────────────────

export type { EngineStats };

export interface RendererOptions {
  /** Field of view in degrees (default 75) */
  fov?:       number;
  /** Near clipping plane (default 0.05) */
  near?:      number;
  /** Far clipping plane (default 400) */
  far?:       number;
  /** Enable anti-aliasing (default true) */
  antialias?: boolean;
  /** Enable shadow maps (default true) */
  shadows?:   boolean;
  /** Pixel ratio cap — higher = sharper but slower (default min(devicePixelRatio, 2)) */
  pixelRatio?: number;
  /** Called every frame with live engine stats */
  onStats?:   (stats: EngineStats) => void;
  /** Called when the container is resized */
  onResize?:  (w: number, h: number) => void;
}

export interface RendererAPI {
  /** The underlying Engine3D instance */
  engine: Engine3D;
  /** The <canvas> element that was created inside the container */
  canvas: HTMLCanvasElement;
  /** Start the render loop */
  start: () => void;
  /** Stop the render loop (does not dispose) */
  stop: () => void;
  /** Load a 3D world config into the scene */
  loadWorld: (config: WorldConfig) => void;
  /** Enter or exit fullscreen on the container */
  setFullscreen: (enabled: boolean) => Promise<void>;
  /** Toggle fullscreen */
  toggleFullscreen: () => Promise<void>;
  /** Whether fullscreen is currently active */
  readonly isFullscreen: boolean;
  /** Current engine stats (fps, entity count, uptime) */
  readonly stats: EngineStats;
  /** Dispose all resources and remove the canvas */
  dispose: () => void;
}

// ── Module-level singleton ────────────────────────────────────────────────────

let _activeAPI: RendererAPI | null = null;

// ── attachRenderer ────────────────────────────────────────────────────────────
//
//  Creates a <canvas> inside `container`, instantiates Engine3D,
//  and returns a control object. The container can be any element
//  (div, section, the document body, etc.).
//
//  Calling attachRenderer() again automatically detaches the previous one.

export function attachRenderer(
  container: HTMLElement,
  options: RendererOptions = {},
): RendererAPI {
  // Detach any existing renderer first
  if (_activeAPI) _activeAPI.dispose();

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.style.cssText = [
    "position:absolute",
    "top:0",
    "left:0",
    "width:100%",
    "height:100%",
    "display:block",
    "outline:none",
  ].join(";");

  // Make container position relative so the canvas fills it
  const prevPos = container.style.position;
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  container.appendChild(canvas);

  // Size the canvas to match the container
  const W = container.clientWidth  || window.innerWidth;
  const H = container.clientHeight || window.innerHeight;
  canvas.width  = W;
  canvas.height = H;

  // Build Engine3D
  const engine = new Engine3D(canvas, {
    fov:       options.fov       ?? 75,
    near:      options.near      ?? 0.05,
    far:       options.far       ?? 400,
    antialias: options.antialias ?? true,
    shadows:   options.shadows   ?? true,
  });

  if (options.pixelRatio !== undefined) {
    engine.renderer.setPixelRatio(options.pixelRatio);
  }

  // Wire up stats + resize callbacks
  engine.onUpdate = (_dt, stats) => options.onStats?.(stats);
  engine.onResize = options.onResize ?? (() => {});

  // Fullscreen tracking
  let _isFullscreen = false;
  const fsChange = () => {
    _isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
  };
  document.addEventListener("fullscreenchange", fsChange);
  document.addEventListener("webkitfullscreenchange", fsChange);

  // Container resize observer
  let _ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    _ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      canvas.width  = Math.round(width);
      canvas.height = Math.round(height);
    });
    _ro.observe(container);
  }

  const api: RendererAPI = {
    engine,
    canvas,

    start() { engine.start(); },
    stop()  { engine.stop();  },

    loadWorld(config: WorldConfig) {
      engine.loadWorld(config);
    },

    async setFullscreen(enabled: boolean) {
      if (enabled) {
        try {
          if (container.requestFullscreen)           await container.requestFullscreen();
          else if ((container as any).webkitRequestFullscreen) (container as any).webkitRequestFullscreen();
        } catch { /* permission denied */ }
      } else {
        try {
          if (document.exitFullscreen)               await document.exitFullscreen();
          else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
        } catch { /* ignore */ }
      }
    },

    async toggleFullscreen() {
      await api.setFullscreen(!_isFullscreen);
    },

    get isFullscreen() { return _isFullscreen; },
    get stats()        { return engine.stats; },

    dispose() {
      engine.dispose();
      _ro?.disconnect();
      document.removeEventListener("fullscreenchange", fsChange);
      document.removeEventListener("webkitfullscreenchange", fsChange);
      if (canvas.parentNode === container) container.removeChild(canvas);
      if (prevPos !== container.style.position) container.style.position = prevPos;
      _activeAPI = null;
    },
  };

  _activeAPI = api;
  return api;
}

// ── detachRenderer ────────────────────────────────────────────────────────────
//
//  Dispose the current renderer and remove the canvas from its container.

export function detachRenderer(): void {
  _activeAPI?.dispose();
  _activeAPI = null;
}

// ── getRenderer ───────────────────────────────────────────────────────────────
//
//  Access the current active RendererAPI (or null if none is attached).

export function getRenderer(): RendererAPI | null {
  return _activeAPI;
}

// ── getStats ──────────────────────────────────────────────────────────────────
//
//  Convenience: read current engine stats without holding a reference.

export function getStats(): EngineStats | null {
  return _activeAPI?.stats ?? null;
}
