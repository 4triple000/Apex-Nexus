/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Universal Entity System               ║
 * ║  Base interface + abstract class for ALL game objects   ║
 * ║                                                         ║
 * ║  Entity types:                                          ║
 * ║    player · enemy · npc · prop · trigger · pickup       ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";

// ── Entity Types ──────────────────────────────────────────────────────────────

export type EntityType = "player" | "enemy" | "npc" | "prop" | "trigger" | "pickup";
export type EntityState = "idle" | "active" | "destroyed";

// ── Core Entity Interface ─────────────────────────────────────────────────────
//  Every game object in Apex Engine 3D implements this interface.
//  The engine's update loop calls update() on every live entity each frame.

export interface Entity {
  readonly id:   string;
  readonly type: EntityType;

  position: THREE.Vector3;
  rotation: THREE.Euler;
  state:    EntityState;

  /** Called every frame by the engine loop. dt = seconds since last frame */
  update(dt: number): void;

  /** Remove from scene + free GPU resources */
  destroy(): void;

  /** True while the entity has not been destroyed */
  readonly alive: boolean;
}

// ── Base Entity (abstract) ────────────────────────────────────────────────────
//  Extend this class for any concrete entity to get lifecycle management,
//  scene wiring, and mesh handling for free.

export abstract class BaseEntity implements Entity {
  readonly id:    string;
  abstract readonly type: EntityType;

  position: THREE.Vector3;
  rotation: THREE.Euler;
  state:    EntityState = "idle";

  protected scene:   THREE.Scene;
  protected mesh:    THREE.Object3D | null = null;
  protected _alive   = true;

  /** Public read accessor for the root Three.js object */
  get rootObject(): THREE.Object3D | null { return this.mesh; }

  constructor(id: string, scene: THREE.Scene, position = new THREE.Vector3()) {
    this.id       = id;
    this.scene    = scene;
    this.position = position.clone();
    this.rotation = new THREE.Euler();
  }

  /** Subclasses must implement per-frame logic */
  abstract update(dt: number): void;

  /** Subclasses can override to add extra cleanup — call super.destroy() last */
  destroy(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      disposeObject(this.mesh);
      this.mesh = null;
    }
    this._alive = false;
    this.state  = "destroyed";
  }

  get alive(): boolean { return this._alive; }

  /** Sync mesh transform with position / rotation */
  protected syncTransform(): void {
    if (!this.mesh) return;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.copy(this.rotation);
  }

  /** Add mesh to scene and record reference */
  protected addMesh(obj: THREE.Object3D): void {
    this.mesh = obj;
    this.scene.add(obj);
  }
}

// ── PropEntity — static scene object (building, box, wall) ───────────────────

export class PropEntity extends BaseEntity {
  readonly type = "prop" as const;

  constructor(
    id:       string,
    scene:    THREE.Scene,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: THREE.Vector3,
    scale    = new THREE.Vector3(1, 1, 1),
  ) {
    super(id, scene, position);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.scale.copy(scale);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    this.addMesh(mesh);
  }

  update(_dt: number): void { /* static — no-op */ }
}

// ── PickupEntity — collectable item ──────────────────────────────────────────

export class PickupEntity extends BaseEntity {
  readonly type = "pickup" as const;
  private bobTime = 0;

  constructor(
    id:       string,
    scene:    THREE.Scene,
    position: THREE.Vector3,
    color    = 0xffdd00,
  ) {
    super(id, scene, position);
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.copy(position);
    this.addMesh(mesh);
  }

  update(dt: number): void {
    if (!this.mesh || !this._alive) return;
    this.bobTime += dt;
    this.mesh.rotation.y  += dt * 2.2;
    this.mesh.position.y   = this.position.y + Math.sin(this.bobTime * 2) * 0.18;
  }
}

// ── TriggerEntity — invisible volume that fires callback ─────────────────────

export interface TriggerOptions {
  radius:   number;
  onEnter?: (entity: Entity) => void;
  onExit?:  (entity: Entity) => void;
  once?:    boolean;
}

export class TriggerEntity extends BaseEntity {
  readonly type = "trigger" as const;
  private opts:    TriggerOptions;
  private inside   = new Set<string>();
  private fired    = false;

  constructor(
    id:      string,
    scene:   THREE.Scene,
    position: THREE.Vector3,
    opts:    TriggerOptions,
  ) {
    super(id, scene, position);
    this.opts = opts;

    // Debug visualizer (transparent cylinder)
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(opts.radius, opts.radius, 0.2, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.12, depthWrite: false }),
    );
    mesh.position.copy(position);
    this.addMesh(mesh);
  }

  update(_dt: number): void { /* checked externally via checkTriggers() */ }

  /** Call from EntityManager each frame, pass list of nearby entities */
  check(candidates: Entity[]): void {
    if (!this._alive) return;
    if (this.opts.once && this.fired) return;

    for (const e of candidates) {
      const dist = e.position.distanceTo(this.position);
      const wasInside = this.inside.has(e.id);

      if (dist <= this.opts.radius && !wasInside) {
        this.inside.add(e.id);
        this.opts.onEnter?.(e);
        this.fired = true;
      } else if (dist > this.opts.radius && wasInside) {
        this.inside.delete(e.id);
        this.opts.onExit?.(e);
      }
    }
  }
}

// ── EntityManager — owns + updates all entities ───────────────────────────────

export class EntityManager {
  private entities = new Map<string, Entity>();

  add<T extends Entity>(e: T): T {
    this.entities.set(e.id, e);
    return e;
  }

  get<T extends Entity>(id: string): T | undefined {
    return this.entities.get(id) as T | undefined;
  }

  getByType<T extends Entity>(type: EntityType): T[] {
    const out: T[] = [];
    for (const e of this.entities.values()) {
      if (e.type === type) out.push(e as T);
    }
    return out;
  }

  update(dt: number): void {
    for (const e of this.entities.values()) {
      if (e.alive) e.update(dt);
      else         this.entities.delete(e.id);
    }
  }

  destroy(id: string): void {
    this.entities.get(id)?.destroy();
    this.entities.delete(id);
  }

  destroyAll(): void {
    for (const e of this.entities.values()) e.destroy();
    this.entities.clear();
  }

  get count(): number { return this.entities.size; }
}

// ── Utility: deep dispose of Three.js object ─────────────────────────────────

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => (m as THREE.Material)?.dispose());
    }
  });
}
