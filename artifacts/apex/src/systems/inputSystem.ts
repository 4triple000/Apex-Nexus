/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX SYSTEMS — Input Abstraction Layer                 ║
 * ║                                                         ║
 * ║  Wraps InputManager with a clean three-method API:      ║
 * ║    getMoveInput()  → { x, y, sprint, crouch, jump }     ║
 * ║    getLookInput()  → { x, y, scope }                    ║
 * ║    getShootInput() → { shoot, reload, interact }        ║
 * ║                                                         ║
 * ║  Game logic never needs to know about keyboard / touch  ║
 * ║  / gamepad — it just reads from these three calls.      ║
 * ║                                                         ║
 * ║  ─── Sensitivity tuning ────────────────────────────── ║
 * ║  Edit SENSITIVITY below to adjust feel per platform:    ║
 * ║    mouseLook      — desktop pointer-lock sensitivity    ║
 * ║    touchLook      — mobile swipe-look sensitivity       ║
 * ║    controllerLook — gamepad right-stick multiplier      ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import {
  InputManager,
  type UnifiedInput,
  type InputManagerOptions,
  type DeviceType,
  type JoystickState,
} from "@/engine3d/InputManager";

// ── Sensitivity constants ─────────────────────────────────────────────────────
//  These are the single source-of-truth for all per-platform feel.
//  Increase mouseLook for a faster desktop aim, decrease touchLook for
//  a more precise mobile swipe.

export const SENSITIVITY = {
  /** Desktop: radians added per pixel of mouse movement. Default = 0.0018.
   *  Higher = faster, lower = more precise.  Typical range: 0.0008–0.004 */
  mouseLook:      0.0018,

  /** Mobile: radians added per pixel of swipe distance. Default = 0.006.
   *  Higher = faster swipe look. Typical range: 0.003–0.012 */
  touchLook:      0.006,

  /** Gamepad: multiplier on right-stick axis (speed per second). Default = 4.5.
   *  Higher = faster controller aim. Typical range: 2–8 */
  controllerLook: 4.5,

  /** Analog stick dead zone (0–1). Values below this are ignored. Default = 0.12 */
  deadZone:       0.12,
} as const;

// ── Per-input type result shapes ──────────────────────────────────────────────

export interface MoveInput {
  /** Horizontal axis  −1 (left) → +1 (right) */
  x:       number;
  /** Forward/back     −1 (forward) → +1 (back) */
  y:       number;
  sprint:  boolean;
  crouch:  boolean;
  jump:    boolean;
}

export interface LookInput {
  /** Horizontal camera delta in radians (accumulated since last update) */
  x:     number;
  /** Vertical camera delta in radians (accumulated since last update) */
  y:     number;
  scope: boolean;
}

export interface ShootInput {
  shoot:    boolean;
  reload:   boolean;
  interact: boolean;
}

// ── InputSystem ───────────────────────────────────────────────────────────────

export class InputSystem {
  private _mgr: InputManager;

  /**
   * @param canvas  The game canvas element — used for pointer lock + touch tracking.
   * @param options Optional overrides.  Sensitivity defaults come from SENSITIVITY above.
   */
  constructor(canvas: HTMLCanvasElement, options: InputManagerOptions = {}) {
    this._mgr = new InputManager(canvas, {
      sensitivity:    SENSITIVITY.mouseLook,
      controllerSens: SENSITIVITY.controllerLook,
      deadZone:       SENSITIVITY.deadZone,
      ...options,
    });
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  /** Call once at the start of each game frame before reading inputs. */
  update(): void {
    this._mgr.update();
  }

  // ── The three-method abstraction API ──────────────────────────────────────

  /** Movement axes + action buttons. Platform-agnostic. */
  getMoveInput(): MoveInput {
    const s = this._mgr.snapshot;
    return {
      x:      s.moveX,
      y:      s.moveY,
      sprint: s.sprint,
      crouch: s.crouch,
      jump:   s.jump,
    };
  }

  /** Camera look deltas in radians. Merged from mouse / swipe / gyro / gamepad. */
  getLookInput(): LookInput {
    const s = this._mgr.snapshot;
    return {
      x:     s.lookX,
      y:     s.lookY,
      scope: s.scope,
    };
  }

  /** Firing + secondary actions. Platform-agnostic. */
  getShootInput(): ShootInput {
    const s = this._mgr.snapshot;
    return {
      shoot:    s.shoot,
      reload:   s.reload,
      interact: s.interact,
    };
  }

  // ── Pass-through helpers ───────────────────────────────────────────────────

  /** Full raw snapshot for advanced consumers (CombatFeel, aim assist, etc.) */
  get snapshot(): Readonly<UnifiedInput> { return this._mgr.snapshot; }

  /** Direct access to the underlying InputManager (HUD buttons, gyro, etc.) */
  get manager(): InputManager { return this._mgr; }

  /** Active device type — changes automatically when gamepad is plugged in. */
  get deviceType(): DeviceType { return this._mgr.deviceType; }

  /** True when pointer lock is active (FPS desktop mode). */
  get isPointerLocked(): boolean { return this._mgr.isPointerLocked; }

  /** Live joystick state — read by mobile HUD to animate the thumb. */
  get joystick(): JoystickState { return this._mgr.joystick; }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  dispose(): void { this._mgr.dispose(); }
}
