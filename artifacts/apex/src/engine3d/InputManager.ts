/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Universal Input Manager               ║
 * ║                                                         ║
 * ║  One input object works on ALL platforms:               ║
 * ║    📱 Mobile  — virtual joystick + swipe look           ║
 * ║    💻 Desktop — WASD + mouse look (pointer lock)        ║
 * ║    🎮 Gamepad — left/right sticks + RT/A/X/Y buttons   ║
 * ║                                                         ║
 * ║  Game logic ONLY reads from this unified input object.  ║
 * ║  No direct device detection in game code.               ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ── Unified input object ──────────────────────────────────────────────────────
//  Every frame the engine calls inputManager.update(), then reads .snapshot.
//  ALL game systems (player, weapons, AI, camera) read ONLY from this object.

export type DeviceType = "mobile" | "desktop" | "controller";

export interface UnifiedInput {
  /** Horizontal movement  −1 (left) → +1 (right) */
  moveX:    number;
  /** Forward/back        −1 (forward) → +1 (back) */
  moveY:    number;
  /** Horizontal camera delta  (accumulated since last update()) */
  lookX:    number;
  /** Vertical camera delta    (accumulated since last update()) */
  lookY:    number;
  /** Shoot / fire — held-state (game debounces single-fire weapons) */
  shoot:    boolean;
  /** Jump key / A button / jump touch button */
  jump:     boolean;
  /** Sprint / Left Shift */
  sprint:   boolean;
  /** Interact / E key / X button / E touch button */
  interact: boolean;
  /** Reload / R key / Y button */
  reload:   boolean;
  /** Crouch / C key / B button */
  crouch:   boolean;
  /** Scope / ADS / Z key / LB button */
  scope:    boolean;
  /** Active device — changes automatically when gamepad is detected */
  deviceType: DeviceType;
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface InputManagerOptions {
  /** Request pointer lock when canvas is clicked (FPS mode) */
  pointerLock?: boolean;
  /** Right-click drag for camera orbit (third-person / open-world mode) */
  rightDragLook?: boolean;
  /** Mouse sensitivity multiplier (default 0.0018) */
  sensitivity?: number;
  /** Controller look speed multiplier (default 4.5) */
  controllerSens?: number;
  /** Dead zone for analog sticks (default 0.12) */
  deadZone?: number;
}

// ── Joystick visual state (read by InputOverlay to animate thumb) ─────────────

export interface JoystickState {
  active: boolean;
  /** -1..1 normalised thumb position */
  dx: number;
  dy: number;
}

// ── InputManager ──────────────────────────────────────────────────────────────

export class InputManager {
  private canvas:  HTMLCanvasElement;
  private opts:    Required<InputManagerOptions>;

  // ── Keyboard ──────────────────────────────────────────────────────────────
  private _keys = new Set<string>();

  // ── Mouse ─────────────────────────────────────────────────────────────────
  private _locked     = false;
  private _mlX        = 0;   // accumulated mouse look X
  private _mlY        = 0;   // accumulated mouse look Y
  private _mouseHeld  = false;

  // ── Touch — left side joystick ────────────────────────────────────────────
  private _joyId:   number | null = null;
  private _joyBase: { x: number; y: number } | null = null;
  private _joyDX   = 0;
  private _joyDY   = 0;

  // ── Touch — right side look swipe ─────────────────────────────────────────
  private _lookId:    number | null = null;
  private _lookPrevX  = 0;
  private _lookPrevY  = 0;
  private _tlX        = 0;   // accumulated touch look X
  private _tlY        = 0;   // accumulated touch look Y

  // ── Button overrides (set by InputOverlay / FPSMobileHUD) ────────────────
  _btnShoot    = false;
  _btnJump     = false;
  _btnInteract = false;
  _btnReload   = false;
  _btnSprint   = false;
  _btnCrouch   = false;
  _btnScope    = false;

  // ── Gyroscope look delta (set by FPSMobileHUD each frame) ─────────────────
  private _gyroLookX = 0;
  private _gyroLookY = 0;

  // ── Gamepad ───────────────────────────────────────────────────────────────
  private _gpMoveX  = 0;
  private _gpMoveY  = 0;
  private _gpLookX  = 0;
  private _gpLookY  = 0;
  private _gpShoot   = false;
  private _gpJump    = false;
  private _gpInteract = false;
  private _gpReload  = false;
  private _gpSprint  = false;
  private _gpCrouch  = false;
  private _gpScope   = false;
  private _gpActive  = false;

  // ── Current snapshot ──────────────────────────────────────────────────────
  private _snap: UnifiedInput;

