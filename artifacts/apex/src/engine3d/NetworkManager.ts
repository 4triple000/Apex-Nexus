/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — Multiplayer Network Manager                  ║
 * ║                                                             ║
 * ║  Client-side systems for AAA-quality networked combat:      ║
 * ║                                                             ║
 * ║  ClientPredictor   — move instantly, send inputs to server  ║
 * ║  Reconciler        — smooth-correct if server disagrees     ║
 * ║  RemoteInterpolator — lerp remote players, no teleporting   ║
 * ║  PingTracker        — rolling RTT average                   ║
 * ║                                                             ║
 * ║  Works with the existing Socket.io /ame namespace.         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Types re-exported for consumers ──────────────────────────────────────────

export interface Vec3 { x: number; y: number; z: number }

export interface NetworkPlayerState {
  playerId: string;
  name:     string;
  x: number; y: number; z: number;
  yaw:   number;
  hp:    number;
  alive: boolean;
  kills: number;
  deaths: number;
}

// ── Input record (for reconciliation) ─────────────────────────────────────────

export interface InputRecord {
  seq:   number;   // monotonically increasing
  ts:    number;   // client timestamp
  dt:    number;   // frame delta
  moveX: number;
  moveY: number;
  jump:  boolean;
  sprint: boolean;
}

// ── Pending input buffer ───────────────────────────────────────────────────────
//
//  Each un-acknowledged input is kept here.
//  On server correction: replay all inputs after the corrected sequence number.

const MAX_PENDING = 120;

// ── Client-side Predictor ─────────────────────────────────────────────────────
//
//  Applies movement locally every frame so the player feels zero delay.
//  Simultaneously sends inputs to the server for authoritative validation.

export class ClientPredictor {
  pos:   Vec3 = { x: 0, y: 1.7, z: 0 };
  yaw    = 0;
  onGround = true;

  private vy        = 0;
  private velX      = 0;
  private velZ      = 0;
  private seq       = 0;
  private pending:  InputRecord[] = [];

  private readonly GRAVITY     = -28;
  private readonly JUMP_FORCE  = 9.5;
  private readonly WALK_SPEED  = 7.5;
  private readonly SPRINT_SPEED = 13.5;
  private readonly ACCEL       = 80;
  private readonly FRICTION    = 14;

  /** Call each frame with the current input snapshot. Returns seq number. */
  applyInput(input: Omit<InputRecord, "seq" | "ts">): number {
    const record: InputRecord = { ...input, seq: ++this.seq, ts: Date.now() };
    this.pending.push(record);
    if (this.pending.length > MAX_PENDING) this.pending.shift();

    this._integrate(record);
    return record.seq;
  }

  /** Called when server sends a corrected position. */
  reconcile(serverPos: Vec3, serverSeq: number): void {
    // Snap to server position
    this.pos.x = serverPos.x;
    this.pos.y = serverPos.y;
    this.pos.z = serverPos.z;
    this.vy    = 0;
    this.velX  = 0;
    this.velZ  = 0;
    this.onGround = true;

    // Discard inputs that the server has acknowledged
    this.pending = this.pending.filter((p) => p.seq > serverSeq);

    // Re-simulate all un-acknowledged inputs (client re-runs them on corrected state)
    for (const rec of this.pending) {
      this._integrate(rec);
    }
  }

  private _integrate(rec: InputRecord): void {
    const { dt, moveX, moveY, jump, sprint } = rec;

    // Gravity
    this.vy    += this.GRAVITY * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 1.7) {
      this.pos.y   = 1.7;
      this.vy      = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Jump
    if (jump && this.onGround) {
      this.vy       = this.JUMP_FORCE;
      this.onGround = false;
    }

    // Horizontal velocity
    const maxSpeed = sprint ? this.SPRINT_SPEED : this.WALK_SPEED;
    const hasInput = Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01;

    if (hasInput) {
      // Rotate input by yaw
      const cos = Math.cos(this.yaw);
      const sin = Math.sin(this.yaw);
      const wx  = moveX * cos - moveY * sin;
      const wz  = moveX * sin + moveY * cos;
      const len = Math.hypot(wx, wz);
      const nx  = len > 0 ? (wx / len) * maxSpeed : 0;
      const nz  = len > 0 ? (wz / len) * maxSpeed : 0;
      this.velX += (nx - this.velX) * Math.min(1, this.ACCEL * dt);
      this.velZ += (nz - this.velZ) * Math.min(1, this.ACCEL * dt);
    } else {
      this.velX *= Math.max(0, 1 - this.FRICTION * dt);
      this.velZ *= Math.max(0, 1 - this.FRICTION * dt);
    }

    this.pos.x += this.velX * dt;
    this.pos.z += this.velZ * dt;
  }

