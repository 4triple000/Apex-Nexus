/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Combat Feel Systems v2                    ║
 * ║                                                             ║
 * ║  RecoilSystem    — pattern-based vertical/horizontal spring ║
 * ║  AimAssistV2     — 3-layer: slowdown + magnet + rotation    ║
 * ║  InputBuffer     — 4-frame shoot/jump buffer                ║
 * ║  ScreenShake     — landing impact + hit micro-shake         ║
 * ║  AudioSystem     — Web Audio synthesizer, zero asset files  ║
 * ║  DamageNumber    — floating damage pop                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";

// ══════════════════════════════════════════════════════════════════════════════
// ── Recoil System v2 — Pattern-based spray ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
//
//  Each weapon has a deterministic spray PATTERN (like Valorant/CS2).
//  While firing, each shot follows the pattern in order. When the player
//  stops firing for `resetTimeSec`, the pattern resets to shot 0.
//  The spring system from v1 still returns the camera offset to 0.

export interface RecoilProfile {
  /** Base vertical kick per shot (radians upward). Used when no pattern. */
  kickV:      number;
  /** Base horizontal spread (radians, random ±). Used when no pattern. */
  kickH:      number;
  /** Spring constant — how fast recoil returns to 0 (higher = snappier) */
  recovery:   number;
  /** Damping — < 1 prevents overshoot */
  damping:    number;
  /** Max accumulated vertical recoil (radians) */
  maxV:       number;
}

export const WEAPON_RECOIL: Record<string, RecoilProfile> = {
  pistol:  { kickV: 0.022, kickH: 0.010, recovery: 14, damping: 0.74, maxV: 0.18 },
  rifle:   { kickV: 0.018, kickH: 0.007, recovery: 12, damping: 0.70, maxV: 0.28 },
  shotgun: { kickV: 0.055, kickH: 0.030, recovery: 9,  damping: 0.65, maxV: 0.35 },
  sniper:  { kickV: 0.085, kickH: 0.005, recovery: 7,  damping: 0.72, maxV: 0.40 },
};

// ── Pattern types ─────────────────────────────────────────────────────────────

export interface RecoilPatternPoint {
  v: number;   // vertical kick this shot (radians, positive = camera moves up = harder to control)
  h: number;   // horizontal kick this shot (radians, positive = right)
}

export interface RecoilPattern {
  /** Per-shot kick offsets. Loops when shotIndex >= pts.length. */
  pts:          RecoilPatternPoint[];
  /** Seconds after last shot before spray pattern resets to index 0. */
  resetTimeSec: number;
}

/**
 * Per-weapon spray patterns.
 *
 * Pistol  — 6-shot: tight vertical + slight rightward drift
 * Rifle   — 12-shot: vertical rise, pulls right mid-spray, corrects left
 * Shotgun — 3-shot: heavy alternating kick
 * Sniper  — 1-shot: pure vertical
 */
export const WEAPON_PATTERNS: Record<string, RecoilPattern> = {
  pistol: {
    resetTimeSec: 0.80,
    pts: [
      { v: 0.022, h:  0.000 },
      { v: 0.022, h:  0.004 },
      { v: 0.021, h:  0.006 },
      { v: 0.020, h: -0.003 },
      { v: 0.019, h:  0.000 },
      { v: 0.018, h: -0.005 },
    ],
  },
  rifle: {
    resetTimeSec: 1.20,
    pts: [
      { v: 0.014, h:  0.000 },
      { v: 0.016, h:  0.003 },
      { v: 0.018, h:  0.005 },
      { v: 0.018, h:  0.008 },
      { v: 0.017, h:  0.010 },
      { v: 0.016, h:  0.010 },
      { v: 0.016, h:  0.008 },
      { v: 0.015, h:  0.005 },
      { v: 0.014, h:  0.001 },
      { v: 0.014, h: -0.004 },
      { v: 0.013, h: -0.006 },
      { v: 0.013, h:  0.000 },
    ],
  },
  shotgun: {
    resetTimeSec: 0.50,
    pts: [
      { v: 0.055, h: -0.022 },
      { v: 0.050, h:  0.028 },
      { v: 0.048, h: -0.012 },
    ],
  },
  sniper: {
    resetTimeSec: 0.25,
    pts: [
      { v: 0.085, h: 0.000 },
    ],
  },
};

