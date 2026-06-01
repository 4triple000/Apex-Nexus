/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  VOICE TONE ANALYSIS — Real-time emotional state from audio      ║
 * ║  Web Audio API: AnalyserNode FFT → pitch · volume · energy       ║
 * ║  No external libraries. Privacy-respecting. Non-blocking.        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import { useState, useRef, useCallback, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoiceEmotion =
  | 'excited' | 'confident' | 'frustrated' | 'stressed'
  | 'calm'    | 'tired'     | 'neutral';

export interface VoiceFeatures {
  volume:   number; // 0–1  (RMS amplitude)
  pitch:    number; // 0–1  (spectral centroid, proxy for perceived pitch)
  energy:   number; // 0–1  (average frequency magnitude)
  variance: number; // 0–1  (volume variance over recent history = speech dynamism)
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const KEY_ENABLED       = 'apex_voice_tone_enabled';
const KEY_STORE_HISTORY = 'apex_voice_tone_store_history';

// ── Emotion detection from audio features ─────────────────────────────────────

function detectEmotionFromFeatures(f: VoiceFeatures): VoiceEmotion {
  const { volume, pitch, energy, variance } = f;

  // Any silence / near-silence → neutral immediately
  if (volume < 0.06 && energy < 0.06) return 'neutral';

  // excited:     high pitch + high variance + decent energy
  if (pitch > 0.62 && variance > 0.38 && energy > 0.30) return 'excited';

  // stressed:    high pitch + high volume + high energy
  if (pitch > 0.58 && volume > 0.68 && energy > 0.45) return 'stressed';

  // frustrated:  high volume + high variance, pitch is mid-range
  if (volume > 0.68 && variance > 0.48) return 'frustrated';

  // confident:   medium pitch, low-mid variance, decent energy
  if (pitch > 0.42 && pitch < 0.65 && variance < 0.33 && energy > 0.28) return 'confident';

  // tired:       low energy + low variance + low volume
  if (energy < 0.18 && variance < 0.20 && volume < 0.22) return 'tired';

  // calm:        low pitch + steady variance
  if (pitch < 0.40 && variance < 0.33) return 'calm';

  return 'neutral';
}

// ── Human-readable labels ─────────────────────────────────────────────────────

export const VOICE_EMOTION_LABELS: Record<VoiceEmotion, string> = {
  excited:    'Excited',
  confident:  'Confident',
  frustrated: 'Frustrated',
  stressed:   'Stressed',
  calm:       'Calm',
  tired:      'Tired',
  neutral:    'Neutral',
};

export const VOICE_EMOTION_EMOJI: Record<VoiceEmotion, string> = {
  excited:    '⚡',
  confident:  '💪',
  frustrated: '😤',
  stressed:   '😰',
  calm:       '😌',
  tired:      '😴',
  neutral:    '😐',
};

export const VOICE_EMOTION_COLOR: Record<VoiceEmotion, string> = {
  excited:    '#F59E0B',
  confident:  '#10B981',
  frustrated: '#EF4444',
  stressed:   '#EC4899',
  calm:       '#A29BFE',
  tired:      '#6C5CE7',
  neutral:    'rgba(255,255,255,0.40)',
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface VoiceToneAPI {
  voiceEmotion:       VoiceEmotion;
  features:           VoiceFeatures;
  isActive:           boolean;
  enabled:            boolean;
  storeHistory:       boolean;
  start:              (stream: MediaStream) => void;
  stop:               () => void;
  toggle:             () => void;
  toggleStoreHistory: () => void;
}

export function useVoiceToneAnalysis(): VoiceToneAPI {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(KEY_ENABLED) !== 'false'; } catch { return true; }
  });
  const [storeHistory, setStoreHistory] = useState(() => {
    try { return localStorage.getItem(KEY_STORE_HISTORY) !== 'false'; } catch { return true; }
  });
  const [voiceEmotion, setVoiceEmotion] = useState<VoiceEmotion>('neutral');
  const [features,     setFeatures]     = useState<VoiceFeatures>({ volume: 0, pitch: 0, energy: 0, variance: 0 });
  const [isActive,     setIsActive]     = useState(false);

  const audioCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const sourceRef      = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef         = useRef<number | null>(null);
  const enabledRef     = useRef(enabled);
  const volumeHistory  = useRef<number[]>([]);
  const lastUpdateRef  = useRef<number>(0);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    try { sourceRef.current?.disconnect();  } catch {}
    try { analyserRef.current?.disconnect(); } catch {}
    try { audioCtxRef.current?.close();     } catch {}
    sourceRef.current   = null;
    analyserRef.current = null;
    audioCtxRef.current = null;
    volumeHistory.current = [];
    setIsActive(false);
    setVoiceEmotion('neutral');
    setFeatures({ volume: 0, pitch: 0, energy: 0, variance: 0 });
  }, []);

  // ── Start analysis on a live MediaStream ──────────────────────────────────

  const start = useCallback((stream: MediaStream) => {
    if (!enabledRef.current) return;
    stop();

    try {
      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize               = 2048;
      analyser.smoothingTimeConstant = 0.80; // heavy smoothing = less jitter

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      // DO NOT connect to ctx.destination — no echo/loopback

      audioCtxRef.current  = ctx;
      analyserRef.current  = analyser;
      sourceRef.current    = source;
      setIsActive(true);

      const timeDomain = new Uint8Array(analyser.fftSize);
      const freqDomain = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current || !audioCtxRef.current) return;

        analyser.getByteTimeDomainData(timeDomain);
        analyser.getByteFrequencyData(freqDomain);

        // ── RMS volume ────────────────────────────────────────────────────────
        let sumSq = 0;
        for (let i = 0; i < timeDomain.length; i++) {
          const v = (timeDomain[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / timeDomain.length);

        // ── Spectral centroid (pitch proxy) ───────────────────────────────────
        let weightedIdx = 0;
        let totalMag    = 0;
        for (let i = 0; i < freqDomain.length; i++) {
          const mag = freqDomain[i] / 255;
          weightedIdx += i * mag;
          totalMag    += mag;
        }
        const centroid  = totalMag > 0 ? (weightedIdx / totalMag) / freqDomain.length : 0;
        const avgEnergy = totalMag / freqDomain.length;

        // ── Volume variance (speech dynamism) ─────────────────────────────────
        const hist = volumeHistory.current;
        hist.push(rms);
        if (hist.length > 80) hist.shift(); // ~4s at 60fps

        let histMean = 0;
        for (let i = 0; i < hist.length; i++) histMean += hist[i];
        histMean /= hist.length || 1;

        let histVar = 0;
        for (let i = 0; i < hist.length; i++) histVar += (hist[i] - histMean) ** 2;
        const variance = hist.length > 1 ? Math.sqrt(histVar / hist.length) : 0;

        // ── Normalize to 0–1 ranges ───────────────────────────────────────────
        const f: VoiceFeatures = {
          volume:   Math.min(1, rms      * 4.5),
          pitch:    Math.min(1, centroid * 2.8),
          energy:   Math.min(1, avgEnergy * 2.8),
          variance: Math.min(1, variance  * 9.0),
        };
        setFeatures(f);

        // Throttle emotion detection to every 800ms — prevents flickering
        const now = Date.now();
        if (now - lastUpdateRef.current > 800) {
          setVoiceEmotion(detectEmotionFromFeatures(f));
          lastUpdateRef.current = now;
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.warn('[VoiceTone] AudioContext unavailable:', err);
    }
  }, [stop]);

  // ── Toggles ────────────────────────────────────────────────────────────────

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      enabledRef.current = next;
      try { localStorage.setItem(KEY_ENABLED, String(next)); } catch {}
      if (!next) stop();
      return next;
    });
  }, [stop]);

  const toggleStoreHistory = useCallback(() => {
    setStoreHistory((prev) => {
      const next = !prev;
      try { localStorage.setItem(KEY_STORE_HISTORY, String(next)); } catch {}
      return next;
    });
  }, []);

  return {
    voiceEmotion, features, isActive, enabled, storeHistory,
    start, stop, toggle, toggleStoreHistory,
  };
}