  /** Pending input count (for debug). */
  get pendingCount(): number { return this.pending.length; }
}

// ── Smooth Reconciler ─────────────────────────────────────────────────────────
//
//  When the server corrects a position mismatch, instead of snapping,
//  we apply the error gradually over CORRECT_FRAMES frames.

export class SmoothReconciler {
  private errX = 0;
  private errY = 0;
  private errZ = 0;
  private frames = 0;
  private readonly CORRECT_FRAMES = 8;

  /** Receives the correction delta (server_pos - current_predicted_pos). */
  push(dx: number, dy: number, dz: number): void {
    this.errX = dx;
    this.errY = dy;
    this.errZ = dz;
    this.frames = this.CORRECT_FRAMES;
  }

  /** Returns the nudge to add to position this frame. */
  tick(): Vec3 {
    if (this.frames <= 0) return { x: 0, y: 0, z: 0 };
    const t = 1 / this.frames;
    const nudge = { x: this.errX * t, y: this.errY * t, z: this.errZ * t };
    this.errX -= nudge.x;
    this.errY -= nudge.y;
    this.errZ -= nudge.z;
    this.frames--;
    return nudge;
  }

  get active(): boolean { return this.frames > 0; }
}

// ── Remote Player Interpolator ────────────────────────────────────────────────
//
//  Each remote player keeps a small queue of received positions.
//  We render them at (now - INTERPOLATION_DELAY_MS) using linear interpolation
//  so movement is always smooth — no teleporting.

const INTERPOLATION_DELAY_MS = 100;   // render 100ms behind server time
const MAX_BUFFER = 32;

interface PosStamp {
  ts: number;
  x: number; y: number; z: number;
  yaw: number;
}

export class RemotePlayerInterpolator {
  private buffer: Map<string, PosStamp[]> = new Map();
  displayStates:  Map<string, NetworkPlayerState> = new Map();

  /** Called when a server state_update arrives. */
  pushState(state: NetworkPlayerState, serverTs: number): void {
    if (!this.buffer.has(state.playerId)) {
      this.buffer.set(state.playerId, []);
    }
    const buf = this.buffer.get(state.playerId)!;
    buf.push({ ts: serverTs, x: state.x, y: state.y, z: state.z, yaw: state.yaw });
    if (buf.length > MAX_BUFFER) buf.shift();

    // Update non-positional state immediately
    const prev = this.displayStates.get(state.playerId);
    this.displayStates.set(state.playerId, {
      ...state,
      x:   prev?.x   ?? state.x,
      y:   prev?.y   ?? state.y,
      z:   prev?.z   ?? state.z,
      yaw: prev?.yaw ?? state.yaw,
    });
  }

  /** Call every frame to advance interpolated positions. */
  tick(nowMs: number): void {
    const renderTime = nowMs - INTERPOLATION_DELAY_MS;

    for (const [pid, buf] of this.buffer) {
      if (buf.length < 2) continue;

      // Find surrounding samples at renderTime
      let b = buf.findIndex((s) => s.ts >= renderTime);
      if (b <= 0) b = 1;
      if (b >= buf.length) b = buf.length - 1;

      const prev = buf[b - 1]!;
      const next = buf[b]!;
      const t    = (renderTime - prev.ts) / (next.ts - prev.ts);
      const tc   = Math.max(0, Math.min(1, t));

      const cur = this.displayStates.get(pid);
      if (!cur) continue;

      this.displayStates.set(pid, {
        ...cur,
        x:   prev.x   + (next.x   - prev.x)   * tc,
        y:   prev.y   + (next.y   - prev.y)   * tc,
        z:   prev.z   + (next.z   - prev.z)   * tc,
        yaw: prev.yaw + (next.yaw - prev.yaw) * tc,
      });

      // Prune buffer entries older than renderTime - 500ms
      const prune = renderTime - 500;
      while (buf.length > 2 && buf[1] && buf[1].ts < prune) buf.shift();
    }
  }

  /** Remove a player who left. */
  remove(playerId: string): void {
    this.buffer.delete(playerId);
    this.displayStates.delete(playerId);
  }