// ── RecoilState (v2 — adds pattern tracking) ──────────────────────────────────

export interface RecoilState {
  pitchOffset: number;
  yawOffset:   number;
  pitchVel:    number;
  yawVel:      number;
  /** Which pattern point fires next */
  shotIndex:   number;
  /** performance.now() timestamp of the last fired shot */
  lastFireTs:  number;
}

export function createRecoilState(): RecoilState {
  return { pitchOffset: 0, yawOffset: 0, pitchVel: 0, yawVel: 0, shotIndex: 0, lastFireTs: 0 };
}

// ── Legacy kick (random jitter — kept for backward compat) ────────────────────
/** @deprecated Use applyPatternRecoilKick instead */
export function applyRecoilKick(state: RecoilState, profile: RecoilProfile): void {
  state.pitchVel -= profile.kickV;
  const hJitter = (Math.random() - 0.5) * 2 * profile.kickH;
  state.yawVel  += hJitter;
  if (Math.abs(state.pitchOffset) < profile.maxV) {
    state.pitchOffset = Math.max(-profile.maxV, state.pitchOffset + state.pitchVel * 0.016);
  }
}

/**
 * Pattern-based recoil kick.
 * Reads `pattern.pts[state.shotIndex % pts.length]` for deterministic kick.
 * Increments shotIndex and stamps lastFireTs.
 */
export function applyPatternRecoilKick(
  state:   RecoilState,
  profile: RecoilProfile,
  pattern: RecoilPattern,
): void {
  const idx = state.shotIndex % pattern.pts.length;
  const pt  = pattern.pts[idx] ?? pattern.pts[0]!;

  state.pitchVel -= pt.v;
  state.yawVel   += pt.h;
  state.shotIndex++;
  state.lastFireTs = performance.now();

  // Clamp accumulated pitch
  if (state.pitchOffset > -profile.maxV) {
    state.pitchOffset = Math.max(-profile.maxV, state.pitchOffset - pt.v * 0.016);
  }
}

/**
 * Call every frame.
 * When enough time has passed since the last shot, resets spray back to index 0.
 */
export function tickPatternReset(state: RecoilState, pattern: RecoilPattern): void {
  if (state.shotIndex > 0) {
    const elapsed = performance.now() - state.lastFireTs;
    if (elapsed > pattern.resetTimeSec * 1000) {
      state.shotIndex = 0;
    }
  }
}

