/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Unified Engine Class                  ║
 * ║                                                         ║
 * ║  A single Engine3D instance owns:                       ║
 * ║    • Three.js scene / renderer / camera                 ║
 * ║    • Game loop (requestAnimationFrame)                  ║
 * ║    • Entity manager                                     ║
 * ║    • WorldLoader integration                            ║
 * ║    • System update pipeline                             ║
 * ║                                                         ║
 * ║  Usage:                                                 ║
 * ║    const engine = new Engine3D(canvas);                 ║
 * ║    engine.loadWorld(myWorldConfig);                     ║
 * ║    engine.start();                                      ║
 * ║    // later:                                            ║
 * ║    engine.stop();                                       ║
 * ║    engine.dispose();                                    ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";
import { EntityManager, type Entity, disposeObject } from "./Entity";
import { loadWorld, type WorldConfig, type LoadedWorld, buildDefaultWorldConfig, SAMPLE_WORLDS } from "./WorldLoader";

// ── System interface ──────────────────────────────────────────────────────────
//  External systems (physics, AI, audio) implement this and register with the
//  engine to get a per-frame update call.

export interface EngineSystem {
  name:   string;
  update: (dt: number, engine: Engine3D) => void;
  dispose?(): void;
}

// ── Engine stats ──────────────────────────────────────────────────────────────

export interface EngineStats {
  fps:        number;
  frameCount: number;
  entityCount: number;
  uptime:     number;
}

// ── Engine3D ──────────────────────────────────────────────────────────────────

export class Engine3D {
  // ── Core Three.js objects ─────────────────────────────────────────────────
  readonly scene:    THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly camera:   THREE.PerspectiveCamera;

  // ── Entity layer ──────────────────────────────────────────────────────────
  readonly entities: EntityManager = new EntityManager();

  // ── World reference ───────────────────────────────────────────────────────
  private currentWorld: LoadedWorld | null = null;

  // ── Systems ───────────────────────────────────────────────────────────────
  private systems: EngineSystem[] = [];

  // ── Loop state ────────────────────────────────────────────────────────────
  private running    = false;
  private raf:         number | null = null;
  private lastTime:    number = 0;
  private _frameCount  = 0;
  private _fps         = 0;
  private _fpsAccum    = 0;
  private _fpsFrames   = 0;
  private _startTime:  number = performance.now();