  get players(): NetworkPlayerState[] {
    return Array.from(this.displayStates.values());
  }
}

// ── Ping Tracker ──────────────────────────────────────────────────────────────
//
//  Measures round-trip time by sending ping/pong events and keeping
//  a rolling average over the last 8 samples.

export class PingTracker {
  private samples: number[] = [];
  private lastPingSent = 0;
  private pendingPing  = false;
  readonly SAMPLES = 8;

  /** Returns { ts: Date.now() } payload to send with every "ping" event. */
  sendPing(): { ts: number } {
    this.lastPingSent = Date.now();
    this.pendingPing  = true;
    return { ts: this.lastPingSent };
  }

  /** Call when a "pong" event is received from the server. */
  receivePong(): void {
    if (!this.pendingPing) return;
    const rtt = Date.now() - this.lastPingSent;
    this.pendingPing = false;
    this.samples.push(rtt);
    if (this.samples.length > this.SAMPLES) this.samples.shift();
  }

  /** Rolling average RTT in ms. */
  get rttMs(): number {
    if (this.samples.length === 0) return 0;
    return Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length);
  }

  /** Jitter (standard deviation of samples). */
  get jitter(): number {
    if (this.samples.length < 2) return 0;
    const avg = this.rttMs;
    const variance = this.samples.reduce((acc, v) => acc + (v - avg) ** 2, 0) / this.samples.length;
    return Math.round(Math.sqrt(variance));
  }
}

// ── Delta Compressor ──────────────────────────────────────────────────────────
//
//  Only sends position fields that changed by more than the threshold.
//  Reduces outgoing bandwidth ~40 % for stationary players.

const POS_THRESHOLD = 0.015;    // metres
const YAW_THRESHOLD = 0.002;    // radians

export interface DeltaPayload {
  x?:   number;
  y?:   number;
  z?:   number;
  yaw?: number;
}

export class DeltaCompressor {
  private last: { x: number; y: number; z: number; yaw: number } =
    { x: Infinity, y: Infinity, z: Infinity, yaw: Infinity };

  compress(pos: Vec3, yaw: number): DeltaPayload {
    const out: DeltaPayload = {};
    if (Math.abs(pos.x - this.last.x) > POS_THRESHOLD) { out.x = pos.x; this.last.x = pos.x; }
    if (Math.abs(pos.y - this.last.y) > POS_THRESHOLD) { out.y = pos.y; this.last.y = pos.y; }
    if (Math.abs(pos.z - this.last.z) > POS_THRESHOLD) { out.z = pos.z; this.last.z = pos.z; }
    if (Math.abs(yaw  - this.last.yaw) > YAW_THRESHOLD) { out.yaw = yaw; this.last.yaw = yaw; }
    return out;
  }

  reset(): void {
    this.last = { x: Infinity, y: Infinity, z: Infinity, yaw: Infinity };
  }
}

// ── Hit Confirmation ──────────────────────────────────────────────────────────
//
//  The client shows hit feedback INSTANTLY (optimistic).
//  If the server denies the hit, we roll back the UI.

export interface PendingHit {
  targetId:  string;
  timestamp: number;
  clientDmg: number;
}

export class HitConfirmationTracker {
  private pending: Map<string, PendingHit> = new Map();

  /**
   * Register an optimistic hit.
   * @returns pendingId to correlate with server response.
   */
  optimisticHit(targetId: string, clientDmg: number): string {
    const id = `${targetId}_${Date.now()}`;
    this.pending.set(id, { targetId, timestamp: Date.now(), clientDmg });
    return id;
  }

  /**
   * Server confirmed or denied the hit.
   * Returns { confirmed, serverDmg, rollback } so UI can react.
   */
  serverResponse(
    targetId: string,
    serverDmg: number,
    valid: boolean,
  ): { confirmed: boolean; rollback: boolean; delta: number } {
    // Find the oldest pending hit for this target
    for (const [id, hit] of this.pending) {
      if (hit.targetId === targetId) {
        this.pending.delete(id);
        const delta = serverDmg - hit.clientDmg;
        return { confirmed: valid, rollback: !valid, delta };
      }
    }
    return { confirmed: valid, rollback: false, delta: 0 };
  }

  /** Prune stale pending hits older than 2 s (in case server never responds). */
  prune(): void {
    const cutoff = Date.now() - 2000;
    for (const [id, hit] of this.pending) {
      if (hit.timestamp < cutoff) this.pending.delete(id);
    }
  }
}
