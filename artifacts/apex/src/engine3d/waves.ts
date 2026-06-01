/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Wave System                           ║
 * ║  Wave-based enemy spawning · countdown · survival mode  ║
 * ╚══════════════════════════════════════════════════════════╝
 */

export type WavePhase = "countdown" | "fighting" | "wave_clear" | "all_clear";

export interface WaveState {
  phase:       WavePhase;
  wave:        number;
  maxWaves:    number;
  countdown:   number;   // seconds left in countdown
  bannerTtl:   number;   // seconds to show "WAVE X" banner
  enemiesLeft: number;
}

const BETWEEN_WAVE_SECS = 8;
const BANNER_SECS       = 3.5;
const BASE_ENEMIES      = 4;
const ENEMIES_PER_WAVE  = 3;

export function enemiesForWave(wave: number): number {
  return BASE_ENEMIES + (wave - 1) * ENEMIES_PER_WAVE;
}

export function createWaveState(maxWaves = 5): WaveState {
  return {
    phase:       "countdown",
    wave:        1,
    maxWaves,
    countdown:   3,
    bannerTtl:   BANNER_SECS,
    enemiesLeft: enemiesForWave(1),
  };
}

export interface WaveEvents {
  onWaveStart:   (wave: number, count: number) => void;
  onWaveCleared: (wave: number) => void;
  onAllCleared:  () => void;
}

export function updateWaveState(
  ws:       WaveState,
  dt:       number,
  aliveEnemies: number,
  events:   WaveEvents,
): WaveState {
  const s = { ...ws };
  s.enemiesLeft = aliveEnemies;

  switch (s.phase) {
    case "countdown":
      s.countdown -= dt;
      s.bannerTtl -= dt;
      if (s.countdown <= 0) {
        s.phase    = "fighting";
        s.countdown = 0;
        events.onWaveStart(s.wave, enemiesForWave(s.wave));
      }
      break;

    case "fighting":
      if (aliveEnemies <= 0) {
        if (s.wave >= s.maxWaves) {
          s.phase    = "all_clear";
          s.bannerTtl = BANNER_SECS;
          events.onAllCleared();
        } else {
          s.phase    = "wave_clear";
          s.bannerTtl = BANNER_SECS;
          events.onWaveCleared(s.wave);
        }
      }
      break;

    case "wave_clear":
      s.bannerTtl -= dt;
      if (s.bannerTtl <= 0) {
        s.wave++;
        s.countdown = BETWEEN_WAVE_SECS;
        s.bannerTtl = BANNER_SECS;
        s.phase     = "countdown";
        s.enemiesLeft = enemiesForWave(s.wave);
      }
      break;

    case "all_clear":
      break;
  }

  return s;
}
