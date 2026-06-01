/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  AME — Lag Compensator                                   ║
 * ║                                                          ║
 * ║  Stores a rolling 3-second position history for every   ║
 * ║  live player at 20 Hz.  When a shoot event arrives we   ║
 * ║  rewind enemy positions to the moment the shooter fired ║
 * ║  (using reported RTT / 2 as the look-back window),      ║
 * ║  then validate the hit against those historical coords.  ║
 * ║                                                          ║
 * ║  "What you saw is what hit" — even with latency.        ║
 * ╚══════════════════════════════════════════════════════════╝
 */

const HISTORY_MS       = 3_000;   // how far back we keep (ms)
const MAX_COMPENSATE_MS = 400;    // clamp — never rewind > 400 ms (prevents abuse)

export interface PositionSnapshot {
  ts:  number;
  x:   number;
  y:   number;
  z:   number;
  yaw: number;
}

// ── Per-player rolling buffer ─────────────────────────────────────────────────

class PlayerHistory {
  private snaps: PositionSnapshot[] = [];

  push(snap: PositionSnapshot): void {
    this.snaps.push(snap);
    const cutoff = Date.now() - HISTORY_MS;
    // Prune from front while the 2nd element is also old (keep at least 1)
    while (this.snaps.length > 1 && this.snaps[1]!.ts < cutoff) {
      this.snaps.shift();
    }
  }

  /**
   * Interpolated position at timestamp `ts`.
   * Returns null if no history exists.
   */
  getAt(ts: number): PositionSnapshot | null {
    if (this.snaps.length === 0) return null;
    if (this.snaps.length === 1) return this.snaps[0]!;

    // Clamp to available range
    if (ts <= this.snaps[0]!.ts) return this.snaps[0]!;
    if (ts >= this.snaps[this.snaps.length - 1]!.ts) return this.snaps[this.snaps.length - 1]!;

    // Binary search for surrounding pair
    let lo = 0, hi = this.snaps.length - 2;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.snaps[mid + 1]!.ts <= ts) lo = mid + 1;
      else hi = mid;
    }

    const a = this.snaps[lo]!;
    const b = this.snaps[lo + 1]!;
    const t = (ts - a.ts) / (b.ts - a.ts);

    return {
      ts,
      x:   a.x   + (b.x   - a.x)   * t,
      y:   a.y   + (b.y   - a.y)   * t,
      z:   a.z   + (b.z   - a.z)   * t,
      yaw: a.yaw + (b.yaw - a.yaw) * t,
    };
  }

  /** Latest snapshot */
  latest(): PositionSnapshot | null {
    return this.snaps.length > 0 ? this.snaps[this.snaps.length - 1]! : null;
  }
}

// ── Module-level registry ─────────────────────────────────────────────────────

const histories = new Map<string, PlayerHistory>();

/** Record a new position snapshot for a player (called every server tick). */
export function recordSnapshot(playerId: string, snap: Omit<PositionSnapshot, "ts"> & { ts?: number }): void {
  if (!histories.has(playerId)) histories.set(playerId, new PlayerHistory());
  histories.get(playerId)!.push({ ts: snap.ts ?? Date.now(), ...snap });
}

/**
 * Get where a player WAS at a past timestamp.
 * Automatically clamps the lag window to MAX_COMPENSATE_MS.
 *
 * @param playerId  Target player
 * @param shooterTs Timestamp the shooter fired (server time based on shot arrival time)
 * @param shooterRttMs Shooter's round-trip latency in ms (half used as look-back)
 */
export function getRewindPosition(
  playerId:     string,
  shooterTs:    number,
  shooterRttMs: number,
): PositionSnapshot | null {
  const lookBack = Math.min(shooterRttMs / 2, MAX_COMPENSATE_MS);
  const rewindTs  = shooterTs - lookBack;
  return histories.get(playerId)?.getAt(rewindTs) ?? null;
}

/** Latest known position (for sanity checks). */
export function getLatestPosition(playerId: string): PositionSnapshot | null {
  return histories.get(playerId)?.latest() ?? null;
}

/** Clear all history for a player (on disconnect / room end). */
export function clearHistory(playerId: string): void {
  histories.delete(playerId);
}

/** 3D euclidean distance between two position snapshots. */
export function dist3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}
