/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — Universal Input Abstraction Layer            ║
 * ║                                                             ║
 * ║  One API for keyboard, mouse, touch, and gamepad.          ║
 * ║  Game logic reads a single UnifiedInput snapshot every     ║
 * ║  frame — no direct device detection needed.                ║
 * ║                                                             ║
 * ║  Usage:                                                     ║
 * ║    import { initInput, getInput } from "@/apex-engine/input"; ║
 * ║    const inputCtrl = initInput(canvas);               ║
 * ║    // each frame:                                          ║
 * ║    const { moveX, moveY, jump, shoot } = getInput();       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import {
  InputManager,
  type UnifiedInput,
  type InputManagerOptions,
  type DeviceType,
  type JoystickState,
} from "@/engine3d/InputManager";

// ── Re-export types for consumers ─────────────────────────────────────────────

export type { UnifiedInput, InputManagerOptions, DeviceType, JoystickState };

// ── InputController — the returned control object ─────────────────────────────

export interface InputController {
  /** The underlying InputManager (for advanced access) */
  readonly manager: InputManager;

  /**
   * Call once per frame BEFORE reading input.
   * Flushes look-delta accumulators and polls gamepad.
   */
  update: () => void;

  /**
   * Current input snapshot.
   * Read after calling update() each frame.
   */
  getInput: () => Readonly<UnifiedInput>;

  /** Active device type: "desktop" | "mobile" | "controller" */
  readonly deviceType: DeviceType;

  /** Current virtual joystick state (for rendering the joystick overlay) */
  readonly joystick: JoystickState;

  /** Whether pointer lock is active (FPS mode) */
  readonly isPointerLocked: boolean;

  // ── Button injectors (for virtual on-screen controls) ──────────────────────
  setShoot:    (held: boolean) => void;
  setJump:     (held: boolean) => void;
  setSprint:   (held: boolean) => void;
  setInteract: (held: boolean) => void;
  setReload:   (held: boolean) => void;
  setCrouch:   (held: boolean) => void;
  setScope:    (held: boolean) => void;

  /** Set joystick position from a virtual overlay (-1..1) */
  setJoystick:   (dx: number, dy: number) => void;
  /** Reset joystick to centre (call on touch end) */
  clearJoystick: () => void;

  /** Add a look delta from a swipe zone (radians) */
  addLookDelta: (dx: number, dy: number) => void;

  /** Inject gyroscope look delta (radians, called by FPSMobileHUD) */
  setGyroLook: (dx: number, dy: number) => void;

  /** Request pointer lock (FPS mode) */
  requestLock: () => void;
  /** Release pointer lock */
  releaseLock: () => void;

  /** Subscribe to per-frame input. Returns an unsubscribe fn. */
  listen: (callback: (input: Readonly<UnifiedInput>) => void) => () => void;

  /** Free all event listeners */
  dispose: () => void;
}

// ── Module-level singleton ─────────────────────────────────────────────────────

let _ctrl: InputController | null = null;

// ── initInput ─────────────────────────────────────────────────────────────────
//
//  Create an InputController bound to the given canvas.
//  Automatically disposes any previous instance.

export function initInput(
  canvas: HTMLCanvasElement,
  options: InputManagerOptions = {},
): InputController {
  // Clean up previous
  _ctrl?.dispose();

  const mgr = new InputManager(canvas, options);
  const listeners = new Set<(input: Readonly<UnifiedInput>) => void>();

  const ctrl: InputController = {
    get manager()          { return mgr; },
    update()               {
      mgr.update();
      if (listeners.size > 0) {
        const snap = mgr.snapshot;
        for (const cb of listeners) cb(snap);
      }
    },
    getInput()             { return mgr.snapshot; },
    get deviceType()       { return mgr.deviceType; },
    get joystick()         { return mgr.joystick; },
    get isPointerLocked()  { return mgr.isPointerLocked; },

    setShoot:    (h) => mgr.setShoot(h),
    setJump:     (h) => mgr.setJump(h),
    setSprint:   (h) => mgr.setSprint(h),
    setInteract: (h) => mgr.setInteract(h),
    setReload:   (h) => mgr.setReload(h),
    setCrouch:   (h) => mgr.setCrouch(h),
    setScope:    (h) => mgr.setScope(h),

    setJoystick:   (dx, dy) => mgr.setJoystick(dx, dy),
    clearJoystick: ()        => mgr.clearJoystick(),
    addLookDelta:  (dx, dy) => mgr.addLookDelta(dx, dy),
    setGyroLook:   (dx, dy) => mgr.setGyroLook(dx, dy),

    requestLock: () => mgr.requestLock(),
    releaseLock: () => mgr.releaseLock(),

    listen(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    dispose() {
      mgr.dispose();
      listeners.clear();
      if (_ctrl === ctrl) _ctrl = null;
    },
  };

  _ctrl = ctrl;
  return ctrl;
}

// ── getInput ──────────────────────────────────────────────────────────────────
//
//  Read the current input snapshot from the active InputController.
//  Returns a zeroed snapshot if no InputController is active.

export function getInput(): Readonly<UnifiedInput> {
  return _ctrl?.getInput() ?? ZERO_INPUT;
}

// ── getController ─────────────────────────────────────────────────────────────
//
//  Access the active InputController (or null).

export function getController(): InputController | null {
  return _ctrl;
}

// ── destroyInput ──────────────────────────────────────────────────────────────
//
//  Dispose the active InputController and free all event listeners.

export function destroyInput(): void {
  _ctrl?.dispose();
  _ctrl = null;
}

// ── simulateButton ────────────────────────────────────────────────────────────
//
//  Inject a virtual button press into the active input controller.
//  Useful for automated tests or tutorial sequences.

export type ButtonName = "shoot" | "jump" | "sprint" | "interact" | "reload" | "crouch" | "scope";

export function simulateButton(button: ButtonName, held: boolean): void {
  if (!_ctrl) return;
  const map: Record<ButtonName, (h: boolean) => void> = {
    shoot:    _ctrl.setShoot,
    jump:     _ctrl.setJump,
    sprint:   _ctrl.setSprint,
    interact: _ctrl.setInteract,
    reload:   _ctrl.setReload,
    crouch:   _ctrl.setCrouch,
    scope:    _ctrl.setScope,
  };
  map[button]?.(held);
}

// ── Zero input snapshot (fallback when no controller is active) ───────────────

const ZERO_INPUT: Readonly<UnifiedInput> = Object.freeze({
  moveX:    0,
  moveY:    0,
  lookX:    0,
  lookY:    0,
  shoot:    false,
  jump:     false,
  sprint:   false,
  interact: false,
  reload:   false,
  crouch:   false,
  scope:    false,
  deviceType: "desktop" as DeviceType,
});
