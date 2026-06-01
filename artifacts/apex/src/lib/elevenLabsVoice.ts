/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  ELEVENLABS VOICE CLIENT                                 ║
 * ║  Apex custom voice identity system                      ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Architecture:
 *   Browser → /api/tts/generate (our server) → ElevenLabs API
 *   Audio is returned as audio/mpeg and played via Web Audio API.
 *   The ElevenLabs key never touches the browser.
 *
 * Voice profiles:
 *   Each personality tone maps to a distinct ElevenLabs voice with
 *   tuned stability / similarity_boost settings.
 *   The `apex_custom_voice` profile (stability 0.6, similarity 0.8) is
 *   used as the default universal Apex voice identity.
 */

import { VoiceTone } from './voicePersonality';

// ── Voice profile registry ────────────────────────────────────────────────────

export interface ApexVoiceProfile {
  voiceId:         string;
  stability:       number;
  similarity_boost: number;
  style:           number;
  label:           string;
}

/** ElevenLabs voice IDs — public pre-built voices */
const VOICE_IDS = {
  adam:    "pNInz6obpgDQGcFmaJgB",
  bella:   "EXAVITQu4vr4xnSDxMaL",
  dorothy: "ThT5KcBeYPX3keUQqHPh",
  arnold:  "VR6AewLTigWG4xSOukaG",
  gigi:    "jBpfuIE2acCO8z3wKNLl",
} as const;

/**
 * The Apex custom voice — unified identity used across the product.
 * Maps to Adam (deep, trustworthy) with the user-specified stability 0.6 / similarity 0.8.
 */
export const APEX_DEFAULT_VOICE_PROFILE: ApexVoiceProfile = {
  voiceId:          VOICE_IDS.adam,
  stability:        0.60,
  similarity_boost: 0.80,
  style:            0.35,
  label:            "Apex (default)",
};

/** Per-tone voice profiles — tuned for each personality archetype */
export const APEX_VOICE_PROFILES: Record<VoiceTone, ApexVoiceProfile> = {
  firm:      { voiceId: VOICE_IDS.adam,    stability: 0.75, similarity_boost: 0.75, style: 0.20, label: "Strategist"  },
  warm:      { voiceId: VOICE_IDS.bella,   stability: 0.55, similarity_boost: 0.85, style: 0.45, label: "Friend"      },
  clear:     { voiceId: VOICE_IDS.dorothy, stability: 0.80, similarity_boost: 0.70, style: 0.15, label: "Mentor"      },
  intense:   { voiceId: VOICE_IDS.arnold,  stability: 0.45, similarity_boost: 0.90, style: 0.55, label: "Debater"     },
  energetic: { voiceId: VOICE_IDS.gigi,    stability: 0.50, similarity_boost: 0.85, style: 0.50, label: "Innovator"   },
};

// ── Availability check (cached) ───────────────────────────────────────────────

let _available: boolean | null = null;

export async function isElevenLabsAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  try {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
    const res  = await fetch(`${base}/api/tts/status`, { cache: 'no-store' });
    const data = await res.json();
    _available = !!data?.available;
  } catch {
    _available = false;
  }
  return _available;
}

/** Force a fresh availability check (call after API key is added) */
export function resetAvailabilityCache() { _available = null; }

// ── Audio playback via Web Audio API ─────────────────────────────────────────

let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new AudioContext();
  }
  return _audioCtx;
}

let _currentSource: AudioBufferSourceNode | null = null;

function stopCurrent() {
  try { _currentSource?.stop(); } catch {}
  _currentSource = null;
}

// ── LRU text → ArrayBuffer cache (max 20 entries) ────────────────────────────

const CACHE_MAX = 20;
const _cache   = new Map<string, ArrayBuffer>();

function cacheKey(text: string, voiceId: string): string {
  return `${voiceId}::${text.trim().slice(0, 120)}`;
}

function cacheGet(key: string): ArrayBuffer | null {
  const v = _cache.get(key);
  if (!v) return null;
  _cache.delete(key);
  _cache.set(key, v);
  return v;
}

function cacheSet(key: string, buf: ArrayBuffer) {
  if (_cache.size >= CACHE_MAX) {
    _cache.delete(_cache.keys().next().value!);
  }
  _cache.set(key, buf);
}

// ── Core generation function ──────────────────────────────────────────────────

export interface GenerateSpeechOptions {
  tone?:            VoiceTone;
  profile?:         ApexVoiceProfile;
  onAmplitude?:     (v: number) => void;
  onEnd?:           () => void;
  onError?:         (err: Error) => void;
}

/**
 * Generate speech via the API server → ElevenLabs pipeline and play it
 * through the Web Audio API.
 *
 * @param text     Cleaned text to speak (max 600 chars enforced server-side)
 * @param options  Tone, custom profile, and lifecycle callbacks
 * @returns        Promise that resolves when audio has STARTED playing
 */
export async function speakWithElevenLabs(
  text: string,
  options: GenerateSpeechOptions = {}
): Promise<void> {
  const { tone, profile, onAmplitude, onEnd, onError } = options;

  // Profile precedence: explicit > tone-derived > default
  const resolved: ApexVoiceProfile =
    profile ??
    (tone ? APEX_VOICE_PROFILES[tone] : null) ??
    APEX_DEFAULT_VOICE_PROFILE;

  const key = cacheKey(text, resolved.voiceId);

  try {
    stopCurrent();

    let audioData = cacheGet(key);
    if (!audioData) {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
      const res  = await fetch(`${base}/api/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId:          resolved.voiceId,
          stability:        resolved.stability,
          similarity_boost: resolved.similarity_boost,
          style:            resolved.style,
        }),
      });

      if (!res.ok) {
        throw new Error(`TTS generation failed: ${res.status}`);
      }

      audioData = await res.arrayBuffer();
      cacheSet(key, audioData.slice(0)); // store a copy
    }

    // Decode and play
    const ctx    = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const decoded = await ctx.decodeAudioData(audioData.slice(0));
    const source  = ctx.createBufferSource();
    source.buffer = decoded;

    // Amplitude analyser for avatar animation
    if (onAmplitude) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let rafId  = 0;

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.slice(0, 32).reduce((s, v) => s + v, 0) / 32 / 255;
        onAmplitude(Math.min(1, avg * 1.6));
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      source.onended = () => {
        cancelAnimationFrame(rafId);
        onAmplitude(0);
        onEnd?.();
      };
    } else {
      source.connect(ctx.destination);
      source.onended = () => onEnd?.();
    }

    _currentSource = source;
    source.start(0);
  } catch (err) {
    onAmplitude?.(0);
    onEnd?.();
    onError?.(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}

/** Stop any currently playing ElevenLabs audio */
export function stopElevenLabsSpeech() { stopCurrent(); }

/** Resolve the ElevenLabs voice profile for a given tone */
export function getVoiceProfileForTone(tone: VoiceTone): ApexVoiceProfile {
  return APEX_VOICE_PROFILES[tone] ?? APEX_DEFAULT_VOICE_PROFILE;
}