  // ── Event callbacks ───────────────────────────────────────────────────────
  onUpdate?:  (dt: number, stats: EngineStats) => void;
  onResize?:  (width: number, height: number) => void;

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(canvas: HTMLCanvasElement, options: {
    fov?:        number;
    near?:       number;
    far?:        number;
    antialias?:  boolean;
    shadows?:    boolean;
    toneMapping?: THREE.ToneMapping;
    exposure?:   number;
  } = {}) {
    const W = canvas.clientWidth  || canvas.width;
    const H = canvas.clientHeight || canvas.height;

    // Scene
    this.scene            = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a14);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias:        options.antialias ?? true,
      powerPreference:  "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(W, H, false);
    this.renderer.shadowMap.enabled  = options.shadows ?? true;
    this.renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping        = options.toneMapping ?? THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = options.exposure ?? 1.0;

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      options.fov  ?? 75,
      W / H,
      options.near ?? 0.05,
      options.far  ?? 400,
    );
    this.camera.position.set(0, 1.7, 0);

    // Resize
    this._bindResize(canvas);
  }

  // ── World loading ─────────────────────────────────────────────────────────

  /** Load a full WorldConfig into the scene. Replaces any existing world. */
  loadWorld(config: WorldConfig): LoadedWorld {
    this.unloadWorld();
    this.currentWorld = loadWorld(config, this.scene);
    return this.currentWorld;
  }

  /** Load one of the preset sample worlds by key */
  loadSampleWorld(key: string): LoadedWorld {
    const config = SAMPLE_WORLDS[key];
    if (!config) throw new Error(`Unknown sample world: "${key}"`);
    return this.loadWorld(config);
  }

  /** Unload current world, dispose resources */
  unloadWorld(): void {
    if (this.currentWorld) {
      this.currentWorld.dispose();
      this.currentWorld = null;
    }
    this.entities.destroyAll();
  }

  get world(): LoadedWorld | null { return this.currentWorld; }

  // ── System registration ───────────────────────────────────────────────────

  addSystem(system: EngineSystem): this {
    this.systems.push(system);
    return this;
  }

  removeSystem(name: string): void {
    const idx = this.systems.findIndex((s) => s.name === name);
    if (idx >= 0) {
      this.systems[idx]?.dispose?.();
      this.systems.splice(idx, 1);
    }
  }

  // ── Entity helpers ────────────────────────────────────────────────────────

  addEntity<T extends Entity>(e: T): T {
    return this.entities.add(e);
  }

  // ── Game loop ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running  = true;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  private _loop = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this._loop);

    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime  = now;
    this._frameCount++;

    // FPS counter (rolling average over 1s)
    this._fpsAccum  += dt;
    this._fpsFrames += 1;
    if (this._fpsAccum >= 1) {
      this._fps      = this._fpsFrames;
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }

    // Update entities
    this.entities.update(dt);

    // Update registered systems
    for (const sys of this.systems) sys.update(dt, this);

    // User callback
    this.onUpdate?.(dt, this.stats);

    // Render
    this.renderer.render(this.scene, this.camera);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  get stats(): EngineStats {
    return {
      fps:         this._fps,
      frameCount:  this._frameCount,
      entityCount: this.entities.count,
      uptime:      (performance.now() - this._startTime) / 1000,
    };
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  private _resizeHandler: (() => void) | null = null;

  private _bindResize(canvas: HTMLCanvasElement): void {
    const handler = () => {
      const W = canvas.clientWidth  || window.innerWidth;
      const H = canvas.clientHeight || window.innerHeight;
      this.renderer.setSize(W, H, false);
      this.camera.aspect = W / H;
      this.camera.updateProjectionMatrix();
      this.onResize?.(W, H);
    };
    window.addEventListener("resize", handler);
    this._resizeHandler = handler;
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  dispose(): void {
    this.stop();
    this.unloadWorld();
    for (const sys of this.systems) sys.dispose?.();
    this.systems = [];
    if (this._resizeHandler) window.removeEventListener("resize", this._resizeHandler);

    // Dispose all Three.js objects in scene
    this.scene.traverse((child) => disposeObject(child));
    this.renderer.dispose();
  }

  // ── Utility: build a default world config ─────────────────────────────────

  static defaultWorld(name: string, mode: WorldConfig["mode"] = "fps"): WorldConfig {
    return buildDefaultWorldConfig(name, mode);
  }

  // ── Utility: create a full engine + load world in one call ────────────────

  static create(canvas: HTMLCanvasElement, config?: WorldConfig): Engine3D {
    const engine = new Engine3D(canvas);
    if (config) engine.loadWorld(config);
    return engine;
  }
}

// ── Built-in systems ──────────────────────────────────────────────────────────

/** Physics system: applies gravity and floor clamp to any entity with
 *  a `velocity` property and updates its `position`. */
export class PhysicsSystem implements EngineSystem {
  readonly name = "physics";
  private gravity: number;

  constructor(gravity = -20) {
    this.gravity = gravity;
  }

  update(dt: number, engine: Engine3D): void {
    for (const entity of (engine.entities as any).entities.values() as IterableIterator<any>) {
      if (!entity.alive || !entity.velocity) continue;
      entity.velocity.y += this.gravity * dt;
      entity.position.addScaledVector(entity.velocity, dt);

      // Floor clamp
      if (entity.position.y < 0) {
        entity.position.y = 0;
        entity.velocity.y = 0;
      }

      entity.syncTransform?.();
    }
  }
}

/** Debug axes helper */
export class AxesSystem implements EngineSystem {
  readonly name = "axes";
  private helper: THREE.AxesHelper;

  constructor(size = 3) {
    this.helper = new THREE.AxesHelper(size);
  }

  update(_dt: number, engine: Engine3D): void {
    if (!engine.scene.getObjectById(this.helper.id)) {
      engine.scene.add(this.helper);
    }
  }

  dispose(): void { this.helper.removeFromParent(); }
}
