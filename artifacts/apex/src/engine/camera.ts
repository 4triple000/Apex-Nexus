/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE v2 — Smooth Camera System             ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Features:
 *   - Smooth lerp follow (configurable lag)
 *   - Look-ahead in movement direction
 *   - World bounds clamping
 *   - Screen shake (intensity decays over duration)
 */

export class CameraSystem {
  /** Current camera position in world units */
  x   = 0;
  y   = 0;

  /** Shake offsets added on top of camera position each frame */
  shakeX = 0;
  shakeY = 0;

  private shakeIntensity  = 0;
  private shakeDuration   = 0;  // total frames
  private shakeRemaining  = 0;  // frames left

  // Lerp factor per frame at 60fps (0.12 = reaches ~50% in 5 frames)
  private LERP = 0.13;

  // Look-ahead: pixels the camera leads the player in their moving direction
  private LOOKAHEAD = 40;

  // ── Shake ─────────────────────────────────────────────────────────────────

  /**
   * Trigger screen shake.
   * @param intensity  Max pixel offset (e.g. 2 for light, 8 for death)
   * @param durationMs Duration in milliseconds
   */
  shake(intensity: number, durationMs: number) {
    // Always take the stronger shake if one is already running
    if (intensity <= this.shakeIntensity * (this.shakeRemaining / Math.max(1, this.shakeDuration))) return;
    this.shakeIntensity = intensity;
    this.shakeDuration  = durationMs / 16.67; // convert to frames at 60fps
    this.shakeRemaining = this.shakeDuration;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * Call once per frame after player position is known.
   * @param playerX  Player world-x (left edge)
   * @param playerW  Player width (used to centre camera)
   * @param playerVx Player horizontal velocity (for look-ahead)
   * @param worldW   Full world width in pixels
   * @param viewW    Visible viewport width in pixels (world units)
   * @param dt       Delta time multiplier (1 = 60fps frame)
   */
  update(
    playerX: number,
    playerW: number,
    playerVx: number,
    worldW: number,
    viewW: number,
    dt: number
  ) {
    const playerCenter = playerX + playerW / 2;
    const lookAhead    = Math.sign(playerVx) * this.LOOKAHEAD * Math.min(1, Math.abs(playerVx) / 5);
    const targetX      = playerCenter - viewW / 2 + lookAhead;
    const clampedX     = Math.max(0, Math.min(worldW - viewW, targetX));

    this.x += (clampedX - this.x) * this.LERP * dt;

    // Shake decay
    if (this.shakeRemaining > 0) {
      this.shakeRemaining = Math.max(0, this.shakeRemaining - dt);
      const t = this.shakeRemaining / this.shakeDuration;
      const mag = this.shakeIntensity * t;
      this.shakeX = (Math.random() * 2 - 1) * mag;
      this.shakeY = (Math.random() * 2 - 1) * mag * 0.6;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  // ── Canvas transform helpers ──────────────────────────────────────────────

  /**
   * Apply camera + shake translation.
   * Call ctx.save() before this, ctx.restore() after rendering world.
   */
  apply(ctx: CanvasRenderingContext2D) {
    ctx.translate(
      Math.round(-this.x + this.shakeX),
      Math.round(this.shakeY)
    );
  }

  reset() {
    this.x             = 0;
    this.y             = 0;
    this.shakeX        = 0;
    this.shakeY        = 0;
    this.shakeIntensity = 0;
    this.shakeRemaining = 0;
  }
}
