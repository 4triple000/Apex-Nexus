/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  VOICE PERSONALITY ENGINE                                ║
 * ║  Maps personality blend → TTS pitch/rate/tone           ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { BlendSlot, ApexPersonalityId } from './personalityEngine';

// ── Voice style per personality ───────────────────────────────────────────────

export type VoiceTone = 'firm' | 'warm' | 'clear' | 'intense' | 'energetic';

export interface VoiceStyle {
  /** Web Speech pitch: 0–2, normal = 1.0 */
  pitch:  number;
  /** Web Speech rate: 0.1–10, normal = 1.0 */
  speed:  number;
  /** Qualitative tone label (dominant personality wins) */
  tone:   VoiceTone;
  /** Volume: 0–1 */
  volume: number;
}

export const VOICE_STYLES: Record<ApexPersonalityId, VoiceStyle> = {
  strategist: { pitch: 0.92, speed: 0.90, tone: 'firm',      volume: 1.00 },
  friend:     { pitch: 1.08, speed: 1.10, tone: 'warm',      volume: 1.00 },
  mentor:     { pitch: 1.00, speed: 0.85, tone: 'clear',     volume: 0.95 },
  debater:    { pitch: 0.95, speed: 1.20, tone: 'intense',   volume: 1.00 },
  innovator:  { pitch: 1.05, speed: 1.15, tone: 'energetic', volume: 1.00 },
  // Legacy
  hood:         { pitch: 1.00, speed: 1.05, tone: 'warm',    volume: 1.00 },
  professional: { pitch: 0.90, speed: 0.88, tone: 'firm',    volume: 0.95 },
  bigbro:       { pitch: 0.98, speed: 0.95, tone: 'warm',    volume: 1.00 },
};

// ── Weighted mixing ───────────────────────────────────────────────────────────

function weightedAvg(blend: BlendSlot[], field: 'pitch' | 'speed' | 'volume'): number {
  const total = blend.reduce((s, sl) => s + sl.weight, 0);
  if (total === 0) return 1;
  return blend.reduce((sum, sl) => {
    const vs = VOICE_STYLES[sl.id] ?? VOICE_STYLES.strategist;
    return sum + vs[field] * (sl.weight / total);
  }, 0);
}

function weightedDominantTone(blend: BlendSlot[]): VoiceTone {
  const dominant = [...blend].filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight)[0];
  return (VOICE_STYLES[dominant?.id] ?? VOICE_STYLES.strategist).tone;
}

/**
 * Compute the blended voice style from a personality blend array.
 * Numeric fields (pitch, speed, volume) are weighted averages.
 * Tone is the dominant personality's tone.
 */
export function getVoiceStyle(blend: BlendSlot[]): VoiceStyle {
  const active = blend.filter((s) => s.weight > 0);
  if (active.length === 0) return VOICE_STYLES.strategist;
  if (active.length === 1) return VOICE_STYLES[active[0].id] ?? VOICE_STYLES.strategist;

  return {
    pitch:  Math.round(weightedAvg(active, 'pitch')  * 1000) / 1000,
    speed:  Math.round(weightedAvg(active, 'speed')  * 1000) / 1000,
    volume: Math.round(weightedAvg(active, 'volume') * 1000) / 1000,
    tone:   weightedDominantTone(active),
  };
}

/** Get voice style from the current localStorage personality (for non-React call sites) */
export function getGlobalVoiceStyle(): VoiceStyle {
  try {
    const raw = localStorage.getItem('apex_global_personality');
    if (raw) {
      const state = JSON.parse(raw);
      if (state?.blend?.length) return getVoiceStyle(state.blend);
      if (state?.id) return VOICE_STYLES[state.id as ApexPersonalityId] ?? VOICE_STYLES.strategist;
    }
  } catch {}
  return VOICE_STYLES.strategist;
}

/**
 * Describe the voice style in natural language.
 * Used in settings UI.
 */
export function describeVoiceStyle(vs: VoiceStyle): string {
  const pitchWord = vs.pitch > 1.03 ? 'lighter' : vs.pitch < 0.97 ? 'deeper' : 'neutral';
  const speedWord = vs.speed > 1.05 ? 'faster' : vs.speed < 0.95 ? 'slower' : 'measured';
  return `${vs.tone.charAt(0).toUpperCase() + vs.tone.slice(1)}, ${speedWord} pace, ${pitchWord} pitch`;
}

// ── Mood-based voice settings ─────────────────────────────────────────────────
// Maps explicit user/AI mood states to voice modifier values.
// Pitch is a Web Speech API absolute delta from the personality base (0–2 scale).
// Rate maps directly to Web Speech API's rate / useSpeechOutput's speed.

export type MoodId = 'excited' | 'calm' | 'focused';

export interface MoodVoiceSettings {
  /** Delta applied on top of the personality base pitch (Web Speech 0–2 scale) */
  pitchDelta: number;
  /** Absolute playback rate (maps to Web Speech API rate / internal speed) */
  rate: number;
}

/**
 * Returns voice parameters for a given mood.
 *
 * excited → higher pitch, faster pace  (pitch: +0.10, rate: 1.1)
 * calm    → lower pitch, slower pace   (pitch: -0.07, rate: 0.9)
 * focused → neutral pitch, measured pace (pitch: 0,  rate: 0.95)
 */
export function getVoiceSettings(mood: MoodId): MoodVoiceSettings {
  switch (mood) {
    case 'excited': return { pitchDelta: +0.10, rate: 1.10 };
    case 'calm':    return { pitchDelta: -0.07, rate: 0.90 };
    case 'focused': return { pitchDelta:  0.00, rate: 0.95 };
    default:        return { pitchDelta:  0.00, rate: 1.00 };
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Layer a mood on top of an existing personality VoiceStyle.
 * The mood's pitchDelta is added to the base personality pitch.
 * The mood's rate replaces speed (mood intent takes precedence over personality pace).
 */
export function applyMoodToVoiceStyle(style: VoiceStyle, mood: MoodId): VoiceStyle {
  const { pitchDelta, rate } = getVoiceSettings(mood);
  return {
    ...style,
    pitch: clamp(style.pitch + pitchDelta, 0.50, 1.80),
    speed: clamp(rate,                     0.50, 1.80),
  };
}

/**
 * Detect a mood from a vibeCheck string (e.g. from the AI Voice Coach).
 * Returns null if no mood is recognisable.
 */
export function detectMoodFromVibeCheck(vibeCheck: string): MoodId | null {
  const v = vibeCheck.toLowerCase().trim();
  if (/excit|hype|energy|pump|fire|lit/.test(v)) return 'excited';
  if (/calm|chill|relax|cool|peace|gentle/.test(v)) return 'calm';
  if (/focus|sharp|lock|concent|deep|grind|crunch/.test(v)) return 'focused';
  return null;
}