  // ── Device type ───────────────────────────────────────────────────────────
  private _deviceType: DeviceType;

  // ── Joystick state (public, read by InputOverlay) ─────────────────────────
  readonly joystick: JoystickState = { active: false, dx: 0, dy: 0 };

  // ── Listener cleanup ──────────────────────────────────────────────────────
  private _remove: Array<() => void> = [];

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(canvas: HTMLCanvasElement, options: InputManagerOptions = {}) {
    this.canvas = canvas;
    this.opts   = {
      pointerLock:    options.pointerLock    ?? false,
      rightDragLook:  options.rightDragLook  ?? false,
      sensitivity:    options.sensitivity    ?? 0.0018,
      controllerSens: options.controllerSens ?? 4.5,
      deadZone:       options.deadZone       ?? 0.12,
    };

    this._deviceType = this._detectDevice();

    this._snap = {
      moveX: 0, moveY: 0, lookX: 0, lookY: 0,
      shoot: false, jump: false, sprint: false, interact: false,
      reload: false, crouch: false, scope: false,
      deviceType: this._deviceType,
    };

    this._bindListeners();
  }

  // ── Device detection ──────────────────────────────────────────────────────

  private _detectDevice(): DeviceType {
    const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches;
    const hasTouch      = navigator.maxTouchPoints > 0 || coarsePointer;
    return hasTouch ? "mobile" : "desktop";
  }

  // ── Bind all event listeners ──────────────────────────────────────────────

  private _on<K extends string>(
    target: EventTarget,
    type: K,
    fn: EventListenerOrEventListenerObject,
    opts?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, fn, opts);
    this._remove.push(() => target.removeEventListener(type, fn, opts));
  }

  private _bindListeners(): void {
    const c = this.canvas;
    const w = window;

    // ── Keyboard ────────────────────────────────────────────────────────────
    this._on(w, "keydown", (e: Event) => {
      const ke = e as KeyboardEvent;
      this._keys.add(ke.code);
    });
    this._on(w, "keyup", (e: Event) => {
      this._keys.delete((e as KeyboardEvent).code);
    });

    // ── Mouse ────────────────────────────────────────────────────────────────
    this._on(document, "pointerlockchange", () => {
      this._locked = document.pointerLockElement === c;
    });

    // Right-click drag state (third-person / open-world mode)
    let rdActive = false;
    let rdLastX  = 0;
    let rdLastY  = 0;

    this._on(w, "mousemove", (e: Event) => {
      const me = e as MouseEvent;
      if (this._locked) {
        // Pointer-lock (FPS): use movementX/Y
        this._mlX += me.movementX * this.opts.sensitivity;
        this._mlY += me.movementY * this.opts.sensitivity;
      } else if (this.opts.rightDragLook && rdActive) {
        // Right-drag (third-person): use delta from last position
        this._mlX += (me.clientX - rdLastX) * this.opts.sensitivity;
        this._mlY += (me.clientY - rdLastY) * this.opts.sensitivity;
        rdLastX = me.clientX;
        rdLastY = me.clientY;
      }
    });

    this._on(c, "mousedown", (e: Event) => {
      const me = e as MouseEvent;
      if (me.button === 0) {
        this._mouseHeld = true;
        if (this.opts.pointerLock && !this._locked) {
          c.requestPointerLock?.();
        }
      }
      if (me.button === 2 && this.opts.rightDragLook) {
        rdActive = true;
        rdLastX  = me.clientX;
        rdLastY  = me.clientY;
      }
    });
    this._on(w, "mouseup", (e: Event) => {
      const me = e as MouseEvent;
      if (me.button === 0) this._mouseHeld = false;
      if (me.button === 2) rdActive = false;
    });

    // Suppress context menu in right-drag mode
    if (this.opts.rightDragLook) {
      this._on(c, "contextmenu", (e: Event) => e.preventDefault());
    }

    // ── Touch ────────────────────────────────────────────────────────────────
    const W = () => c.clientWidth || window.innerWidth;

    this._on(c, "touchstart", (e: Event) => {
      const te = e as TouchEvent;
      te.preventDefault();
      for (let i = 0; i < te.changedTouches.length; i++) {
        const t = te.changedTouches[i]!;
        if (t.clientX < W() * 0.5 && this._joyId === null) {
          // Left side → joystick
          this._joyId   = t.identifier;
          this._joyBase = { x: t.clientX, y: t.clientY };
          this._joyDX   = 0;
          this._joyDY   = 0;
        } else if (t.clientX >= W() * 0.5 && this._lookId === null) {
          // Right side → look swipe
          this._lookId    = t.identifier;
          this._lookPrevX = t.clientX;
          this._lookPrevY = t.clientY;
        }
      }
    }, { passive: false } as AddEventListenerOptions);

    this._on(c, "touchmove", (e: Event) => {
      const te = e as TouchEvent;
      te.preventDefault();
      for (let i = 0; i < te.changedTouches.length; i++) {
        const t = te.changedTouches[i]!;
        if (t.identifier === this._joyId && this._joyBase) {
          const JOY_R   = 55;
          const rawX    = (t.clientX - this._joyBase.x) / JOY_R;
          const rawY    = (t.clientY - this._joyBase.y) / JOY_R;
          const len     = Math.hypot(rawX, rawY);
          this._joyDX   = len > 1 ? rawX / len : rawX;
          this._joyDY   = len > 1 ? rawY / len : rawY;
          this.joystick.active = true;
          this.joystick.dx     = this._joyDX;
          this.joystick.dy     = this._joyDY;
        } else if (t.identifier === this._lookId) {
          this._tlX       += (t.clientX - this._lookPrevX) * 0.006;
          this._tlY       += (t.clientY - this._lookPrevY) * 0.006;
          this._lookPrevX  = t.clientX;
          this._lookPrevY  = t.clientY;
        }
      }
    }, { passive: false } as AddEventListenerOptions);

    const clearTouch = (e: Event) => {
      const te = e as TouchEvent;
      for (let i = 0; i < te.changedTouches.length; i++) {
        const t = te.changedTouches[i]!;
        if (t.identifier === this._joyId) {
          this._joyId   = null;
          this._joyBase = null;
          this._joyDX   = 0;
          this._joyDY   = 0;
          this.joystick.active = false;
          this.joystick.dx     = 0;
          this.joystick.dy     = 0;
        }
        if (t.identifier === this._lookId) {
          this._lookId = null;
        }
      }
    };
    this._on(c, "touchend",    clearTouch, { passive: true } as AddEventListenerOptions);
    this._on(c, "touchcancel", clearTouch, { passive: true } as AddEventListenerOptions);

    // Gamepad connect event
    this._on(w, "gamepadconnected", () => { this._gpActive = true; this._deviceType = "controller"; });
    this._on(w, "gamepaddisconnected", () => { this._gpActive = false; });
  }

