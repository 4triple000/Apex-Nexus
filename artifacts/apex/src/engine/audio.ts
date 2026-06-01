/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE v2 — Audio Manager                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Zero-file procedural audio using Web Audio API synthesis.
 * Each sound is a synthesized waveform — no network requests,
 * no loading time, works in any browser context.
 *
 * Debounce prevents audio spam when the same sound fires
 * multiple times in quick succession.
 */

type SoundId = 'jump' | 'coin' | 'stomp' | 'hit' | 'win' | 'land';

const DEBOUNCE_MS: Record<SoundId, number> = {
  jump:  60,
  coin:  40,
  stomp: 80,
  hit:   150,
  win:   500,
  land:  30,
};

export class AudioManager {
  private ctx: AudioContext | null      = null;
  private lastPlayed = new Map<SoundId, number>();
  private volume = 0.55;

  private getCtx(): AudioContext | null {
    if (!this.ctx || this.ctx.state === 'closed') {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  private canPlay(id: SoundId): boolean {
    const now  = performance.now();
    const last = this.lastPlayed.get(id) ?? 0;
    if (now - last < DEBOUNCE_MS[id]) return false;
    this.lastPlayed.set(id, now);
    return true;
  }

  // ── Low-level primitives ─────────────────────────────────────────────────

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 0.4,
    freqEnd?: number,
    delay = 0
  ) {
    const ctx = this.getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env);
    env.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + delay + duration);
    }

    const vol = gain * this.volume;
    env.gain.setValueAtTime(0, ctx.currentTime + delay);
    env.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.01);
  }

  private noise(duration: number, gain = 0.2, delay = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;

    const bufSize = ctx.sampleRate * duration;
    const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data    = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env    = ctx.createGain();
    src.buffer   = buffer;
    filter.type  = 'lowpass';
    filter.frequency.value = 600;
    src.connect(filter);
    filter.connect(env);
    env.connect(ctx.destination);

    const vol = gain * this.volume;
    env.gain.setValueAtTime(vol, ctx.currentTime + delay);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    src.start(ctx.currentTime + delay);
    src.stop(ctx.currentTime + delay + duration + 0.01);
  }

  // ── Sound library ─────────────────────────────────────────────────────────

  /** Jump: quick upward chirp */
  jump() {
    if (!this.canPlay('jump')) return;
    this.tone(200, 0.08, 'square', 0.18, 420);
    this.tone(420, 0.10, 'sine',   0.12, 600, 0.04);
  }

  /** Land: soft thud with brief noise */
  land() {
    if (!this.canPlay('land')) return;
    this.noise(0.06, 0.15);
    this.tone(80, 0.08, 'sine', 0.22, 40);
  }

  /** Coin: bright bell ping */
  coin() {
    if (!this.canPlay('coin')) return;
    this.tone(880, 0.05, 'sine', 0.25, 1200);
    this.tone(1320, 0.12, 'sine', 0.15, 880, 0.03);
  }

  /** Stomp: satisfying crunch */
  stomp() {
    if (!this.canPlay('stomp')) return;
    this.noise(0.08, 0.25);
    this.tone(120, 0.12, 'sine', 0.30, 40);
    this.tone(60, 0.15, 'square', 0.12, 30, 0.02);
  }

  /** Hit / take damage: painful buzz */
  hit() {
    if (!this.canPlay('hit')) return;
    this.noise(0.10, 0.30);
    this.tone(160, 0.18, 'sawtooth', 0.20, 80);
  }

  /** Win: ascending 3-note chord */
  win() {
    if (!this.canPlay('win')) return;
    this.tone(523, 0.20, 'sine', 0.22);         // C5
    this.tone(659, 0.20, 'sine', 0.18, 880, 0.12); // E5 → A5
    this.tone(784, 0.25, 'sine', 0.14, 1047, 0.24); // G5 → C6
  }

  // ── Volume control ────────────────────────────────────────────────────────

  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); }
  getVolume()          { return this.volume; }

  /** Must be called from a user gesture to unlock AudioContext on iOS/Safari */
  unlock() { this.getCtx()?.resume(); }
}