/** Spring recoil back toward 0 — call every frame */
export function tickRecoil(state: RecoilState, profile: RecoilProfile, dt: number): void {
  state.pitchVel += -profile.recovery * state.pitchOffset * dt;
  state.yawVel   += -profile.recovery * state.yawOffset   * dt;
  state.pitchVel *= Math.pow(profile.damping, dt * 60);
  state.yawVel   *= Math.pow(profile.damping, dt * 60);
  state.pitchOffset += state.pitchVel * dt;
  state.yawOffset   += state.yawVel   * dt;
  if (Math.abs(state.pitchOffset) < 0.0005) { state.pitchOffset = 0; state.pitchVel = 0; }
  if (Math.abs(state.yawOffset)   < 0.0005) { state.yawOffset   = 0; state.yawVel   = 0; }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Screen Shake ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export interface ShakeState {
  intensity: number;
  decayRate: number;
  x:         number;
  y:         number;
}

export function createShakeState(): ShakeState {
  return { intensity: 0, decayRate: 8, x: 0, y: 0 };
}

export function addShake(state: ShakeState, amount: number): void {
  state.intensity = Math.min(state.intensity + amount, 0.06);
}

export function tickShake(state: ShakeState, dt: number): void {
  if (state.intensity <= 0.0001) { state.x = 0; state.y = 0; return; }
  state.x = (Math.random() - 0.5) * 2 * state.intensity;
  state.y = (Math.random() - 0.5) * 2 * state.intensity;
  state.intensity = Math.max(0, state.intensity - state.decayRate * dt);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Input Buffer ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const BUFFER_FRAMES = 4;

export class InputBuffer {
  private shootBuf = 0;
  private jumpBuf  = 0;

  feed(shoot: boolean, jump: boolean): void {
    if (shoot) this.shootBuf = BUFFER_FRAMES;
    if (jump)  this.jumpBuf  = BUFFER_FRAMES;
    if (this.shootBuf > 0) this.shootBuf--;
    if (this.jumpBuf  > 0) this.jumpBuf--;
  }

  consumeShoot(): boolean {
    if (this.shootBuf > 0) { this.shootBuf = 0; return true; }
    return false;
  }

  consumeJump(): boolean {
    if (this.jumpBuf > 0) { this.jumpBuf = 0; return true; }
    return false;
  }

  get wantsShoot(): boolean { return this.shootBuf > 0; }
  get wantsJump():  boolean { return this.jumpBuf  > 0; }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Aim Assist v2 — 3-Layer System ────────────────────────────────════════════
// ══════════════════════════════════════════════════════════════════════════════
//
//  Layer 1 — Slowdown:   attenuates look velocity near a target
//  Layer 2 — Magnetism:  tiny pull toward target center when inside magnet zone
//  Layer 3 — Rotation:   tracks target screen-space movement so the crosshair
//                        "sticks" to a strafing enemy
//
//  Strength tiers control all three layers simultaneously.
//  Mobile devices get a 1.30× bonus applied automatically.

export type AimAssistStrength = "off" | "low" | "medium" | "high";

export interface AimAssistConfig {
  strength:   AimAssistStrength;
  isMobile:   boolean;
  slowZone:   number;    // NDC radius for slowdown trigger
  magnetZone: number;    // NDC radius for magnet pull trigger
}

export const DEFAULT_AIM_ASSIST_CONFIG: AimAssistConfig = {
  strength:   "medium",
  isMobile:   false,
  slowZone:   0.08,
  magnetZone: 0.035,
};

const STRENGTH_MULTS: Record<AimAssistStrength, { slow: number; magnet: number; rot: number }> = {
  off:    { slow: 0,    magnet: 0,    rot: 0    },
  low:    { slow: 0.30, magnet: 0.50, rot: 0.25 },
  medium: { slow: 0.55, magnet: 1.00, rot: 0.50 },
  high:   { slow: 0.75, magnet: 1.60, rot: 0.80 },
};

const MOBILE_BOOST = 1.30;

// ── Rotational tracking state ─────────────────────────────────────────────────

export interface RotationalTrackState {
  prevNdcX:  number;
  prevNdcY:  number;
  hasTarget: boolean;
}

export function createRotationalTrackState(): RotationalTrackState {
  return { prevNdcX: 0, prevNdcY: 0, hasTarget: false };
}

/**
 * 3-layer aim assist.
 * Mutates `trackState` each call to maintain rotational tracking across frames.
 *
 * @param lookDX       Raw horizontal look delta this frame
 * @param lookDY       Raw vertical look delta this frame
 * @param camera       Current perspective camera (for NDC projection)
 * @param enemyPos     World-space positions of alive enemies
 * @param config       Strength settings + zone radii
 * @param trackState   Mutable state for Layer-3 rotational tracking
 * @param dt           Delta time in seconds
 * @returns Modified look deltas
 */
export function applyAimAssistV2(
  lookDX:     number,
  lookDY:     number,
  camera:     THREE.PerspectiveCamera,
  enemyPos:   THREE.Vector3[],
  config:     AimAssistConfig,
  trackState: RotationalTrackState,
  dt:         number,
): { dx: number; dy: number } {

  const m = STRENGTH_MULTS[config.strength];
  if (m.slow === 0 && m.magnet === 0 && m.rot === 0) {
    // "off" — also reset tracking
    trackState.hasTarget = false;
    return { dx: lookDX, dy: lookDY };
  }

  const boost = config.isMobile ? MOBILE_BOOST : 1.0;

  // ── Find nearest enemy in screen space ────────────────────────────────────
  const ndc = new THREE.Vector3();
  let bestDist = Infinity;
  let bestNdcX = 0;
  let bestNdcY = 0;

  for (const ep of enemyPos) {
    ndc.copy(ep).project(camera);
    if (ndc.z > 1) continue;   // behind camera
    const dist = Math.hypot(ndc.x, ndc.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestNdcX = ndc.x;
      bestNdcY = ndc.y;
    }
  }

  if (bestDist > config.slowZone) {
    // No target in range — update tracking state and return unchanged
    trackState.hasTarget = false;
    return { dx: lookDX, dy: lookDY };
  }

  // Proximity 0 (edge of zone) → 1 (centre)
  const proximity = Math.max(0, 1 - bestDist / config.slowZone);

  // ── Layer 1: Slowdown ─────────────────────────────────────────────────────
  const slowFactor = 1 - (m.slow * boost) * proximity;
  let dx = lookDX * slowFactor;
  let dy = lookDY * slowFactor;

  // ── Layer 2: Magnetism ────────────────────────────────────────────────────
  if (bestDist < config.magnetZone && bestDist > 0.003) {
    const pull = (m.magnet * boost) * 0.0018 * proximity;
    dx += bestNdcX * pull;
    dy -= bestNdcY * pull;   // NDC Y is flipped vs screen
  }

  // ── Layer 3: Rotational tracking ──────────────────────────────────────────
  //  Compute how fast the target is moving across the screen (NDC/s).
  //  Add a fraction of that velocity to our look delta so the crosshair
  //  "sticks" to a strafing enemy without the player doing any extra input.
  if (m.rot > 0 && dt > 0) {
    if (trackState.hasTarget) {
      const velX = (bestNdcX - trackState.prevNdcX) / dt;
      const velY = (bestNdcY - trackState.prevNdcY) / dt;
      const trackStr = (m.rot * boost) * 0.10 * dt;   // gentle tracking fraction
      dx += velX * trackStr;
      dy -= velY * trackStr;
    }
    // Store for next frame
    trackState.prevNdcX  = bestNdcX;
    trackState.prevNdcY  = bestNdcY;
    trackState.hasTarget = true;
  }

  return { dx, dy };
}

// ── Legacy aim assist (v1) — kept for backward compat ──────────────────────────

export interface AimAssistOptions {
  strength:   number;
  slowZone:   number;
  magnetZone: number;
  enabled:    boolean;
}

export const DEFAULT_AIM_ASSIST: AimAssistOptions = {
  strength:   0.55,
  slowZone:   0.08,
  magnetZone: 0.035,
  enabled:    true,
};

/** @deprecated Use applyAimAssistV2 instead */
export function applyAimAssist(
  lookDX: number, lookDY: number,
  camera: THREE.PerspectiveCamera,
  enemyPositions: THREE.Vector3[],
  opts: AimAssistOptions,
): { dx: number; dy: number } {
  if (!opts.enabled || enemyPositions.length === 0) return { dx: lookDX, dy: lookDY };
  const ndc = new THREE.Vector3();
  let bestDist = Infinity, bestX = 0, bestY = 0;
  for (const ep of enemyPositions) {
    ndc.copy(ep).project(camera);
    const dist = Math.hypot(ndc.x, ndc.y);
    if (dist < bestDist) { bestDist = dist; bestX = ndc.x; bestY = ndc.y; }
  }
  if (bestDist > opts.slowZone) return { dx: lookDX, dy: lookDY };
  const slowFactor = 1 - opts.strength * Math.max(0, 1 - bestDist / opts.slowZone);
  let dx = lookDX * slowFactor, dy = lookDY * slowFactor;
  if (bestDist < opts.magnetZone && bestDist > 0.005) {
    const pull = opts.strength * 0.0015;
    dx += bestX * pull;
    dy -= bestY * pull;
  }
  return { dx, dy };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Floating Damage Numbers ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export interface DamageNumber {
  id:      number;
  value:   number;
  isHead:  boolean;
  screenX: number;
  screenY: number;
  ttl:     number;
  maxTtl:  number;
}

let _dnId = 0;

export function createDamageNumber(
  worldPos: THREE.Vector3, camera: THREE.PerspectiveCamera,
  damage: number, isHead: boolean,
): DamageNumber | null {
  const ndc = worldPos.clone().project(camera);
  if (ndc.z > 1) return null;
  const screenX = (ndc.x + 1) / 2;
  const screenY = 1 - (ndc.y + 1) / 2;
  const ttl = isHead ? 1.2 : 0.9;
  return { id: _dnId++, value: damage, isHead, screenX, screenY, ttl, maxTtl: ttl };
}

export function tickDamageNumbers(nums: DamageNumber[], dt: number): void {
  for (let i = nums.length - 1; i >= 0; i--) {
    nums[i]!.ttl -= dt;
    if (nums[i]!.ttl <= 0) nums.splice(i, 1);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Audio System — Web Audio Synthesizer ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export class AudioSystem {
  private ctx:    AudioContext | null = null;
  private _muted = false;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  mute(v: boolean): void { this._muted = v; }

  private noise(
    ctx: AudioContext, duration: number,
    attack: number, decay: number,
    filterFreq: number, filterQ: number,
    gainPeak: number, detune = 0,
  ): void {
    const buf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src    = ctx.createBufferSource();
    src.buffer   = buf;
    src.detune.value = detune;
    const filt   = ctx.createBiquadFilter();
    filt.type    = "bandpass";
    filt.frequency.value = filterFreq;
    filt.Q.value = filterQ;
    const gain   = ctx.createGain();
    const now    = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    src.start(now); src.stop(now + attack + decay + 0.01);
  }

  private tone(
    ctx: AudioContext, type: OscillatorType, freq: number,
    attack: number, decay: number, gain: number, freqEnd?: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type  = type;
    osc.frequency.value = freq;
    const g   = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);
    if (freqEnd !== undefined)
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + attack + decay);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + attack + decay + 0.05);
  }

  gunshot(weaponId: string): void {
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      const variation = Math.random() * 200 - 100;
      switch (weaponId) {
        case "pistol":
          this.noise(ctx, 0.25, 0.003, 0.20, 900  + variation, 1.0, 0.70);
          this.tone(ctx, "sawtooth", 140, 0.002, 0.12, 0.25, 80);
          break;
        case "rifle":
          this.noise(ctx, 0.18, 0.002, 0.14, 1400 + variation, 0.9, 0.85);
          this.tone(ctx, "sawtooth", 180, 0.001, 0.08, 0.30, 90);
          break;
        case "shotgun":
          this.noise(ctx, 0.35, 0.005, 0.28, 700  + variation, 0.7, 0.95);
          this.tone(ctx, "square", 90, 0.003, 0.18, 0.20, 50);
          break;
        case "sniper":
          this.noise(ctx, 0.55, 0.004, 0.44, 2200 + variation, 1.5, 0.65);
          this.tone(ctx, "sawtooth", 220, 0.003, 0.30, 0.18, 60);
          break;
      }
    } catch (_) {}
  }

  hitConfirm(isHead: boolean): void {
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      this.tone(ctx, "sine", isHead ? 1200 : 800, 0.001, 0.08, isHead ? 0.4 : 0.25);
    } catch (_) {}
  }

  reloadClick(): void {
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      this.tone(ctx, "square", 320, 0.001, 0.06, 0.18);
      setTimeout(() => {
        try { this.tone(this.getCtx(), "square", 480, 0.001, 0.04, 0.15); } catch (_) {}
      }, 120);
    } catch (_) {}
  }

  lowAmmoWarning(): void {
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      this.tone(ctx, "square", 440, 0.005, 0.07, 0.12);
      setTimeout(() => {
        try { this.tone(this.getCtx(), "square", 380, 0.005, 0.07, 0.10); } catch (_) {}
      }, 160);
    } catch (_) {}
  }

  landingThud(): void {
    if (this._muted) return;
    try {
      const ctx = this.getCtx();
      this.noise(ctx, 0.2, 0.003, 0.15, 200, 0.8, 0.5);
    } catch (_) {}
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}