  // ── Gamepad polling ───────────────────────────────────────────────────────

  private _pollGamepad(): void {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gps.length; i++) {
      const gp = gps[i];
      if (!gp || !gp.connected) continue;

      const DZ = this.opts.deadZone;
      const dz = (v: number) => Math.abs(v) > DZ ? v : 0;
      const CS = this.opts.controllerSens;

      this._gpMoveX   = dz(gp.axes[0] ?? 0);
      this._gpMoveY   = dz(gp.axes[1] ?? 0);
      this._gpLookX   = dz(gp.axes[2] ?? 0) * CS * 0.016;  // per-frame delta approximation
      this._gpLookY   = dz(gp.axes[3] ?? 0) * CS * 0.016;

      this._gpShoot    = (gp.buttons[7]?.pressed  ?? false); // RT
      this._gpJump     = (gp.buttons[0]?.pressed  ?? false); // A
      this._gpInteract = (gp.buttons[2]?.pressed  ?? false); // X
      this._gpReload   = (gp.buttons[3]?.pressed  ?? false); // Y
      this._gpSprint   = (gp.buttons[10]?.pressed ?? false); // L3
      this._gpCrouch   = (gp.buttons[1]?.pressed  ?? false); // B
      this._gpScope    = (gp.buttons[4]?.pressed  ?? false); // LB

      if (!this._gpActive) { this._gpActive = true; this._deviceType = "controller"; }
      break; // use first connected gamepad
    }
  }

  // ── Per-frame update ──────────────────────────────────────────────────────
  //  Call once at the START of each game loop iteration.

  update(): void {
    this._pollGamepad();

    // ── Combine all input sources ──────────────────────────────────────────
    const kMoveX = (this._keys.has("KeyD") || this._keys.has("ArrowRight") ? 1 : 0)
                 - (this._keys.has("KeyA") || this._keys.has("ArrowLeft")  ? 1 : 0);
    const kMoveY = (this._keys.has("KeyS") || this._keys.has("ArrowDown")  ? 1 : 0)
                 - (this._keys.has("KeyW") || this._keys.has("ArrowUp")    ? 1 : 0);

    this._snap = {
      moveX:    Math.max(-1, Math.min(1, kMoveX + this._joyDX + this._gpMoveX)),
      moveY:    Math.max(-1, Math.min(1, kMoveY + this._joyDY + this._gpMoveY)),
      lookX:    this._mlX + this._tlX + this._gpLookX + this._gyroLookX,
      lookY:    this._mlY + this._tlY + this._gpLookY + this._gyroLookY,
      shoot:    this._mouseHeld || this._btnShoot    || this._gpShoot,
      jump:     this._keys.has("Space") || this._btnJump     || this._gpJump,
      sprint:   this._keys.has("ShiftLeft") || this._keys.has("ShiftRight") || this._btnSprint  || this._gpSprint,
      interact: this._keys.has("KeyE")  || this._btnInteract || this._gpInteract,
      reload:   this._keys.has("KeyR")  || this._btnReload   || this._gpReload,
      crouch:   this._keys.has("KeyC")  || this._btnCrouch   || this._gpCrouch,
      scope:    this._keys.has("KeyZ")  || this._btnScope    || this._gpScope,
      deviceType: this._deviceType,
    };

    // ── Clear per-frame deltas ─────────────────────────────────────────────
    this._mlX = this._mlY = 0;
    this._tlX = this._tlY = 0;
    this._gyroLookX = this._gyroLookY = 0;
  }

  // ── Public read API ───────────────────────────────────────────────────────

  /** Current input snapshot — call after update() */
  get snapshot(): Readonly<UnifiedInput> { return this._snap; }

  /** Convenience alias */
  get input(): Readonly<UnifiedInput> { return this._snap; }

  /** Is pointer lock active? (FPS mode) */
  get isPointerLocked(): boolean { return this._locked; }

  /** Active device type */
  get deviceType(): DeviceType { return this._deviceType; }

  /** Synthesised keys Set — backward-compat with systems that read key codes */
  get keys(): Set<string> {
    const s = new Set(this._keys);
    const sn = this._snap;
    if (sn.jump)    s.add("Space");
    if (sn.sprint)  s.add("ShiftLeft");
    if (sn.interact)s.add("KeyE");
    if (sn.reload)  s.add("KeyR");
    return s;
  }

  // ── Button setters (called by InputOverlay React component) ───────────────

  setShoot(held: boolean): void    { this._btnShoot    = held; }
  setJump(held: boolean): void     { this._btnJump     = held; }
  setInteract(held: boolean): void { this._btnInteract = held; }
  setReload(held: boolean): void   { this._btnReload   = held; }
  setSprint(held: boolean): void   { this._btnSprint   = held; }
  setCrouch(held: boolean): void   { this._btnCrouch   = held; }
  setScope(held: boolean): void    { this._btnScope    = held; }

  // ── Joystick setters (called by MobileJoystick overlay component) ─────────

  /**
   * Set joystick delta directly from an overlay React component.
   * dx/dy are in [-1, 1]. Called on every touchmove.
   */
  setJoystick(dx: number, dy: number): void {
    this._joyDX = dx;
    this._joyDY = dy;
    this.joystick.active = true;
    this.joystick.dx     = dx;
    this.joystick.dy     = dy;
    if (this._deviceType !== "mobile") this._deviceType = "mobile";
  }

  /** Reset joystick to centre. Called on touchend/touchcancel. */
  clearJoystick(): void {
    this._joyDX = 0;
    this._joyDY = 0;
    this.joystick.active = false;
    this.joystick.dx     = 0;
    this.joystick.dy     = 0;
  }

  /**
   * Accumulate look delta from a right-side swipe zone.
   * dx/dy are in radians — same unit as mouse look deltas.
   * Called on every touchmove in the look zone.
   */
  addLookDelta(dx: number, dy: number): void {
    this._tlX += dx;
    this._tlY += dy;
    if (this._deviceType !== "mobile") this._deviceType = "mobile";
  }

  /** Called by FPSMobileHUD each frame when gyroscope is enabled.
   *  dx/dy are pre-scaled radians, same unit as mouse lookX/Y deltas. */
  setGyroLook(dx: number, dy: number): void {
    this._gyroLookX += dx;
    this._gyroLookY += dy;
  }

  /** Request pointer lock (FPS) */
  requestLock(): void {
    if (!this._locked) this.canvas.requestPointerLock?.();
  }

  /** Release pointer lock */
  releaseLock(): void {
    if (this._locked) document.exitPointerLock?.();
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  dispose(): void {
    this._remove.forEach((fn) => fn());
    this._remove = [];
    this._keys.clear();
  }
}
